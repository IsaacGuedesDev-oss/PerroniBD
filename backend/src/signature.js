// Gera um PNG pequeno com um rabisco de assinatura, usado no seed do modo demo.
const zlib = require('zlib');

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(crcInput) >>> 0, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = chunk('IHDR', ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filtro "none" no início de cada linha
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const idat = chunk('IDAT', zlib.deflateSync(raw));
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([PNG_SIGNATURE, ihdr, idat, iend]);
}

function makeFakeSignaturePNG() {
  const W = 240, H = 90;
  const buf = Buffer.alloc(W * H * 4, 0); // transparente

  function setPixel(x, y, r, g, b, a) {
    if (x < 0 || x >= W || y < 0 || y >= H) return;
    const idx = (y * W + x) * 4;
    buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = a;
  }
  function dot(cx, cy, radius, r, g, b, a) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) setPixel(cx + dx, cy + dy, r, g, b, a);
      }
    }
  }

  const INK = [42, 40, 38, 255];
  const baseY = H * 0.55;

  for (let px = 18; px <= W - 18; px++) {
    const t = (px - 18) / (W - 36);
    const y = baseY
      + Math.sin(t * Math.PI * 3.1) * 17
      + Math.sin(t * Math.PI * 7.3) * 5
      - t * 9;
    dot(px, Math.round(y), 2, INK[0], INK[1], INK[2], INK[3]);
  }
  // pequeno floreio embaixo, como um traço final de assinatura
  for (let px = 28; px <= W - 40; px++) {
    const t = (px - 28) / (W - 68);
    const y = baseY + 27 + Math.sin(t * Math.PI * 2.2) * 4;
    dot(px, Math.round(y), 1, INK[0], INK[1], INK[2], INK[3]);
  }

  const png = encodePNG(W, H, buf);
  return 'data:image/png;base64,' + png.toString('base64');
}

module.exports = { makeFakeSignaturePNG };
