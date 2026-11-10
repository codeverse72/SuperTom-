import { describe, it } from 'node:test';
import assert from 'node:assert';
import { DepositVerificationService } from '../dist/modules/payouts/depositVerificationService.js';

describe('Multi-Chain Deposit & Amount Conversion Suite', () => {
  const TREASURY_EVM = '0xc25C9522eD01EC3C857d44133F33F7A765aB7eB1';
  const TREASURY_TRON = 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv';
  const TREASURY_TON = 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';
  const TREASURY_SOL = 'ER74j5s2PgVPx9dsT7wqyMSM7RgY4LKrFt9c1NFp92Qk';

  describe('1. Centralized Base Unit Precision (toBaseUnits)', () => {
    it('should accurately convert standard and custom amounts to base units without float drift', () => {
      // TON: 9 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(1.5, 9), '1500000000');
      assert.strictEqual(DepositVerificationService.toBaseUnits(0.1923, 9), '192300000');
      assert.strictEqual(DepositVerificationService.toBaseUnits(10.0, 9), '10000000000');

      // USDT BEP20: 18 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(10.0, 18), '10000000000000000000');
      assert.strictEqual(DepositVerificationService.toBaseUnits(1.0, 18), '1000000000000000000');
      assert.strictEqual(DepositVerificationService.toBaseUnits(5.5, 18), '5500000000000000000');

      // USDT TRC20: 6 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(10.0, 6), '10000000');
      assert.strictEqual(DepositVerificationService.toBaseUnits(1.5, 6), '1500000');

      // BNB: 18 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(0.01538, 18), '15380000000000000');

      // TRX: 6 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(40.0, 6), '40000000');

      // SOL: 9 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(0.0555, 9), '55500000');

      // USDC Base: 6 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(10.0, 6), '10000000');

      // ETH Base: 18 decimals
      assert.strictEqual(DepositVerificationService.toBaseUnits(0.00384, 18), '3840000000000000');
    });

    it('base unit string must never contain scientific notation or exponents', () => {
      const largeBnb = DepositVerificationService.toBaseUnits(100.0, 18);
      assert.strictEqual(largeBnb, '100000000000000000000');
      assert.doesNotMatch(largeBnb, /[eE]/);

      const largeTon = DepositVerificationService.toBaseUnits(10000.0, 9);
      assert.strictEqual(largeTon, '10000000000000');
      assert.doesNotMatch(largeTon, /[eE]/);
    });
  });

  describe('2. TON (Toncoin) Quote & URL Synchronization', () => {
    it('TON amount in SuperTom and Tonkeeper must match exactly', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'TON',
        'TON',
        TREASURY_TON,
        'DEP-8441612063-ABC12'
      );

      assert.strictEqual(quote.currency, 'TON');
      assert.strictEqual(quote.decimals, 9);
      assert.ok(quote.cryptoAmount > 0);
      assert.ok(quote.rawUnits.length >= 8);

      // Verify the generated URL contains the exact rawUnits
      const url = new URL(quote.walletLinks.tonkeeperUniversalUrl);
      assert.strictEqual(url.searchParams.get('amount'), quote.rawUnits);
      assert.strictEqual(url.searchParams.get('text'), 'DEP-8441612063-ABC12');
      assert.strictEqual(url.pathname, `/transfer/${TREASURY_TON}`);
    });
  });

  describe('3. USDT (BEP20) – BNB Smart Chain (Chain ID: 56)', () => {
    it('should generate valid BEP20 contract transfer and Trust Wallet deep links', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'USDT',
        'BNB',
        TREASURY_EVM,
        'DEP-8441612063-BEP20'
      );

      assert.strictEqual(quote.decimals, 18);
      assert.strictEqual(quote.cryptoAmount, 10.0);
      assert.strictEqual(quote.rawUnits, '10000000000000000000');
      assert.strictEqual(quote.tokenContract, '0x55d398326f99059fF775485246999027B3197955');

      // EIP-681 standard URI format
      assert.ok(quote.walletLinks.eip681Uri.startsWith('ethereum:0x55d398326f99059fF775485246999027B3197955@56/transfer?'));
      assert.ok(quote.walletLinks.eip681Uri.includes(`address=${TREASURY_EVM}`));
      assert.ok(quote.walletLinks.eip681Uri.includes('uint256=10000000000000000000'));

      // Trust Wallet Send link
      assert.ok(quote.walletLinks.trustWalletUrl.includes(`address=${TREASURY_EVM}`));
      assert.ok(quote.walletLinks.trustWalletUrl.includes('asset=c20000714_t0x55d398326f99059fF775485246999027B3197955'));
    });
  });

  describe('4. USDT (TRC20) – TRON Network', () => {
    it('should generate valid TRC-20 contract transfer and TronLink / Trust Wallet links', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'USDT',
        'TRON',
        TREASURY_TRON,
        'DEP-8441612063-TRC20'
      );

      assert.strictEqual(quote.decimals, 6);
      assert.strictEqual(quote.cryptoAmount, 10.0);
      assert.strictEqual(quote.rawUnits, '10000000');
      assert.strictEqual(quote.tokenContract, 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

      // TRON URI
      assert.ok(quote.walletLinks.tronUri.startsWith(`tron:${TREASURY_TRON}?token=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`));
      assert.ok(quote.walletLinks.tronUri.includes('amount=10000000'));

      // Trust Wallet
      assert.ok(quote.walletLinks.trustWalletUrl.includes('asset=c195_tTR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'));
    });
  });

  describe('5. Native BNB – BNB Smart Chain (Chain ID: 56)', () => {
    it('should generate valid native BNB transfer without token contract', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'BNB',
        'BNB',
        TREASURY_EVM,
        'DEP-8441612063-BNB'
      );

      assert.strictEqual(quote.decimals, 18);
      assert.strictEqual(quote.tokenContract, null);
      assert.ok(quote.cryptoAmount > 0);
      assert.ok(BigInt(quote.rawUnits) > 0n);

      assert.ok(quote.walletLinks.eip681Uri.startsWith(`ethereum:${TREASURY_EVM}@56?value=`));
      assert.ok(quote.walletLinks.trustWalletUrl.includes('asset=c20000714'));
    });
  });

  describe('6. Native TRX – TRON Network', () => {
    it('should generate valid native TRX transfer in sun units', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'TRX',
        'TRON',
        TREASURY_TRON,
        'DEP-8441612063-TRX'
      );

      assert.strictEqual(quote.decimals, 6);
      assert.strictEqual(quote.tokenContract, null);
      assert.ok(quote.cryptoAmount > 0);

      assert.ok(quote.walletLinks.tronUri.startsWith(`tron:${TREASURY_TRON}?amount=`));
      assert.ok(quote.walletLinks.trustWalletUrl.includes('asset=c195'));
    });
  });

  describe('7. Solana (SOL) – Solana Pay Specification', () => {
    it('should generate valid Solana Pay URI with lamports, reference, and memo', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'SOL',
        'SOLANA',
        TREASURY_SOL,
        'DEP-8441612063-SOL'
      );

      assert.strictEqual(quote.decimals, 9);
      assert.strictEqual(quote.tokenContract, null);
      assert.ok(quote.cryptoAmount > 0);
      assert.ok(BigInt(quote.rawUnits) > 0n);

      assert.ok(quote.walletLinks.solanaPayUri.startsWith(`solana:${TREASURY_SOL}?amount=`));
      assert.ok(quote.walletLinks.solanaPayUri.includes('memo=DEP-8441612063-SOL'));
      assert.ok(quote.walletLinks.phantomUrl.includes('phantom.app'));
    });
  });

  describe('8. Base (USDC & ETH Separated)', () => {
    it('USDC Base must use ERC-20 contract transfer with 6 decimals', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'USDC',
        'BASE',
        TREASURY_EVM,
        'DEP-8441612063-USDC'
      );

      assert.strictEqual(quote.decimals, 6);
      assert.strictEqual(quote.cryptoAmount, 10.0);
      assert.strictEqual(quote.rawUnits, '10000000');
      assert.strictEqual(quote.tokenContract, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');

      assert.ok(quote.walletLinks.eip681Uri.startsWith('ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?'));
      assert.ok(quote.walletLinks.trustWalletUrl.includes('asset=c8453_t0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'));
    });

    it('ETH Base must use native ETH transfer with 18 decimals and no token contract', async () => {
      const quote = await DepositVerificationService.calculateMultiChainQuote(
        10.0,
        'ETH',
        'BASE',
        TREASURY_EVM,
        'DEP-8441612063-ETH'
      );

      assert.strictEqual(quote.decimals, 18);
      assert.strictEqual(quote.tokenContract, null);
      assert.ok(quote.cryptoAmount > 0);

      assert.ok(quote.walletLinks.eip681Uri.startsWith(`ethereum:${TREASURY_EVM}@8453?value=`));
      assert.ok(quote.walletLinks.trustWalletUrl.includes('asset=c8453&'));
    });
  });
});
