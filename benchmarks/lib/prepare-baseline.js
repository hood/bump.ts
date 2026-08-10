/*
 * Regenerates the benchmark baselines from git and verifies their integrity.
 *
 *   node benchmarks/lib/prepare-baseline.js [--verify-only] [ref]
 *
 * `.bench-baseline/src`  — the comparison baseline ("base" arm)
 * `.bench-baseline2/src` — a byte-identical copy of it ("ctrl" arm)
 *
 * Both come from `git archive <ref> src`, never from a copy of the working tree.
 * An earlier sweep silently copied the optimised `rect.ts` over the baseline; the
 * "base" arm then ran half-optimised code and the whole comparison was junk
 * (base jumped from 1.2k to 2.2k ops/s while the true control read -40%). The
 * hash check below exists so that failure mode is loud instead of silent.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const DIRS = ['.bench-baseline', '.bench-baseline2'];

/*
 * The working tree is frozen into `.bench-curr` and everything downstream
 * measures THAT, never `src` directly.
 *
 * Two sweeps died mid-run because `src` was edited while they were measuring:
 * one hit a dangling reference, the other a getter/assignment clash. Both had
 * already printed rows measured against the earlier state. Freezing means a
 * sweep validates and measures one fixed snapshot whose hash it reports.
 */
const CURR_DIR = '.bench-curr';

/*
 * The baseline ref is pinned, NOT `HEAD`.
 *
 * `d436f67` is the last commit before the performance work landed; it already
 * carries the benchmark harness and the world-test fix, so it differs from the
 * optimised tree only in the library internals under measurement. Once the
 * optimisations were committed, `HEAD` became the optimised code and using it as
 * the baseline made every row read ~0%.
 */
const DEFAULT_REF = 'd436f67';

const args = process.argv.slice(2);
const verifyOnly = args.includes('--verify-only');
const ref = args.find(a => !a.startsWith('--')) || DEFAULT_REF;

function treeHash(dir) {
  const files = [];

  (function walk(d, rel) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : 1
    )) {
      const abs = path.join(d, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, r);
      else files.push([r, fs.readFileSync(abs)]);
    }
  })(dir, '');

  const h = crypto.createHash('sha256');
  for (const [rel, buf] of files) {
    h.update(rel);
    h.update(buf);
  }
  return { hash: h.digest('hex').slice(0, 16), count: files.length };
}

if (!verifyOnly) {
  for (const dir of DIRS) {
    const abs = path.join(REPO, dir);
    fs.rmSync(abs, { recursive: true, force: true });
    fs.mkdirSync(abs, { recursive: true });

    // `git archive | tar -x` rather than `cp`, so the baseline can only ever be
    // the committed source.
    execFileSync('sh', ['-c', `git archive ${ref} src | tar -x -C '${abs}'`], {
      cwd: REPO,
      stdio: 'inherit',
    });
  }
  // Freeze the working tree.
  const currAbs = path.join(REPO, CURR_DIR);
  fs.rmSync(currAbs, { recursive: true, force: true });
  fs.mkdirSync(currAbs, { recursive: true });
  fs.cpSync(path.join(REPO, 'src'), path.join(currAbs, 'src'), { recursive: true });

  // Record the ref so a sweep can report which baseline it measured against.
  fs.writeFileSync(
    path.join(REPO, DIRS[0], 'REF'),
    `${execFileSync('git', ['rev-parse', '--short', ref], { cwd: REPO, encoding: 'utf8' }).trim()}\n`
  );

  console.log(`baselines regenerated from ${ref}`);
}

const base = treeHash(path.join(REPO, DIRS[0], 'src'));
const ctrl = treeHash(path.join(REPO, DIRS[1], 'src'));
const curr = treeHash(path.join(REPO, CURR_DIR, 'src'));

console.log(`  base ${base.hash} (${base.count} files)`);
console.log(`  ctrl ${ctrl.hash} (${ctrl.count} files)`);
console.log(`  curr ${curr.hash} (${curr.count} files)`);

let bad = false;

if (base.hash !== ctrl.hash) {
  console.error('\nFATAL: base and ctrl differ. The control arm must be a byte-identical');
  console.error('copy of the baseline, or the noise floor it reports is meaningless.');
  bad = true;
}

if (base.hash === curr.hash) {
  console.error('\nFATAL: curr is identical to base, so there is nothing to measure.');
  console.error('This is what happens when the baseline ref points at a commit that');
  console.error('already contains the changes under test.');
  bad = true;
}

if (bad) process.exit(1);

console.log('\nbaseline integrity OK');
