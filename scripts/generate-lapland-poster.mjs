#!/usr/bin/env node
/**
 * Rebuild the Lapland journey picture from lib/journey-map-model.ts.
 *
 * Printed-itinerary architecture: LEFT notes column, RIGHT colorful
 * OpenTopoMap of Finland (north Lapland → south Helsinki) so parks,
 * water, terrain, and roads actually read. Tiles:
 * https://tile.opentopomap.org/{z}/{x}/{y}.png
 * (no Google, no API key). Numbered pins stay on the map; short blurbs
 * sit under each number. Seasonal December / midwinter language only.
 * Run again when stops change: `pnpm generate:lapland-poster`
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCanvas, GlobalFonts, loadImage } from "@napi-rs/canvas";
import {
  arcticCirclePosterPath,
  buildJourneyItinerary,
  buildPosterLayout,
  getLaplandPosterRasterSize,
  getPosterRasterSize,
  getPosterTileGrid,
  getStreetTileUrl,
  LAPLAND_CITY,
  LAPLAND_HELSINKI,
  LAPLAND_POSTER,
  LAPLAND_POSTER_LEGEND_RATIO,
  LAPLAND_POSTER_TITLE,
  POSTER_THEME,
  projectOntoLaplandPoster,
  STREET_BASEMAP,
  TILE_PIXEL_SIZE,
} from "../lib/journey-map-model.ts";
import { seedTripDetails } from "../lib/trips.ts";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, LAPLAND_POSTER.relativeFile);
const USER_AGENT = "TravelOS-lapland-poster/1.0 (itinerary raster generator; OpenTopoMap/OSM tiles; no Google Maps)";
const FONT_CJK = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc";
const FONT_LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const FONT_LATIN_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";
const TILE_HOSTS = ["a", "b", "c"];
const TILE_CONCURRENCY = 4;

GlobalFonts.registerFromPath(FONT_CJK, "PosterCjk");
GlobalFonts.registerFromPath(FONT_LATIN, "PosterLatin");
GlobalFonts.registerFromPath(FONT_LATIN_REG, "PosterLatinReg");

const PAPER = "#fff8ee";
const PAPER_RULE = "rgba(15, 79, 72, 0.12)";
const TITLE_BAR = "#0f4f48";
const TITLE_INK = "#f7f1e6";
const MUTED = "#5b6b64";
const ARCTIC = "rgba(125, 84, 52, 0.78)";

function pctX(width, percent) {
  return (percent / 100) * width;
}

function pctY(height, percent) {
  return (percent / 100) * height;
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
      await new Promise((resolveWait) => setTimeout(resolveWait, 600 * attempt));
      return fetchTile(url, attempt + 1);
    }
    throw new Error(`Failed to fetch ${url} (${response.status})`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.closePath();
}

function toPixels(path, width, height) {
  return path.map((point) => ({ x: pctX(width, point.x), y: pctY(height, point.y) }));
}

function traceSmoothPath(ctx, points) {
  if (points.length < 2) {
    return;
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    ctx.bezierCurveTo(
      current.x + (next.x - previous.x) / 6,
      current.y + (next.y - previous.y) / 6,
      next.x - (after.x - current.x) / 6,
      next.y - (after.y - current.y) / 6,
      next.x,
      next.y,
    );
  }
}

function drawPicturePath(ctx, points, { color, dashed, width }) {
  if (points.length < 2) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = width + 8;
  ctx.setLineDash(dashed ? [18, 14] : []);
  traceSmoothPath(ctx, points);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [14, 12] : []);
  traceSmoothPath(ctx, points);
  ctx.stroke();
  ctx.restore();
}

function fillLabelCard(ctx, x, y, width, height, radius = 14, fill = "rgba(255, 248, 236, 0.94)") {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = PAPER_RULE;
  ctx.stroke();
}

function drawStackedLabel(ctx, english, chinese, x, y, align, accent) {
  ctx.save();
  ctx.font = "700 22px PosterLatin, PosterCjk, sans-serif";
  const englishWidth = ctx.measureText(english).width;
  ctx.font = "600 15px PosterCjk, sans-serif";
  const chineseWidth = chinese ? ctx.measureText(chinese).width : 0;
  const paddingX = 12;
  const boxWidth = Math.max(englishWidth, chineseWidth) + paddingX * 2 + 8;
  const boxHeight = chinese ? 46 : 32;
  const boxX = align === "right" ? x - boxWidth : align === "center" ? x - boxWidth / 2 : x;
  const boxY = y - boxHeight / 2;
  fillLabelCard(ctx, boxX, boxY, boxWidth, boxHeight, 12);
  if (accent) {
    ctx.fillStyle = accent;
    ctx.fillRect(boxX, boxY + 8, 4, boxHeight - 16);
  }
  ctx.fillStyle = POSTER_THEME.label;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = "700 22px PosterLatin, PosterCjk, sans-serif";
  ctx.fillText(english, boxX + paddingX + 4, chinese ? boxY + 16 : y);
  if (chinese) {
    ctx.font = "600 15px PosterCjk, sans-serif";
    ctx.fillStyle = MUTED;
    ctx.fillText(chinese, boxX + paddingX + 4, boxY + 33);
  }
  ctx.restore();
}

function drawCityName(ctx, text, x, y, size) {
  ctx.save();
  ctx.font = `700 ${size}px PosterLatin, PosterCjk, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(6, size / 7);
  ctx.strokeStyle = "rgba(255, 248, 236, 0.92)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = "#1f3b36";
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawPin(ctx, pin, width, height) {
  const x = pctX(width, pin.x);
  const y = pctY(height, pin.y);
  const radius = 24;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y + 2, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 40, 36, 0.18)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.97)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = pin.leg === "side" ? POSTER_THEME.side : POSTER_THEME.winter;
  ctx.fill();
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = pin.leg === "side" ? POSTER_THEME.sideBorder : POSTER_THEME.pinBorder;
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 22px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(pin.number), x, y + 0.5);
  ctx.restore();
}

function legendIcon(ctx, number, x, y, color, radius = 18) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 40, 36, 0.08)";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${radius + 2}px PosterLatin, PosterCjk, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), x, y + 0.5);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) {
    lines.push(current);
  }
  return lines.slice(0, 2);
}

function drawPhaseChip(ctx, label, x, y, width, color) {
  drawRoundedRect(ctx, x, y, width, 36, 18);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 16px PosterCjk, PosterLatin, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 16, y + 19);
}

function drawKeyLine(ctx, x, y, color, dashed) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.setLineDash(dashed ? [10, 8] : []);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 42, y);
  ctx.stroke();
  ctx.restore();
}

function drawNotesColumn(ctx, layout, width, height) {
  const columnWidth = width * LAPLAND_POSTER_LEGEND_RATIO;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, columnWidth, height);

  ctx.fillStyle = TITLE_BAR;
  ctx.fillRect(0, 0, columnWidth, pctY(height, 12.2));
  ctx.fillStyle = TITLE_INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "700 22px PosterCjk, sans-serif";
  ctx.fillText("一眼 / At a glance", 28, pctY(height, 2.15));
  ctx.font = "700 34px PosterCjk, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleZh, 28, pctY(height, 4.35));
  ctx.font = "700 20px PosterLatin, sans-serif";
  ctx.fillStyle = "#d7ebe6";
  ctx.fillText(LAPLAND_POSTER_TITLE.titleEn, 28, pctY(height, 6.15));
  ctx.fillStyle = TITLE_INK;
  ctx.font = "700 18px PosterCjk, sans-serif";
  ctx.fillText(`${LAPLAND_POSTER_TITLE.kickerZh}  ·  ${LAPLAND_POSTER_TITLE.kickerEn}`, 28, pctY(height, 8.15));
  ctx.font = "700 17px PosterLatin, PosterCjk, sans-serif";
  ctx.fillText(LAPLAND_POSTER_TITLE.routeEn, 28, pctY(height, 10.15));

  drawPhaseChip(ctx, `${LAPLAND_POSTER_TITLE.seasonZh} / ${LAPLAND_POSTER_TITLE.seasonEn}`, 22, pctY(height, 13.15), columnWidth - 44, POSTER_THEME.winter);
  drawPhaseChip(ctx, "然後城市 / Then the city", 22, pctY(height, 41.7), columnWidth - 44, POSTER_THEME.side);

  const textLeft = 72;
  const textWidth = columnWidth - textLeft - 22;

  for (const item of layout.legendItems) {
    const x = pctX(width, item.x);
    const y = pctY(height, item.y);
    const rowHeight = pctY(height, item.height);
    const color = item.phase === "city" ? POSTER_THEME.side : POSTER_THEME.winter;
    drawRoundedRect(ctx, x, y, pctX(width, item.width), rowHeight, 16);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "rgba(15, 79, 72, 0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(x, y + 14, 5, rowHeight - 28);
    legendIcon(ctx, item.number, x + 34, y + rowHeight / 2 - 10, color, 17);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = POSTER_THEME.label;
    ctx.font = "700 26px PosterCjk, sans-serif";
    ctx.fillText(item.label, textLeft, y + 36);
    ctx.fillStyle = MUTED;
    ctx.font = "700 15px PosterLatin, sans-serif";
    ctx.fillText(item.sublabel ?? "", textLeft, y + 58);
    ctx.fillStyle = "#1f3b36";
    ctx.font = "600 18px PosterCjk, sans-serif";
    ctx.fillText(item.blurb, textLeft, y + 86);
    ctx.fillStyle = MUTED;
    ctx.font = "600 14px PosterLatinReg, PosterLatin, sans-serif";
    const englishLines = wrapText(ctx, item.blurbEn, textWidth);
    englishLines.forEach((line, index) => {
      ctx.fillText(line, textLeft, y + 108 + index * 18);
    });
  }

  const storyTop = pctY(height, 63.2);
  fillLabelCard(ctx, 18, storyTop, columnWidth - 36, pctY(height, 12.4), 18, "#fffdf8");
  ctx.fillStyle = POSTER_THEME.winter;
  ctx.font = "700 16px PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("這張圖 / This picture", 36, storyTop + 28);
  ctx.fillStyle = "#1f3b36";
  ctx.font = "600 16px PosterCjk, sans-serif";
  ctx.fillText("十二月 · 聖誕季窗口。北極圈上過夜，", 36, storyTop + 56);
  ctx.fillText("然後往南，雪後是城市。", 36, storyTop + 78);
  ctx.fillStyle = MUTED;
  ctx.font = "600 13px PosterLatinReg, PosterLatin, sans-serif";
  ctx.fillText("December, the Christmas window.", 36, storyTop + 104);
  ctx.fillText("A night on the Circle, then south.", 36, storyTop + 124);

  const keyTop = pctY(height, 77.2);
  fillLabelCard(ctx, 18, keyTop, columnWidth - 36, pctY(height, 18.8), 20, "#fffdf8");
  ctx.fillStyle = POSTER_THEME.winter;
  ctx.font = "700 18px PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("圖例 / Map key", 36, keyTop + 32);
  const keys = [
    { color: POSTER_THEME.winter, dashed: false, en: "Lapland to Helsinki", zh: "拉普蘭 → 赫爾辛基" },
    { color: POSTER_THEME.side, dashed: true, en: "South Harbour walk", zh: "南港" },
    { color: ARCTIC, dashed: true, en: "Arctic Circle", zh: "北極圈" },
  ];
  keys.forEach((key, index) => {
    const y = keyTop + 70 + index * 48;
    drawKeyLine(ctx, 40, y, key.color, key.dashed);
    ctx.fillStyle = "#1e293b";
    ctx.font = "700 16px PosterCjk, sans-serif";
    ctx.fillText(key.zh, 96, y - 8);
    ctx.fillStyle = MUTED;
    ctx.font = "600 13px PosterLatin, sans-serif";
    ctx.fillText(key.en, 96, y + 12);
  });

  ctx.fillStyle = "rgba(15, 36, 32, 0.18)";
  ctx.fillRect(columnWidth - 2, 0, 2, height);
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

async function main() {
  const lapland = seedTripDetails.find((trip) => trip.id === "trip_lapland_2020");
  if (!lapland) {
    throw new Error("Lapland seed trip is missing");
  }

  const itinerary = buildJourneyItinerary({
    center: lapland.coordinates,
    city: lapland.city,
    journalEntries: lapland.journalEntries,
    photos: lapland.photos,
    places: lapland.places,
    route: lapland.travelRoute,
  });
  const layout = buildPosterLayout(itinerary, lapland.city);
  const grid = getPosterTileGrid(layout.bounds);
  const mapRaster = getPosterRasterSize(layout.bounds);
  const posterRaster = getLaplandPosterRasterSize(layout.bounds);
  const cols = grid.maxX - grid.minX + 1;
  const rows = grid.maxY - grid.minY + 1;

  if (cols * rows > 80) {
    throw new Error(`Too many tiles (${cols}x${rows}) for a regional poster`);
  }

  const mosaic = createCanvas(cols * TILE_PIXEL_SIZE, rows * TILE_PIXEL_SIZE);
  const mosaicCtx = mosaic.getContext("2d");
  mosaicCtx.fillStyle = "#86c46e";
  mosaicCtx.fillRect(0, 0, mosaic.width, mosaic.height);

  const jobs = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = grid.minX + col;
      const y = grid.minY + row;
      const wrappedX = ((x % grid.tileCount) + grid.tileCount) % grid.tileCount;
      jobs.push({ col, row, url: tileUrl(layout.bounds.zoom, wrappedX, y, row + col) });
    }
  }

  await paintTiles(jobs, mosaicCtx);

  const cropX = (layout.bounds.minX - grid.minX) * TILE_PIXEL_SIZE;
  const cropY = (layout.bounds.minY - grid.minY) * TILE_PIXEL_SIZE;
  const poster = createCanvas(posterRaster.width, posterRaster.height);
  const ctx = poster.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, posterRaster.width, posterRaster.height);

  const mapX = posterRaster.width - mapRaster.width;
  ctx.drawImage(mosaic, cropX, cropY, mapRaster.width, mapRaster.height, mapX, 0, mapRaster.width, mapRaster.height);

  const arcticPath = toPixels(arcticCirclePosterPath(layout.bounds), posterRaster.width, posterRaster.height);
  drawPicturePath(ctx, arcticPath, {
    color: ARCTIC,
    dashed: true,
    width: 3.4,
  });

  drawPicturePath(ctx, toPixels(layout.winterPath, posterRaster.width, posterRaster.height), {
    color: POSTER_THEME.winter,
    dashed: false,
    width: 8,
  });
  drawPicturePath(ctx, toPixels(layout.sidePath, posterRaster.width, posterRaster.height), {
    color: POSTER_THEME.side,
    dashed: true,
    width: 5.5,
  });

  const rovaniemi = projectOntoLaplandPoster(LAPLAND_CITY, layout.bounds);
  const helsinki = projectOntoLaplandPoster(LAPLAND_HELSINKI, layout.bounds);
  drawCityName(ctx, "ROVANIEMI", pctX(posterRaster.width, rovaniemi.x - 16), pctY(posterRaster.height, rovaniemi.y + 13), 22);
  drawCityName(ctx, "HELSINKI", pctX(posterRaster.width, helsinki.x - 11), pctY(posterRaster.height, helsinki.y - 11), 46);

  const onMapLabel = {
    1: { align: "right", chinese: "聖誕老人村", dx: -26, dy: -42, text: "Santa Claus Village" },
    3: { align: "left", chinese: "4 號紅木屋", dx: -22, dy: 44, text: "Cabin" },
    4: { align: "left", chinese: "主教座堂", dx: -26, dy: -42, text: "Cathedral" },
    5: { align: "left", chinese: "南港", dx: 22, dy: 40, text: "South Harbour" },
  };

  for (const pin of layout.pins) {
    drawPin(ctx, pin, posterRaster.width, posterRaster.height);
    const plan = onMapLabel[pin.number];
    if (!plan) {
      continue;
    }
    drawStackedLabel(
      ctx,
      plan.text,
      plan.chinese,
      pctX(posterRaster.width, pin.x) + plan.dx,
      pctY(posterRaster.height, pin.y) + plan.dy,
      plan.align,
      pin.leg === "side" ? POSTER_THEME.side : POSTER_THEME.winter,
    );
  }

  const southFrom = layout.pins.find((pin) => pin.number === 3);
  const southTo = layout.pins.find((pin) => pin.number === 4);
  if (southFrom && southTo) {
    drawStackedLabel(
      ctx,
      "then south",
      "然後往南",
      pctX(posterRaster.width, (southFrom.x + southTo.x) / 2 + 4),
      pctY(posterRaster.height, (southFrom.y + southTo.y) / 2),
      "left",
      POSTER_THEME.winter,
    );
  }

  if (arcticPath.length > 0) {
    drawStackedLabel(ctx, "Arctic Circle", "北極圈", arcticPath[0].x + 18, arcticPath[0].y - 28, "left", ARCTIC);
  }

  drawNotesColumn(ctx, layout, posterRaster.width, posterRaster.height);

  ctx.save();
  ctx.font = "600 13px PosterLatin, sans-serif";
  const credit = STREET_BASEMAP.attribution;
  const creditWidth = ctx.measureText(credit).width + 18;
  drawRoundedRect(ctx, posterRaster.width - creditWidth - 16, posterRaster.height - 38, creditWidth, 22, 8);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(credit, posterRaster.width - 26, posterRaster.height - 26);
  ctx.restore();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, poster.toBuffer("image/png"));
  console.log(
    `Wrote ${LAPLAND_POSTER.relativeFile} (${posterRaster.width}x${posterRaster.height}px, map ${mapRaster.width}px, zoom ${layout.bounds.zoom}, ${jobs.length} OpenTopoMap tiles, ${layout.pins.length} pins, legend ${layout.legendItems.length}, long-haul ${layout.longHaulLabel ?? "none"})`,
  );
}

await main();
