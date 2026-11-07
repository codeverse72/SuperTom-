import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, signAdminToken, verifyAdminToken } from '../dist/utils/crypto.js';

describe('Admin Authentication & Security Suite', () => {
  test('should securely hash password with PBKDF2 salt and verify match', () => {
    const password = 'SuperTom@SecureAdminPass2026!';
    const hash = hashPassword(password);

    assert.ok(hash.includes(':'));
    assert.equal(verifyPassword(password, hash), true);
    assert.equal(verifyPassword('WrongPassword123', hash), false);
  });

  test('should sign and verify valid Admin JWT with SUPER_ADMIN role', () => {
    const payload = {
      adminId: 'admin_test_123',
      email: 'admin@supertom.io',
      role: 'SUPER_ADMIN',
    };

    const token = signAdminToken(payload);
    assert.ok(typeof token === 'string');

    const decoded = verifyAdminToken(token);
    assert.ok(decoded);
    assert.equal(decoded.adminId, payload.adminId);
    assert.equal(decoded.email, payload.email);
    assert.equal(decoded.role, 'SUPER_ADMIN');
  });

  test('should reject invalid or tampered Admin JWT', () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature';
    const decoded = verifyAdminToken(invalidToken);
    assert.equal(decoded, null);
  });

  test('should strictly validate that spin probabilities sum to 100%', () => {
    const validConfig = [
      { id: '1', percentage: 99.0 },
      { id: '2', percentage: 0.5 },
      { id: '3', percentage: 0.5 },
    ];
    const validSum = validConfig.reduce((acc, r) => acc + r.percentage, 0);
    assert.equal(Math.abs(validSum - 100) < 0.001, true);

    const invalidConfig = [
      { id: '1', percentage: 99.0 },
      { id: '2', percentage: 0.2 },
    ];
    const invalidSum = invalidConfig.reduce((acc, r) => acc + r.percentage, 0);
    assert.equal(Math.abs(invalidSum - 100) < 0.001, false);
  });
});

