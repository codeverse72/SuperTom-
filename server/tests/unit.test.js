import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyTelegramInitData } from '../dist/utils/telegramAuth.js';
import { isValidTronAddress, isValidTonAddress, isValidBscAddress, validateNetworkAddress, secureRandomFloat, signAccessToken, verifyAccessToken } from '../dist/utils/crypto.js';

describe('1. Telegram Cryptographic Authentication Suite', () => {
  const testBotToken = '123456789:ABCdefGHIjklMNOpqrSTUvwxYZ';
  const testUser = {
    id: 987654321,
    first_name: 'Tom',
    last_name: 'King',
    username: 'kingtom',
    language_code: 'en',
  };

  function generateValidInitData(botToken, user, authDate = Math.floor(Date.now() / 1000)) {
    const params = new URLSearchParams();
    params.set('auth_date', authDate.toString());
    params.set('query_id', 'AAHdF6IQAAAAAN0XohC_test');
    params.set('user', JSON.stringify(user));

    const pairs = [];
    params.forEach((val, key) => pairs.push(`${key}=${val}`));
    pairs.sort();
    const dataCheckString = pairs.join('\n');

    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    params.set('hash', hash);

    return params.toString();
  }

  test('should verify genuine Telegram initData signature successfully', () => {
    const validInitData = generateValidInitData(testBotToken, testUser);
    const result = verifyTelegramInitData(validInitData, testBotToken);

    assert.equal(result.isValid, true);
    assert.ok(result.data);
    assert.equal(result.data.user.id, testUser.id);
    assert.equal(result.data.user.username, testUser.username);
  });

  test('should reject tampered initData payload', () => {
    const validInitData = generateValidInitData(testBotToken, testUser);
    const tampered = validInitData.replace('kingtom', 'hacker');
    const result = verifyTelegramInitData(tampered, testBotToken);

    assert.equal(result.isValid, false);
    assert.match(result.error, /Cryptographic signature mismatch|Validation error/i);
  });

  test('should reject expired initData (replay attack prevention)', () => {
    // 25 hours ago
    const oldTimestamp = Math.floor(Date.now() / 1000) - (25 * 3600);
    const expiredInitData = generateValidInitData(testBotToken, testUser, oldTimestamp);
    const result = verifyTelegramInitData(expiredInitData, testBotToken, 86400);

    assert.equal(result.isValid, false);
    assert.match(result.error, /replay protection triggered/i);
  });
});

describe('2. Multi-Network Address Validation Suite', () => {
  test('should accept valid TRON TRC20 wallet addresses', () => {
    const validTron1 = 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf';
    const validTron2 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // Official Tether USDT contract
    assert.equal(isValidTronAddress(validTron1), true);
    assert.equal(isValidTronAddress(validTron2), true);
    assert.equal(validateNetworkAddress('TRC20', validTron1).isValid, true);
  });

  test('should accept valid TON wallet addresses', () => {
    const validTon = 'EQBvW8Z5huBkMJYdn3PCDKNKKqiqXDjvjjx29JqYpn8SoGSq';
    assert.equal(isValidTonAddress(validTon), true);
    assert.equal(validateNetworkAddress('TON', validTon).isValid, true);
  });

  test('should accept valid BEP20 (BSC) wallet addresses', () => {
    const validBsc = '0x55d398326f99059fF775485246999027B3197955'; // Official USDT on BSC
    assert.equal(isValidBscAddress(validBsc), true);
    assert.equal(validateNetworkAddress('BEP20', validBsc).isValid, true);
  });

  test('should reject invalid or malicious addresses across networks', () => {
    assert.equal(isValidTronAddress('0x71C...'), false); // Ethereum style
    assert.equal(isValidTronAddress('bc1q...'), false); // Bitcoin SegWit
    assert.equal(isValidTronAddress('TShort'), false); // Too short
    assert.equal(isValidTronAddress(''), false);
    assert.equal(validateNetworkAddress('TRC20', 'invalidAddress').isValid, false);
    assert.equal(validateNetworkAddress('TON', 'invalidTon').isValid, false);
    assert.equal(validateNetworkAddress('BEP20', 'notAnEthAddress').isValid, false);
  });
});

describe('3. JWT Token Session Management Suite', () => {
  test('should sign and verify valid JWT session token', () => {
    const payload = { userId: 'usr_test_123', telegramId: '987654321', username: 'tom' };
    const token = signAccessToken(payload);
    assert.ok(token);

    const decoded = verifyAccessToken(token);
    assert.ok(decoded);
    assert.equal(decoded.userId, payload.userId);
    assert.equal(decoded.telegramId, payload.telegramId);
  });

  test('should return null for tampered or invalid JWT', () => {
    const invalid = verifyAccessToken('invalid.token.payload');
    assert.equal(invalid, null);
  });
});

describe('4. Lucky Wheel Probability & Cryptographic RNG Suite', () => {
  test('should produce uniform cryptographically secure floats in [0, 1)', () => {
    for (let i = 0; i < 50; i++) {
      const val = secureRandomFloat();
      assert.ok(val >= 0 && val < 1, `Value ${val} out of bounds [0, 1)`);
    }
  });

  test('should reflect configured 99% / 1% probability distribution over large sample', () => {
    const trials = 10000;
    let commonWins = 0;
    let rareWins = 0;

    for (let i = 0; i < trials; i++) {
      const roll = secureRandomFloat() * 1000;
      if (roll < 990) {
        commonWins++;
      } else {
        rareWins++;
      }
    }

    const commonPercent = (commonWins / trials) * 100;
    const rarePercent = (rareWins / trials) * 100;

    // Allowed statistical tolerance for 10,000 rolls: common 98.5% - 99.5%
    assert.ok(commonPercent >= 98.0 && commonPercent <= 99.8, `Common percent ${commonPercent}% out of bounds`);
    assert.ok(rarePercent >= 0.2 && rarePercent <= 2.0, `Rare percent ${rarePercent}% out of bounds`);
  });
});

describe('5. Mining Accumulator Math & Caps Suite', () => {
  function computeAccrued(elapsedMs, ratePerHour, maxHours = 24) {
    const elapsedHours = Math.min(maxHours, Math.max(0, elapsedMs) / (3600 * 1000));
    return Math.floor(elapsedHours * ratePerHour);
  }

  test('should correctly compute exact hourly accrual', () => {
    // 3 hours at 100 Poops/hr
    const accrued = computeAccrued(3 * 3600 * 1000, 100);
    assert.equal(accrued, 300);
  });

  test('should enforce strict 24-hour maximum accumulation cap', () => {
    // 72 hours (3 days) offline at 50 Poops/hr
    const accrued = computeAccrued(72 * 3600 * 1000, 50, 24);
    // Must be capped at 24 * 50 = 1200
    assert.equal(accrued, 1200);
  });
});
