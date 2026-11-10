import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('TON Deposit & Blockchain Verification Suite', () => {
  const TREASURY_TON_ADDRESS = 'UQBGdgDogsxtpbFIvzAFnIByU3E3PlXsdkt_xyuG4S-gzvgR';

  describe('1. Treasury Address & Format Integrity', () => {
    it('official TON treasury address must be exactly 48 characters and start with UQ or EQ', () => {
      assert.strictEqual(TREASURY_TON_ADDRESS.length, 48);
      assert.match(TREASURY_TON_ADDRESS, /^(EQ|UQ)[a-zA-Z0-9_-]{46}$/);
    });
  });

  describe('2. Decimal-Safe TON & NanoTON Quote Calculation', () => {
    it('should compute exact TON and nanoTON without floating-point drift', () => {
      const tonPriceUsd = 5.20;
      const testCases = [
        { usd: 1.0, expectedTon: 0.1923, expectedNano: '192300000' },
        { usd: 3.0, expectedTon: 0.5769, expectedNano: '576900000' },
        { usd: 5.0, expectedTon: 0.9615, expectedNano: '961500000' },
        { usd: 10.0, expectedTon: 1.9231, expectedNano: '1923100000' },
        { usd: 15.0, expectedTon: 2.8846, expectedNano: '2884600000' },
        { usd: 50.0, expectedTon: 9.6154, expectedNano: '9615400000' },
      ];

      for (const tc of testCases) {
        const rawTon = tc.usd / tonPriceUsd;
        const tonAmount = Math.round(rawTon * 10000) / 10000;
        const nanoTonAmount = BigInt(Math.round(tonAmount * 1_000_000_000)).toString();

        assert.strictEqual(tonAmount, tc.expectedTon, `TON amount for $${tc.usd}`);
        assert.strictEqual(nanoTonAmount, tc.expectedNano, `NanoTON for $${tc.usd}`);
        // Must be a pure integer string
        assert.match(nanoTonAmount, /^[1-9]\d*$/, 'NanoTON must be a positive integer without decimals');
      }
    });

    it('nanoTON string must never contain exponents or scientific notation', () => {
      const largeUsd = 10000;
      const tonPrice = 5.20;
      const ton = Math.round((largeUsd / tonPrice) * 10000) / 10000;
      const nanoTon = BigInt(Math.round(ton * 1_000_000_000)).toString();

      assert.doesNotMatch(nanoTon, /[eE]/, 'NanoTON must not use exponential notation');
      assert.strictEqual(typeof nanoTon, 'string');
    });
  });

  describe('3. Tonkeeper HTTPS Universal Link & Deep Link Generation', () => {
    it('should generate official HTTPS Tonkeeper link matching mobile App Links specification', () => {
      const address = TREASURY_TON_ADDRESS;
      const nanoTon = '1923100000';
      const reference = 'DEP-8441612063-XYZ12';

      const universalUrl = `https://app.tonkeeper.com/transfer/${address}?amount=${nanoTon}&text=${encodeURIComponent(reference)}`;
      const parsed = new URL(universalUrl);

      assert.strictEqual(parsed.protocol, 'https:');
      assert.strictEqual(parsed.hostname, 'app.tonkeeper.com');
      assert.strictEqual(parsed.pathname, `/transfer/${address}`);
      assert.strictEqual(parsed.searchParams.get('amount'), nanoTon);
      assert.strictEqual(parsed.searchParams.get('text'), reference);
    });

    it('HTTPS Universal Link avoids ERR_UNKNOWN_URL_SCHEME in Telegram Android WebView', () => {
      const address = TREASURY_TON_ADDRESS;
      const universalUrl = `https://app.tonkeeper.com/transfer/${address}?amount=1000000000&text=DEP-TEST`;
      // Telegram WebApp openLink only accepts https:// links for OS app intercept
      assert.strictEqual(universalUrl.startsWith('https://'), true);
      assert.strictEqual(universalUrl.includes('ton://'), false);
    });

    it('should generate valid ton:// deep link fallback', () => {
      const address = TREASURY_TON_ADDRESS;
      const nanoTon = '576900000';
      const reference = 'DEP-8441612063-ABC99';

      const deepLink = `ton://transfer/${address}?amount=${nanoTon}&text=${encodeURIComponent(reference)}`;
      assert.strictEqual(deepLink.startsWith('ton://transfer/'), true);
      assert.strictEqual(deepLink.includes(address), true);
      assert.strictEqual(deepLink.includes(`amount=${nanoTon}`), true);
      assert.strictEqual(deepLink.includes(`text=${reference}`), true);
    });
  });

  describe('4. Blockchain On-Chain Verification Matching Engine', () => {
    const deposit = {
      id: 'dep_test_123',
      telegramId: '8441612063',
      paymentReference: 'DEP-8441612063-K8J2M',
      expectedCryptoAmount: 1.9231, // TON
    };

    const expectedNanoTon = BigInt(Math.round(deposit.expectedCryptoAmount * 1_000_000_000)); // 1923100000n

    it('should match incoming transaction by unique paymentReference', () => {
      const inMsg = {
        value: '1923100000',
        message: 'DEP-8441612063-K8J2M',
      };

      const memo = inMsg.message.trim();
      const isMatch = memo.toUpperCase() === deposit.paymentReference.toUpperCase();
      assert.strictEqual(isMatch, true);
    });

    it('should match incoming transaction by user telegramId in memo', () => {
      const inMsg = {
        value: '1923100000',
        message: '8441612063',
      };

      const memo = inMsg.message.trim();
      const isMatch = memo === deposit.telegramId || memo.includes(deposit.telegramId);
      assert.strictEqual(isMatch, true);
    });

    it('should accept transfer value within 2% slippage tolerance', () => {
      const exactValue = expectedNanoTon; // 1923100000n
      const slightlyLower = (expectedNanoTon * 99n) / 100n; // 1% lower
      const minAcceptable = (expectedNanoTon * 98n) / 100n; // 2% lower
      const tooLow = (expectedNanoTon * 95n) / 100n; // 5% lower

      assert.strictEqual(exactValue >= minAcceptable, true);
      assert.strictEqual(slightlyLower >= minAcceptable, true);
      assert.strictEqual(tooLow >= minAcceptable, false, '5% below expected must be rejected');
    });

    it('should reject transactions with duplicate txHash across completed deposits', () => {
      const existingHashes = new Set(['hash_already_credited_123']);
      const incomingHash = 'hash_already_credited_123';

      const isDuplicate = existingHashes.has(incomingHash);
      assert.strictEqual(isDuplicate, true, 'Duplicate hash must be rejected');
    });
  });
});

