import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { createTelegramAuth, createTokenCleanupInterval } from '../dist/index.js';

test('periodic token cleanup runs without a login request', () => {
  mock.timers.enable({ apis: ['setInterval'] });
  let cleanupCalls = 0;

  const handle = createTokenCleanupInterval({
    cleanup() {
      cleanupCalls += 1;
    },
  });

  mock.timers.tick(59_999);
  assert.equal(cleanupCalls, 0);

  mock.timers.tick(1);
  assert.equal(cleanupCalls, 1);

  clearInterval(handle);
  mock.timers.reset();
});

test('auth instances expose a dispose hook for cleanup timers', () => {
  const auth = createTelegramAuth({
    cookieName: 'test_session',
    chatIds: [],
    appUrl: 'http://localhost:4000',
    sessionSecret: 'test-secret',
  });

  assert.equal(typeof auth.dispose, 'function');
  auth.dispose();
});
