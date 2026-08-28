#!/usr/bin/env node
/**
 * Fail-fast check for GitHub Actions Cloudflare deploy secrets.
 *
 * Never prints CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID. A 33-character
 * account id (copy/paste typo) previously produced Wrangler API 7003 on
 * /workers/services/travelos2 and looked like a missing-worker problem.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ACCOUNT_ID_HEX_RE = /^[0-9a-fA-F]{32}$/;
const CF_API = "https://api.cloudflare.com/client/v4";

export function inspectAccountId(raw) {
  if (raw == null) {
    return { ok: false, reason: "missing", length: 0 };
  }
  const id = String(raw).trim();
  if (!id) {
    return { ok: false, reason: "missing", length: 0 };
  }
  if (id.length !== 32) {
    return { ok: false, reason: "length", length: id.length };
  }
  if (!ACCOUNT_ID_HEX_RE.test(id)) {
    return { ok: false, reason: "hex", length: 32 };
  }
  return { ok: true, reason: "ok", length: 32 };
}

export function redactCloudflareText(text) {
  return String(text)
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .replace(/\/accounts\/[0-9a-fA-F]+/gi, "/accounts/***")
    .replace(/\b[0-9a-fA-F]{32,33}\b/g, "***");
}

export function formatAccountIdError(inspection) {
  if (inspection.reason === "missing") {
    return "CLOUDFLARE_ACCOUNT_ID is missing. Set the GitHub Actions secret from Cloudflare Workers overview → Account ID (32 hexadecimal characters).";
  }
  if (inspection.reason === "length") {
    return `CLOUDFLARE_ACCOUNT_ID must be exactly 32 hexadecimal characters (Workers overview → Account ID). Got length ${inspection.length}. A 33-character value is a copy/paste typo and Cloudflare API 7003s.`;
  }
  if (inspection.reason === "hex") {
    return "CLOUDFLARE_ACCOUNT_ID must be 32 hexadecimal characters (0-9, a-f). Recopy it from Workers overview; do not invent a value.";
  }
  return "CLOUDFLARE_ACCOUNT_ID is invalid.";
}

function firstCfError(json) {
  const errors = json && Array.isArray(json.errors) ? json.errors : [];
  const first = errors[0];
  if (!first) {
    return { code: null, message: "" };
  }
  return {
    code: first.code ?? null,
    message: redactCloudflareText(first.message || ""),
  };
}

export async function verifyCloudflareCreds(
  { token, accountId, fetchImpl } = {},
) {
  const fetchFn = fetchImpl || fetch;
  const logs = [];
  const fail = (message) => ({
    ok: false,
    message: redactCloudflareText(message),
    logs: logs.map(redactCloudflareText),
  });

  if (!token || !String(token).trim()) {
    return fail(
      "CLOUDFLARE_API_TOKEN is missing. Create a token with Workers Scripts Edit and set the GitHub Actions secret. Do not paste the token into chat or logs.",
    );
  }

  const inspection = inspectAccountId(accountId);
  logs.push(`CLOUDFLARE_ACCOUNT_ID length=${inspection.length} format=${inspection.reason}`);
  if (!inspection.ok) {
    return fail(formatAccountIdError(inspection));
  }

  logs.push("CLOUDFLARE_API_TOKEN is set (value not printed)");

  let verifyRes;
  try {
    verifyRes = await fetchFn(`${CF_API}/user/tokens/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    return fail(
      `Could not reach Cloudflare token verify endpoint: ${error instanceof Error ? error.message : error}`,
    );
  }

  const verifyText = await verifyRes.text();
  let verifyJson = null;
  try {
    verifyJson = JSON.parse(verifyText);
  } catch {
    verifyJson = null;
  }

  if (!verifyRes.ok || !verifyJson?.success) {
    const { code, message } = firstCfError(verifyJson);
    return fail(
      `Cloudflare API token was rejected (HTTP ${verifyRes.status}${code ? `, code ${code}` : ""}). ${message || "Token may be inactive, malformed, or missing permission."} Recreate the token with Workers Scripts Edit and update GitHub secret CLOUDFLARE_API_TOKEN. Do not echo the token.`,
    );
  }

  const status = verifyJson?.result?.status;
  if (status && status !== "active") {
    return fail(
      `Cloudflare API token status is "${status}", not active. Recreate travelos2-deploy (Workers Scripts Edit) and update the GitHub secret.`,
    );
  }
  logs.push("Cloudflare API token verified (active)");

  let accountRes;
  try {
    accountRes = await fetchFn(
      `${CF_API}/accounts/${String(accountId).trim()}/workers/scripts`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
  } catch (error) {
    return fail(
      `Could not reach Cloudflare workers/scripts endpoint: ${error instanceof Error ? error.message : error}`,
    );
  }

  const accountText = await accountRes.text();
  let accountJson = null;
  try {
    accountJson = JSON.parse(accountText);
  } catch {
    accountJson = null;
  }

  if (!accountRes.ok || !accountJson?.success) {
    const { code, message } = firstCfError(accountJson);
    if (code === 7003 || /object identifier is invalid/i.test(message)) {
      return fail(
        "Cloudflare API 7003: CLOUDFLARE_ACCOUNT_ID does not match an account this token can access. Recopy the 32-character Account ID from Workers overview into the GitHub secret. Do not invent a value. This is not a missing-worker error.",
      );
    }
    if (accountRes.status === 403 || code === 9109 || code === 10000) {
      return fail(
        `Cloudflare refused workers/scripts on this account (HTTP ${accountRes.status}${code ? `, code ${code}` : ""}). ${message} Confirm the token has Account → Workers Scripts → Edit.`,
      );
    }
    return fail(
      `Cloudflare workers/scripts check failed (HTTP ${accountRes.status}${code ? `, code ${code}` : ""}). ${message || "See Cloudflare API errors (redacted)."}`,
    );
  }

  const scripts = Array.isArray(accountJson.result) ? accountJson.result : [];
  logs.push(
    `Account is reachable; ${scripts.length} worker script(s) listed. travelos2 may be absent on a first deploy.`,
  );
  return {
    ok: true,
    message: "Cloudflare token is active and the account id is reachable.",
    logs,
  };
}

async function main() {
  const result = await verifyCloudflareCreds({
    token: process.env.CLOUDFLARE_API_TOKEN,
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  });
  for (const line of result.logs) {
    console.log(line);
  }
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  console.log(result.message);
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(redactCloudflareText(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  });
}
