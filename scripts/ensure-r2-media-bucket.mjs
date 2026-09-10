#!/usr/bin/env node
/**
 * Create Cloudflare R2 bucket `travelos-media` when missing.
 * Never prints CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID.
 *
 * Owner dashboard if the deploy token cannot create R2:
 *   Cloudflare Dashboard → R2 Object Storage → Create bucket
 *   Name: travelos-media → Create bucket
 * Then add Account → Cloudflare R2 → Edit on token `travelos2-deploy`,
 * or leave the dashboard bucket in place (Workers Scripts Edit can bind it).
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  inspectAccountId,
  formatAccountIdError,
  redactCloudflareText,
} from "./verify-cloudflare-creds.mjs";

export const TRAVELOS_MEDIA_BUCKET = "travelos-media";
const CF_API = "https://api.cloudflare.com/client/v4";

export const R2_OWNER_CREATE_CLICK =
  "Cloudflare Dashboard → R2 Object Storage → Create bucket → name `travelos-media` → Create bucket. Optional public access is not required: the Worker serves objects at GET /api/media?key=. Public r2.dev: bucket → Settings → Public access → Allow Access.";

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

function bucketNamesFromList(json) {
  const result = json?.result;
  const buckets = Array.isArray(result?.buckets)
    ? result.buckets
    : Array.isArray(result)
      ? result
      : [];
  return buckets
    .map((item) => (item && typeof item.name === "string" ? item.name : ""))
    .filter(Boolean);
}

export async function ensureR2MediaBucket({ token, accountId, fetchImpl } = {}) {
  const fetchFn = fetchImpl || fetch;
  const logs = [];
  const fail = (message) => ({
    ok: false,
    created: false,
    existed: false,
    message: redactCloudflareText(message),
    logs: logs.map(redactCloudflareText),
  });

  if (!token || !String(token).trim()) {
    return fail(
      "CLOUDFLARE_API_TOKEN is missing. Cannot create R2 bucket travelos-media.",
    );
  }
  const inspection = inspectAccountId(accountId);
  if (!inspection.ok) {
    return fail(formatAccountIdError(inspection));
  }
  const id = String(accountId).trim();
  const headers = {
    Authorization: `Bearer ${String(token).trim()}`,
    "Content-Type": "application/json",
  };

  const listRes = await fetchFn(`${CF_API}/accounts/${id}/r2/buckets`, { headers });
  const listText = await listRes.text();
  let listJson = {};
  try {
    listJson = JSON.parse(listText);
  } catch {
    listJson = {};
  }
  const listed = bucketNamesFromList(listJson);
  if (listRes.ok && listed.includes(TRAVELOS_MEDIA_BUCKET)) {
    logs.push("R2 bucket travelos-media already exists.");
    return {
      ok: true,
      created: false,
      existed: true,
      message: "R2 bucket travelos-media is present.",
      logs,
    };
  }

  if (listRes.status === 403 || listRes.status === 401) {
    const { code, message } = firstCfError(listJson);
    if (code === 10042) {
      return fail(
        `Cloudflare R2 is not enabled on this account (API 10042). Owner: open Cloudflare Dashboard → R2 Object Storage once (accept R2 terms / Enable R2), then Create bucket → name \`travelos-media\`. After that, re-run the Cloudflare Workers workflow. Optional public r2.dev is not required; Worker GET /api/media?key= serves objects.`,
      );
    }
    return fail(
      `Cloudflare refused R2 list (HTTP ${listRes.status}${code ? `, code ${code}` : ""}). ${message || "Token needs Account → Cloudflare R2 → Edit (or at least Read)."} ${R2_OWNER_CREATE_CLICK}`,
    );
  }

  if (!listRes.ok && listRes.status !== 404) {
    const { code, message } = firstCfError(listJson);
    logs.push(`R2 list HTTP ${listRes.status}${code ? ` code ${code}` : ""}${message ? `: ${message}` : ""}`);
  }

  const createRes = await fetchFn(`${CF_API}/accounts/${id}/r2/buckets`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: TRAVELOS_MEDIA_BUCKET }),
  });
  const createText = await createRes.text();
  let createJson = {};
  try {
    createJson = JSON.parse(createText);
  } catch {
    createJson = {};
  }
  const { code, message } = firstCfError(createJson);
  const already =
    createRes.status === 409 ||
    code === 10004 ||
    /already exists/i.test(message || "");

  if (createRes.ok || already) {
    logs.push(already ? "R2 bucket travelos-media already existed on create." : "Created R2 bucket travelos-media.");
    return {
      ok: true,
      created: !already,
      existed: already,
      message: already
        ? "R2 bucket travelos-media is present."
        : "Created R2 bucket travelos-media.",
      logs,
    };
  }

  if (createRes.status === 403 || createRes.status === 401) {
    return fail(
      `Cloudflare refused R2 create (HTTP ${createRes.status}${code ? `, code ${code}` : ""}). ${message || "Token needs Account → Cloudflare R2 → Edit."} ${R2_OWNER_CREATE_CLICK}`,
    );
  }

  return fail(
    `Could not create R2 bucket travelos-media (HTTP ${createRes.status}${code ? `, code ${code}` : ""}). ${message || "See Cloudflare API errors (redacted)."} ${R2_OWNER_CREATE_CLICK}`,
  );
}

async function main() {
  const result = await ensureR2MediaBucket({
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
