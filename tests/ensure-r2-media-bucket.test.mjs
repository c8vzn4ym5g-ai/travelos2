import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  ensureR2MediaBucket,
  R2_OWNER_CREATE_CLICK,
  TRAVELOS_MEDIA_BUCKET,
} from "../scripts/ensure-r2-media-bucket.mjs";

const GOOD_ID = "31c5f4dccc8eabb03968996576e8e1c4";
const root = resolve(import.meta.dirname, "..");

test("ensureR2MediaBucket is a no-op when the bucket already exists", async () => {
  let posts = 0;
  const result = await ensureR2MediaBucket({
    token: "fake-token",
    accountId: GOOD_ID,
    fetchImpl: async (url, init) => {
      if (init?.method === "POST") {
        posts += 1;
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            success: true,
            result: { buckets: [{ name: TRAVELOS_MEDIA_BUCKET }] },
          }),
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.existed, true);
  assert.equal(result.created, false);
  assert.equal(posts, 0);
});

test("ensureR2MediaBucket creates the bucket when the list is empty", async () => {
  const result = await ensureR2MediaBucket({
    token: "fake-token",
    accountId: GOOD_ID,
    fetchImpl: async (url, init) => {
      if (init?.method === "POST") {
        assert.match(String(init.body), /travelos-media/);
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({ success: true, result: { name: TRAVELOS_MEDIA_BUCKET } }),
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true, result: { buckets: [] } }),
      };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.created, true);
});

test("ensureR2MediaBucket tells Owner the dashboard click on 403", async () => {
  const result = await ensureR2MediaBucket({
    token: "fake-token",
    accountId: GOOD_ID,
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      text: async () =>
        JSON.stringify({ success: false, errors: [{ code: 9109, message: "Unauthorized" }] }),
    }),
  });
  assert.equal(result.ok, false);
  assert.match(result.message, /R2/);
  assert.match(result.message, /travelos-media/);
  assert.match(result.message, /Create bucket/);
  assert.doesNotMatch(result.message, /fake-token/);
  assert.match(R2_OWNER_CREATE_CLICK, /R2 Object Storage/);
});

test("Cloudflare workflow creates travelos-media before Wrangler deploy", async () => {
  const workflow = await readFile(resolve(root, ".github/workflows/cloudflare-deploy.yml"), "utf8");
  assert.match(workflow, /ensure-r2-media-bucket\.mjs/);
  const wrangler = await readFile(resolve(root, "wrangler.jsonc"), "utf8");
  assert.match(wrangler, /"r2_buckets"/);
  assert.doesNotMatch(wrangler, /\/\/ "r2_buckets"/);
  assert.match(wrangler, /TRAVELOS_MEDIA/);
  assert.match(wrangler, /travelos-media/);
});
