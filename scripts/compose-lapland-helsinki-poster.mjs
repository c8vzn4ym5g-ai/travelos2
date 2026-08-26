#!/usr/bin/env node
/**
 * Compose the public Lapland Journey-picture JPEG (portrait 1200×1800).
 * v5 plate: dump / garnish thumbs on the left, Finland map, complete footer
 * (map key + two-line theme-card blurbs + Europe locator). No mid-map
 * southward callout. Hotspot percentages match LAPLAND_GLANCE_HOTSPOTS.
 * Locator is drawn, not a tap.
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

const PAPER = "#f7f4ee";
const FOOTER = "#ece7de";
const INK = "#1e293b";
const MUTED = "#5b6b64";
const WINTER = "#1f4f3d";
const SIDE = "#c45c28";
const CARD = "#f4efe6";
const THUMB_LINE = "#d7ddd8";
const FINLAND = "#1f5c56";

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
  {
    blurbEn: "Experience the purity of polar night and snow.",
    blurbZh: "極夜與雪國的純淨體驗",
    en: "Arctic Journey",
    icon: "camera",
    zh: "極地之旅",
  },
  {
    blurbEn: "Frozen lakes and forests in pristine beauty.",
    blurbZh: "冰雪覆蓋的湖泊與森林",
    en: "Scenic Nature",
    icon: "pine",
    zh: "自然風光",
  },
  {
    blurbEn: "Cabins, sleds, and holiday spirit.",
    blurbZh: "木屋、雪橇、聖誕氛圍",
    en: "Local Experience",
    icon: "house",
    zh: "在地體驗",
  },
  {
    blurbEn: "A magical journey only in midwinter.",
    blurbZh: "深冬限定的奇幻旅程",
    en: "Winter Exclusive",
    icon: "snow",
    zh: "冬季限定",
  },
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

function drawShip(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = "#1e3a4c";
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.lineTo(10, 2);
  ctx.lineTo(6, 8);
  ctx.lineTo(-6, 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f7f4ee";
  ctx.fillRect(-2, -8, 3, 10);
  ctx.beginPath();
  ctx.moveTo(1, -8);
  ctx.lineTo(8, -2);
  ctx.lineTo(1, -2);
  ctx.closePath();
  ctx.fill();
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

function drawEuropeLocator(ctx, x, y, width, height) {
  const pad = 8;
  roundRect(ctx, x, y, width, height, 8);
  ctx.fillStyle = "#d9e0dc";
  ctx.fill();

  ctx.save();
  ctx.translate(x + pad, y + pad + 10);
  const scaleX = (width - pad * 2) / 120;
  const scaleY = (height - pad * 2 - 14) / 140;
  ctx.scale(scaleX, scaleY);

  ctx.fillStyle = "#9aa7a0";
  ctx.beginPath();
  ctx.moveTo(18, 18);
  ctx.lineTo(42, 8);
  ctx.lineTo(58, 22);
  ctx.lineTo(78, 14);
  ctx.lineTo(96, 28);
  ctx.lineTo(108, 48);
  ctx.lineTo(102, 78);
  ctx.lineTo(88, 108);
  ctx.lineTo(70, 128);
  ctx.lineTo(48, 122);
  ctx.lineTo(28, 98);
  ctx.lineTo(12, 72);
  ctx.lineTo(8, 42);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = FINLAND;
  ctx.beginPath();
  ctx.moveTo(78, 22);
  ctx.lineTo(92, 18);
  ctx.lineTo(96, 38);
  ctx.lineTo(90, 62);
  ctx.lineTo(82, 58);
  ctx.lineTo(76, 36);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = WINTER;
  ctx.font = "700 9px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Europe · 芬蘭", x + width / 2, y + 14);
}

function drawMapKey(ctx, x, y, width, height) {
  ctx.fillStyle = INK;
  ctx.font = "700 10px PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("MAP KEY", x, y + 14);

  const rows = [
    { kind: "route", label: "Route / 路線" },
    { kind: "walk", label: "Walking path / 步行" },
    { kind: "arctic", label: "Arctic Circle / 北極圈" },
    { kind: "stop", label: "Stops / 景點" },
    { kind: "city", label: "Major cities / 城市" },
  ];
  rows.forEach((row, index) => {
    const rowY = y + 32 + index * 16;
    if (row.kind === "route") {
      ctx.strokeStyle = WINTER;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x + 28, rowY);
      ctx.stroke();
    } else if (row.kind === "walk") {
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = SIDE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x + 28, rowY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (row.kind === "arctic") {
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "#5b6b64";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(x, rowY);
      ctx.lineTo(x + 28, rowY);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (row.kind === "stop") {
      ctx.beginPath();
      ctx.arc(x + 14, rowY, 6, 0, Math.PI * 2);
      ctx.fillStyle = WINTER;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "700 8px PosterLatin, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("1", x + 14, rowY + 0.5);
    } else {
      ctx.fillStyle = INK;
      ctx.font = "700 8px PosterLatin, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("HEL", x + 4, rowY + 3);
    }
    ctx.fillStyle = MUTED;
    ctx.font = "600 9px PosterCjk, PosterLatin, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(row.label, x + 36, rowY);
  });
  void width;
  void height;
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

  const footerY = HEIGHT * LAPLAND_GLANCE_HOTSPOTS[0].y;
  const notesW = Math.round(WIDTH * 0.36);
  const mapX = notesW;
  const mapY = 0;
  const mapW = WIDTH - mapX;
  const mapH = footerY;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX, mapY, mapW, mapH);
  ctx.clip();
  ctx.drawImage(finland.canvas, mapX, mapY, mapW, mapH);
  ctx.restore();

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
  ctx.strokeStyle = "rgba(90,100,96,0.9)";
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(mapX + 8, arcticY);
  ctx.lineTo(mapX + mapW - 8, arcticY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = MUTED;
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

  [pin1, pin2, pin3, pin4, pin5].forEach((pin) => drawPin(ctx, pin.x, pin.y, pin.number, pin.color));

  ctx.fillStyle = INK;
  ctx.font = "700 13px PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("羅瓦涅米", pin3.x + 18, pin3.y - 4);
  ctx.font = "700 11px PosterLatin, sans-serif";
  ctx.fillText("Rovaniemi", pin3.x + 18, pin3.y + 12);
  ctx.font = "700 13px PosterLatin, sans-serif";
  ctx.fillText("HELSINKI", pin4.x + 18, pin4.y - 14);
  ctx.fillText("LAPLAND", pin1.x - 8, pin1.y - 36);

  drawShip(ctx, pin5.x + 48, pin5.y + 28);
  drawNorthArrow(ctx, mapX + mapW - 36, mapY + 36);

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, notesW, footerY);

  ctx.fillStyle = WINTER;
  ctx.font = "700 11px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("一眼 / At a glance", 22, 28);
  ctx.fillStyle = INK;
  ctx.font = "700 26px PosterCjk, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleZh, 22, 60);
  ctx.font = "700 16px PosterLatin, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleEn, 22, 82);
  ctx.fillStyle = MUTED;
  ctx.font = "600 12px PosterCjk, PosterLatin, sans-serif";
  ctx.fillText(`${LAPLAND_POSTER_TITLE.kickerZh}  ·  ${LAPLAND_POSTER_TITLE.kickerEn}`, 22, 104);
  ctx.fillText(LAPLAND_POSTER_TITLE.routeEn, 22, 122);

  const christmas = NOTES.slice(0, 3);
  const city = NOTES.slice(3);
  const headerH = 20;
  const pictureH = 70;
  const stackTop = 142;
  const stackBottom = footerY - pictureH - 12;
  const innerH = stackBottom - stackTop - headerH * 2 - 12;
  const rowH = innerH / NOTES.length;

  ctx.fillStyle = WINTER;
  ctx.font = "700 11px PosterCjk, PosterLatin, sans-serif";
  ctx.fillText("聖誕季窗口 / Christmas window", 22, stackTop);
  christmas.forEach((entry, index) => {
    drawStopRow(ctx, {
      blurb: `${entry.note.blurbZh} / ${entry.note.blurbEn}`,
      number: entry.note.number,
      photo: photos[index],
      phase: entry.note.phase,
      titleEn: entry.note.titleEn,
      titleZh: entry.note.titleZh,
      x: 18,
      y: stackTop + headerH + index * rowH,
      width: notesW - 28,
      height: rowH - 6,
    });
  });

  const cityTop = stackTop + headerH + christmas.length * rowH + 8;
  ctx.fillStyle = SIDE;
  ctx.font = "700 11px PosterCjk, PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("然後城市 / Then the city", 22, cityTop);
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
      x: 18,
      y: cityTop + headerH + index * rowH,
      width: notesW - 28,
      height: rowH - 6,
    });
  });

  const pictureY = footerY - pictureH;
  ctx.fillStyle = MUTED;
  ctx.font = "700 10px PosterCjk, PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("這張圖 / This picture", 22, pictureY + 14);
  ctx.font = "600 10px PosterCjk, PosterLatin, sans-serif";
  wrapText(
    ctx,
    "北極圈往南到赫爾辛基。Dump thumbs beside the notes; the map is the north–south path.",
    22,
    pictureY + 30,
    notesW - 36,
    13,
    3,
  );

  ctx.fillStyle = FOOTER;
  ctx.fillRect(0, footerY, WIDTH, HEIGHT - footerY);

  const keyRight = WIDTH * LAPLAND_GLANCE_HOTSPOTS[0].x - 10;
  drawMapKey(ctx, 18, footerY + 8, keyRight - 22, HEIGHT - footerY - 16);

  LAPLAND_GLANCE_HOTSPOTS.forEach((spot, index) => {
    const x = WIDTH * spot.x;
    const y = HEIGHT * spot.y;
    const w = WIDTH * spot.w;
    const h = HEIGHT * spot.h;
    const card = GLANCE_CARDS[index];
    roundRect(ctx, x + 3, y + 6, w - 6, h - 12, 10);
    ctx.fillStyle = CARD;
    ctx.fill();
    drawIcon(ctx, card.icon, x + w / 2, y + 24, WINTER);
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = INK;
    ctx.font = "700 12px PosterCjk, sans-serif";
    ctx.fillText(card.zh, x + w / 2, y + 46);
    ctx.font = "700 9px PosterLatin, sans-serif";
    ctx.fillText(card.en, x + w / 2, y + 60);
    ctx.fillStyle = MUTED;
    ctx.font = "600 9px PosterCjk, sans-serif";
    wrapText(ctx, card.blurbZh, x + 8, y + 76, w - 16, 11, 1);
    ctx.font = "600 8px PosterLatin, sans-serif";
    wrapText(ctx, card.blurbEn, x + 8, y + 90, w - 16, 10, 2);
  });

  const locatorX = WIDTH * LAPLAND_GLANCE_HOTSPOTS[3].x + WIDTH * LAPLAND_GLANCE_HOTSPOTS[3].w + 8;
  drawEuropeLocator(ctx, locatorX, footerY + 10, WIDTH - locatorX - 12, HEIGHT - footerY - 20);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, poster.toBuffer("image/jpeg", 86));
  console.log(
    `Wrote ${LAPLAND_POSTER.relativeFile} (${WIDTH}x${HEIGHT} portrait JPEG, ${finland.jobs} OpenTopoMap tiles, theme cards y=${LAPLAND_GLANCE_HOTSPOTS[0].y})`,
  );
}

await main();
