import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTokenStore } from '../dist/tokens.js';

test('peek does not use up a token', () => {
  const store = createTokenStore(60_000);
  const token = store.generate('42');
  assert.equal(store.peek(token), true);
  assert.equal(store.peek(token), true);
  assert.deepEqual(store.consume(token), { valid: true, chatId: '42' });
});

test('peek is false after the token is consumed or for unknown tokens', () => {
  const store = createTokenStore(60_000);
  const token = store.generate('42');
  store.consume(token);
  assert.equal(store.peek(token), false);
  assert.equal(store.peek('nope'), false);
});

test('peek is false for expired tokens', () => {
  const store = createTokenStore(-1);
  assert.equal(store.peek(store.generate('42')), false);
});
