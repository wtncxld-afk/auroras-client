import { test } from "node:test";
import assert from "node:assert/strict";
import { base32Decode, base32Encode, hotp, totp, verifyTotp } from "../../src/lib/auth/totp";

// RFC 4226 appendix D and RFC 6238 appendix B (SHA-1) test vectors.
const KEY = Buffer.from("12345678901234567890");
test("HOTP matches RFC 4226 vectors", () => {
  const expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583", "399871", "520489"];
  expected.forEach((code, i) => assert.equal(hotp(KEY, i), code));
});
test("TOTP matches RFC 6238 SHA-1 vectors (8 digits)", () => {
  const b32 = base32Encode(KEY);
  assert.deepEqual(base32Decode(b32), KEY);
  for (const [t, code] of [[59, "94287082"], [1111111109, "07081804"], [1111111111, "14050471"], [1234567890, "89005924"], [2000000000, "69279037"]] as const)
    assert.equal(hotp(KEY, Math.floor(t / 30), 8), code);
  assert.equal(totp(b32, 59_000), "287082");
});
test("verifyTotp accepts ±1 step, rejects replays and wrong codes", () => {
  const s = base32Encode(KEY), now = 1_700_000_000_000, step = Math.floor(now / 30000);
  assert.equal(verifyTotp(s, totp(s, now), null, now), step);
  assert.equal(verifyTotp(s, totp(s, now - 30000), null, now), step - 1);
  assert.equal(verifyTotp(s, totp(s, now - 90000), null, now), null, "too old");
  assert.equal(verifyTotp(s, totp(s, now), step, now), null, "same step replayed");
  assert.equal(verifyTotp(s, "000000", null, now) === null || totp(s, now) === "000000", true);
  assert.equal(verifyTotp(s, "abc", null, now), null);
});
