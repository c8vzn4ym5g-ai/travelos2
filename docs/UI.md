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
  copy. Hero video is `Lapland_那年冬天_WinterWarm_Q.mp4`. Keep
  `Public_Cut.mp4` and `WinterVocal_F.mp4` in the repo as archive; do not
  delete them. Do not point the hero at F. Default WITH sound: try
  unmuted `play()` first; on `NotAllowedError` keep the picture moving
  muted and put `輕點開聲音 / Tap for sound` on the frame itself. After
  that tap, the cue goes away and sound stays on. Native controls stay so
  someone who wants silence can mute. The frozen
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
- `/family` is three stacked zones: 入口 (Capture + Write + 行程 pill to
  `/family/trip`), 工作台
  (one door to `/family/bench`), then 編輯 (旅行遊記 and 咖啡記憶).
  工作台 appears once on that page and is not stuffed next to Capture.
  旅行遊記 stays public `/trips`. The 行程 and 說說 controls are framed
  pills, not decorative stickers.
- `/family/bench` is the family workshop table (工作台 / Bench): the raw pile of
  Capture dumps, newest first. It is private family, not the public storefront
  (橱窗). Do not put Drive or booking widgets there.
- `/family/trip` is a family-only trip companion in the same 家庭本子 visual
  (`data-surface="family"`). Sticky 1–8 day-strip stays. **總表** (week
  rows) sits at the top; **表1** is eight day writeups (`trip-day-N`)
  below, not a highlighted row. Sticky + 總表 tap `jumpToDay` scrolls
  that section under the sticky strip. Day-1
  cards stay 飛 → 車 → 住. Chinese first, muted Japanese under hotel names.
  Restaurant and craft recs include 地址 and 電話. Dinners are 建議自訂
  except 西川 已訂. 佐藤酒造 is 已發申請, not confirmed. Solaria / Flügel /
  Nissan stay Latin. 梅響 + うめひびき. 星野 界・由布院 + 界 由布院.
  Meals are 早餐 / 晚餐 with a cute tick or X — not 有/沒 pills, not 今早 /
  明早. Day-1 today card is 去搭飛機 JX316 only. 8/30 is sleep only. 9/5
  night is empty. Copy the KMJ map crop and Serena photo as bytes
  (`object-fit: contain`); do not redraw them. Day 1 Solaria
  `TF53AEFAC2A33` is a different booking from Days 5–6 `T032CA29B451B`.
  No 8-day map until GM sends a PASSED file + sha256. Do not copy a
  failed plate or draw GIS. Grade: tap 3 lands on 梅響 / 小鹿田 / 和くら.
  No station shuttles. Footer: 沒有接駁車。9/5 還沒訂. Do not invent a
  letter check-in clock, a missing-guest warning, passenger DOB, or “GM 填”.
  Public `/trips` is untouched.
- `/family/talk` is a family-only Kyushu talk translator on the same apple
  paper. Two huge tap modes only: 我說中文 (zh-TW/zh-CN → spoken Japanese)
  and 對方說日文 (ja-JP → spoken Chinese). Tap to start, tap to stop.
  Web Speech first, then MediaRecorder + Workers AI Whisper. Translation
  is spoken, not literary. Back is a framed press-in button, not naked
  text. PWA manifest + apple-touch-icon live under `/family/talk`.
  English, auto-detect, Capture dump, itinerary, and Drive stay out.
- Family workshop pages use pale green-apple paper, rounded 本子 type, and family tokens.
  Do not use public magazine Georgia / teal kickers or theme-color `#0f766e`
  on `/family`, `/family/capture`, `/family/bench`, `/family/trip`, or `/family/talk`.
- Bench shows the workshop intro once. Native audio controls that error must
  not appear; unplayable voice is a quiet line. Transcripts may appear later
  without blocking the page. The spoken line is tappable on the card itself;
  a correction persists through the existing moment update path. No extra
  save wizard, tags, or classify on that line.
- Capture voice keeps the existing mic/dump door. After recognition the
  spoken line is a textarea on that line. Language chips `粵 / 国 / EN`
  sit near the mic (`data-surface=family`, apple paper / young leaf, M PLUS Rounded /
  Nunito). Last chip is remembered in localStorage. Default `国` (`zh-TW`).
  `粵` sends `zh-HK` or `yue-Hant-HK` to Web Speech; `EN` is `en-US`. Do
  not fake iPhone auto-detect. Photo dump stays one pick up to 40,
  parallel POSTs, no queue-of-3, no classify at dump.
- The empty Capture middle card is preview of what just landed, not a
  shutter. No camera glyph. 拍照 / 選照片 pills are the only capture doors.
- Content cards and editing surfaces use light backgrounds with dark text.
  Dark color may be used as a small accent, not as a large content box that can
  make labels or entered content appear obscured.
