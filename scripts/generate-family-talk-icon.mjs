import { createCanvas } from "@napi-rs/canvas";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  const s = size / 180;

  ctx.fillStyle = "#f0f6e4";
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = "#dceec6";
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.52, size * 0.38, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#6eaa5a";
  ctx.beginPath();
  ctx.ellipse(size * 0.58, size * 0.18, 16 * s, 9 * s, 0.5, 0, Math.PI * 2);
  ctx.fill();

  const bubble = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18 * s);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.28, y + h);
    ctx.lineTo(x + w * 0.18, y + h + 12 * s);
    ctx.lineTo(x + w * 0.42, y + h);
    ctx.closePath();
    ctx.fill();
  };

  bubble(size * 0.16, size * 0.3, size * 0.42, size * 0.28, "#fbfcf7");
  bubble(size * 0.42, size * 0.48, size * 0.42, size * 0.28, "#d5ecf8");

  const face = (cx, cy, ink) => {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(cx - 7 * s, cy - 2 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.arc(cx + 7 * s, cy - 2 * s, 2.2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(cx, cy + 3 * s, 6 * s, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  };

  face(size * 0.37, size * 0.43, "#6eaa5a");
  face(size * 0.63, size * 0.61, "#5a9cc7");

  return canvas.toBuffer("image/png");
}

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../public/family/talk");
await mkdir(outDir, { recursive: true });
await writeFile(resolve(outDir, "apple-touch-icon.png"), drawIcon(180));
await writeFile(resolve(outDir, "icon-512.png"), drawIcon(512));
console.log("wrote family talk icons");
