#!/usr/bin/env node
//
// Has `supabase/functions/` changed since the Edge Functions were last deployed?
//
// WHY THIS EXISTS. `supabase migration list` reports migration drift. There is
// no equivalent for Edge Functions: `functions deploy` reports success without
// saying what it replaced, so a function can sit live behind `main` and nothing
// says so. That already happened once — `_shared/allocate.ts` changed by 74
// lines and was not redeployed for three commits, while the documentation
// described the new behaviour.
//
// The trap it guards against is subtler than forgetting: comparing the working
// tree to `main` proves nothing about what is deployed, while reading exactly
// like a parity check.
//
// HOW IT WORKS. `supabase/functions/DEPLOYED` records the commit that was last
// deployed. This compares it to HEAD. No secrets, no network, no dependencies.
//
// The marker lives inside the directory it watches, so it is excluded from the
// comparison — otherwise recording a deploy is itself a change since the
// deploy, and the check reports stale for ever.
//
// Update the marker as part of deploying:
//   npx supabase functions deploy compose
//   git rev-parse HEAD > supabase/functions/DEPLOYED

import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const MARKER = join('supabase', 'functions', 'DEPLOYED');
const FUNCTIONS = join('supabase', 'functions');

function fail(message) {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

if (!existsSync(MARKER)) {
  fail(
    `No deploy marker at ${MARKER}.\n` +
    `  After deploying, record the commit:\n` +
    `    git rev-parse HEAD > ${MARKER}`
  );
}

const deployed = readFileSync(MARKER, 'utf8').trim();
if (!/^[0-9a-f]{40}$/.test(deployed)) {
  fail(`${MARKER} does not contain a commit sha: ${JSON.stringify(deployed)}`);
}

let changed;
try {
  changed = execSync(
    `git log --oneline ${deployed}..HEAD -- supabase/functions/ ":!supabase/functions/DEPLOYED"`,
    { encoding: 'utf8' }
  ).trim();
} catch {
  fail(
    `Could not diff against ${deployed.slice(0, 8)} — is it an ancestor of HEAD?\n` +
    `  If the marker is stale or from a rebased branch, redeploy and rewrite it.`
  );
}

// Committed history is only half of it. Uncommitted edits to a function are
// exactly the case where a "current" answer is most misleading, because that is
// when someone is mid-change and most likely to believe the deployment matches.
const dirty = execSync('git status --porcelain -- supabase/functions/ ":!supabase/functions/DEPLOYED"', {
  encoding: 'utf8',
}).trim();

if (changed === '' && dirty === '') {
  console.log(`\n  Edge Functions are current (deployed at ${deployed.slice(0, 8)}).\n`);
  process.exit(0);
}

if (changed === '') {
  console.error(
    `\n  Edge Functions have UNCOMMITTED changes. Nothing is committed since the\n` +
    `  last deploy, but the working tree differs from what is live:\n` +
    dirty.split('\n').map((l) => `    ${l}`).join('\n') +
    `\n\n  Commit and redeploy before treating the deployment as current.\n`
  );
  process.exit(1);
}

const commits = changed.split('\n');

/**
 * WHICH functions changed, not a guess.
 *
 * This used to print `functions deploy compose` whatever had actually changed.
 * Following that instruction deploys one function, then writes a marker claiming
 * everything is current — so a genuinely stale function is recorded as deployed
 * and the next check says it is fine. A wrong answer that silences the check is
 * worse than no check.
 *
 * `_shared/` belongs to every function that imports it, so a change there means
 * redeploying all of them.
 */
const touched = execSync(
  `git diff --name-only ${deployed}..HEAD -- supabase/functions/ ":!supabase/functions/DEPLOYED"`,
  { encoding: 'utf8' }
).trim();

const dirtyPaths = dirty
  .split('\n')
  .map((line) => line.slice(3).trim())
  .filter(Boolean);

const paths = [...touched.split('\n'), ...dirtyPaths].filter(Boolean);
const shared = paths.some((f) => f.includes('supabase/functions/_shared/'));

const functions = shared
  ? readdirSync(FUNCTIONS, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('_'))
      .map((e) => e.name)
  : [...new Set(
      paths
        .map((f) => /supabase\/functions\/([^/]+)\//.exec(f)?.[1])
        .filter((n) => n && !n.startsWith('_'))
    )];

console.error(
  `\n  Edge Functions are STALE. ${commits.length} commit(s) have touched ` +
  `supabase/functions/ since ${deployed.slice(0, 8)}:\n` +
  commits.map((c) => `    ${c}`).join('\n') +
  (shared
    ? `\n\n  _shared/ changed, so every function that imports it is stale.`
    : '') +
  `\n\n  Redeploy these, then update the marker:\n` +
  functions.map((f) => `    npx supabase functions deploy ${f}`).join('\n') +
  `\n    git rev-parse HEAD > ${MARKER}\n`
);
process.exit(1);
