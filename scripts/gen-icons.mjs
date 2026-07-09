// Genera los íconos PNG de la PWA sin dependencias externas (solo zlib de Node).
// Diseño: degradado teal→azul (paleta del prototipo) con un motivo de barras
// ascendentes blancas (finanzas). Full-bleed → sirve como maskable.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, "..", "public");
mkdirSync(OUT, { recursive: true });

const TEAL = [26, 138, 111];
const BLUE = [63, 127, 224];
const WHITE = [242, 245, 248];

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  // fondo: degradado vertical teal→azul
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const col = [lerp(TEAL[0], BLUE[0], t), lerp(TEAL[1], BLUE[1], t), lerp(TEAL[2], BLUE[2], t)];
    for (let x = 0; x < size; x++) set(x, y, col);
  }
  // tres barras ascendentes blancas centradas
  const barW = Math.round(size * 0.13);
  const gap = Math.round(size * 0.07);
  const totalW = barW * 3 + gap * 2;
  const x0 = Math.round((size - totalW) / 2);
  const baseY = Math.round(size * 0.72);
  const heights = [0.20, 0.32, 0.44].map((h) => Math.round(size * h));
  const radius = Math.round(barW * 0.28);
  heights.forEach((h, k) => {
    const bx = x0 + k * (barW + gap);
    const topY = baseY - h;
    for (let y = topY; y < baseY; y++) {
      for (let x = bx; x < bx + barW; x++) {
        // esquinas superiores redondeadas
        const inTopLeft = x < bx + radius && y < topY + radius;
        const inTopRight = x >= bx + barW - radius && y < topY + radius;
        if (inTopLeft) {
          const dx = bx + radius - x, dy = topY + radius - y;
          if (dx * dx + dy * dy > radius * radius) continue;
        } else if (inTopRight) {
          const dx = x - (bx + barW - radius - 1), dy = topY + radius - y;
          if (dx * dx + dy * dy > radius * radius) continue;
        }
        set(x, y, WHITE);
      }
    }
  });
  return px;
}

function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const t = Buffer.from(type, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit, RGBA
  // scanlines con filtro 0
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const targets = [
  ["pwa-192x192.png", 192],
  ["pwa-512x512.png", 512],
  ["maskable-512x512.png", 512],
  ["apple-touch-icon.png", 180],
];
for (const [name, size] of targets) {
  writeFileSync(join(OUT, name), encodePNG(size, render(size)));
  console.log("wrote", name);
}
