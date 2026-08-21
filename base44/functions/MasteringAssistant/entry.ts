import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const MEDIUMS = ['cinematic', 'radio', 'podcast', 'album', 'ep', 'video', 'streaming', 'club'];
const STYLES = ['edm', 'jazz', 'classical', 'independent', 'loud', 'medium', 'soft'];

const MEDIUM_NOTES = {
  cinematic: 'wide dynamic range, dialogue-level loudness, gentle limiting, true peak ≤ -2 dBFS',
  radio: 'loud, competitive, dense and bright, tight low end',
  podcast: 'speech-optimized, consistent level, present midrange',
  album: 'balanced streaming-ready master, musical dynamics preserved',
  ep: 'punchy, modern streaming-loud single',
  video: 'YouTube/broadcast-safe, consistent level, true peak ≤ -1 dBFS',
  streaming: 'Spotify/Apple Music normalization target, balanced and clean',
  club: 'loud, weighty low end, maximum impact for sound systems',
};

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    eq: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' },
        bandCount: { type: 'number' },
        low: { type: 'object', properties: { freq: { type: 'number' }, gain: { type: 'number' }, cut: { type: 'boolean' }, slope: { type: 'number' } } },
        mids: { type: 'array', items: { type: 'object', properties: { freq: { type: 'number' }, gain: { type: 'number' }, q: { type: 'number' } } } },
        high: { type: 'object', properties: { freq: { type: 'number' }, gain: { type: 'number' }, cut: { type: 'boolean' }, slope: { type: 'number' } } },
      },
    },
    compressor: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' }, threshold: { type: 'number' }, ratio: { type: 'number' },
        attack: { type: 'number' }, release: { type: 'number' }, knee: { type: 'number' }, makeupGain: { type: 'number' },
      },
    },
    limiter: { type: 'object', properties: { enabled: { type: 'boolean' }, threshold: { type: 'number' } } },
    mbc: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' }, bandCount: { type: 'number' },
        crossovers: { type: 'array', items: { type: 'number' } },
        bands: { type: 'array', items: { type: 'object', properties: {
          threshold: { type: 'number' }, ratio: { type: 'number' }, attack: { type: 'number' },
          release: { type: 'number' }, makeupGain: { type: 'number' }, knee: { type: 'number' },
        } } },
        globalMakeup: { type: 'number' },
      },
    },
    tape: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' }, preset: { type: 'string' }, speed: { type: 'number' },
        drive: { type: 'number' }, saturation: { type: 'number' }, bias: { type: 'number' },
        hysteresis: { type: 'number' }, wow: { type: 'number' }, flutter: { type: 'number' },
        noise: { type: 'number' }, headBump: { type: 'number' }, hfLoss: { type: 'number' }, mix: { type: 'number' },
      },
    },
    saturation: {
      type: 'object',
      properties: {
        enabled: { type: 'boolean' }, mode: { type: 'string' }, drive: { type: 'number' },
        mix: { type: 'number' }, tone: { type: 'number' }, output: { type: 'number' },
      },
    },
    targetLufs: { type: 'number' },
    notes: { type: 'string' },
  },
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const medium = MEDIUMS.includes(body.medium) ? body.medium : 'album';
    const style = STYLES.includes(body.style) ? body.style : 'medium';
    const targetLufs = Math.max(-27, Math.min(-5, Number(body.targetLufs) || -14));

    const prompt = `You are a Grammy-winning audio mastering engineer working in the lineage of Bob Katz.
Design a complete mastering chain for one track using Katz's principles:
- The K-System: reserve headroom and tie loudness to a calibrated SPL rather than chasing peak; keep musical dynamics.
- Pink-noise / third-octave spectral balance: a balanced master follows roughly a -3 dB/octave pink-noise slope measured in third-octave bands. Tilt the spectrum back toward that reference so no octave jumps out — tame harsh 2–5 kHz, control muddy 200–400 Hz, gentle air above 10 kHz.
- Loudness target: hit the requested integrated LUFS without clipping (true peak ≤ -1 dBFS) using compression/limiting, never by hard clipping.

Target medium: ${medium} — ${MEDIUM_NOTES[medium]}.
Musical style: ${style}.
Target loudness: ${targetLufs} LUFS integrated.

Return a JSON mastering recipe with these exact fields. Use realistic, conservative values within the ranges:
- eq: a parametric EQ (3–5 bands). low = { freq 20–200 Hz, gain ±dB, cut boolean, slope 12/24 }, mids = array of { freq, gain ±dB, q 0.4–2 }, high = { freq 2000–16000, gain, cut, slope }. Balance toward the pink-noise reference.
- compressor: glue bus compressor { enabled, threshold -30..-10 dB, ratio 1.5..4, attack 0.003..0.03 s, release 0.1..0.5 s, knee 0..30, makeupGain 0..6 dB }.
- limiter: brickwall { enabled true, threshold -1.5..-0.3 dB } sized so true peak stays ≤ -1 dBFS.
- mbc: optional multi-band compressor { enabled, bandCount 3..5, crossovers array of Hz, bands array of { threshold, ratio, attack, release, makeupGain, knee }, globalMakeup 0..6 dB }. Use it only if the style/medium benefits (e.g. radio/EDM).
- tape: analog tape color { enabled, preset string (studera800|ampexatr102|otarimtr90|nagraivs|tascammsr), speed 7.5/15/30, drive 0..1, saturation 0..1, bias 0..1, hysteresis 0..1, wow 0..0.4, flutter 0..0.2, noise 0..0.2, headBump 0..0.5, hfLoss 0..0.7, mix 0..1 }. More color for warm/lo-fi styles, less for classical/cinematic.
- saturation: optional harmonic exciter { enabled, mode (tube|tape|transistor|opto|clean), drive 0..1, mix 0..0.5, tone 2000..16000, output 0..2 }.
- targetLufs: the integrated LUFS you are mastering toward (the requested value).
- notes: 2–3 short sentences explaining your tonal and loudness decisions in plain English.

Be conservative — never recommend settings that would clip or distort. Prefer musicality over loudness except for "radio"/"loud".`;

    const recipe = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: RECIPE_SCHEMA,
      model: 'claude_sonnet_4_6',
    });

    return Response.json({ recipe });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}