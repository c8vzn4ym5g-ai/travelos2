#!/usr/bin/env node
/**
 * Rebuild the Rovaniemi journey picture from lib/journey-map-model.ts.
 *
 * Fetches Carto Voyager street tiles from
 * https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
 * (no Google, no API key), stitches one raster, then draws a glanceable
 * numbered itinerary. Glanceable picture only: no GIS chrome.
 * Run again when stops change: `pnpm generate:lapland-poster`
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import {
  buildJourneyItinerary,
  buildPosterLayout,
  getPosterRasterSize,
  getPosterTileGrid,
  getStreetTileUrl,
  LAPLAND_POSTER,
  POSTER_THEME,
  STREET_BASEMAP,
  TILE_PIXEL_SIZE,
} from "../lib/journey-map-model.ts";
import { seedTripDetails } from "../lib/trips.ts";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, LAPLAND_POSTER.relativeFile);
const USER_AGENT = "TravelOS-lapland-poster/1.0 (itinerary raster generator; OSM/CARTO tiles; no Google Maps)";

function pctX(width, percent) {
  return (percent / 100) * width;
}

function pctY(height, percent) {
  return (percent / 100) * height;
}

async function fetchTile(url, attempt = 1) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) {
    if (attempt < 4) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 400 * attempt));
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
  ctx.lineWidth = width + 7;
  ctx.setLineDash(dashed ? [16, 12] : []);
  traceSmoothPath(ctx, points);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [12, 10] : []);
  traceSmoothPath(ctx, points);
  ctx.stroke();
  ctx.restore();
}

function drawLabel(ctx, text, x, y, align) {
  ctx.save();
  ctx.font = "600 21px 'DejaVu Sans', 'Liberation Sans', sans-serif";
  const metrics = ctx.measureText(text);
  const paddingX = 10;
  const boxWidth = metrics.width + paddingX * 2;
  const boxHeight = 26;
  const boxX = align === "right" ? x - boxWidth : x;
  drawRoundedRect(ctx, boxX, y - boxHeight / 2, boxWidth, boxHeight, 13);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fill();
  ctx.fillStyle = POSTER_THEME.label;
  ctx.textAlign = align === "right" ? "right" : "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, align === "right" ? x - paddingX : x + paddingX, y + 0.5);
  ctx.restore();
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
  const raster = getPosterRasterSize(layout.bounds);
  const cols = grid.maxX - grid.minX + 1;
  const rows = grid.maxY - grid.minY + 1;

  if (cols * rows > 80) {
    throw new Error(`Too many tiles (${cols}x${rows}) for a regional poster`);
  }

  const mosaic = createCanvas(cols * TILE_PIXEL_SIZE, rows * TILE_PIXEL_SIZE);
  const mosaicCtx = mosaic.getContext("2d");
  mosaicCtx.fillStyle = "#e8f0e4";
  mosaicCtx.fillRect(0, 0, mosaic.width, mosaic.height);

  const jobs = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = grid.minX + col;
      const y = grid.minY + row;
      const wrappedX = ((x % grid.tileCount) + grid.tileCount) % grid.tileCount;
      jobs.push({ col, row, url: getStreetTileUrl(layout.bounds.zoom, wrappedX, y) });
    }
  }

  for (const job of jobs) {
    const image = await loadImage(await fetchTile(job.url));
    mosaicCtx.drawImage(image, job.col * TILE_PIXEL_SIZE, job.row * TILE_PIXEL_SIZE);
  }

  const cropX = (layout.bounds.minX - grid.minX) * TILE_PIXEL_SIZE;
  const cropY = (layout.bounds.minY - grid.minY) * TILE_PIXEL_SIZE;
  const poster = createCanvas(raster.width, raster.height);
  const ctx = poster.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(mosaic, cropX, cropY, raster.width, raster.height, 0, 0, raster.width, raster.height);

  ctx.fillStyle = "rgba(255, 248, 236, 0.07)";
  ctx.fillRect(0, 0, raster.width, raster.height);

  const vignette = ctx.createRadialGradient(
    raster.width / 2,
    raster.height / 2,
    Math.min(raster.width, raster.height) * 0.38,
    raster.width / 2,
    raster.height / 2,
    Math.max(raster.width, raster.height) * 0.72,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(24, 36, 32, 0.1)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, raster.width, raster.height);

  drawPicturePath(ctx, toPixels(layout.winterPath, raster.width, raster.height), {
    color: POSTER_THEME.winter,
    dashed: false,
    width: 6,
  });
  drawPicturePath(ctx, toPixels(layout.sidePath, raster.width, raster.height), {
    color: POSTER_THEME.side,
    dashed: true,
    width: 4.5,
  });

  for (const pin of layout.pins) {
    const x = pctX(raster.width, pin.x);
    const y = pctY(raster.height, pin.y);
    const radius = 20;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y + 1.5, radius + 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(15, 40, 36, 0.16)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.97)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = pin.leg === "side" ? POSTER_THEME.side : POSTER_THEME.winter;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pin.leg === "side" ? POSTER_THEME.sideBorder : POSTER_THEME.pinBorder;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 19px 'DejaVu Sans', 'Liberation Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(pin.number), x, y + 0.5);
    ctx.restore();

    const alignRight = pin.x > 62 || pin.number === 2 || pin.number === 3;
    const labelX = x + (alignRight ? -26 : 26);
    drawLabel(ctx, pin.label, labelX, y - 26, alignRight ? "right" : "left");
  }

  ctx.save();
  drawRoundedRect(ctx, 16, 16, 248, 40, 20);
  ctx.fillStyle = "rgba(255,255,255,0.94)";
  ctx.fill();
  ctx.font = "700 14px 'DejaVu Sans', 'Liberation Sans', sans-serif";
  ctx.fillStyle = POSTER_THEME.title;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(layout.cityLabel, 140, 37);
  ctx.restore();

  if (layout.longHaulLabel) {
    ctx.save();
    const inset = `via ${layout.longHaulLabel}`;
    ctx.font = "600 13px 'DejaVu Sans', 'Liberation Sans', sans-serif";
    const insetWidth = ctx.measureText(inset).width + 22;
    drawRoundedRect(ctx, 16, raster.height - 44, insetWidth, 28, 14);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fill();
    ctx.fillStyle = "#64748b";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(inset, 27, raster.height - 29);
    ctx.restore();
  }

  ctx.save();
  ctx.font = "600 12px 'DejaVu Sans', 'Liberation Sans', sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  const credit = STREET_BASEMAP.attribution;
  const creditWidth = ctx.measureText(credit).width + 18;
  drawRoundedRect(ctx, raster.width - creditWidth - 16, raster.height - 36, creditWidth, 22, 8);
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillText(credit, raster.width - 26, raster.height - 24);
  ctx.restore();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, poster.toBuffer("image/png"));
  console.log(
    `Wrote ${LAPLAND_POSTER.relativeFile} (${raster.width}x${raster.height}px, zoom ${layout.bounds.zoom}, ${jobs.length} Voyager tiles, ${layout.pins.length} pins, long-haul ${layout.longHaulLabel ?? "none"})`,
  );
}

await main();
