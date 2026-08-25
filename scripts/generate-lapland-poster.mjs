#!/usr/bin/env node
/**
 * Rebuild the Lapland journey picture from lib/journey-map-model.ts.
 *
 * Fetches Carto Voyager street tiles from
 * https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png
 * (no Google, no API key), stitches Finland at glance scale, then draws a
 * Christmas-card itinerary: numbered beats on the picture, Santa Claus
 * Village and Helsinki readable in one second. Not a measuring tool.
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
  POSTER_THEME,
  projectOntoLaplandPoster,
  STREET_BASEMAP,
  TILE_PIXEL_SIZE,
} from "../lib/journey-map-model.ts";
import { seedTripDetails } from "../lib/trips.ts";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, LAPLAND_POSTER.relativeFile);
const USER_AGENT = "TravelOS-lapland-poster/1.0 (itinerary raster generator; OSM/CARTO tiles; no Google Maps)";
const FONT_CJK = "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc";
const FONT_LATIN = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

GlobalFonts.registerFromPath(FONT_CJK, "PosterCjk");
GlobalFonts.registerFromPath(FONT_LATIN, "PosterLatin");

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

function fillLabelCard(ctx, x, y, width, height, radius = 14) {
  drawRoundedRect(ctx, x, y, width, height, radius);
  ctx.fillStyle = "rgba(255, 248, 236, 0.94)";
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "rgba(15, 79, 72, 0.12)";
  ctx.stroke();
}

function drawStackedLabel(ctx, english, chinese, x, y, align) {
  ctx.save();
  ctx.font = "700 22px PosterLatin, PosterCjk, sans-serif";
  const englishWidth = ctx.measureText(english).width;
  ctx.font = "600 15px PosterCjk, sans-serif";
  const chineseWidth = chinese ? ctx.measureText(chinese).width : 0;
  const paddingX = 10;
  const boxWidth = Math.max(englishWidth, chineseWidth) + paddingX * 2;
  const boxHeight = chinese ? 44 : 30;
  const boxX = align === "right" ? x - boxWidth : align === "center" ? x - boxWidth / 2 : x;
  const boxY = y - boxHeight / 2;
  fillLabelCard(ctx, boxX, boxY, boxWidth, boxHeight, 12);
  ctx.fillStyle = POSTER_THEME.label;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = "700 22px PosterLatin, PosterCjk, sans-serif";
  ctx.fillText(english, boxX + paddingX, chinese ? boxY + 15 : y);
  if (chinese) {
    ctx.font = "600 15px PosterCjk, sans-serif";
    ctx.fillStyle = "#4b5d56";
    ctx.fillText(chinese, boxX + paddingX, boxY + 32);
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
  const radius = 22;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y + 2, radius + 3, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(15, 40, 36, 0.16)";
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
  ctx.font = "700 20px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(pin.number), x, y + 0.5);
  ctx.restore();
}

function legendIcon(ctx, number, x, y, color) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "700 14px PosterLatin, PosterCjk, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), x, y + 0.5);
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
  const mapRaster = getPosterRasterSize(layout.bounds);
  const posterRaster = getLaplandPosterRasterSize(layout.bounds);
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
  const poster = createCanvas(posterRaster.width, posterRaster.height);
  const ctx = poster.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = "#f4eee3";
  ctx.fillRect(0, 0, posterRaster.width, posterRaster.height);
  ctx.drawImage(mosaic, cropX, cropY, mapRaster.width, mapRaster.height, 0, 0, mapRaster.width, mapRaster.height);

  ctx.fillStyle = "rgba(255, 246, 228, 0.05)";
  ctx.fillRect(0, 0, mapRaster.width, mapRaster.height);

  const vignette = ctx.createRadialGradient(
    mapRaster.width * 0.48,
    mapRaster.height * 0.46,
    Math.min(mapRaster.width, mapRaster.height) * 0.34,
    mapRaster.width * 0.5,
    mapRaster.height * 0.5,
    Math.max(mapRaster.width, mapRaster.height) * 0.78,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(36, 28, 18, 0.08)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, mapRaster.width, mapRaster.height);

  const arcticPath = toPixels(arcticCirclePosterPath(layout.bounds), posterRaster.width, posterRaster.height);
  drawPicturePath(ctx, arcticPath, {
    color: "rgba(125, 84, 52, 0.72)",
    dashed: true,
    width: 3.2,
  });

  drawPicturePath(ctx, toPixels(layout.winterPath, posterRaster.width, posterRaster.height), {
    color: POSTER_THEME.winter,
    dashed: false,
    width: 7,
  });
  drawPicturePath(ctx, toPixels(layout.sidePath, posterRaster.width, posterRaster.height), {
    color: POSTER_THEME.side,
    dashed: true,
    width: 5,
  });

  const rovaniemi = projectOntoLaplandPoster(LAPLAND_CITY, layout.bounds);
  const helsinki = projectOntoLaplandPoster(LAPLAND_HELSINKI, layout.bounds);
  drawCityName(ctx, "ROVANIEMI", pctX(posterRaster.width, rovaniemi.x - 8), pctY(posterRaster.height, rovaniemi.y + 9), 22);
  drawCityName(ctx, "HELSINKI", pctX(posterRaster.width, helsinki.x - 12), pctY(posterRaster.height, helsinki.y - 8), 48);

  const onMapLabel = {
    1: { align: "right", chinese: "聖誕老人村", dx: -20, dy: -40, text: "Santa Claus Village" },
    3: { align: "left", chinese: "木屋", dx: -18, dy: 38, text: "Cabin" },
    4: { align: "left", chinese: "主教座堂", dx: -22, dy: -38, text: "Cathedral" },
    5: { align: "left", chinese: "南港", dx: 18, dy: 36, text: "South Harbour" },
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
    );
  }

  const southFrom = layout.pins.find((pin) => pin.number === 3);
  const southTo = layout.pins.find((pin) => pin.number === 4);
  if (southFrom && southTo) {
    drawStackedLabel(
      ctx,
      "then south",
      "然後往南",
      pctX(posterRaster.width, (southFrom.x + southTo.x) / 2 + 6),
      pctY(posterRaster.height, (southFrom.y + southTo.y) / 2),
      "left",
    );
  }

  if (arcticPath.length > 0) {
    drawStackedLabel(ctx, "Arctic Circle", "北極圈", arcticPath[0].x + 18, arcticPath[0].y - 28, "left");
  }

  ctx.save();
  fillLabelCard(ctx, 14, 14, 420, 70, 18);
  ctx.fillStyle = POSTER_THEME.winter;
  ctx.font = "700 16px PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("十二月 · December", 32, 36);
  ctx.fillStyle = "#1e293b";
  ctx.font = "700 22px PosterLatin, PosterCjk, sans-serif";
  ctx.fillText("Santa Claus Village → Helsinki", 32, 60);
  ctx.restore();

  const legendX = pctX(posterRaster.width, 69.6);
  const legendWidth = pctX(posterRaster.width, 28.4);
  const legendTop = pctY(posterRaster.height, 8.2);
  const legendHeight = pctY(posterRaster.height, 58);
  fillLabelCard(ctx, legendX, legendTop, legendWidth, legendHeight, 28);

  ctx.save();
  ctx.fillStyle = POSTER_THEME.winter;
  ctx.font = "700 22px PosterCjk, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("一眼 / At a glance", legendX + 20, legendTop + 28);
  ctx.fillStyle = "#5b6b64";
  ctx.font = "600 14px PosterLatin, PosterCjk, sans-serif";
  ctx.fillText(layout.cityLabel, legendX + 20, legendTop + 48);
  ctx.restore();

  for (const item of layout.legendItems) {
    const x = pctX(posterRaster.width, item.x);
    const y = pctY(posterRaster.height, item.y);
    const height = pctY(posterRaster.height, item.height);
    const pin = layout.pins.find((entry) => entry.number === item.number);
    legendIcon(ctx, item.number, x + 18, y + height / 2, pin?.leg === "side" ? POSTER_THEME.side : POSTER_THEME.winter);
    ctx.fillStyle = "#1e293b";
    ctx.font = "700 15px PosterLatin, PosterCjk, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(item.label, x + 38, y + height / 2 - (item.sublabel ? 8 : 0));
    if (item.sublabel) {
      ctx.fillStyle = "#5b6b64";
      ctx.font = "600 13px PosterCjk, sans-serif";
      ctx.fillText(item.sublabel, x + 38, y + height / 2 + 10);
    }
  }

  ctx.save();
  ctx.font = "600 13px PosterLatin, sans-serif";
  const credit = STREET_BASEMAP.attribution;
  const creditWidth = ctx.measureText(credit).width + 18;
  drawRoundedRect(ctx, 16, posterRaster.height - 38, creditWidth, 22, 8);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(credit, 25, posterRaster.height - 26);
  ctx.restore();

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, poster.toBuffer("image/png"));
  console.log(
    `Wrote ${LAPLAND_POSTER.relativeFile} (${posterRaster.width}x${posterRaster.height}px, map ${mapRaster.width}px, zoom ${layout.bounds.zoom}, ${jobs.length} Voyager tiles, ${layout.pins.length} pins, legend ${layout.legendItems.length}, long-haul ${layout.longHaulLabel ?? "none"})`,
  );
}

await main();
