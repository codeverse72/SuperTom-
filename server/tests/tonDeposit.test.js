import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TonPriceService } from '../dist/modules/payouts/tonPriceService.js';
import { TonBlockchainService } from '../dist/modules/payouts/tonBlockchainService.js';

describe('TON Deposit & Blockchain Verification Suite', () => {
  describe('1. TON USD to nanoTON Precision Arithmetic', () => {
    it('should convert USD to nanoTON with high precision decimal integer arithmetic', async () => {
      const conversion = await TonPriceService.convertUsdToNanoTon(5.0);
      
      assert.strictEqual(conversion.amountUsd, 5.0);
      assert.ok(conversion.tonPriceUsd > 0, 'Price must be positive');
      assert.ok(conversion.nanoTon > 0n, 'NanoTON must be positive bigint');
      assert.strictEqual(typeof conversion.nanoTonString, 'string');
      assert.strictEqual(conversion.nanoTon.toString(), conversion.nanoTonString);

      // Verify mathematical relationship: tonAmount * 1e9 == nanoTon (within integer rounding)
      const expectedNano = BigInt(Math.round(conversion.tonAmount * 1e9));
      const diff = conversion.nanoTon > expectedNano ? conversion.nanoTon - expectedNano : expectedNano - conversion.nanoTon;
      assert.ok(diff < 1000n, 'Difference between tonAmount and nanoTon must be within tiny rounding bound');
    });

    it('should handle standard tier amounts accurately ($1, $3, $5, $10, $15, $50)', async () => {
      const tiers = [1, 3, 5, 10, 15, 50];
      for (const tier of tiers) {
        const conv = await TonPriceService.convertUsdToNanoTon(tier);
        assert.strictEqual(conv.amountUsd, tier);
        assert.ok(conv.nanoTon > 0n);
        // $10 must be approx 2x of $5
        if (tier === 10) {
          const conv5 = await TonPriceService.convertUsdToNanoTon(5);
          const ratio = Number(conv.nanoTon) / Number(conv5.nanoTon);
          assert.ok(Math.abs(ratio - 2.0) < 0.01, '10 USD should equal 2x 5 USD in nanoTON');
        }
      }
    });
  });

  describe('2. Transaction Comment Decoder', () => {
    it('should decode plain text comment string', () => {
      const inMsg = { message: 'ST-DEP-XYZ123-12345678' };
      const comment = TonBlockchainService.decodeComment(inMsg);
      assert.strictEqual(comment, 'ST-DEP-XYZ123-12345678');
    });

    it('should decode base64 comment from Toncenter v2', () => {
      const plain = 'ST-DEP-ABC999-55555555';
      const base64 = Buffer.from(plain).toString('base64');
      const inMsg = { msg_data: { '@type': 'msg.dataText', text: base64 } };
      const comment = TonBlockchainService.decodeComment(inMsg);
      assert.strictEqual(comment, plain);
    });

    it('should decode binary hex body with 0x00000000 opcode prefix', () => {
      const plain = 'ST-DEP-TEST45-77777777';
      const prefix = Buffer.from([0, 0, 0, 0]);
      const textBuf = Buffer.from(plain, 'utf8');
      const fullBuf = Buffer.concat([prefix, textBuf]);
      const inMsg = { msg_data: { '@type': 'msg.dataRaw', body: fullBuf.toString('hex') } };
      const comment = TonBlockchainService.decodeComment(inMsg);
      assert.strictEqual(comment, plain);
    });

    it('should return empty string for missing or null message payload', () => {
      assert.strictEqual(TonBlockchainService.decodeComment(null), '');
      assert.strictEqual(TonBlockchainService.decodeComment(undefined), '');
      assert.strictEqual(TonBlockchainService.decodeComment({}), '');
    });
  });

  describe('3. Matching On-Chain Transaction Verification', () => {
    const receivingAddress = 'UQBGdgDogaxtpbFIvzAFnIByU3E3Plxsdkt_xyuG4S-gzvgR';
    const depositCreatedAt = new Date();
    const expectedNanoTon = 2_500_000_000n; // 2.5 TON
    const depositReference = 'ST-DEP-998877-12345678';
    const telegramId = '12345678';

    it('should successfully match a genuine transaction with exact reference and amount', () => {
      const txs = [
        {
          txHash: '0xabc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abc',
          senderAddress: 'EQD__________________________________________0vo',
          receivingAddress,
          receivedNanoTon: 2_500_000_000n,
          receivedTonAmount: 2.5,
          comment: depositReference,
          timestamp: new Date(depositCreatedAt.getTime() + 10_000),
          rawTx: {},
        },
      ];

      const match = TonBlockchainService.findMatchingDepositTransaction(txs, {
        depositId: 'some-uuid-1',
        paymentReference: depositReference,
        telegramId,
        expectedNanoTon,
        depositCreatedAt,
      });

      assert.ok(match !== null, 'Match must be found');
      assert.strictEqual(match?.txHash, txs[0].txHash);
      assert.strictEqual(match?.receivedNanoTon, 2_500_000_000n);
    });

    it('should match transaction when comment contains Telegram ID as fallback', () => {
      const txs = [
        {
          txHash: '0xtgmatch1234567890abcdef1234567890abcdef1234567890abcdef1234567',
          senderAddress: 'EQD__________________________________________0vo',
          receivingAddress,
          receivedNanoTon: 2_500_000_000n,
          receivedTonAmount: 2.5,
          comment: `Deposit user ${telegramId}`,
          timestamp: new Date(depositCreatedAt.getTime() + 15_000),
          rawTx: {},
        },
      ];

      const match = TonBlockchainService.findMatchingDepositTransaction(txs, {
        depositId: 'some-uuid-2',
        paymentReference: depositReference,
        telegramId,
        expectedNanoTon,
        depositCreatedAt,
      });

      assert.ok(match !== null, 'Fallback telegram ID match must be accepted');
      assert.strictEqual(match?.txHash, txs[0].txHash);
    });

    it('should accept amount within 5% tolerance due to exchange rate movement', () => {
      const txs = [
        {
          txHash: '0xtolerance1234567890abcdef1234567890abcdef1234567890abcdef12345',
          senderAddress: 'EQD__________________________________________0vo',
          receivingAddress,
          receivedNanoTon: 2_400_000_000n, // 96% of 2.5 TON (>= 95%)
          receivedTonAmount: 2.4,
          comment: depositReference,
          timestamp: new Date(depositCreatedAt.getTime() + 10_000),
          rawTx: {},
        },
      ];

      const match = TonBlockchainService.findMatchingDepositTransaction(txs, {
        depositId: 'some-uuid-3',
        paymentReference: depositReference,
        telegramId,
        expectedNanoTon,
        depositCreatedAt,
      });

      assert.ok(match !== null, 'Transaction within 5% tolerance must be accepted');
    });

    it('should reject transaction with insufficient amount (< 95% of expected)', () => {
      const txs = [
        {
          txHash: '0xtooreduced1234567890abcdef1234567890abcdef1234567890abcdef123',
          senderAddress: 'EQD__________________________________________0vo',
          receivingAddress,
          receivedNanoTon: 2_000_000_000n, // 80% of 2.5 TON (< 95%)
          receivedTonAmount: 2.0,
          comment: depositReference,
          timestamp: new Date(depositCreatedAt.getTime() + 10_000),
          rawTx: {},
        },
      ];

      const match = TonBlockchainService.findMatchingDepositTransaction(txs, {
        depositId: 'some-uuid-4',
        paymentReference: depositReference,
        telegramId,
        expectedNanoTon,
        depositCreatedAt,
      });

      assert.strictEqual(match, null, 'Underpaid transaction must be rejected');
    });

    it('should reject transaction with unrelated comment', () => {
      const txs = [
        {
          txHash: '0xrandomtx1234567890abcdef1234567890abcdef1234567890abcdef12345',
          senderAddress: 'EQD__________________________________________0vo',
          receivingAddress,
          receivedNanoTon: 2_500_000_000n,
          receivedTonAmount: 2.5,
          comment: 'Random gift from friend',
          timestamp: new Date(depositCreatedAt.getTime() + 10_000),
          rawTx: {},
        },
      ];

      const match = TonBlockchainService.findMatchingDepositTransaction(txs, {
        depositId: 'some-uuid-5',
        paymentReference: depositReference,
        telegramId,
        expectedNanoTon,
        depositCreatedAt,
      });

      assert.strictEqual(match, null, 'Unrelated transaction comment must not be matched');
    });
  });
});

