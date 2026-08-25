# UI Specification

TravelOS should feel like a refined personal operating system for travel: organized, calm, visual, and efficient. It should not feel like a promotional landing page.

## Primary Screens

Dashboard, trip list, trip detail, trip editor, world map, timeline, albums, costs, places, AI assistant, settings.

## Dashboard Requirements

Show high-level travel stats, latest journeys, a map-ready visual region, and clear next actions. Work comfortably on mobile and desktop.

## Component Rules

Use compact cards only for repeated records and dashboard panels. Avoid nested cards. Use stable dimensions for map, list, and stat regions. Keep color restrained with clear contrast.

## Public Journal Costs

- Cost chips and Tracked spend on public trip journals are **journal records**
  from the trip dates, not live quotes. Label them with the trip year and
  `遊記 / Journal`.
- The Lapland 2020 journal keeps €4,280 / €1,560 / €1,720 / €640 and names
  them as that trip, about two people and about one week. A dated August 2026
  reference may sit beside them as ranges, not as a fake exact total.
- Point readers to `BookingBand` (`出發 / Go there`) for today's flight/hotel
  quote. Do not invent Travelpayouts widget hashes or dump booking URLs in the
  hero.

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
- Content cards and editing surfaces use light backgrounds with dark text.
  Dark color may be used as a small accent, not as a large content box that can
  make labels or entered content appear obscured.
