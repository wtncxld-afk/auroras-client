// Microsoft sign-in for Minecraft, the way other launchers do it: Microsoft's own sign-in page opens in a window, the
// person signs in there (password, passkey, 2FA, all handled by Microsoft), and the launcher receives a one-time code at
// the registered redirect address. OAuth 2.0 authorization code flow with PKCE (RFC 7636). Pure helpers: main.js opens
// the window and does the network calls, so this is testable without Electron.
const crypto = require("crypto");

const MSA = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
/** Microsoft's standard redirect for desktop apps. Turn it on in the Azure app: Authentication > Mobile and desktop applications. */
const REDIRECT = "https://login.microsoftonline.com/common/oauth2/nativeclient";
const SCOPE = "XboxLive.signin offline_access";
const CLIENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const b64url = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
/** A fresh PKCE pair and state value for one sign-in attempt. */
function pkce(rand = crypto.randomBytes) {
  const verifier = b64url(rand(32)), challenge = b64url(crypto.createHash("sha256").update(verifier).digest()), state = b64url(rand(16));
  return { verifier, challenge, state };
}
function authorizeUrl(clientId, { challenge, state }) {
  if (!CLIENT_ID.test(String(clientId))) throw new Error("That doesn’t look like an Azure application (client) ID");
  const q = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: REDIRECT, scope: SCOPE, code_challenge: challenge, code_challenge_method: "S256", state, prompt: "select_account" });
  return MSA + "/authorize?" + q.toString();
}
/** Is this navigation the end of sign-in? */
const isRedirect = (url) => String(url).split(/[?#]/)[0] === REDIRECT;
/** Reads the code (or Microsoft's error) from the redirect. A wrong state means the reply isn't for this attempt and is refused. */
function parseRedirect(url, state) {
  const u = new URL(url), q = new URLSearchParams(u.search || u.hash.slice(1));
  if (q.get("error")) {
    const e = q.get("error"), d = q.get("error_description") || "";
    if (e === "access_denied") return { error: "Sign-in was cancelled." };
    if (/AADSTS50011|redirect/i.test(d)) return { error: "The Azure app doesn’t allow this launcher’s sign-in window yet. In the Azure portal, open the app > Authentication > Add a platform > Mobile and desktop applications, and tick the …/oauth2/nativeclient address." };
    if (/AADSTS700016|AADSTS700025|not found in the directory|unauthorized_client/i.test(d + e)) return { error: "Microsoft didn’t recognise the Azure app. Check the Application (client) ID, and that the app allows personal Microsoft accounts and public client flows." };
    return { error: d.split(/\r?\n/)[0] || "Microsoft sign-in failed (" + e + ")." };
  }
  if (q.get("state") !== state) return { error: "The sign-in reply didn’t match this attempt, so it was ignored. Try again." };
  const code = q.get("code"); return code ? { code } : { error: "Microsoft didn’t send a sign-in code. Try again." };
}
const tokenBody = (clientId, code, verifier) => ({ client_id: clientId, grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: verifier, scope: SCOPE });
/** Client ID: the one in Settings, otherwise the one shipped with this copy of the launcher (auth.json), otherwise none. */
function clientId(settings, shipped) {
  const s = String((settings && settings.msClientId) || "").trim(); if (CLIENT_ID.test(s)) return s;
  const b = String((shipped && shipped.msClientId) || "").trim(); return CLIENT_ID.test(b) ? b : "";
}
module.exports = { MSA, REDIRECT, SCOPE, CLIENT_ID, pkce, authorizeUrl, isRedirect, parseRedirect, tokenBody, clientId };
