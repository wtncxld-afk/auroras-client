const test = require("node:test"), assert = require("node:assert");
const M = require("../msauth.js");
const ID = "0123abcd-0000-4000-8000-00000000abcd";

test("PKCE: S256 challenge matches the RFC 7636 example; every attempt gets a new verifier and state", () => {
  const v = Buffer.from("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk".replace(/-/g, "+").replace(/_/g, "/") + "=", "base64");
  let n = 0; const p = M.pkce((len) => (n++ === 0 ? v : Buffer.alloc(len, 7)));
  assert.strictEqual(p.verifier, "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"); assert.strictEqual(p.challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const a = M.pkce(), b = M.pkce(); assert.notStrictEqual(a.verifier, b.verifier); assert.notStrictEqual(a.state, b.state); assert.match(a.verifier, /^[A-Za-z0-9_-]{43}$/);
});
test("authorize URL: Microsoft's consumer endpoint, code + PKCE, desktop redirect, account picker; bad IDs refused", () => {
  const u = new URL(M.authorizeUrl(ID, { challenge: "ch", state: "st" })), q = u.searchParams;
  assert.strictEqual(u.origin + u.pathname, "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize");
  assert.deepStrictEqual([q.get("client_id"), q.get("response_type"), q.get("redirect_uri"), q.get("scope"), q.get("code_challenge"), q.get("code_challenge_method"), q.get("state"), q.get("prompt")],
    [ID, "code", "https://login.microsoftonline.com/common/oauth2/nativeclient", "XboxLive.signin offline_access", "ch", "S256", "st", "select_account"]);
  assert.throws(() => M.authorizeUrl("modrinth", { challenge: "c", state: "s" }), /client\) ID/);
});
test("redirect: code read only when the state matches; Microsoft's errors become clear messages", () => {
  const R = M.REDIRECT;
  assert.ok(M.isRedirect(R + "?code=x") && M.isRedirect(R) && !M.isRedirect("https://login.live.com/x?u=" + R) && !M.isRedirect(R + "x"));
  assert.deepStrictEqual(M.parseRedirect(R + "?code=M.C1_abc&state=st", "st"), { code: "M.C1_abc" });
  assert.match(M.parseRedirect(R + "?code=M.C1_abc&state=other", "st").error, /didn’t match/);
  assert.match(M.parseRedirect(R + "?error=access_denied&error_description=The+user+cancelled&state=st", "st").error, /cancelled/);
  assert.match(M.parseRedirect(R + "?error=invalid_request&error_description=AADSTS50011%3A+The+redirect+URI+does+not+match", "st").error, /Mobile and desktop applications/);
  assert.match(M.parseRedirect(R + "?error=unauthorized_client&error_description=AADSTS700016%3A+Application+not+found+in+the+directory", "st").error, /didn’t recognise/);
  assert.match(M.parseRedirect(R + "?state=st", "st").error, /didn’t send/);
});
test("token request carries the verifier and the same redirect", () => {
  assert.deepStrictEqual(M.tokenBody(ID, "code1", "ver1"), { client_id: ID, grant_type: "authorization_code", code: "code1", redirect_uri: M.REDIRECT, code_verifier: "ver1", scope: "XboxLive.signin offline_access" });
});
test("client ID: Settings first, then the copy shipped in auth.json; junk ignored", () => {
  const other = "11111111-2222-4333-8444-555555555555";
  assert.strictEqual(M.clientId({ msClientId: ID }, { msClientId: other }), ID);
  assert.strictEqual(M.clientId({ msClientId: "" }, { msClientId: other }), other);
  assert.strictEqual(M.clientId({ msClientId: "nope" }, { msClientId: "" }), "");
  assert.strictEqual(M.clientId(null, null), "");
  assert.strictEqual(M.clientId({}, require("../auth.json")), "5540599b-7cbe-424f-ad58-50fc1a040a0c", "the owner's own Azure app ID ships in auth.json");
});
