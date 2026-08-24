#!/usr/bin/env node
/**
 * Rebuild the Rovaniemi itinerary poster from lib/journey-map-model.ts.
 *
 * Fetches Carto Voyager street tiles from
 * https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
 * (no Google, no API key), stitches one raster, then draws pins, routes,
 * legend, scale, and north. Run again when stops change:
 * `pnpm generate:lapland-poster`
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

function drawRoute(ctx, fromX, fromY, toX, toY, { color, dashed, width, halo }) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (halo) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = width + 5;
    ctx.setLineDash(dashed ? [14, 10] : []);
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dashed ? [10, 8] : []);
  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();
  ctx.restore();
}

function drawLabel(ctx, text, x, y, align) {
  ctx.save();
  ctx.font = "600 22px 'DejaVu Sans', 'Liberation Sans', sans-serif";
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = 5;
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.strokeText(text, x, y);
  ctx.fillStyle = POSTER_THEME.label;
  ctx.fillText(text, x, y);
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

  for (const leg of layout.legs) {
    drawRoute(ctx, pctX(raster.width, leg.from.x), pctY(raster.height, leg.from.y), pctX(raster.width, leg.to.x), pctY(raster.height, leg.to.y), {
      color: leg.kind === "side" ? POSTER_THEME.side : POSTER_THEME.winter,
      dashed: leg.style === "dotted",
      halo: true,
      width: leg.kind === "side" ? 4 : 5.5,
    });
  }

  for (const pin of layout.pins) {
    const x = pctX(raster.width, pin.x);
    const y = pctY(raster.height, pin.y);
    const radius = 18;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = pin.leg === "side" ? POSTER_THEME.side : POSTER_THEME.winter;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = pin.leg === "side" ? POSTER_THEME.sideBorder : POSTER_THEME.pinBorder;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 18px 'DejaVu Sans', 'Liberation Sans', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(pin.number), x, y + 0.5);
    ctx.restore();

    const alignRight = pin.x > 62 || pin.number === 2;
    const labelX = x + (alignRight ? -26 : 26);
    drawLabel(ctx, pin.label, labelX, y - 22, alignRight ? "right" : "left");
  }

  ctx.save();
  drawRoundedRect(ctx, 18, 18, 268, 36, 18);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.font = "700 13px 'DejaVu Sans', 'Liberation Sans', sans-serif";
    ctx.fillStyle = POSTER_THEME.title;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(layout.cityLabel, 152, 37);
  ctx.restore();

  ctx.save();
  drawRoundedRect(ctx, raster.width - 58, 18, 40, 46, 8);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.fillStyle = POSTER_THEME.title;
  ctx.textAlign = "center";
  ctx.font = "700 16px 'DejaVu Sans', 'Liberation Sans', sans-serif";
  ctx.fillText("▲", raster.width - 38, 36);
  ctx.font = "700 12px 'DejaVu Sans', 'Liberation Sans', sans-serif";
  ctx.fillText("N", raster.width - 38, 52);
  ctx.restore();

  const legendX = 18;
  const legendY = raster.height - 118;
  ctx.save();
  drawRoundedRect(ctx, legendX, legendY, 176, 100, 14);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.strokeStyle = POSTER_THEME.winter;
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(legendX + 16, legendY + 24);
  ctx.lineTo(legendX + 52, legendY + 24);
  ctx.stroke();
  ctx.strokeStyle = POSTER_THEME.side;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(legendX + 16, legendY + 48);
  ctx.lineTo(legendX + 52, legendY + 48);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#0f172a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(legendX + 16, legendY + 76);
  ctx.lineTo(legendX + 16 + Math.min(layout.scaleBar.widthPercent, 28) * 2.1, legendY + 76);
  ctx.stroke();
  ctx.fillStyle = POSTER_THEME.title;
  ctx.font = "600 13px 'DejaVu Sans', 'Liberation Sans', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Winter route", legendX + 62, legendY + 24);
  ctx.fillText("Side leg", legendX + 62, legendY + 48);
  ctx.fillText(layout.scaleBar.label, legendX + 62, legendY + 76);
  ctx.restore();

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
    `Wrote ${LAPLAND_POSTER.relativeFile} (${raster.width}x${raster.height}px, zoom ${layout.bounds.zoom}, ${jobs.length} Voyager tiles, ${layout.pins.length} pins, scale ${layout.scaleBar.label})`,
  );
}

await main();
