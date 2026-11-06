/**
 * Decodes the embedded sample pack. Vite inlines every file in
 * src/audio/samples/ as a base64 data URL, so the offline build needs no
 * file loading (browsers block fetch() on file://).
 */
const EMBEDDED = import.meta.glob('./samples/*.mp3', { query: '?inline', import: 'default', eager: true });

export class SampleBank {
  constructor(ctx) {
    this.ctx = ctx;
    this.buffers = new Map();
    this.loopBounds = new Map();
    this.failed = [];
    this.total = Object.keys(EMBEDDED).length;
  }

  get loaded() {
    return this.buffers.size;
  }

  /** Decodes all samples in parallel; failures are recorded, never thrown. */
  async loadAll() {
    const jobs = Object.entries(EMBEDDED).map(async ([path, url]) => {
      const name = path.split('/').pop().replace(/\.mp3$/, '');
      try {
        const buffer = await this.ctx.decodeAudioData(dataUrlToArrayBuffer(url));
        this.buffers.set(name, buffer);
        this.loopBounds.set(name, findAudibleBounds(buffer));
      } catch (err) {
        this.failed.push(name);
        console.warn(`[audio] could not decode ${name}:`, err);
      }
    });
    await Promise.all(jobs);
  }

  get(name) {
    return this.buffers.get(name) ?? null;
  }

  /**
   * Loop start/end in seconds. MP3 encoders add a few hundred to a thousand
   * silent samples at both ends; depending on the browser's decoder these
   * may survive decoding, which would click on every loop pass.
   */
  bounds(name) {
    return this.loopBounds.get(name) ?? null;
  }
}

function dataUrlToArrayBuffer(url) {
  const base64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function findAudibleBounds(buffer) {
  const data = buffer.getChannelData(0);
  const threshold = 1e-5;
  const search = Math.min(data.length >> 2, 4096);
  let start = 0;
  while (start < search && Math.abs(data[start]) < threshold) start++;
  let end = data.length - 1;
  while (end > data.length - 1 - search && Math.abs(data[end]) < threshold) end--;
  return { start: start / buffer.sampleRate, end: (end + 1) / buffer.sampleRate };
}
