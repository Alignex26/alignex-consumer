#!/usr/bin/env node
//
// Renders the approved module scripts to speech with ElevenLabs.
//
//   ELEVENLABS_API_KEY=... node scripts/generate-voice-elevenlabs.mjs \
//     --voice warm --voice-id <elevenlabs voice id> [--commit]
//
// DRY RUN BY DEFAULT. Without `--commit` nothing is requested and nothing is
// written: it prints exactly what it would send, how many characters that is,
// and where the output would land. Synthesis costs money, so the plan is shown
// before anything is spent.
//
// WHERE THIS SITS. It writes RAW takes into the same folder a human recording
// would go, and stops. It does not produce masters, and it deliberately cannot:
// spec compliance, silence trimming, loudness and the hard duration ceilings
// are all applied afterwards by `prepare-voice-masters.mjs`, exactly as they
// are for a recorded take. Nothing generated here bypasses a single check.
//
// THIS IS NOT THE RUNTIME PROVIDER. The architecture defers choosing a TTS
// vendor for *dynamic* speech, which is metered per session and governed by a
// budget. This is a different thing: module masters are rendered ONCE, offline,
// and served from storage forever after. It adds no runtime dependency, no
// per-session cost and no credential to the app.
//
// THE KEY IS NEVER PERSISTED. Supply it in the environment for this one
// command. It must not go in `.env`, which is loaded into the app, and no
// `EXPO_PUBLIC_` variable may ever hold it.

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const pick = (flag, fallback = null) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : fallback;
};

const VOICES = ['warm', 'clear'];
const voice = pick('--voice', 'warm');
const voiceId = pick('--voice-id');
const commit = args.includes('--commit');
const model = pick('--model', 'eleven_multilingual_v2');

if (!VOICES.includes(voice)) {
  console.error(`\n  Unknown voice "${voice}". V1 has: ${VOICES.join(', ')}\n`);
  process.exit(2);
}

const OUT = pick('--out', join('content', 'nervous_ready', 'audio-source', voice));

/**
 * The approved scripts, and their ceilings.
 *
 * Copied verbatim from `content/nervous_ready/VOICE-GENERATION-PACK.md`, which
 * is the approved source. Changing a word here without changing it there would
 * put unapproved wording into production audio, so they are checked against
 * each other below rather than trusted to stay in step.
 */
const MODULES = [
  {
    key: 'nr_arrive_short',
    ceiling: 21,
    text:
      'Come back to where you actually are. Let your eyes rest on one thing around you. ' +
      'Feel the surface supporting you. Notice your feet or your hands. ' +
      'Nothing needs solving yet. Just arrive here.',
  },
  {
    key: 'nr_regulate_short',
    ceiling: 45,
    text:
      'Notice where the tension is sitting — your jaw, shoulders, chest or stomach. ' +
      "You don't have to force it away. " +
      'Breathe in gently, then let the out-breath be a little longer. ' +
      'Again. In, easy. Out, slower. ' +
      'Let your shoulders soften as you breathe out.',
    /**
     * The same approved words, with silence where the breathing happens.
     *
     * WHY THIS ONE MODULE HAS IT. Here the breathing IS the technique, and it
     * is the only script that asks the listener to do something in real time.
     * Read straight through, the prompts land in about twenty seconds and
     * nobody has time to follow them — the words would be present and the
     * intervention absent.
     *
     * NOT A WORDING CHANGE. Every approved word survives, in order. A break tag
     * is a delivery instruction, the spoken equivalent of the direction that
     * already says "allow enough space for the breathing prompts". The drift
     * check below strips the tags and compares the words, so this cannot become
     * a route around approval.
     *
     * ELEVENLABS CAPS A SINGLE BREAK AT 3 SECONDS, so longer pauses are several
     * consecutive tags. That is a provider constraint, not a choice.
     *
     * THE DURATIONS ARE ENGINEERING DEFAULTS. Roughly three seconds in and five
     * out, twice — the shape the pack's estimate assumed. How long a breath
     * should actually be is a content judgement nobody has made, and these are
     * a starting point for the first take rather than an answer.
     */
    ssml:
      'Notice where the tension is sitting — your jaw, shoulders, chest or stomach.' +
      '<break time="1.5s" />' +
      "You don't have to force it away." +
      '<break time="2s" />' +
      // Cycle one: in, then a longer out.
      'Breathe in gently,' +
      '<break time="3s" />' +
      'then let the out-breath be a little longer.' +
      '<break time="3s" /><break time="2.5s" />' +
      // Cycle two, cued more briefly because the pattern is established.
      'Again.' +
      '<break time="1s" />' +
      'In, easy.' +
      '<break time="3s" />' +
      'Out, slower.' +
      '<break time="3s" /><break time="2.5s" />' +
      'Let your shoulders soften as you breathe out.' +
      '<break time="2s" />',
  },
  {
    key: 'nr_reframe_short',
    ceiling: 40,
    text:
      "That nervous feeling doesn't automatically mean you're not ready. " +
      'It can simply mean this matters and your system is switched on. ' +
      "You don't have to get rid of the energy. " +
      'You can give it a job. ' +
      'Let it sharpen your attention. ' +
      'Let it remind you to stay present. ' +
      'You can feel nerves and still move well. ' +
      'Both can be true at the same time.',
  },
  {
    key: 'nr_prepare_short',
    ceiling: 45,
    text:
      'Now bring to mind the very first moment you need to handle. ' +
      'Not the whole thing — just the beginning. ' +
      'What do you need to do first? ' +
      'Maybe walk in, make the call, say the opening line, or take your place. ' +
      'See yourself doing that one thing steadily. ' +
      'Choose one simple cue: shoulders down, eyes up, start slowly. ' +
      "You don't need the whole thing mapped out. " +
      'You only need the next move.',
  },
  {
    key: 'nr_close_short',
    ceiling: 11,
    text:
      "You don't need to feel fearless. " +
      'Take this steadier version of you with you. ' +
      "You're ready to begin.",
  },
];

// --- the scripts must match the approved pack ------------------------------
//
// A drift between this file and the pack would put unapproved wording into
// production audio without anybody noticing. Checked, not assumed.
const PACK = join('content', 'nervous_ready', 'VOICE-GENERATION-PACK.md');
if (existsSync(PACK)) {
  const pack = readFileSync(PACK, 'utf8');
  const drifted = MODULES.filter((m) => {
    // The pack renders each script as a blockquote; compare on words alone so
    // line breaks and quote markers do not register as differences.
    const words = (text) =>
      text.replace(/<[^>]*>/g, ' ').replace(/[—.,?:]/g, ' ').split(/\s+/).filter(Boolean);

    // Both the plain text and any SSML variant are checked against the pack,
    // with tags stripped. Markup must not become a way to say something the
    // approved script does not.
    if (!words(m.text).every((w) => pack.includes(w))) return true;
    if (m.ssml && !words(m.ssml).every((w) => pack.includes(w))) return true;

    // And the SSML must speak exactly the approved words, in order — not merely
    // words that all happen to appear somewhere in the pack.
    if (m.ssml && words(m.ssml).join(' ') !== words(m.text).join(' ')) return true;

    return false;
  });

  if (drifted.length > 0) {
    console.error(
      `\n  These scripts do not match ${PACK}:\n` +
      drifted.map((m) => `    ${m.key}`).join('\n') +
      `\n\n  The pack is the approved source. Nothing was generated.\n`
    );
    process.exit(1);
  }
} else {
  console.error(`\n  Cannot find ${PACK}, so the scripts cannot be checked against it.\n`);
  process.exit(2);
}

// --- plan ------------------------------------------------------------------
const characters = MODULES.reduce((n, m) => n + m.text.length, 0);

console.log(`\n  ${commit ? 'GENERATE' : 'DRY RUN'} — ElevenLabs, ${voice} voice\n`);
console.log(`  model     ${model}`);
console.log(`  voice id  ${voiceId ?? 'NOT SET'}`);
console.log(`  out       ${OUT}\n`);
/** Total seconds of deliberate silence a module's SSML asks for. */
const pauseSeconds = (m) =>
  [...(m.ssml ?? '').matchAll(/<break\s+time="([\d.]+)s"\s*\/>/g)]
    .reduce((total, match) => total + Number(match[1]), 0);

console.log('  module               chars  pauses  ceiling  headroom');
console.log('  -------------------  -----  ------  -------  --------');
for (const m of MODULES) {
  const pause = pauseSeconds(m);
  // Rough speaking time at an unhurried 130 words per minute, plus the silence
  // the SSML asks for. An estimate to catch an obvious overrun before spending
  // anything -- the real number comes from the file, and the ceiling is
  // enforced by prepare-voice-masters.mjs regardless.
  const words = m.text.split(/\s+/).filter(Boolean).length;
  const estimate = (words / 130) * 60 + pause;
  const headroom = m.ceiling - estimate;
  console.log(
    `  ${m.key.padEnd(19)}  ${String(m.text.length).padStart(5)}  ` +
    `${(pause ? `${pause}s` : '—').padStart(6)}  ${String(m.ceiling).padStart(6)}s  ` +
    `${headroom >= 0 ? `${headroom.toFixed(1)}s` : `OVER ${Math.abs(headroom).toFixed(1)}s`}`
  );
}
console.log(`\n  ${characters} characters total across ${MODULES.length} modules.`);

if (!voiceId) {
  console.error(
    `\n  --voice-id is required.\n\n` +
    `  Which ElevenLabs voice reads ELSEA is a casting decision, not an\n` +
    `  engineering one, and no default is assumed here. Pick one in their\n` +
    `  library and pass its id.\n`
  );
  process.exit(2);
}

if (!commit) {
  console.log('\n  Dry run. Nothing requested, nothing written, nothing spent.');
  console.log('  Re-run with --commit to generate.\n');
  process.exit(0);
}

const apiKey = process.env.ELEVENLABS_API_KEY;
if (!apiKey) {
  console.error(
    `\n  ELEVENLABS_API_KEY is not set.\n\n` +
    `  Pass it in the environment for this one command. Do not add it to .env,\n` +
    `  which is loaded into the app, and never to an EXPO_PUBLIC_ variable.\n`
  );
  process.exit(2);
}

// --- generate --------------------------------------------------------------
mkdirSync(OUT, { recursive: true });

let written = 0;
let failed = 0;

for (const m of MODULES) {
  const file = join(OUT, `${m.key}.mp3`);
  process.stdout.write(`  ${m.key.padEnd(19)} `);

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          // SSML where a module has it; the plain approved text otherwise.
          text: m.ssml ?? m.text,
          model_id: model,
          // Left at the provider's defaults on purpose. Stability, similarity
          // and style are delivery decisions, and delivery is a content call.
          // If a take reads too fast for its ceiling, that is a reason to
          // adjust them deliberately rather than to have guessed here.
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.log(`FAILED  ${response.status} ${body.slice(0, 120)}`);
      failed += 1;
      continue;
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    writeFileSync(file, bytes);
    console.log(`ok  ${Math.round(bytes.length / 1024)} KB`);
    written += 1;
  } catch (error) {
    console.log(`FAILED  ${error?.message ?? 'unknown error'}`);
    failed += 1;
  }
}

console.log(`\n  ${written} raw take(s) written, ${failed} failed.`);

if (written > 0) {
  console.log(
    `\n  These are RAW takes, not masters. Nothing is to specification yet and\n` +
    `  no duration has been checked. Convert and validate them the same way a\n` +
    `  recorded take would be:\n\n` +
    `    node scripts/prepare-voice-masters.mjs --voice ${voice}\n\n` +
    `  That is where the ceilings are enforced. A take that reads long is\n` +
    `  rejected, and the fix is to regenerate it — not to process it harder.\n`
  );
}

if (failed > 0) process.exit(1);
