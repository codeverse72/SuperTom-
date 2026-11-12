import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

function escapeHtml(input) {
  if (!input) return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderBroadcastMessage(template, user) {
  const safeName = escapeHtml(user.firstName?.trim() || (user.username ? `@${user.username}` : 'Miner'));
  const safeUsername = escapeHtml(user.username ? `@${user.username.replace(/^@/, '')}` : 'SuperTomPlayer');
  const safeBalance = escapeHtml(Number(user.poopsBalance ?? 0).toLocaleString('en-US'));
  const safeRefCode = escapeHtml(user.referralCode || 'TOMVIP');

  return template
    .replace(/\{firstName\}/g, safeName)
    .replace(/\{username\}/g, safeUsername)
    .replace(/\{balance\}/g, safeBalance)
    .replace(/\{referralCode\}/g, safeRefCode);
}

function stripTelegramHtml(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function buildAudienceWhereClause(segment, now) {
  const baseWhere = { accountStatus: 'ACTIVE' };
  switch (segment) {
    case 'inactive_24h':
      return { ...baseWhere, updatedAt: { lt: new Date(now.getTime() - 24 * 3600 * 1000) } };
    case 'inactive_72h':
      return { ...baseWhere, updatedAt: { lt: new Date(now.getTime() - 72 * 3600 * 1000) } };
    case 'inactive_7d':
      return { ...baseWhere, updatedAt: { lt: new Date(now.getTime() - 7 * 24 * 3600 * 1000) } };
    case 'low_balance':
      return { ...baseWhere, poopsBalance: { lt: 1000n } };
    case 'all_active':
    default:
      return baseWhere;
  }
}

describe('Admin Broadcast & Wake-Up Templates Suite', () => {
  test('Renders placeholders cleanly and escapes user HTML characters', () => {
    const rendered = renderBroadcastMessage(
      'Hey <b>{firstName}</b> ({username}), balance: {balance}, code: <code>{referralCode}</code>',
      {
        firstName: 'Tom <King> & Co',
        username: 'tom_miner',
        poopsBalance: 12500n,
        referralCode: 'TOM99',
      }
    );

    assert.equal(
      rendered,
      'Hey <b>Tom &lt;King&gt; &amp; Co</b> (@tom_miner), balance: 12,500, code: <code>TOM99</code>'
    );
  });

  test('Strips HTML cleanly for fallback plain-text Telegram delivery', () => {
    const plain = stripTelegramHtml('<b>Wake Up</b> &amp; Mine <code>TOM1</code>!');
    assert.equal(plain, 'Wake Up & Mine TOM1!');
  });

  test('Builds accurate Prisma filters for wake-up audience segments', () => {
    const now = new Date('2026-11-12T12:00:00Z');

    const w24 = buildAudienceWhereClause('inactive_24h', now);
    assert.equal(w24.accountStatus, 'ACTIVE');
    assert.equal(w24.updatedAt.lt.toISOString(), '2026-11-11T12:00:00.000Z');

    const w7d = buildAudienceWhereClause('inactive_7d', now);
    assert.equal(w7d.updatedAt.lt.toISOString(), '2026-11-05T12:00:00.000Z');

    const low = buildAudienceWhereClause('low_balance', now);
    assert.equal(low.poopsBalance.lt, 1000n);
  });
});

