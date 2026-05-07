/**
 * Converts the generated Lumo animation reference sheet into normalized
 * transparent game-style sprite strips.
 *
 * Usage:
 *   node scripts/process-lumo-animation-sheet.mjs \
 *     /Users/licheng.phan/Downloads/fc3e4d38-01e6-4274-bbb9-d6977cea8100.png
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const defaultSheet = '/Users/licheng.phan/Downloads/fc3e4d38-01e6-4274-bbb9-d6977cea8100.png';
const sheetPath = process.argv[2] ?? defaultSheet;
const outDir = path.join(root, 'src/assets/lumo/animations');
const previewPath = path.join(root, 'src/assets/lumo/lumo-animation-preview.png');

const frameSize = 256;
const footPadding = 16;
const targetBodyHeight = 158;

const rows = [
  {name: 'idle', count: 7, left: 135, top: 90, slotW: 183, slotH: 176, speed: 220},
  {name: 'blink', count: 7, left: 92, top: 344, slotW: 191, slotH: 178, speed: 120},
  {name: 'thinking', count: 8, left: 94, top: 596, slotW: 174, slotH: 178, speed: 190},
  {name: 'happy', count: 8, left: 92, top: 844, slotW: 174, slotH: 178, speed: 135},
];

function isSeedPixel(data, idx) {
  const offset = idx * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const darkInk = max < 88 || (max < 130 && max - min > 22);
  const creamBody = r > 165 && g > 135 && b > 96 && r - b > 22;
  const orange = r > 135 && g > 55 && b < 92 && r - g > 25;
  const sparkle = r > 190 && g > 135 && b < 92;
  return darkInk || creamBody || orange || sparkle;
}

function isGrowPixel(data, idx) {
  const offset = idx * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const scarfOrOutline = max < 178 && min > 24 && r >= b && r - b > 10;
  const shadow = max < 170 && min > 28 && max - min < 62;
  return isSeedPixel(data, idx) || scarfOrOutline || shadow;
}

function dilate(mask, width, height, iterations = 1) {
  let current = mask;
  for (let iter = 0; iter < iterations; iter += 1) {
    const next = new Uint8Array(current);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        if (current[idx]) continue;
        if (current[idx - 1] || current[idx + 1] || current[idx - width] || current[idx + width]) {
          next[idx] = 1;
        }
      }
    }
    current = next;
  }
  return current;
}

function erode(mask, width, height, iterations = 1) {
  let current = mask;
  for (let iter = 0; iter < iterations; iter += 1) {
    const next = new Uint8Array(current);
    for (let y = 1; y < height - 1; y += 1) {
      for (let x = 1; x < width - 1; x += 1) {
        const idx = y * width + x;
        if (!current[idx]) continue;
        if (!current[idx - 1] || !current[idx + 1] || !current[idx - width] || !current[idx + width]) {
          next[idx] = 0;
        }
      }
    }
    current = next;
  }
  return current;
}

function keepPrimaryComponent(mask, width, height) {
  const seen = new Uint8Array(width * height);
  let best = [];
  const centerX = width / 2;
  const centerY = height * 0.58;
  for (let i = 0; i < mask.length; i += 1) {
    if (!mask[i] || seen[i]) continue;
    const queue = [i];
    const pixels = [];
    seen[i] = 1;
    let touchesEdge = false;
    let scoreX = 0;
    let scoreY = 0;
    for (let qi = 0; qi < queue.length; qi += 1) {
      const idx = queue[qi];
      pixels.push(idx);
      const x = idx % width;
      const y = Math.floor(idx / width);
      scoreX += x;
      scoreY += y;
      if (x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2) touchesEdge = true;
      for (const next of [idx - 1, idx + 1, idx - width, idx + width]) {
        if (next < 0 || next >= mask.length || seen[next] || !mask[next]) continue;
        seen[next] = 1;
        queue.push(next);
      }
    }
    const cx = scoreX / pixels.length;
    const cy = scoreY / pixels.length;
    const distancePenalty = Math.hypot(cx - centerX, cy - centerY) * 6;
    const edgePenalty = touchesEdge ? pixels.length * 0.8 : 0;
    const score = pixels.length - distancePenalty - edgePenalty;
    const bestScore = best.score ?? -Infinity;
    if (score > bestScore) best = Object.assign(pixels, {score});
  }
  const out = new Uint8Array(width * height);
  for (const idx of best) out[idx] = 1;
  return out;
}

async function isolateLumoForeground(input) {
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const {width, height} = info;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  const seed = new Uint8Array(width * height);
  for (let i = 0; i < seed.length; i += 1) {
    if (!isSeedPixel(data, i)) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    seed[i] = 1;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (maxX < 0) return sharp(data, {raw: info}).png().toBuffer();

  minX = Math.max(0, minX - 18);
  minY = Math.max(0, minY - 18);
  maxX = Math.min(width - 1, maxX + 18);
  maxY = Math.min(height - 1, maxY + 18);

  const grown = new Uint8Array(seed);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const idx = y * width + x;
      if (isGrowPixel(data, idx)) grown[idx] = 1;
    }
  }
  const closed = erode(dilate(grown, width, height, 2), width, height, 1);
  const primary = keepPrimaryComponent(closed, width, height);
  const finalMask = dilate(primary, width, height, 1);

  for (let i = 0; i < finalMask.length; i += 1) {
    if (!finalMask[i]) data[i * 4 + 3] = 0;
  }

  return sharp(data, {raw: info}).png().toBuffer();
}

async function alphaBounds(input, threshold = 8) {
  const {data, info} = await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0) return null;
  return {minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1};
}

async function normalizeFrame(input) {
  const transparent = await isolateLumoForeground(input);
  const trimmed = await sharp(transparent)
    .trim({background: {r: 0, g: 0, b: 0, alpha: 0}, threshold: 8})
    .png()
    .toBuffer();
  const bounds = await alphaBounds(trimmed);
  if (!bounds) return sharp({create: {width: frameSize, height: frameSize, channels: 4, background: '#0000'}}).png().toBuffer();
  const scale = Math.min(1.38, targetBodyHeight / bounds.height, (frameSize - 24) / bounds.width, (frameSize - footPadding - 4) / bounds.height);
  const width = Math.round(bounds.width * scale);
  const height = Math.round(bounds.height * scale);
  const scaled = await sharp(trimmed).resize(width, height, {fit: 'fill'}).png().toBuffer();
  return sharp({
    create: {
      width: frameSize,
      height: frameSize,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite([
      {
        input: scaled,
        left: Math.round((frameSize - width) / 2),
        top: frameSize - height - footPadding,
      },
    ])
    .png()
    .toBuffer();
}

async function buildStrip(row, frames) {
  const stripPath = path.join(outDir, `lumo-${row.name}-strip.png`);
  await sharp({
    create: {
      width: frameSize * frames.length,
      height: frameSize,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite(frames.map((input, index) => ({input, left: index * frameSize, top: 0})))
    .png()
    .toFile(stripPath);
  return stripPath;
}

async function main() {
  if (!fs.existsSync(sheetPath)) {
    console.error('Missing animation sheet:', sheetPath);
    process.exit(1);
  }

  fs.mkdirSync(outDir, {recursive: true});
  const strips = [];

  for (const row of rows) {
    const rowDir = path.join(outDir, row.name);
    fs.mkdirSync(rowDir, {recursive: true});
    const frames = [];
    for (let i = 0; i < row.count; i += 1) {
      const crop = await sharp(sheetPath)
        .extract({
          left: Math.round(row.left + i * row.slotW),
          top: row.top,
          width: row.slotW,
          height: row.slotH,
        })
        .png()
        .toBuffer();
      const frame = await normalizeFrame(crop);
      const framePath = path.join(rowDir, `${String(i + 1).padStart(2, '0')}.png`);
      await fs.promises.writeFile(framePath, frame);
      frames.push(frame);
    }
    const stripPath = await buildStrip(row, frames);
    strips.push({row, stripPath});
    console.log(`Wrote ${path.relative(root, stripPath)} (${row.count} frames @ ${row.speed}ms)`);
  }

  await sharp({
    create: {
      width: frameSize * Math.max(...rows.map((row) => row.count)),
      height: frameSize * rows.length,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite(strips.map(({stripPath}, index) => ({input: stripPath, left: 0, top: index * frameSize})))
    .png()
    .toFile(previewPath);
  console.log('Wrote', path.relative(root, previewPath));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
