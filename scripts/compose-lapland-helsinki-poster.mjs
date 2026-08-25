#!/usr/bin/env node
/**
 * Compose the public Lapland Journey-picture JPEG (A3 landscape, web size).
 * Uses family dump / garnish photographs and OpenTopoMap tiles. Seasonal
 * December / midwinter copy only. Glance-band geometry matches
 * LAPLAND_GLANCE_HOTSPOTS (cards at y=0.931987, Europe locator at the right).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import {
  getStreetTileUrl,
  LAPLAND_GLANCE_HOTSPOTS,
  LAPLAND_POSTER,
  LAPLAND_POSTER_NOTES,
  LAPLAND_POSTER_TITLE,
  STREET_BASEMAP,
  TILE_PIXEL_SIZE,
} from "../lib/journey-map-model.ts";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, LAPLAND_POSTER.relativeFile);
const USER_AGENT = "TravelOS-lapland-poster/1.0 (itinerary raster; OpenTopoMap/OSM; no Google Maps)";
const FONT_CJK = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc";
const FONT_LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const FONT_LATIN_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const TILE_HOSTS = ["a", "b", "c"];
const TILE_CONCURRENCY = 4;

// Half of the 4200×2970 A3 print master so hotspot percentages stay exact.
const WIDTH = 2100;
const HEIGHT = 1485;

const PAPER = "#efe6d4";
const INK = "#1e293b";
const MUTED = "#5b6b64";
const WINTER = "#0f4f48";
const SIDE = "#b65f44";
const CARD = "#f7f1e6";

GlobalFonts.registerFromPath(FONT_CJK, "PosterCjk");
GlobalFonts.registerFromPath(FONT_LATIN, "PosterLatin");
GlobalFonts.registerFromPath(FONT_LATIN_REG, "PosterLatinReg");

const NOTES = [
  { file: "santa-village-night.jpeg", note: LAPLAND_POSTER_NOTES[0] },
  { file: "dump-arctic-circle-sign.jpeg", note: LAPLAND_POSTER_NOTES[1] },
  { file: "dump-cabin-4-snowman.jpeg", note: LAPLAND_POSTER_NOTES[2] },
  { file: "garnish-helsinki-cathedral.jpeg", note: LAPLAND_POSTER_NOTES[3] },
  { file: "garnish-helsinki-harbour.jpeg", note: LAPLAND_POSTER_NOTES[4] },
];

const GLANCE_CARDS = [
  { en: "Arctic Journey", kicker: "ARCTIC", zh: "極地暮光與雪", icon: "camera" },
  { en: "Scenic Nature", kicker: "NATURE", zh: "冰湖與森林", icon: "pine" },
  { en: "Local Experience", kicker: "STAY", zh: "木屋、雪橇、聖誕氣氛", icon: "house" },
  { en: "Winter Exclusive", kicker: "WINTER", zh: "只有深冬才有的路", icon: "snow" },
];

function lonToX(longitude, zoom) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latToY(latitude, zoom) {
  const radians = (latitude * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom;
}

function tileUrl(zoom, x, y, salt) {
  return getStreetTileUrl(zoom, x, y).replace(
    "tile.opentopomap.org",
    `${TILE_HOSTS[salt % TILE_HOSTS.length]}.tile.opentopomap.org`,
  );
}

async function fetchTile(url, attempt = 1) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    if (attempt < 6) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 500 * attempt));
      return fetchTile(url, attempt + 1);
    }
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

async function paintTiles(jobs, mosaicCtx) {
  for (let index = 0; index < jobs.length; index += TILE_CONCURRENCY) {
    const batch = jobs.slice(index, index + TILE_CONCURRENCY);
    const images = await Promise.all(
      batch.map(async (job) => ({
        col: job.col,
        row: job.row,
        image: await loadImage(await fetchTile(job.url)),
      })),
    );
    for (const tile of images) {
      mosaicCtx.drawImage(tile.image, tile.col * TILE_PIXEL_SIZE, tile.row * TILE_PIXEL_SIZE);
    }
  }
}

async function stitchMap({ maxLat, maxLng, minLat, minLng, zoom }) {
  const minX = lonToX(minLng, zoom);
  const maxX = lonToX(maxLng, zoom);
  const minY = latToY(maxLat, zoom);
  const maxY = latToY(minLat, zoom);
  const tileCount = 2 ** zoom;
  const gridMinX = Math.floor(minX);
  const gridMaxX = Math.floor(maxX);
  const gridMinY = Math.max(0, Math.floor(minY));
  const gridMaxY = Math.min(tileCount - 1, Math.floor(maxY));
  const cols = gridMaxX - gridMinX + 1;
  const rows = gridMaxY - gridMinY + 1;
  const mosaic = createCanvas(cols * TILE_PIXEL_SIZE, rows * TILE_PIXEL_SIZE);
  const mosaicCtx = mosaic.getContext("2d");
  mosaicCtx.fillStyle = "#7eb56a";
  mosaicCtx.fillRect(0, 0, mosaic.width, mosaic.height);

  const jobs = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = gridMinX + col;
      const y = gridMinY + row;
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      jobs.push({ col, row, url: tileUrl(zoom, wrappedX, y, row + col) });
    }
  }
  await paintTiles(jobs, mosaicCtx);

  const width = Math.max(1, Math.round((maxX - minX) * TILE_PIXEL_SIZE));
  const height = Math.max(1, Math.round((maxY - minY) * TILE_PIXEL_SIZE));
  const crop = createCanvas(width, height);
  const cropCtx = crop.getContext("2d");
  cropCtx.drawImage(mosaic, (minX - gridMinX) * TILE_PIXEL_SIZE, (minY - gridMinY) * TILE_PIXEL_SIZE, width, height, 0, 0, width, height);

  const project = (latitude, longitude) => ({
    x: ((lonToX(longitude, zoom) - minX) / (maxX - minX)) * width,
    y: ((latToY(latitude, zoom) - minY) / (maxY - minY)) * height,
  });

  return { canvas: crop, height, project, width };
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function coverImage(ctx, image, x, y, width, height) {
  const scale = Math.max(width / image.width, height / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(image, x + (width - dw) / 2, y + (height - dh) / 2, dw, dh);
  ctx.restore();
}

function drawIcon(ctx, kind, cx, cy, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "camera") {
    ctx.roundRect(-10, -6, 20, 14, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 1, 4.2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (kind === "pine") {
    ctx.moveTo(0, -11);
    ctx.lineTo(8, 2);
    ctx.lineTo(-8, 2);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(0, 11);
    ctx.stroke();
  } else if (kind === "house") {
    ctx.moveTo(-10, 2);
    ctx.lineTo(0, -10);
    ctx.lineTo(10, 2);
    ctx.lineTo(10, 11);
    ctx.lineTo(-10, 11);
    ctx.closePath();
    ctx.stroke();
  } else {
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 10);
    ctx.moveTo(-10, 0);
    ctx.lineTo(10, 0);
    ctx.moveTo(-7, -7);
    ctx.lineTo(7, 7);
    ctx.moveTo(7, -7);
    ctx.lineTo(-7, 7);
    ctx.stroke();
  }
  ctx.restore();
}

function drawNorthArrow(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "rgba(255,248,238,0.92)";
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = WINTER;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(8, 14);
  ctx.lineTo(0, 8);
  ctx.lineTo(-8, 14);
  ctx.closePath();
  ctx.fillStyle = WINTER;
  ctx.fill();
  ctx.fillStyle = WINTER;
  ctx.font = "700 11px PosterLatin, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("N", 0, 16);
  ctx.restore();
}

function drawEuropeLocator(ctx, x, y, width, height) {
  roundRect(ctx, x, y, width, height, 10);
  ctx.fillStyle = "#dfe7dc";
  ctx.fill();
  ctx.strokeStyle = "rgba(15,79,72,0.18)";
  ctx.lineWidth = 1;
  ctx.stroke();

  const ox = x + 10;
  const oy = y + 8;
  const sx = (width - 20) / 80;
  const sy = (height - 18) / 70;
  const europe = [
    [8, 62],
    [18, 58],
    [28, 52],
    [36, 48],
    [48, 46],
    [62, 44],
    [70, 38],
    [74, 28],
    [70, 16],
    [58, 12],
    [42, 18],
    [28, 22],
    [18, 28],
    [10, 38],
    [6, 50],
  ];
  ctx.beginPath();
  europe.forEach((point, index) => {
    const px = ox + point[0] * sx;
    const py = oy + point[1] * sy;
    if (index === 0) {
      ctx.moveTo(px, py);
    } else {
      ctx.lineTo(px, py);
    }
  });
  ctx.closePath();
  ctx.fillStyle = "#c5d4c0";
  ctx.fill();

  ctx.fillStyle = WINTER;
  ctx.beginPath();
  ctx.moveTo(ox + 48 * sx, oy + 8 * sy);
  ctx.lineTo(ox + 56 * sx, oy + 8 * sy);
  ctx.lineTo(ox + 54 * sx, oy + 28 * sy);
  ctx.lineTo(ox + 50 * sx, oy + 28 * sy);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = MUTED;
  ctx.font = "700 11px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("EUROPE 歐洲", x + width / 2, y + height - 4);
}

function drawInset(ctx, image, x, y, width, height, title) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 10);
  ctx.clip();
  ctx.drawImage(image, x, y, width, height);
  ctx.restore();
  roundRect(ctx, x, y, width, height, 10);
  ctx.strokeStyle = "rgba(15,36,32,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "rgba(15,36,32,0.78)";
  ctx.fillRect(x, y, width, 22);
  ctx.fillStyle = "#f7f1e6";
  ctx.font = "700 12px PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(title, x + 8, y + 11);
}

async function main() {
  const finland = await stitchMap({
    maxLat: 70.2,
    maxLng: 32.4,
    minLat: 59.2,
    minLng: 16.8,
    zoom: 6,
  });
  const napapiiri = await stitchMap({
    maxLat: 66.552,
    maxLng: 25.872,
    minLat: 66.534,
    minLng: 25.822,
    zoom: 14,
  });
  const helsinki = await stitchMap({
    maxLat: 60.178,
    maxLng: 24.975,
    minLat: 60.158,
    minLng: 24.93,
    zoom: 14,
  });
  const photos = await Promise.all(NOTES.map((entry) => loadImage(resolve(root, "public/travelos/lapland", entry.file))));

  const poster = createCanvas(WIDTH, HEIGHT);
  const ctx = poster.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const glanceY = HEIGHT * LAPLAND_GLANCE_HOTSPOTS[0].y;
  const mapX = Math.round(WIDTH * 0.262);
  const mapY = 18;
  const mapW = WIDTH - mapX - 18;
  const mapH = glanceY - mapY - 12;

  ctx.drawImage(finland.canvas, mapX, mapY, mapW, mapH);

  const rovaniemi = finland.project(66.5039, 25.7294);
  const helsinkiCity = finland.project(60.1699, 24.9384);
  const scaleX = mapW / finland.width;
  const scaleY = mapH / finland.height;
  const toMap = (point) => ({ x: mapX + point.x * scaleX, y: mapY + point.y * scaleY });
  const from = toMap(rovaniemi);
  const to = toMap(helsinkiCity);

  ctx.save();
  ctx.strokeStyle = "rgba(247,241,230,0.92)";
  ctx.lineWidth = 10;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.strokeStyle = WINTER;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(247,241,230,0.88)";
  ctx.beginPath();
  ctx.arc(from.x, from.y, 7, 0, Math.PI * 2);
  ctx.arc(to.x, to.y, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.font = "700 28px PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("LAPLAND", mapX + mapW * 0.42, mapY + mapH * 0.18);
  ctx.font = "700 16px PosterCjk, sans-serif";
  ctx.fillStyle = MUTED;
  ctx.fillText("拉普蘭", mapX + mapW * 0.42, mapY + mapH * 0.18 + 22);

  ctx.fillStyle = INK;
  ctx.font = "700 18px PosterLatin, sans-serif";
  ctx.fillText("ROVANIEMI", from.x + 14, from.y - 8);
  ctx.fillText("HELSINKI", to.x + 14, to.y + 6);
  ctx.font = "600 13px PosterLatin, PosterCjk, sans-serif";
  ctx.fillStyle = SIDE;
  ctx.fillText("Arctic Circle 北極圈", mapX + mapW * 0.34, mapY + mapH * 0.29);
  ctx.fillStyle = MUTED;
  ctx.fillText("Gulf of Bothnia", mapX + 28, mapY + mapH * 0.55);
  ctx.fillText("Gulf of Finland", mapX + mapW * 0.58, mapY + mapH * 0.9);

  ctx.fillStyle = WINTER;
  ctx.font = "700 16px PosterCjk, PosterLatin, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("向南前行  Then south", (from.x + to.x) / 2 + 36, (from.y + to.y) / 2);

  drawInset(ctx, napapiiri.canvas, mapX + 16, mapY + 16, 250, 210, "NAPAPIIRI");
  drawInset(ctx, helsinki.canvas, mapX + mapW - 266, mapY + mapH - 226, 250, 210, "HELSINKI");
  drawNorthArrow(ctx, mapX + mapW - 42, mapY + 46);

  roundRect(ctx, mapX + 16, mapY + mapH - 118, 210, 100, 10);
  ctx.fillStyle = "rgba(247,241,230,0.94)";
  ctx.fill();
  ctx.fillStyle = WINTER;
  ctx.font = "700 13px PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("LEGEND", mapX + 28, mapY + mapH - 96);
  ctx.strokeStyle = WINTER;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(mapX + 28, mapY + mapH - 72);
  ctx.lineTo(mapX + 70, mapY + mapH - 72);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = "600 12px PosterCjk, PosterLatin, sans-serif";
  ctx.fillText("Lapland → Helsinki", mapX + 80, mapY + mapH - 68);
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = SIDE;
  ctx.beginPath();
  ctx.moveTo(mapX + 28, mapY + mapH - 48);
  ctx.lineTo(mapX + 70, mapY + mapH - 48);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText("Arctic Circle", mapX + 80, mapY + mapH - 44);
  ctx.fillStyle = MUTED;
  ctx.font = "600 11px PosterLatin, sans-serif";
  ctx.fillText("OpenTopoMap · OSM", mapX + 28, mapY + mapH - 24);

  const colW = mapX - 16;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, mapX, glanceY);

  ctx.fillStyle = WINTER;
  ctx.font = "700 15px PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("一眼 / AT A GLANCE", 22, 28);
  ctx.fillStyle = INK;
  ctx.font = "700 32px PosterCjk, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleZh, 22, 64);
  ctx.font = "700 20px PosterLatin, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleEn, 22, 90);
  ctx.fillStyle = MUTED;
  ctx.font = "600 14px PosterCjk, PosterLatin, sans-serif";
  ctx.fillText(`${LAPLAND_POSTER_TITLE.kickerZh}  ·  ${LAPLAND_POSTER_TITLE.kickerEn}`, 22, 114);
  ctx.fillText(LAPLAND_POSTER_TITLE.routeEn, 22, 134);

  const stackTop = 150;
  const stackBottom = glanceY - 28;
  const rowH = (stackBottom - stackTop) / NOTES.length;

  NOTES.forEach((entry, index) => {
    const y = stackTop + index * rowH;
    const color = entry.note.phase === "city" ? SIDE : WINTER;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(34, y + 18, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "700 13px PosterLatin, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(entry.note.number), 34, y + 18);

    ctx.textAlign = "left";
    ctx.fillStyle = INK;
    ctx.font = "700 16px PosterCjk, sans-serif";
    ctx.fillText(entry.note.titleZh, 52, y + 12);
    ctx.fillStyle = MUTED;
    ctx.font = "700 12px PosterLatin, sans-serif";
    ctx.fillText(entry.note.titleEn, 52, y + 30);

    const photoX = 22;
    const photoY = y + 42;
    const photoW = colW - 28;
    const photoH = rowH - 52;
    roundRect(ctx, photoX, photoY, photoW, photoH, 8);
    ctx.save();
    ctx.clip();
    coverImage(ctx, photos[index], photoX, photoY, photoW, photoH);
    ctx.restore();
  });

  ctx.fillStyle = MUTED;
  ctx.font = "600 10px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Harbour photo: Ninara · CC BY 2.0", 22, glanceY - 10);
  ctx.fillText(STREET_BASEMAP.attribution, 22, glanceY - 24);

  ctx.fillStyle = "#e7dcc6";
  ctx.fillRect(0, glanceY, WIDTH, HEIGHT - glanceY);

  LAPLAND_GLANCE_HOTSPOTS.forEach((spot, index) => {
    const x = WIDTH * spot.x;
    const y = HEIGHT * spot.y;
    const w = WIDTH * spot.w;
    const h = HEIGHT * spot.h;
    const card = GLANCE_CARDS[index];
    roundRect(ctx, x + 4, y + 6, w - 8, h - 12, 12);
    ctx.fillStyle = CARD;
    ctx.fill();
    drawIcon(ctx, card.icon, x + 28, y + h / 2, WINTER);
    ctx.textAlign = "left";
    ctx.fillStyle = WINTER;
    ctx.font = "700 11px PosterLatin, sans-serif";
    ctx.fillText(card.kicker, x + 48, y + 22);
    ctx.fillStyle = INK;
    ctx.font = "700 15px PosterLatin, sans-serif";
    ctx.fillText(card.en, x + 48, y + 42);
    ctx.fillStyle = MUTED;
    ctx.font = "600 13px PosterCjk, sans-serif";
    ctx.fillText(card.zh, x + 48, y + 64);
  });

  const locatorX = WIDTH * 0.91;
  drawEuropeLocator(ctx, locatorX, glanceY + 8, WIDTH - locatorX - 12, HEIGHT - glanceY - 16);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, poster.toBuffer("image/jpeg", 82));
  console.log(`Wrote ${LAPLAND_POSTER.relativeFile} (${WIDTH}x${HEIGHT} JPEG)`);
}

await main();
