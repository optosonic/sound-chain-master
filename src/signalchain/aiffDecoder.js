// AIFF / AIFC container parser + PCM decoder → Web Audio AudioBuffer.
//
// Browsers (Chrome, Firefox, Edge) can't decode AIFF through the <audio>
// element OR BaseAudioContext.decodeAudioData — only Safari/macOS does (AIFF
// is an Apple format). So for AIFF we parse the container in JavaScript and
// build an AudioBuffer directly, then play it through an AudioBufferSourceNode.
//
// Supports the common uncompressed-PCM variants:
//   • AIFF  — 8/16/20/24/32-bit signed integer (big-endian; 8-bit is unsigned)
//   • AIFC  — 'NONE'/'twos' (big-endian PCM), 'sowt' (little-endian PCM),
//             'fl32'/'fl64' (32/64-bit IEEE float)
// Compressed AIFC codecs (IMA4, alaw, ulaw, …) throw a clear "unsupported"
// error rather than failing silently.

const isAiffName = (name) => /\.(aif|aiff|aifc)$/i.test(name || '');
const isAiffMime = (type) => /^(audio\/aiff|audio\/x-aiff|audio\/aifc)$/i.test(type || '');

export function isAiffFile(file) {
  return !!(file && (isAiffMime(file.type) || isAiffName(file.name)));
}

// 80-bit IEEE 754 extended float (AIFF sample-rate) → JS number.
function readExtended(dv, off) {
  const exponent = dv.getUint16(off, false) & 0x7fff;
  const hi = dv.getUint32(off + 2, false) >>> 0;
  const lo = dv.getUint32(off + 6, false) >>> 0;
  const sign = (dv.getUint8(off) & 0x80) ? -1 : 1;
  if (exponent === 0 && hi === 0 && lo === 0) return 0;
  // 64-bit integer mantissa (may exceed 2^53 and lose precision, but typical
  // integer sample rates land exactly after the power-of-two scaling).
  const mantissa = hi * 4294967296 + lo;
  return sign * mantissa * Math.pow(2, exponent - 16383 - 63);
}

function fourcc(dv, off) {
  return String.fromCharCode(dv.getUint8(off), dv.getUint8(off + 1), dv.getUint8(off + 2), dv.getUint8(off + 3));
}

/**
 * Decode an AIFF/AIFC ArrayBuffer into a Web Audio AudioBuffer.
 * @param {AudioContext|OfflineAudioContext} ctx
 * @param {ArrayBuffer} arrayBuffer
 * @returns {Promise<AudioBuffer>}
 */
export async function decodeAiffToAudioBuffer(ctx, arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 12) throw new Error('File is too small to be a valid AIFF file.');
  const dv = new DataView(arrayBuffer);
  if (fourcc(dv, 0) !== 'FORM') throw new Error('Not an AIFF/AIFC file (missing FORM container).');
  const formType = fourcc(dv, 8);
  if (formType !== 'AIFF' && formType !== 'AIFC') throw new Error(`Unsupported AIFF form type "${formType}".`);
  const aifc = formType === 'AIFC';

  let numChannels = 0, numFrames = 0, sampleSize = 0, sampleRate = 0;
  let compressionType = 'NONE';
  let ssndOffset = -1, ssndLength = 0;

  // Chunks start at offset 12; each chunk = 4 id + 4 size (big-endian) + data.
  let pos = 12;
  const end = Math.min(arrayBuffer.byteLength, 8 + dv.getUint32(4, false));
  while (pos + 8 <= end) {
    const id = fourcc(dv, pos);
    const size = dv.getUint32(pos + 4, false);
    const dataOff = pos + 8;
    if (id === 'COMM') {
      numChannels = dv.getUint16(dataOff, false);
      numFrames = dv.getUint32(dataOff + 2, false);
      sampleSize = dv.getUint16(dataOff + 6, false);
      sampleRate = readExtended(dv, dataOff + 8);
      if (aifc) compressionType = fourcc(dv, dataOff + 18);
    } else if (id === 'SSND') {
      // SSND: 4-byte offset (usually 0) + 4-byte blockSize (usually 0) + samples.
      ssndOffset = dataOff + 8;
      ssndLength = size - 8;
    }
    // Chunks are padded to an even byte length.
    pos = dataOff + size + (size & 1 ? 1 : 0);
  }

  if (!numChannels || !sampleRate || sampleSize === 0) throw new Error('AIFF has no valid COMM chunk.');
  if (ssndOffset < 0) throw new Error('AIFF has no SSND (sample data) chunk.');

  const ct = compressionType.toUpperCase();
  const isFloat = (ct === 'FL32' || ct === 'FL64');
  const littleEndian = (ct === 'SOWT');
  const isPcm = (ct === 'NONE' || ct === 'TWOS' || ct === 'SOWT');
  if (!isFloat && !isPcm) {
    throw new Error(`Unsupported AIFF compression "${compressionType}" — only uncompressed PCM and float are supported.`);
  }

  if (!numFrames) {
    const bytesPerFrame = numChannels * Math.ceil(sampleSize / 8);
    numFrames = bytesPerFrame ? Math.floor(ssndLength / bytesPerFrame) : 0;
  }
  if (numFrames <= 0) throw new Error('AIFF has no sample frames.');

  const bytesPerSample = Math.ceil(sampleSize / 8);
  const buffer = ctx.createBuffer(numChannels, numFrames, Math.round(sampleRate));
  const dataStart = ssndOffset;
  const frameBytes = numChannels * bytesPerSample;

  // Per-channel float32 output arrays.
  const chData = [];
  for (let ch = 0; ch < numChannels; ch++) chData.push(buffer.getChannelData(ch));

  if (isFloat) {
    if (bytesPerSample === 4) {
      for (let i = 0; i < numFrames; i++) {
        const base = dataStart + i * frameBytes;
        for (let ch = 0; ch < numChannels; ch++) chData[ch][i] = dv.getFloat32(base + ch * 4, littleEndian);
      }
    } else if (bytesPerSample === 8) {
      for (let i = 0; i < numFrames; i++) {
        const base = dataStart + i * frameBytes;
        for (let ch = 0; ch < numChannels; ch++) chData[ch][i] = dv.getFloat64(base + ch * 8, littleEndian);
      }
    } else {
      throw new Error(`Unsupported float sample size (${sampleSize}-bit).`);
    }
  } else if (sampleSize === 8) {
    // 8-bit AIFF is unsigned (0..255, 128 = silence).
    for (let i = 0; i < numFrames; i++) {
      const base = dataStart + i * frameBytes;
      for (let ch = 0; ch < numChannels; ch++) chData[ch][i] = (dv.getUint8(base + ch) - 128) / 128;
    }
  } else if (sampleSize === 16) {
    for (let i = 0; i < numFrames; i++) {
      const base = dataStart + i * frameBytes;
      for (let ch = 0; ch < numChannels; ch++) chData[ch][i] = dv.getInt16(base + ch * 2, littleEndian) / 32768;
    }
  } else if (sampleSize === 24) {
    for (let i = 0; i < numFrames; i++) {
      const base = dataStart + i * frameBytes;
      for (let ch = 0; ch < numChannels; ch++) {
        const o = base + ch * 3;
        let v = littleEndian
          ? (dv.getUint8(o + 2) << 16) | (dv.getUint8(o + 1) << 8) | dv.getUint8(o)
          : (dv.getUint8(o) << 16) | (dv.getUint8(o + 1) << 8) | dv.getUint8(o + 2);
        if (v & 0x800000) v |= ~0xffffff; // sign-extend to 32-bit
        chData[ch][i] = v / 8388608;
      }
    }
  } else if (sampleSize === 32) {
    for (let i = 0; i < numFrames; i++) {
      const base = dataStart + i * frameBytes;
      for (let ch = 0; ch < numChannels; ch++) chData[ch][i] = dv.getInt32(base + ch * 4, littleEndian) / 2147483648;
    }
  } else {
    // General MSB-aligned integer fallback (e.g. 12/20-bit, rare).
    for (let i = 0; i < numFrames; i++) {
      const base = dataStart + i * frameBytes;
      for (let ch = 0; ch < numChannels; ch++) {
        chData[ch][i] = readIntSample(dv, base + ch * bytesPerSample, sampleSize, bytesPerSample, littleEndian);
      }
    }
  }

  return buffer;
}

// Read one MSB-aligned signed integer sample and convert to float32 in [-1, 1].
function readIntSample(dv, off, bits, bytes, littleEndian) {
  let v = 0;
  for (let b = 0; b < bytes; b++) {
    const byte = dv.getUint8(off + b);
    v |= byte << (littleEndian ? (b * 8) : ((bytes - 1 - b) * 8));
  }
  // Sign-extend to 32-bit (bytes <= 4).
  const signShift = 32 - bytes * 8;
  if (signShift > 0) v = (v << signShift) >> signShift;
  // AIFF stores samples MSB-aligned within the byte field.
  const unused = bytes * 8 - bits;
  const s = unused > 0 ? (v >> unused) : v;
  return s / Math.pow(2, bits - 1);
}