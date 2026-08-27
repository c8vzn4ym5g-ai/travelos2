import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { isAdminPinValid, isFamilyPinRequired } from "../lib/family-pin.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

function withPinEnv(values: { pin?: string; required?: string }, run: () => Promise<void> | void) {
  const previousPin = process.env.TRAVELOS_ADMIN_PIN;
  const previousRequired = process.env.TRAVELOS_REQUIRE_FAMILY_PIN;

  if (values.pin === undefined) {
    delete process.env.TRAVELOS_ADMIN_PIN;
  } else {
    process.env.TRAVELOS_ADMIN_PIN = values.pin;
  }

  if (values.required === undefined) {
    delete process.env.TRAVELOS_REQUIRE_FAMILY_PIN;
  } else {
    process.env.TRAVELOS_REQUIRE_FAMILY_PIN = values.required;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (previousPin === undefined) {
        delete process.env.TRAVELOS_ADMIN_PIN;
      } else {
        process.env.TRAVELOS_ADMIN_PIN = previousPin;
      }

      if (previousRequired === undefined) {
        delete process.env.TRAVELOS_REQUIRE_FAMILY_PIN;
      } else {
        process.env.TRAVELOS_REQUIRE_FAMILY_PIN = previousRequired;
      }
    });
}

test("family PIN is off unless TRAVELOS_REQUIRE_FAMILY_PIN is exactly 1", () => {
  return withPinEnv({ pin: "secret", required: undefined }, () => {
    assert.equal(isFamilyPinRequired(), false);
    assert.equal(isAdminPinValid(null), true);
    assert.equal(isAdminPinValid(""), true);
  }).then(() =>
    withPinEnv({ pin: "secret", required: "true" }, () => {
      assert.equal(isFamilyPinRequired(), false);
      assert.equal(isAdminPinValid(null), true);
    }),
  ).then(() =>
    withPinEnv({ pin: "secret", required: "1" }, () => {
      assert.equal(isFamilyPinRequired(), true);
      assert.equal(isAdminPinValid(null), false);
      assert.equal(isAdminPinValid("wrong"), false);
      assert.equal(isAdminPinValid("secret"), true);
    }),
  );
});

test("moments APIs succeed without a PIN header when the family PIN flag is off", async () => {
  await withPinEnv({ pin: "keep-this-pin", required: undefined }, async () => {
    const [{ GET, POST }, photos, audio] = await Promise.all([
      import("../app/api/moments/route.ts"),
      import("../app/api/moments/photos/route.ts"),
      import("../app/api/moments/audio/route.ts"),
    ]);

    const getResponse = await GET(new Request("http://travelos.local/api/moments"));
    assert.equal(getResponse.status, 200);
    const getBody = (await getResponse.json()) as { content?: { moments?: unknown[] } };
    assert.ok(Array.isArray(getBody.content?.moments));

    const postResponse = await POST(
      new Request("http://travelos.local/api/moments", {
        body: JSON.stringify({ note: "gate-open", time: "2026-08-25T01:00:00.000Z" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    assert.equal(postResponse.status, 200);
    const created = (await postResponse.json()) as { moment: { id: string } };
    assert.equal(created.moment.id.startsWith("moment_"), true);

    const photoData = new FormData();
    photoData.set("momentId", created.moment.id);
    photoData.set("file", new File([Uint8Array.from([1, 2, 3, 4])], "gate.jpg", { type: "image/jpeg" }));
    const photoResponse = await photos.POST(
      new Request("http://travelos.local/api/moments/photos", {
        body: photoData,
        method: "POST",
      }),
    );
    assert.equal(photoResponse.status, 200);

    const audioData = new FormData();
    audioData.set("momentId", created.moment.id);
    audioData.set("file", new File([Uint8Array.from([5, 6, 7, 8])], "gate.webm", { type: "audio/webm" }));
    const audioResponse = await audio.POST(
      new Request("http://travelos.local/api/moments/audio", {
        body: audioData,
        method: "POST",
      }),
    );
    assert.equal(audioResponse.status, 200);
  });
});

test("GET /api/moments can be listed newest first for the family bench", async () => {
  await withPinEnv({ pin: "keep-this-pin", required: undefined }, async () => {
    const [{ GET, POST }, { sortMomentsNewestFirst }] = await Promise.all([
      import("../app/api/moments/route.ts"),
      import("../lib/moments.ts"),
    ]);

    const created = await POST(
      new Request("http://travelos.local/api/moments", {
        body: JSON.stringify({ note: "bench dump", time: "2026-08-27T09:24:00.000Z" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    assert.equal(created.status, 200);
    const body = (await created.json()) as { moment: { id: string } };

    const listedResponse = await GET(new Request("http://travelos.local/api/moments"));
    assert.equal(listedResponse.status, 200);
    const listed = (await listedResponse.json()) as {
      content: { moments: Parameters<typeof sortMomentsNewestFirst>[0] };
    };
    const sorted = sortMomentsNewestFirst([...listed.content.moments, ...listed.content.moments]);
    const stamps = sorted.map((moment) => Date.parse(moment.createdAt) || Date.parse(moment.time ?? "") || 0);
    for (let index = 1; index < stamps.length; index += 1) {
      assert.ok(stamps[index - 1] >= stamps[index]);
    }
    assert.equal(new Set(sorted.map((moment) => moment.id)).size, sorted.length);
    assert.ok(sorted.some((moment) => moment.id === body.moment.id));
  });
});

test("moments APIs still return 401 for a missing or wrong PIN when the flag is on", async () => {
  await withPinEnv({ pin: "family-secret", required: "1" }, async () => {
    const [{ GET, POST }, photos, audio, gate] = await Promise.all([
      import("../app/api/moments/route.ts"),
      import("../app/api/moments/photos/route.ts"),
      import("../app/api/moments/audio/route.ts"),
      import("../app/api/family/gate/route.ts"),
    ]);

    const gateResponse = await gate.GET();
    assert.equal(gateResponse.status, 200);
    assert.deepEqual(await gateResponse.json(), { required: true });

    const missing = await GET(new Request("http://travelos.local/api/moments"));
    assert.equal(missing.status, 401);

    const wrong = await GET(
      new Request("http://travelos.local/api/moments", {
        headers: { "x-travelos-admin-pin": "nope" },
      }),
    );
    assert.equal(wrong.status, 401);

    const ok = await GET(
      new Request("http://travelos.local/api/moments", {
        headers: { "x-travelos-admin-pin": "family-secret" },
      }),
    );
    assert.equal(ok.status, 200);

    const postMissing = await POST(
      new Request("http://travelos.local/api/moments", {
        body: JSON.stringify({ note: "locked" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    assert.equal(postMissing.status, 401);

    const photoMissing = await photos.POST(
      new Request("http://travelos.local/api/moments/photos", {
        body: new FormData(),
        method: "POST",
      }),
    );
    assert.equal(photoMissing.status, 401);

    const audioMissing = await audio.POST(
      new Request("http://travelos.local/api/moments/audio", {
        body: new FormData(),
        method: "POST",
      }),
    );
    assert.equal(audioMissing.status, 401);
  });
});

test("family and capture clients discover the PIN gate and do not add a Capture PIN form", async () => {
  const [gate, pin, session, unlock, capture, bench, write, family, tripsAdmin, coffeeAdmin] = await Promise.all([
    readSource("app/api/family/gate/route.ts"),
    readSource("lib/family-pin.ts"),
    readSource("lib/family-session.ts"),
    readSource("app/family/family-unlock-panel.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/family/bench/page.tsx"),
    readSource("app/trips/write/page.tsx"),
    readSource("app/family/page.tsx"),
    readSource("app/trips/admin/page.tsx"),
    readSource("app/coffee/admin/page.tsx"),
  ]);

  assert.match(pin, /TRAVELOS_REQUIRE_FAMILY_PIN === "1"/);
  assert.match(pin, /if \(!isFamilyPinRequired\(\)\) \{\s*return true;/);
  assert.match(gate, /isFamilyPinRequired\(\)/);
  assert.match(session, /fetch\("\/api\/family\/gate"/);
  assert.match(session, /export async function resolveFamilySession/);
  assert.match(unlock, /fetchFamilyGate/);
  assert.match(unlock, /href="\/family\/capture"/);
  assert.match(unlock, /href="\/family\/bench"/);
  assert.match(unlock, /href="\/trips\/write"/);
  assert.match(unlock, /id="family-pin"/);
  assert.match(unlock, /type=\{showPin \? "text" : "password"\}/);
  assert.match(capture, /resolveFamilySession/);
  assert.match(bench, /resolveFamilySession/);
  assert.match(write, /resolveFamilySession/);
  assert.match(tripsAdmin, /resolveFamilySession/);
  assert.match(coffeeAdmin, /resolveFamilySession/);
  assert.match(capture, /router\.replace\("\/family"\)/);
  assert.match(bench, /router\.replace\("\/family"\)/);
  assert.match(write, /router\.replace\("\/family"\)/);
  assert.doesNotMatch(capture, /type="password"/);
  assert.doesNotMatch(capture, /id="family-pin"/);
  assert.doesNotMatch(bench, /type="password"/);
  assert.doesNotMatch(write, /type="password"/);
  assert.doesNotMatch(family, /travelpayouts/i);
  assert.doesNotMatch(family, /emrldtp/);
  assert.doesNotMatch(capture, /travelpayouts/i);
  assert.doesNotMatch(capture, /from "@\/lib\/trips"/);
  assert.doesNotMatch(bench, /travelpayouts/i);
  assert.doesNotMatch(bench, /from "@\/lib\/trips"/);
});

test("public Lapland stays independent of the family PIN gate", async () => {
  const [page, seed, poster, gate] = await Promise.all([
    readSource("app/trips/[slug]/page.tsx"),
    readSource("lib/trips.ts"),
    readSource("scripts/generate-lapland-poster.mjs"),
    readSource("app/api/family/gate/route.ts"),
  ]);

  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(seed, /trip_lapland_2020/);
  assert.match(seed, /laplandTitle: "北極圈上的十二月"/);
  assert.match(seed, /finland-lapland-winter-journal"/);
  assert.match(poster, /tile\.opentopomap\.org/);
  assert.doesNotMatch(page, /isAdminPinValid/);
  assert.doesNotMatch(page, /isFamilyPinRequired/);
  assert.doesNotMatch(page, /TRAVELOS_REQUIRE_FAMILY_PIN/);
  assert.doesNotMatch(page, /family\/capture/);
  assert.doesNotMatch(page, /family\/bench/);
  assert.doesNotMatch(page, /moment-store/);
  assert.doesNotMatch(gate, /trip_lapland_2020/);
  assert.doesNotMatch(seed, /TRAVELOS_REQUIRE_FAMILY_PIN/);
});
