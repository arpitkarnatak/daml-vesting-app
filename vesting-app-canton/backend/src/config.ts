import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3001),

  ledgerUrl: required("LEDGER_JSON_API_URL", "http://localhost:6864").replace(/\/$/, ""),
  userId: required("LEDGER_USER_ID", "vesting-app"),
  packageRef: required("PACKAGE_REF", "#vesting"),

  auth: {
    enabled: (process.env.AUTH_ENABLED ?? "false").toLowerCase() === "true",
    tokenUrl: process.env.OAUTH_TOKEN_URL ?? "",
    clientId: process.env.OAUTH_CLIENT_ID ?? "",
    clientSecret: process.env.OAUTH_CLIENT_SECRET ?? "",
    scope: process.env.OAUTH_SCOPE ?? "openid",
  },
};
