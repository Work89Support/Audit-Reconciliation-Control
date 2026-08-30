import fs from "node:fs/promises";
import { Canvas, loadImage } from "/Users/a/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/node_modules/skia-canvas/lib/index.js";

const dir = "/Users/a/Documents/GitHub/Audit-Reconciliation-Control/artifacts/audit_3day_deck";
const cols = 3, rows = 5, sw = 640, sh = 360;
const canvas = new Canvas(cols * sw, rows * sh);
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#dbe7f3";
ctx.fillRect(0, 0, canvas.width, canvas.height);
for (let i = 0; i < 15; i++) {
  const img = await loadImage(`${dir}/slide-${String(i + 1).padStart(2, "0")}.png`);
  const x = (i % cols) * sw, y = Math.floor(i / cols) * sh;
  ctx.drawImage(img, x, y, sw, sh);
}
await fs.writeFile(`${dir}/qa-montage.png`, await canvas.png);
