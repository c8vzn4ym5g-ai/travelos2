# Kyushu trip SSR Application error — root cause + fix

**Live:** `https://travelos2.chao-jason.workers.dev/trips/kyushu-family-fukuoka-oguni-aso-2026`  
**Digest:** `3502938665` (Next.js server Application error / HTTP 500)  
**Branch:** `hotfix/kyushu-entrydate-ssr`  
**Locked texts:** untouched (`大分 奧日田 梅響 溫泉酒店`, `小國町附近：竹庵的驚人份量`)

## Root cause

Live trip JSON (`GET /api/trips/content`) for `trip_kyushu_family_2026` includes **two warehouse leftover journals with no `entryDate`**:

| id | title |
|----|-------|
| `journal_trip_kyushu_family_2026_13` | 福岡的螃蟹 |
| `journal_trip_kyushu_family_2026_16` | 離開前的冷水源：畑冷泉 |

`app/trips/[slug]/page.tsx` SSR calls `formatDate(entry.entryDate)` for every journal (story cards + full journal list):

```ts
dateFormatter.format(new Date(date))  // date === undefined → RangeError: Invalid time value
```

That `RangeError` aborts the RSC render → Next.js generic Application error digest.

### Checked / not the cause

- **ShortVideoGallery / promo videos:** only used on admin videos tab; not on public trip page.
- **`costs` / `musicTracks`:** present as `[]` on live Kyushu (not undefined). Still guarded with `?? []` on spend panel.
- **`coordinates`:** `null` on Kyushu; JourneyMap falls back to place/route points — no throw.
- **Maps / travelRoute / places:** populated; `formatStopDate` already null-safe.
- **`enrichKyushuFamilyTrip`:** not on public `readContent` path; would also drop the two extra journals if forced — not used for this hotfix.

## Fix (minimal)

File: `app/trips/[slug]/page.tsx`

1. Harden `formatDate` to accept `string | null | undefined` and return `"Date not set"` for missing/invalid values (no `RangeError`).
2. Pass `trip.costs ?? []` into `JournalSpendPanel` (defensive for other thin trip JSON).

Does **not** rewrite any journal bodies.

## Apply

```bash
git fetch origin hotfix/kyushu-entrydate-ssr
# or apply patch below if branch not available
```

Patch path: `KYUSHU-ENTRYDATE-SSR.patch` (same folder).

## Verify after deploy

- `GET /trips/kyushu-family-fukuoka-oguni-aso-2026` → 200, page renders.
- Journals「福岡的螃蟹」「畑冷泉」still visible; date line shows `Date not set` until content gains `entryDate`.
- 梅響 / 竹庵 bodies unchanged.
