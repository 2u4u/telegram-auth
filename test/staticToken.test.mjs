import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getStaticBearerToken } from '../dist/staticToken.js';

test('reads static token from Authorization bearer header', () => {
  assert.equal(
    getStaticBearerToken({ headers: { authorization: 'Bearer static-secret' } }),
    'static-secret',
  );
});

test('trims whitespace around the bearer token', () => {
  assert.equal(
    getStaticBearerToken({ headers: { authorization: 'Bearer   static-secret  ' } }),
    'static-secret',
  );
});

test('ignores query token and non-bearer authorization values', () => {
  assert.equal(
    getStaticBearerToken({
      headers: { authorization: 'Basic static-secret' },
      query: { token: 'static-secret' },
    }),
    null,
  );
});
