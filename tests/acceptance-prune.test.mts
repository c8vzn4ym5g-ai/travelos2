import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../scripts/drive-warehouse-apps-script.js", import.meta.url), "utf8");
const target = "moment_speed_acceptance_20260913";
function setup(options: { mixedJob?: boolean; backupFails?: boolean; duplicates?: boolean } = {}) {
  const real = { id: "moment_real", note: "家人的原始文字", photos: [{ id: "real_photo" }], custom: "retain" };
  let catalog = JSON.stringify({ moments: [real, { id: target, photos: [] }], jobs: [{ id: "real_job", momentIds: ["moment_real"] }, { id: "test_job", momentIds: options.mixedJob ? [target, "moment_real"] : [target] }], custom: "retain catalog field" });
  const backups: string[] = [];
  let locked = false, locks = 0, writes = 0;
  const file = {
    getBlob: () => ({ getDataAsString: () => catalog }),
    makeCopy: () => {
      assert.equal(locked, true);
      if (options.backupFails) throw new Error("backup unavailable");
      backups.push(catalog);
      return { getId: () => "backup_id" };
    },
    setContent: (text: string) => {
      assert.equal(locked, true);
      assert.ok(backups.length > 0);
      writes++;
      catalog = text;
    },
  };
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock: () => { locked = true; locks++; }, releaseLock: () => { locked = false; } }) },
  });
  vm.runInContext(source, context);
  context.tokenOk_ = () => true;
  context.json_ = (value: unknown) => JSON.parse(JSON.stringify(value));
  context.folder_ = () => ({ getFilesByName: () => {
    let count = options.duplicates ? 2 : 1;
    return { hasNext: () => count > 0, next: () => { count--; return file; } };
  } });
  return {
    call: (body: object) => context.doPost({ postData: { contents: JSON.stringify({ op: "prune-acceptance", ...body }) } }),
    state: () => ({ catalog: JSON.parse(catalog), backups, writes, locks, locked }), real,
  };
}

test("default prune is read-only and applies only the reviewed IDs under the existing lock", () => {
  const app = setup();
  assert.equal(app.call({ momentIds: [target] }).applied, false);
  assert.equal(app.state().writes, 0);
  const result = app.call({ momentIds: [target], apply: true });
  assert.equal(result.applied, true);
  assert.equal(result.backupFileId, "backup_id");
  assert.deepEqual(app.state().catalog.moments, [app.real]);
  assert.equal(app.state().catalog.jobs[0].id, "real_job");
  assert.equal(app.state().catalog.jobs.length, 1);
  assert.equal(app.state().catalog.custom, "retain catalog field");
  assert.equal(JSON.parse(app.state().backups[0]!).moments.length, 2);
  assert.equal(app.state().locks, 2);
  assert.equal(app.state().locked, false);
  assert.equal(app.call({ momentIds: [target], apply: true }).applied, false);
  assert.equal(app.state().writes, 1, "repeating cleanup is idempotent");
});

test("an arbitrary family ID or mixed job cannot be pruned", () => {
  const app = setup();
  assert.match(app.call({ momentIds: ["moment_real"], apply: true }).error, /unreviewed/);
  assert.equal(app.state().writes, 0);
  const mixed = setup({ mixedJob: true });
  assert.match(mixed.call({ momentIds: [target], apply: true }).error, /mixes/);
  assert.equal(mixed.state().writes, 0);
});

test("missing backup or ambiguous catalog leaves original rows intact and releases lock", () => {
  const app = setup({ backupFails: true });
  assert.throws(() => app.call({ momentIds: [target], apply: true }), /backup unavailable/);
  assert.equal(app.state().writes, 0);
  assert.equal(app.state().locked, false);
  const ambiguous = setup({ duplicates: true });
  assert.match(ambiguous.call({ momentIds: [target], apply: true }).error, /ambiguous/);
  assert.equal(ambiguous.state().writes, 0);
});
