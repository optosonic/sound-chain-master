/** Shared import/export format list — keep in sync with native scmAudioIo. */
export const AUDIO_FORMATS = [
  { id: 'wav', label: 'WAV', ext: 'wav' },
  { id: 'aiff', label: 'AIFF', ext: 'aiff' },
  { id: 'flac', label: 'FLAC', ext: 'flac' },
  { id: 'ogg', label: 'OGG', ext: 'ogg' },
  { id: 'm4a', label: 'M4A', ext: 'm4a' },
  { id: 'mp4', label: 'MP4', ext: 'mp4' },
  { id: 'mp3', label: 'MP3', ext: 'mp3' },
];

export const AUDIO_IMPORT_ACCEPT = [
  'audio/wav', 'audio/x-wav', 'audio/mpeg', 'audio/mp3', 'audio/flac', 'audio/ogg',
  'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/aiff', 'audio/x-aiff', 'video/mp4',
  '.wav', '.aif', '.aiff', '.flac', '.ogg', '.mp3', '.m4a', '.mp4',
].join(',');

const IMPORT_EXT = /\.(wav|aif|aiff|flac|ogg|mp3|m4a|mp4)$/i;

export function isImportableAudioFile(file) {
  if (!file) return false;
  if (IMPORT_EXT.test(file.name || '')) return true;
  const t = file.type || '';
  if (t.startsWith('audio/')) return true;
  if (t === 'video/mp4') return true;
  return false;
}
