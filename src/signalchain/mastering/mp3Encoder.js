/**
 * Encode Float32 channel arrays into an MP3 (320 kbps by default) using lamejs.
 * Used to download the offline-rendered master as MP3.
 */
function floatToInt16(data, dither = false) {
  const out = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    let v = data[i];
    if (dither) v += (Math.random() - Math.random()) * (2 / 65536);
    if (v > 1) v = 1; else if (v < -1) v = -1;
    out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  return out;
}

export async function encodeMp3(channels, sampleRate, length, kbps = 320, dither = false, onProgress) {
  const mod = await import('@breezystack/lamejs');
  const Lame = mod.default || mod;
  const Mp3Encoder = Lame.Mp3Encoder || mod.Mp3Encoder;
  const enc = new Mp3Encoder(channels.length, sampleRate, kbps);

  const left = floatToInt16(channels[0], dither);
  const right = channels.length > 1 ? floatToInt16(channels[1], dither) : left;

  const block = 1152;
  const chunks = [];
  const totalBlocks = Math.ceil(length / block);
  // Yield ~40 times across the encode so the UI thread can paint progress
  // without the setTimeout overhead of yielding every block.
  const yieldEvery = Math.max(1, Math.floor(totalBlocks / 40));
  for (let i = 0, b = 0; i < length; i += block, b++) {
    const l = left.subarray(i, i + block);
    const r = right.subarray(i, i + block);
    const buf = channels.length > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
    if (onProgress && b % yieldEvery === 0) {
      try { onProgress(b / totalBlocks); } catch {}
      await new Promise((res) => setTimeout(res, 0));
    }
  }
  const end = enc.flush();
  if (end.length > 0) chunks.push(new Uint8Array(end));
  if (onProgress) { try { onProgress(1); } catch {} }

  const total = chunks.reduce((a, c) => a + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return new Blob([out], { type: 'audio/mp3' });
}