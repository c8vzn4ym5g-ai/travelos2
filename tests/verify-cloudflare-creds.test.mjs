import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import test from "node:test";
import {
  formatAccountIdError,
  inspectAccountId,
  redactCloudflareText,
  verifyCloudflareCreds,
} from "../scripts/verify-cloudflare-creds.mjs";

const root = resolve(import.meta.dirname, "..");

const GOOD_ID = "31c5f4dccc8eabb03968996576e8e1c4";
const TYPED_ID = "31c5f4dccc8eabb039689996576e8e1c4";

test("Cloudflare account id must be exactly 32 hex characters", () => {
  assert.deepEqual(inspectAccountId(GOOD_ID), {
    ok: true,
    reason: "ok",
    length: 32,
  });
  assert.deepEqual(inspectAccountId(GOOD_ID.toUpperCase()), {
    ok: true,
    reason: "ok",
    length: 32,
  });
  assert.equal(inspectAccountId(TYPED_ID).ok, false);
  assert.equal(inspectAccountId(TYPED_ID).reason, "length");
  assert.equal(inspectAccountId(TYPED_ID).length, 33);
  assert.equal(inspectAccountId("").reason, "missing");
  assert.equal(inspectAccountId("   ").reason, "missing");
  assert.equal(inspectAccountId("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz").reason, "hex");
  assert.match(formatAccountIdError(inspectAccountId(TYPED_ID)), /33/);
  assert.match(formatAccountIdError(inspectAccountId(TYPED_ID)), /7003/);
});

test("redaction strips tokens and account-id shaped values", () => {
  const leaked = redactCloudflareText(
    `Bearer super-secret-token /accounts/${TYPED_ID}/workers/services/travelos2 ${GOOD_ID}`,
  );
  assert.doesNotMatch(leaked, /super-secret-token/);
  assert.doesNotMatch(leaked, /31c5f4dc/i);
  assert.match(leaked, /Bearer \*\*\*/);
  assert.match(leaked, /\/accounts\/\*\*\*/);
});

test("verifyCloudflareCreds fails locally on the 33-char typo without calling Cloudflare", async () => {
  let calls = 0;
  const result = await verifyCloudflareCreds({
    token: "fake-token",
    accountId: TYPED_ID,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("network should not be used");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(calls, 0);
  assert.match(result.message, /32 hexadecimal/);
  assert.doesNotMatch(result.message, new RegExp(TYPED_ID, "i"));
});

test("verifyCloudflareCreds maps API 7003 to an account-id message", async () => {
  const result = await verifyCloudflareCreds({
    token: "fake-token",
    accountId: GOOD_ID,
    fetchImpl: async (url) => {
      const path = String(url);
      if (path.endsWith("/user/tokens/verify")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ success: true, result: { status: "active" } }),
        };
      }
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            success: false,
            errors: [
              {
                code: 7003,
                message: `Could not route to /client/v4/accounts/${GOOD_ID}/workers/scripts`,
              },
            ],
          }),
      };
    },
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /7003/);
  assert.match(result.message, /not a missing-worker error/);
  assert.doesNotMatch(result.message, new RegExp(GOOD_ID, "i"));
  assert.doesNotMatch(result.logs.join("\n"), /fake-token/);
});

test("verifyCloudflareCreds succeeds when token is active and account lists scripts", async () => {
  const result = await verifyCloudflareCreds({
    token: "fake-token",
    accountId: GOOD_ID,
    fetchImpl: async (url) => {
      const path = String(url);
      if (path.endsWith("/user/tokens/verify")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            JSON.stringify({ success: true, result: { status: "active" } }),
        };
      }
      assert.match(path, /\/accounts\/31c5f4dccc8eabb03968996576e8e1c4\/workers\/scripts$/);
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, result: [] }),
      };
    },
  });
  assert.equal(result.ok, true);
  assert.match(result.message, /reachable/);
});

test("CLI exits 1 on a 33-char account id without printing it", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/verify-cloudflare-creds.mjs"],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        CLOUDFLARE_API_TOKEN: "fake-token",
        CLOUDFLARE_ACCOUNT_ID: TYPED_ID,
      },
    },
  );
  assert.equal(result.status, 1);
  const out = `${result.stdout}${result.stderr}`;
  assert.match(out, /32 hexadecimal/);
  assert.doesNotMatch(out, new RegExp(TYPED_ID, "i"));
  assert.doesNotMatch(out, /fake-token/);
});
