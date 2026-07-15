import { config } from "./config.js";

// Simple in-memory token cache for the OAuth2 client-credentials flow.
let cached: { token: string; expiresAt: number } | null = null;

export async function getAuthHeader(): Promise<Record<string, string>> {
  if (!config.auth.enabled) return {};
  const token = await getToken();
  return { Authorization: `Bearer ${token}` };
}

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 30_000) return cached.token;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.auth.clientId,
    client_secret: config.auth.clientSecret,
    scope: config.auth.scope,
  });

  const res = await fetch(config.auth.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Token request failed (${res.status}): ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cached = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 300) * 1000,
  };
  return cached.token;
}
