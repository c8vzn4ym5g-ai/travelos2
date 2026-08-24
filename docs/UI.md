# UI Specification

TravelOS should feel like a refined personal operating system for travel: organized, calm, visual, and efficient. It should not feel like a promotional landing page.

## Primary Screens

Dashboard, trip list, trip detail, trip editor, world map, timeline, albums, costs, places, AI assistant, settings.

## Dashboard Requirements

Show high-level travel stats, latest journeys, a map-ready visual region, and clear next actions. Work comfortably on mobile and desktop.

## Component Rules

Use compact cards only for repeated records and dashboard panels. Avoid nested cards. Use stable dimensions for map, list, and stat regions. Keep color restrained with clear contrast.

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

## Public Travelpayouts Rules

- Travelpayouts Drive is an affiliate layer over public destination copy, not a
  car-rental search and not a family tool.
- Load the registered Drive script only on public pages. Skip `/family`,
  `/family/*`, `/sana`, `/trips/admin`, `/coffee/admin`, `/trips/new`,
  `/coffee/new`, and `/trips/write`. A pathname gate is enough; family,
  Capture, and sit-and-write HTML must not contain the Drive script.
- Public trip pages keep story, photos, and the itinerary picture first.
  Then a native `出發 / Go there` BookingBand (flights, stays, things to
  do) with 44px controls. `/drive` uses the same band as its main tools.
- Home presents the public journal as the viewer hero. `家庭編輯` stays a
  quiet family door. Do not put Drive, BookingBand, or affiliate language
  on `/family`.
- One bilingual affiliate line in the booking band or footer. Do not use
  a yellow lecture card as the main content.
- Use ordinary brand search URLs so Drive can attribute them. Do not
  invent widget IDs, paste fake booking iframes, or load extra ad networks.
