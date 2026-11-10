import { logger } from '../../utils/logger.js';

export interface VerifiedTonTransaction {
  txHash: string;
  senderAddress: string;
  receivingAddress: string;
  receivedNanoTon: bigint;
  receivedTonAmount: number;
  comment: string;
  timestamp: Date;
  rawTx: Record<string, unknown>;
}

export class TonBlockchainService {
  /**
   * Decodes a TON transaction comment from various RPC response formats:
   * 1. Plain text string
   * 2. Base64 encoded comment (Toncenter API v2 msg.dataText)
   * 3. Hex-encoded body starting with opcode 0x00000000
   */
  public static decodeComment(inMsg: Record<string, unknown> | null | undefined): string {
    if (!inMsg) return '';

    // Direct plain message property
    if (typeof inMsg.message === 'string' && inMsg.message.trim()) {
      return inMsg.message.trim();
    }

    const msgData = inMsg.msg_data as Record<string, unknown> | undefined;
    if (msgData) {
      // 1. Toncenter v2 base64 text
      if (typeof msgData.text === 'string' && msgData.text.trim()) {
        try {
          const decoded = Buffer.from(msgData.text, 'base64').toString('utf8').replace(/\0/g, '').trim();
          if (decoded && /^[\x20-\x7E\s]+$/.test(decoded)) {
            return decoded;
          }
          return msgData.text.trim();
        } catch {
          return msgData.text.trim();
        }
      }

      // 2. Hex-encoded body
      if (typeof msgData.body === 'string' && msgData.body.trim()) {
        try {
          const buf = Buffer.from(msgData.body, 'hex');
          if (buf.length >= 4 && buf.readUInt32BE(0) === 0) {
            return buf.subarray(4).toString('utf8').replace(/\0/g, '').trim();
          }
          const text = buf.toString('utf8').replace(/\0/g, '').trim();
          if (/^[\x20-\x7E\s]+$/.test(text)) {
            return text;
          }
        } catch {
          // ignore
        }
      }
    }

    return '';
  }

  /**
   * Fetches recent transactions for a TON address from public blockchain RPCs
   */
  public static async fetchRecentTransactions(address: string, limit = 25): Promise<VerifiedTonTransaction[]> {
    if (!address) return [];
    const cleanAddr = address.trim();
    const results: VerifiedTonTransaction[] = [];

    // Provider 1: Official Toncenter API v2
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const url = `https://toncenter.com/api/v2/getTransactions?address=${encodeURIComponent(cleanAddr)}&limit=${limit}&archival=false`;
      
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const json = (await res.json()) as { ok?: boolean; result?: Array<Record<string, unknown>> };
        if (json.ok && Array.isArray(json.result)) {
          for (const tx of json.result) {
            const inMsg = tx.in_msg as Record<string, unknown> | undefined;
            if (!inMsg) continue;

            const valueStr = (inMsg.value as string) || '0';
            const valueBig = BigInt(valueStr);
            if (valueBig <= 0n) continue; // skip 0-value or outbound

            const txHashObj = tx.transaction_id as { hash?: string } | undefined;
            const txHash = txHashObj?.hash || (tx.hash as string) || '';
            const sender = (inMsg.source as string) || '';
            const destination = (inMsg.destination as string) || cleanAddr;
            const comment = this.decodeComment(inMsg);
            const utime = typeof tx.utime === 'number' ? tx.utime * 1000 : Date.now();

            results.push({
              txHash,
              senderAddress: sender,
              receivingAddress: destination,
              receivedNanoTon: valueBig,
              receivedTonAmount: Number(valueBig) / 1_000_000_000,
              comment,
              timestamp: new Date(utime),
              rawTx: tx,
            });
          }
          return results;
        }
      }
    } catch (err) {
      logger.warn('[TonBlockchainService] Toncenter getTransactions failed:', err);
    }

    return results;
  }

  /**
   * Matches an on-chain TON transaction against a pending deposit requirement.
   * Checks:
   * 1. Destination matches receiving wallet address.
   * 2. Transaction comment matches unique deposit ID or reference or user's Telegram ID.
   * 3. Received amount matches expected nanoTON (allows 5% tolerance for slight market moves).
   * 4. Transaction occurred around or after deposit creation.
   */
  public static findMatchingDepositTransaction(
    transactions: VerifiedTonTransaction[],
    criteria: {
      depositId: string;
      paymentReference?: string | null;
      telegramId?: string | null;
      expectedNanoTon: bigint;
      depositCreatedAt: Date;
    }
  ): VerifiedTonTransaction | null {
    const minTimestamp = new Date(criteria.depositCreatedAt.getTime() - 5 * 60 * 1000); // 5 min grace window
    // Allow 5% tolerance for price fluctuation between intent creation and wallet confirmation
    const minAcceptableNano = (criteria.expectedNanoTon * 95n) / 100n;

    for (const tx of transactions) {
      if (tx.timestamp < minTimestamp) continue;
      if (tx.receivedNanoTon < minAcceptableNano) continue;

      const normComment = tx.comment.toLowerCase().trim();
      const refMatches = criteria.paymentReference && normComment.includes(criteria.paymentReference.toLowerCase().trim());
      const idMatches = normComment.includes(criteria.depositId.toLowerCase().trim());
      const shortIdMatches = normComment.includes(criteria.depositId.slice(0, 8).toLowerCase().trim());
      const tgMatches = criteria.telegramId && normComment.includes(criteria.telegramId.trim());

      if (refMatches || idMatches || shortIdMatches || tgMatches) {
        return tx;
      }
    }

    return null;
  }
}

