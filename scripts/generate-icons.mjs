/**
 * Generates minimal valid PNG icons for the RoadPulse PWA manifest.
 * Uses only Node.js built-ins (no external dependencies).
 *
 * Run once: node scripts/generate-icons.mjs
 * Output: public/icons/icon-192.png, public/icons/icon-512.png
 */

import { createWriteStream, mkdirSync } from "fs";
import { deflateRawSync, crc32 } from "zlib";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, "..", "public", "icons");

mkdirSync(OUT_DIR, { recursive: true });

/**
 * Write a minimal PNG file with a solid-color background.
 * Format: 8-bit depth, RGBA color type, no interlacing.
 *
 * Background: #0c0f14 (RoadPulse dark bg)
 * "P" letter is not rendered — icons need a real design tool for that;
 * this script just produces valid PWA-installable placeholder icons.
 */
function generatePng(size, filePath) {
  const R = 0x0c, G = 0x0f, B = 0x14, A = 0xff;

  // Build raw image data: each row is a filter byte (0=None) + RGBA pixels
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    const row = y * rowSize;
    raw[row] = 0; // filter type: None
    for (let x = 0; x < size; x++) {
      const off = row + 1 + x * 4;
      raw[off] = R;
      raw[off + 1] = G;
      raw[off + 2] = B;
      raw[off + 3] = A;
    }
  }

  const compressed = deflateRawSync(raw);

  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type: RGBA
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // IDAT chunk wraps the compressed pixel data
  // IEND chunk
  const file = Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);

  const ws = createWriteStream(filePath);
  ws.write(file);
  ws.end();
  console.log(`Written ${filePath} (${size}x${size})`);
}

function makeChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  // CRC covers the type + data bytes
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcValue = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  // crc32 returns an unsigned 32-bit int — must use writeUInt32BE
  crcBuf.writeUInt32BE(crcValue >>> 0, 0);

  return Buffer.concat([len, typeBytes, data, crcBuf]);
}

generatePng(192, join(OUT_DIR, "icon-192.png"));
generatePng(512, join(OUT_DIR, "icon-512.png"));
