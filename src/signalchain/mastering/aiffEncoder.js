/**
 * Encode Float32 channel arrays into a 24-bit PCM AIFF file (big-endian).
 * Used to download the offline-rendered master as AIFF / AIF.
 */

function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

/** 80-bit IEEE 754 extended float (AIFF COMM sample rate). */
function writeExtended80(view, offset, value) {
  if (!Number.isFinite(value) || value === 0) {
    for (let i = 0; i < 10; i++) view.setUint8(offset + i, 0);
    return;
  }
  const sign = value < 0 ? 0x8000 : 0;
  value = Math.abs(value);
  let exp = Math.floor(Math.log2(value));
  let mantissa = value / 2 ** exp;
  exp += 16383;
  let mant = BigInt(Math.round(mantissa * 2 ** 63));
  if (mant >= (1n << 64n)) {
    mant >>= 1n;
    exp += 1;
  }
  view.setUint16(offset, sign | (exp & 0x7fff), false);
  view.setUint32(offset + 2, Number((mant >> 32n) & 0xffffffffn), false);
  view.setUint32(offset + 6, Number(mant & 0xffffffffn), false);
}

export function encodeAiff(channels, sampleRate, length, bitDepth = 24, dither = false) {
  const bytesPerSample = bitDepth / 8;
  const numCh = channels.length;
  const dataSize = length * numCh * bytesPerSample;
  const commSize = 18;
  const ssndSize = 8 + dataSize;
  const formSize = 4 + (8 + commSize) + (8 + ssndSize);
  const buffer = new ArrayBuffer(8 + formSize);
  const view = new DataView(buffer);

  writeStr(view, 0, 'FORM');
  view.setUint32(4, formSize, false);
  writeStr(view, 8, 'AIFF');
  writeStr(view, 12, 'COMM');
  view.setUint32(16, commSize, false);
  view.setUint16(20, numCh, false);
  view.setUint32(22, length, false);
  view.setUint16(26, bitDepth, false);
  writeExtended80(view, 28, sampleRate);
  writeStr(view, 38, 'SSND');
  view.setUint32(42, ssndSize, false);
  view.setUint32(46, 0, false);
  view.setUint32(50, 0, false);

  let offset = 54;
  const max = 2 ** (bitDepth - 1) - 1;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = channels[c][i];
      if (dither) v += (Math.random() - Math.random()) * (2 / 2 ** bitDepth);
      if (v > 1) v = 1; else if (v < -1) v = -1;
      const iv = Math.round(v * max);
      if (bitDepth === 16) {
        view.setInt16(offset, iv, false);
        offset += 2;
      } else {
        view.setUint8(offset, (iv >> 16) & 0xff);
        view.setUint8(offset + 1, (iv >> 8) & 0xff);
        view.setUint8(offset + 2, iv & 0xff);
        offset += 3;
      }
    }
  }
  return new Blob([buffer], { type: 'audio/aiff' });
}
