#!/usr/bin/env node
/**
 * Compose the public Lapland Journey-picture JPEG (portrait 1200×1800).
 * Free-ai-2 layout: left notes with dump thumbs beside each stop, right
 * Finland map, bottom-right icon row only. Seasonal December / midwinter
 * copy. Hotspot percentages match LAPLAND_GLANCE_HOTSPOTS.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import {
  getStreetTileUrl,
  LAPLAND_GLANCE_HOTSPOTS,
  LAPLAND_POSTER,
  LAPLAND_POSTER_HEIGHT,
  LAPLAND_POSTER_NOTES,
  LAPLAND_POSTER_TITLE,
  LAPLAND_POSTER_WIDTH,
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

const WIDTH = LAPLAND_POSTER_WIDTH;
const HEIGHT = LAPLAND_POSTER_HEIGHT;

const PAPER = "#f4f7f5";
const INK = "#1e293b";
const MUTED = "#5b6b64";
const WINTER = "#1f4f3d";
const SIDE = "#c45c28";
const CARD = "#e8ece9";
const THUMB_LINE = "#d7ddd8";

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
  { en: "Arctic Journey", zh: "極地之旅", icon: "camera" },
  { en: "Scenic Nature", zh: "自然風光", icon: "pine" },
  { en: "Local Experience", zh: "在地體驗", icon: "house" },
  { en: "Winter Exclusive", zh: "冬季限定", icon: "snow" },
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

  return { canvas: crop, height, jobs: jobs.length, project, width };
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
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = WINTER;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(7, 11);
  ctx.lineTo(0, 6);
  ctx.lineTo(-7, 11);
  ctx.closePath();
  ctx.fillStyle = WINTER;
  ctx.fill();
  ctx.font = "700 10px PosterLatin, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("N", 0, 14);
  ctx.restore();
}

function drawPin(ctx, x, y, number, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 13, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 12px PosterLatin, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), x, y + 0.5);
  ctx.restore();
}

function drawStopRow(ctx, { blurb, number, photo, phase, titleEn, titleZh, x, y, width, height }) {
  const color = phase === "city" ? SIDE : WINTER;
  const thumbW = 92;
  const thumbH = Math.min(70, height - 8);
  const thumbX = x;
  const thumbY = y + (height - thumbH) / 2;
  roundRect(ctx, thumbX, thumbY, thumbW, thumbH, 7);
  ctx.save();
  ctx.clip();
  coverImage(ctx, photo, thumbX, thumbY, thumbW, thumbH);
  ctx.restore();
  roundRect(ctx, thumbX, thumbY, thumbW, thumbH, 7);
  ctx.strokeStyle = THUMB_LINE;
  ctx.lineWidth = 1;
  ctx.stroke();

  const textX = thumbX + thumbW + 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(textX + 9, y + 14, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.font = "700 11px PosterLatin, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), textX + 9, y + 14.5);

  const titleX = textX + 22;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.font = "700 13px PosterCjk, sans-serif";
  ctx.fillText(titleZh, titleX, y + 10);
  ctx.fillStyle = MUTED;
  ctx.font = "700 10px PosterLatin, sans-serif";
  ctx.fillText(titleEn, titleX, y + 26);

  ctx.fillStyle = MUTED;
  ctx.font = "600 10px PosterCjk, PosterLatin, sans-serif";
  const maxWidth = width - (titleX - x) - 4;
  wrapText(ctx, blurb, titleX, y + 44, maxWidth, 13, 2);
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = text.split(/\s+/);
  let line = "";
  let lineY = y;
  let used = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      line = word;
      lineY += lineHeight;
      used += 1;
      if (used >= maxLines - 1) {
        break;
      }
    } else {
      line = next;
    }
  }
  if (used < maxLines && line) {
    let out = line;
    if (ctx.measureText(out).width > maxWidth) {
      while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
        out = out.slice(0, -1);
      }
      out = `${out}…`;
    }
    ctx.fillText(out, x, lineY);
  }
}

async function main() {
  const finland = await stitchMap({
    maxLat: 70.2,
    maxLng: 32.4,
    minLat: 59.2,
    minLng: 16.8,
    zoom: 6,
  });
  const photos = await Promise.all(NOTES.map((entry) => loadImage(resolve(root, "public/travelos/lapland", entry.file))));

  const poster = createCanvas(WIDTH, HEIGHT);
  const ctx = poster.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const notesW = Math.round(WIDTH * 0.392);
  const iconY = HEIGHT * LAPLAND_GLANCE_HOTSPOTS[0].y;
  const mapX = notesW;
  const mapY = 18;
  const mapW = WIDTH - mapX - 16;
  const mapH = iconY - mapY - 10;

  ctx.save();
  roundRect(ctx, mapX, mapY, mapW, mapH, 12);
  ctx.clip();
  ctx.drawImage(finland.canvas, mapX, mapY, mapW, mapH);
  ctx.restore();
  roundRect(ctx, mapX, mapY, mapW, mapH, 12);
  ctx.strokeStyle = "rgba(31,79,61,0.18)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  const scaleX = mapW / finland.width;
  const scaleY = mapH / finland.height;
  const toMap = (latitude, longitude) => {
    const point = finland.project(latitude, longitude);
    return { x: mapX + point.x * scaleX, y: mapY + point.y * scaleY };
  };

  const rovaniemi = toMap(66.5039, 25.7294);
  const helsinki = toMap(60.1699, 24.9384);
  const pin1 = { x: rovaniemi.x - 18, y: rovaniemi.y - 8, number: 1, color: WINTER };
  const pin2 = { x: rovaniemi.x + 22, y: rovaniemi.y - 28, number: 2, color: WINTER };
  const pin3 = { x: rovaniemi.x - 6, y: rovaniemi.y + 28, number: 3, color: WINTER };
  const pin4 = { x: helsinki.x - 16, y: helsinki.y - 10, number: 4, color: SIDE };
  const pin5 = { x: helsinki.x + 18, y: helsinki.y + 16, number: 5, color: SIDE };

  const arcticY = toMap(66.5436, 22).y;
  ctx.save();
  ctx.setLineDash([7, 6]);
  ctx.strokeStyle = "rgba(196,92,40,0.85)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(mapX + 12, arcticY);
  ctx.lineTo(mapX + mapW - 12, arcticY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = SIDE;
  ctx.font = "700 11px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Arctic Circle  北極圈", mapX + 18, arcticY - 8);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = WINTER;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(pin1.x, pin1.y);
  ctx.lineTo(pin3.x, pin3.y);
  ctx.lineTo((pin3.x + pin4.x) / 2 + 8, (pin3.y + pin4.y) / 2);
  ctx.lineTo(pin4.x, pin4.y);
  ctx.stroke();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = SIDE;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(pin4.x, pin4.y);
  ctx.lineTo(pin5.x, pin5.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  const midX = (pin3.x + pin4.x) / 2 + 10;
  const midY = (pin3.y + pin4.y) / 2;
  drawIcon(ctx, "pine", midX, midY - 18, WINTER);
  ctx.fillStyle = WINTER;
  ctx.font = "700 12px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("Then South", midX, midY + 4);

  [pin1, pin2, pin3, pin4, pin5].forEach((pin) => drawPin(ctx, pin.x, pin.y, pin.number, pin.color));

  ctx.fillStyle = INK;
  ctx.font = "700 13px PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("ROVANIEMI", pin1.x + 18, pin1.y - 16);
  ctx.fillText("HELSINKI", pin4.x + 18, pin4.y - 14);

  drawNorthArrow(ctx, mapX + 28, mapY + 32);

  const scaleW = 72;
  const scaleX0 = mapX + mapW - 110;
  const scaleY0 = mapY + mapH - 28;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(scaleX0, scaleY0);
  ctx.lineTo(scaleX0 + scaleW, scaleY0);
  ctx.moveTo(scaleX0, scaleY0 - 4);
  ctx.lineTo(scaleX0, scaleY0 + 4);
  ctx.moveTo(scaleX0 + scaleW, scaleY0 - 4);
  ctx.lineTo(scaleX0 + scaleW, scaleY0 + 4);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = "700 10px PosterLatin, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("100 km", scaleX0 + scaleW / 2, scaleY0 - 8);
  ctx.fillStyle = MUTED;
  ctx.font = "600 8px PosterLatin, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(STREET_BASEMAP.attribution, mapX + mapW - 10, mapY + mapH - 8);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, notesW, HEIGHT);

  ctx.fillStyle = WINTER;
  ctx.font = "700 11px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("AT A GLANCE", 22, 28);
  ctx.fillStyle = INK;
  ctx.font = "700 28px PosterCjk, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleZh, 22, 62);
  ctx.font = "700 18px PosterLatin, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleEn, 22, 86);
  ctx.fillStyle = MUTED;
  ctx.font = "600 12px PosterCjk, PosterLatin, sans-serif";
  ctx.fillText(`${LAPLAND_POSTER_TITLE.kickerZh}  ·  ${LAPLAND_POSTER_TITLE.kickerEn}`, 22, 108);
  ctx.fillText(LAPLAND_POSTER_TITLE.routeEn, 22, 126);

  const christmas = NOTES.slice(0, 3);
  const city = NOTES.slice(3);
  const headerH = 22;
  const pictureH = 92;
  const keyH = 78;
  const stackTop = 148;
  const stackBottom = HEIGHT - pictureH - keyH - 24;
  const innerH = stackBottom - stackTop - headerH * 2 - 12;
  const rowH = innerH / NOTES.length;

  ctx.fillStyle = WINTER;
  ctx.font = "700 11px PosterCjk, PosterLatin, sans-serif";
  ctx.fillText("聖誕季窗口 / Christmas Window", 22, stackTop);
  christmas.forEach((entry, index) => {
    drawStopRow(ctx, {
      blurb: `${entry.note.blurbZh} / ${entry.note.blurbEn}`,
      number: entry.note.number,
      photo: photos[index],
      phase: entry.note.phase,
      titleEn: entry.note.titleEn,
      titleZh: entry.note.titleZh,
      x: 22,
      y: stackTop + headerH + index * rowH,
      width: notesW - 36,
      height: rowH - 6,
    });
  });

  const cityTop = stackTop + headerH + christmas.length * rowH + 8;
  ctx.fillStyle = SIDE;
  ctx.font = "700 11px PosterCjk, PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("然後城市 / Then the City", 22, cityTop);
  city.forEach((entry, index) => {
    drawStopRow(ctx, {
      blurb:
        index === 1
          ? "Ninara · CC BY 2.0"
          : `${entry.note.blurbZh} / ${entry.note.blurbEn}`,
      number: entry.note.number,
      photo: photos[3 + index],
      phase: entry.note.phase,
      titleEn: entry.note.titleEn,
      titleZh: entry.note.titleZh,
      x: 22,
      y: cityTop + headerH + index * rowH,
      width: notesW - 36,
      height: rowH - 6,
    });
  });

  const pictureY = HEIGHT - pictureH - keyH - 16;
  roundRect(ctx, 18, pictureY, notesW - 36, pictureH - 8, 10);
  ctx.fillStyle = "#e7eef3";
  ctx.fill();
  drawIcon(ctx, "snow", 36, pictureY + 24, WINTER);
  ctx.fillStyle = WINTER;
  ctx.font = "700 11px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("This Picture", 52, pictureY + 20);
  ctx.fillStyle = MUTED;
  ctx.font = "600 10px PosterCjk, PosterLatin, sans-serif";
  wrapText(
    ctx,
    "聖誕老人村到赫爾辛基。Dump thumbs beside the notes; the map is the north–south path.",
    24,
    pictureY + 42,
    notesW - 52,
    13,
    3,
  );

  const keyY = HEIGHT - keyH - 10;
  ctx.fillStyle = INK;
  ctx.font = "700 10px PosterLatin, sans-serif";
  ctx.fillText("MAP KEY", 22, keyY + 8);
  ctx.strokeStyle = WINTER;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(22, keyY + 24);
  ctx.lineTo(54, keyY + 24);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = "600 10px PosterCjk, PosterLatin, sans-serif";
  ctx.fillText("Route", 62, keyY + 27);
  ctx.setLineDash([5, 4]);
  ctx.strokeStyle = SIDE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(22, keyY + 42);
  ctx.lineTo(54, keyY + 42);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillText("Arctic Circle", 62, keyY + 45);
  ctx.beginPath();
  ctx.arc(38, keyY + 60, 6, 0, Math.PI * 2);
  ctx.fillStyle = WINTER;
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.fillText("Stops", 62, keyY + 63);

  const bandLeft = WIDTH * LAPLAND_GLANCE_HOTSPOTS[0].x;
  const bandRight =
    WIDTH * LAPLAND_GLANCE_HOTSPOTS[3].x + WIDTH * LAPLAND_GLANCE_HOTSPOTS[3].w;
  const bandTop = iconY;
  const bandH = HEIGHT * LAPLAND_GLANCE_HOTSPOTS[0].h;
  roundRect(ctx, bandLeft - 6, bandTop, bandRight - bandLeft + 12, bandH, 10);
  ctx.fillStyle = CARD;
  ctx.fill();

  LAPLAND_GLANCE_HOTSPOTS.forEach((spot, index) => {
    const x = WIDTH * spot.x;
    const y = HEIGHT * spot.y;
    const w = WIDTH * spot.w;
    const h = HEIGHT * spot.h;
    const card = GLANCE_CARDS[index];
    drawIcon(ctx, card.icon, x + w / 2, y + 28, WINTER);
    ctx.textAlign = "center";
    ctx.fillStyle = INK;
    ctx.font = "700 11px PosterCjk, sans-serif";
    ctx.fillText(card.zh, x + w / 2, y + 52);
    ctx.fillStyle = MUTED;
    ctx.font = "700 9px PosterLatin, sans-serif";
    ctx.fillText(card.en, x + w / 2, y + 68);
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, poster.toBuffer("image/jpeg", 86));
  console.log(
    `Wrote ${LAPLAND_POSTER.relativeFile} (${WIDTH}x${HEIGHT} portrait JPEG, ${finland.jobs} OpenTopoMap tiles, icon row y=${LAPLAND_GLANCE_HOTSPOTS[0].y})`,
  );
}

await main();
