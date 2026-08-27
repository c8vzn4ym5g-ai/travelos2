# UI Specification

TravelOS should feel like a refined personal operating system for travel: organized, calm, visual, and efficient. It should not feel like a promotional landing page.

## Primary Screens

Dashboard, trip list, trip detail, trip editor, world map, timeline, albums, costs, places, AI assistant, settings.

## Dashboard Requirements

Show high-level travel stats, latest journeys, a map-ready visual region, and clear next actions. Work comfortably on mobile and desktop.

## Component Rules

Use compact cards only for repeated records and dashboard panels. Avoid nested cards. Use stable dimensions for map, list, and stat regions. Keep color restrained with clear contrast.

## Public Journal Costs

- The first screen is the story. The hero cost chip is a quiet number
  (`Cost` + €4,280). Do not put the 2020 disclaimer or August 2026 range
  next to the title.
- 2020 journal record, August 2026 range, and “not today's quote, tap 出發
  for live fares” sit behind a collapsed `<details>` on the cost chip and on
  Tracked spend. Small print. Default closed.
- The Lapland 2020 journal keeps €4,280 / €1,560 / €1,720 / €640. Ranges are
  not a fake exact total.
- `BookingBand` (`出發 / Go there`) stays the action for a live quote. Do not
  invent Travelpayouts widget hashes or dump booking URLs in the hero.

## Public storefront glance (Lapland)

- Under the map, a short bilingual why-go block about the place: where,
  when, what it feels like, and why a stranger might go. This copy is
  independent of journal bodies and photo captions.
- Do not rewrite family memory lines. Keep the winter-village title
  `記憶裡的聖誕卡 / A Christmas card from memory`.
- No fake prices, reviews, or unsourced stats. Live quotes stay on
  `BookingBand`, with 出发 / go-there, not in the first screen.
- First glance is a film cut: title and kicker, the public cut video,
  then ONE still. Extra Santa Claus Village photos and the long why-go /
  path copy sit behind a closed `更多 / More` tap. Do not delete locked
  copy. Hero video is `Lapland_那年冬天_Public_Cut.mp4`. Keep
  `WinterVocal_F.mp4` in the repo as archive; do not delete it. The frozen
  poster stays behind the tap, after the video, not above it.

## Public Lapland journey picture

- The first picture a stranger sees is the public cut, then one still.
  Extra photos wait behind the More tap. The frozen printed **portrait**
  itinerary plate sits in that More layer after the video, not a GIS
  widget and not the landscape A3. Left column: numbered notes with dump
  thumbs. Stop 3 is 羅瓦涅米 / Rovaniemi; the cabin is only the thumb and
  stay line. Right: Finland, Lapland to Helsinki. Footer: map key, four
  theme cards, Europe locator (locator is not a tap). December /
  midwinter language only; no day-by-day dates; no mid-map southward box.
- Show the **whole** 2:3 plate in about one screen: `max-height: 90vh`,
  width auto, `object-fit: contain`. Do not stretch, and do not crop the
  sidebar or footer. Drive chrome stays off the picture.

## Public Booking Band

- Finished public trip journals may show a reusable `BookingBand`
  (`出發 / Go there`) with ordinary Aviasales, Hotellook, and Klook search
  URLs. Default origin is HKG.
- `/drive` uses the same band as its main tools, not a lecture card.
- One bilingual affiliate line belongs in the band footer. Family, Capture,
  Write, and admin routes never render the band or Drive.

## Family Workspace Rules

- `/family` is the single authentication layer for every family department.
  Travel and Coffee editors must never render their own PIN form.
- The family password field must include a visible `顯示密碼 / 隱藏密碼`
  control so phone users can confirm exactly what they typed before submitting.
- A direct visit to a protected department without a family session returns the
  user to `/family`.
- `/family` is three stacked zones: 入口 (Capture + Write), 工作台
  (one door to `/family/bench`), then 編輯 (旅行遊記 and 咖啡記憶).
  工作台 appears once on that page and is not stuffed next to Capture.
- `/family/bench` is the family workshop table (工作台 / Bench): the raw pile of
  Capture dumps, newest first. It is private family, not the public storefront
  (橱窗). Do not put Drive or booking widgets there.
- Bench shows the workshop intro once. Native audio controls that error must
  not appear; unplayable voice is a quiet line. Transcripts may appear later
  without blocking the page.
- Content cards and editing surfaces use light backgrounds with dark text.
  Dark color may be used as a small accent, not as a large content box that can
  make labels or entered content appear obscured.
