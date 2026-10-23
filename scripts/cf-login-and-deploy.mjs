import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, exec } from "node:child_process";

const CLIENT_ID = "54d11594-84e4-41aa-b438-e81b8fa78ee7";
const REDIRECT_URI = "http://localhost:8976/oauth/callback";
const SCOPES = [
  "account:read",
  "user:read",
  "workers:write",
  "workers_kv:write",
  "workers_routes:write",
  "workers_scripts:write",
  "workers_tail:read",
  "d1:write",
  "pages:write",
  "zone:read",
  "ssl_certs:write",
  "ai:write",
  "queues:write",
  "pipelines:write",
  "offline_access",
];

function base64URLEncode(buf) {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const codeVerifier = base64URLEncode(crypto.randomBytes(32));
const codeChallenge = base64URLEncode(crypto.createHash("sha256").update(codeVerifier).digest());
const state = crypto.randomBytes(16).toString("hex"); // pure hex, no special chars!

const authUrl =
  `https://dash.cloudflare.com/oauth2/auth?response_type=code` +
  `&client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
  `&scope=${encodeURIComponent(SCOPES.join(" "))}` +
  `&state=${state}` +
  `&code_challenge=${codeChallenge}` +
  `&code_challenge_method=S256`;

console.log("AUTH_URL=" + authUrl);
exec(`start "" "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost:8976");
  if (u.pathname !== "/oauth/callback") {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = u.searchParams.get("code");
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>Código de autorização não recebido.</h2>");
    return;
  }

  try {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch("https://dash.cloudflare.com/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      throw new Error(JSON.stringify(tokenData));
    }

    const exp = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();
    const toml = [
      `oauth_token = "${tokenData.access_token}"`,
      `expiration_time = "${exp}"`,
      `refresh_token = "${tokenData.refresh_token || ""}"`,
      `scopes = ${JSON.stringify(SCOPES)}`,
      "",
    ].join("\n");

    const paths = [
      path.join(os.homedir(), ".wrangler", "config", "default.toml"),
      path.join(os.homedir(), "AppData", "Roaming", "xdg.config", ".wrangler", "config", "default.toml"),
    ];
    for (const p of paths) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, toml, "utf8");
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(
      "<div style='font-family:sans-serif;padding:40px;text-align:center'><h1>✅ Cloudflare autorizada com sucesso!</h1><p>O deploy do Conectas já está sendo finalizado automaticamente. Você pode fechar esta aba.</p></div>"
    );

    console.log("LOGIN_OK");
    server.close(() => process.exit(0));
  } catch (err) {
    console.error("TOKEN_ERROR", err);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Erro ao obter token: " + err.message);
  }
});

server.listen(8976, "localhost", () => {
  console.log("LISTENING_8976");
});
