import fs from 'node:fs';
import path from 'node:path';

/**
 * Generates a gentle ~10-second looping pastel ambient piano/chime chord WAV file
 * using pure Node.js so the repository ships with a self-contained soothing soundtrack.
 */
const SAMPLE_RATE = 22050;
const DURATION_SECONDS = 10;
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SECONDS;

// Soft major-7th & add9 chord progression (Fmaj7 -> Em7 -> Dm9 -> Cmaj7)
const CHORDS = [
  [174.61, 220.0, 261.63, 329.63], // Fmaj7
  [164.81, 196.0, 246.94, 293.66], // Em7
  [146.83, 220.0, 261.63, 329.63], // Dm9
  [130.81, 196.0, 246.94, 329.63], // Cmaj7
];

const pcm = new Int16Array(TOTAL_SAMPLES);
const chordDuration = DURATION_SECONDS / CHORDS.length;

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;
  const chordIndex = Math.min(CHORDS.length - 1, Math.floor(t / chordDuration));
  const localT = t - chordIndex * chordDuration;
  const chord = CHORDS[chordIndex];

  // Smooth attack & decay envelope per chord + seamless loop crossfade at edges
  const attack = Math.min(1, localT / 0.35);
  const decay = Math.exp(-localT * 0.65);
  const edgeFadeIn = Math.min(1, t / 0.25);
  const edgeFadeOut = Math.min(1, (DURATION_SECONDS - t) / 0.25);
  const env = attack * decay * edgeFadeIn * edgeFadeOut;

  let sample = 0;
  for (let n = 0; n < chord.length; n++) {
    const freq = chord[n];
    // Gentle staggered arpeggio feel
    const noteDelay = n * 0.14;
    if (localT >= noteDelay) {
      const nt = localT - noteDelay;
      const noteEnv = Math.min(1, nt / 0.08) * Math.exp(-nt * 0.75);
      sample +=
        Math.sin(2 * Math.PI * freq * t) * 0.65 * noteEnv +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.12 * noteEnv;
    }
  }

  const normalized = (sample / chord.length) * env * 0.42;
  pcm[i] = Math.max(-32767, Math.min(32767, Math.round(normalized * 32767)));
}

const dataSize = pcm.length * 2;
const buffer = Buffer.alloc(44 + dataSize);

buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // PCM header size
buffer.writeUInt16LE(1, 20); // PCM format
buffer.writeUInt16LE(1, 22); // Mono
buffer.writeUInt32LE(SAMPLE_RATE, 24);
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // Byte rate
buffer.writeUInt16LE(2, 32); // Block align
buffer.writeUInt16LE(16, 34); // Bits per sample
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < pcm.length; i++) {
  buffer.writeInt16LE(pcm[i], 44 + i * 2);
}

const outPath = path.join(process.cwd(), 'public', 'samples', 'gentle-memories.wav');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buffer);
console.log(`Generated ${outPath} (${buffer.length} bytes)`);
