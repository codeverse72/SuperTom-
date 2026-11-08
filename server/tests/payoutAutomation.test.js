import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PayoutAutomationService } from '../dist/modules/payoutAutomation/payoutAutomationService.js';

describe('Payout Channel Automation Suite', () => {
  describe('1. Channel Identifier Normalization', () => {
    test('should normalize bare username with @ prefix', () => {
      assert.strictEqual(PayoutAutomationService.normalizeChannelId('SuperTomPayouts'), '@SuperTomPayouts');
    });

    test('should preserve existing @ prefix', () => {
      assert.strictEqual(PayoutAutomationService.normalizeChannelId('@SuperTomPayouts'), '@SuperTomPayouts');
    });

    test('should strip https://t.me/ prefix for standard channels', () => {
      assert.strictEqual(PayoutAutomationService.normalizeChannelId('https://t.me/SuperTomPayouts'), '@SuperTomPayouts');
    });

    test('should preserve telegram private channel IDs starting with -', () => {
      assert.strictEqual(PayoutAutomationService.normalizeChannelId('-1001234567890'), '-1001234567890');
    });
  });

  describe('2. Blockchain Explorer URL Generator', () => {
    const sampleHash = '3a2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b';

    test('should generate valid Tronscan link for TRC20', () => {
      const url = PayoutAutomationService.getExplorerUrl('TRC20', sampleHash);
      assert.strictEqual(url, `https://tronscan.org/#/transaction/${sampleHash}`);
    });

    test('should generate valid Tonviewer link for TON', () => {
      const url = PayoutAutomationService.getExplorerUrl('TON', sampleHash);
      assert.strictEqual(url, `https://tonviewer.com/transaction/${sampleHash}`);
    });

    test('should generate valid BscScan link for BEP20', () => {
      const url = PayoutAutomationService.getExplorerUrl('BEP20', sampleHash);
      assert.strictEqual(url, `https://bscscan.com/tx/${sampleHash}`);
    });

    test('should generate valid Solscan link for Solana', () => {
      const url = PayoutAutomationService.getExplorerUrl('SOL', sampleHash);
      assert.strictEqual(url, `https://solscan.io/tx/${sampleHash}`);
    });
  });

  describe('3. Player Privacy Masking', () => {
    test('should mask Telegram username with asterisks', () => {
      const masked = PayoutAutomationService.maskIdentity('@alexander123');
      assert.strictEqual(masked, '@al***');
    });

    test('should mask blockchain wallet address displaying prefix and suffix', () => {
      const masked = PayoutAutomationService.maskIdentity('TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv');
      assert.strictEqual(masked, 'TJLEg...shCv');
    });
  });

  describe('4. Reference Message Format Analysis & Extraction', () => {
    const sampleReferencePost = `
✅ Withdrawal Completed!
💰 Amount: 15.50 USDT ($15.50)
👤 User: @crypto_miner
🔗 Tx: 7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a
🌐 Explorer: https://tronscan.org/#/transaction/7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a
🚀 Instant automatic payout processed!
    `;

    test('should extract emojis, currency, amount, and tx hash accurately', () => {
      const analysis = PayoutAutomationService.analyzeReferenceMessage(sampleReferencePost);

      assert.strictEqual(analysis.detectedCurrency, 'USDT');
      assert.strictEqual(analysis.detectedAmount, '15.50');
      assert.strictEqual(analysis.detectedUsd, '$15.50');
      assert.ok(analysis.detectedEmojis.includes('✅') || analysis.detectedEmojis.includes('💰'));
      assert.strictEqual(analysis.detectedExplorerDomain, 'tronscan.org');
    });

    test('should produce recommended SuperTom template adhering to extracted style without proprietary leaks', () => {
      const analysis = PayoutAutomationService.analyzeReferenceMessage(sampleReferencePost);

      assert.ok(analysis.recommendedTemplate.heading.includes('SuperTom'));
      assert.strictEqual(analysis.recommendedTemplate.currencyDisplay, 'USDT');
      assert.strictEqual(analysis.recommendedTemplate.showExplorerLink, true);
      assert.strictEqual(analysis.recommendedTemplate.maskUserAddress, true);
    });
  });

  describe('5. Message Rendering & Token Substitution', () => {
    const template = {
      heading: '✅ SuperTom Withdrawal Complete',
      successMessage: 'Payment verified and transferred on-chain!',
      footer: '🐱 Thank you for mining with SuperTom! Support: @SuperTomCare',
      currencyDisplay: 'USDT',
      showUsd: true,
      showPoops: true,
      showExplorerLink: true,
      maskUserAddress: true,
    };

    test('should render markdown message with real SuperTom payout parameters', () => {
      const { message, explorerUrl } = PayoutAutomationService.renderMessage({
        template,
        network: 'TRC20',
        amountUsdt: 10.0,
        amountPoops: 20000,
        walletAddress: 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
        txHash: '7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a',
        recipientIdentifier: '@lucky_cat',
      });

      assert.ok(message.includes('*✅ SuperTom Withdrawal Complete*'));
      assert.ok(message.includes('*10.00 USDT*'));
      assert.ok(message.includes('20,000 Poops'));
      assert.ok(message.includes('@lu***')); // masked
      assert.ok(message.includes('TJLEg...shCv')); // masked
      assert.ok(message.includes('tronscan.org'));
      assert.ok(explorerUrl.includes('tronscan.org/#/transaction/7d2a58b90c1f4e3d2a1b9c8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a'));
    });

    test('should support custom tokenized raw template layout', () => {
      const customTemplate = {
        ...template,
        rawTemplate: 'PAYOUT: {amount_crypto} sent to {recipient}! Tx: {explorer_link} - {footer}',
      };

      const { message } = PayoutAutomationService.renderMessage({
        template: customTemplate,
        network: 'TRC20',
        amountUsdt: 25.5,
        amountPoops: 51000,
        walletAddress: 'TJLEgXHdGG3fxwn1UiHvpDoqz29FmJshCv',
        txHash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        recipientIdentifier: '@cryptoking',
      });

      assert.strictEqual(
        message,
        'PAYOUT: 25.50 USDT sent to @cr***! Tx: https://tronscan.org/#/transaction/1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef - 🐱 Thank you for mining with SuperTom! Support: @SuperTomCare'
      );
    });
  });
});

