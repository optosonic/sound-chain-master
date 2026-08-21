/**
 * Encode Float32 channel arrays into a PCM WAV file (16 or 24 bit).
 * Used to download the offline-rendered master.
 */
function writeStr(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

export function encodeWav(channels, sampleRate, length, bitDepth = 24, dither = false) {
  const bytesPerSample = bitDepth / 8;
  const numCh = channels.length;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeStr(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, 'WAVE');
  writeStr(view, 12, 'fmt ');
  view.setUint32(16, 16, true);            // fmt chunk size
  view.setUint16(20, 1, true);             // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  const max = Math.pow(2, bitDepth - 1) - 1;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numCh; c++) {
      let v = channels[c][i];
      if (dither) v += (Math.random() - Math.random()) * (2 / Math.pow(2, bitDepth));
      if (v > 1) v = 1; else if (v < -1) v = -1;
      const iv = Math.round(v * max);
      if (bitDepth === 16) {
        view.setInt16(offset, iv, true);
        offset += 2;
      } else {
        view.setUint8(offset, iv & 0xff);
        view.setUint8(offset + 1, (iv >> 8) & 0xff);
        view.setUint8(offset + 2, (iv >> 16) & 0xff);
        offset += 3;
      }
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}