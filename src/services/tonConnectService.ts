import { TonConnectUI, ConnectedWallet } from '@tonconnect/ui';

/**
 * Serializes a TON text comment into a standard single-cell BoC base64 payload
 * using 100% browser-native Uint8Array and window.btoa (Zero Node.js Buffer dependencies).
 * Opcode: 0x00000000 (32-bit zero integer) + UTF-8 comment text.
 */
function createCommentBoc(commentText: string): string {
  if (!commentText || !commentText.trim()) return '';
  try {
    const textBytes = new TextEncoder().encode(commentText.trim());
    if (textBytes.length > 120) {
      return '';
    }
    const dataLen = 4 + textBytes.length;
    const cellLen = 2 + dataLen;
    const d2 = dataLen * 2;

    const boc = new Uint8Array([
      0xb5, 0xee, 0x9c, 0x72,
      0x01, 0x01, 0x01, 0x01, 0x00,
      cellLen,
      0x00,
      0x00,
      d2,
      0x00, 0x00, 0x00, 0x00,
      ...textBytes,
    ]);

    let binary = '';
    const len = boc.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(boc[i]);
    }
    return typeof window !== 'undefined' ? window.btoa(binary) : '';
  } catch (err) {
    console.warn('[TonConnectService] Failed to encode comment BoC:', err);
    return '';
  }
}

class TonConnectService {
  private tonConnectUI: TonConnectUI | null = null;
  private isInitializing: boolean = false;

  public getTonConnectUI(): TonConnectUI | null {
    if (typeof window === 'undefined') return null;
    if (!this.tonConnectUI && !this.isInitializing) {
      try {
        this.isInitializing = true;
        const origin = window.location.origin || 'https://super-tom.vercel.app';
        const manifestUrl = `${origin}/tonconnect-manifest.json`;

        this.tonConnectUI = new TonConnectUI({
          manifestUrl,
          actionsConfiguration: {
            twaReturnUrl: 'https://t.me/supertom_earn_bot' as `${string}://${string}`,
            returnStrategy: 'back',
          },
        });
      } catch (err) {
        console.warn('[TonConnectService] Failed to initialize TonConnectUI:', err);
      } finally {
        this.isInitializing = false;
      }
    }
    return this.tonConnectUI;
  }

  public isConnected(): boolean {
    const ui = this.getTonConnectUI();
    return !!ui?.connected;
  }

  public getConnectedWallet(): ConnectedWallet | null {
    const ui = this.getTonConnectUI();
    return (ui?.wallet as ConnectedWallet) || null;
  }

  public async connectWallet(): Promise<ConnectedWallet | null> {
    const ui = this.getTonConnectUI();
    if (!ui) throw new Error('TON Connect is not initialized');

    if (ui.connected && ui.wallet) {
      return ui.wallet as ConnectedWallet;
    }

    await ui.openModal();

    return new Promise((resolve) => {
      const unsubscribe = ui.onStatusChange((wallet) => {
        if (wallet) {
          unsubscribe();
          resolve(wallet as ConnectedWallet);
        }
      });

      const unsubscribeModal = ui.onModalStateChange((state) => {
        if (state.status === 'closed' && !ui.connected) {
          unsubscribe();
          unsubscribeModal();
          resolve(null);
        }
      });
    });
  }

  public async disconnectWallet(): Promise<void> {
    const ui = this.getTonConnectUI();
    if (ui && ui.connected) {
      await ui.disconnect();
    }
  }

  /**
   * Encodes a plain text comment into a standard TON BoC base64 payload.
   * Format: 32 zero bits (0x00000000) followed by the UTF-8 comment text.
   */
  public encodeCommentPayload(commentText: string): string {
    return createCommentBoc(commentText);
  }

  /**
   * Requests a TON transaction with prefilled recipient, nanoTON amount, and comment payload.
   */
  public async sendDepositTransaction(params: {
    receivingAddress: string;
    nanoTon: string;
    comment: string;
  }): Promise<{ success: boolean; boc?: string; error?: string }> {
    const ui = this.getTonConnectUI();
    if (!ui) {
      return { success: false, error: 'TON Connect UI is not available' };
    }

    // If wallet not connected, prompt connect
    if (!ui.connected) {
      const connected = await this.connectWallet();
      if (!connected) {
        return { success: false, error: 'Wallet connection cancelled' };
      }
    }

    const payloadBoc = this.encodeCommentPayload(params.comment);
    const validUntil = Math.floor(Date.now() / 1000) + 600; // 10 minutes

    try {
      const res = await ui.sendTransaction({
        validUntil,
        messages: [
          {
            address: params.receivingAddress,
            amount: params.nanoTon,
            payload: payloadBoc || undefined,
          },
        ],
      });

      return {
        success: true,
        boc: res.boc,
      };
    } catch (err: any) {
      console.error('[TonConnectService] sendTransaction failed:', err);
      return {
        success: false,
        error: err.message || 'Transaction was rejected or failed in wallet',
      };
    }
  }
}

export const tonConnectService = new TonConnectService();

