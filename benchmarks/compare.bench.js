/*
 * A/B benchmark driver: current `src/` vs the pristine snapshot in
 * `.bench-baseline/src/`, with a control arm.
 *
 *   node benchmarks/compare.bench.js                 # everything
 *   node benchmarks/compare.bench.js move            # ops matching "move"
 *   TRIALS=7 node benchmarks/compare.bench.js        # more trials
 *
 * Three arms are measured per op:
 *   base — the pristine snapshot
 *   ctrl — a byte-identical second copy of the snapshot
 *   curr — the working tree
 *
 * `ctrl` should read 0%. Whatever it actually reads is the measurement error for
 * that row under the conditions that row was measured, so `curr` is only
 * believable when it clearly exceeds `ctrl`. Each measurement runs in its own
 * process, and the arm order rotates between trials so warm-up order cannot
 * favour any one of them.
 *
 * Do not run anything else on the machine during a sweep. Compiling in another
 * terminal pushed a control arm that should read 0% to +33%.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { SCENARIOS } = require('./lib/scenarios');

/*
 * Hash of the tree under test, sampled before and after the sweep.
 *
 * A sweep once ran while `src` was being edited: it measured two different
 * implementations under one label and then died halfway through on a
 * ReferenceError. Comparing these two hashes turns that into a visible warning
 * rather than a plausible-looking table.
 */
function treeHash(dir) {
  const parts = [];

  (function walk(d, rel) {
    for (const entry of fs
      .readdirSync(d, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const abs = path.join(d, entry.name);
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(abs, r);
      else parts.push(r, fs.readFileSync(abs));
    }
  })(dir, '');

  const h = crypto.createHash('sha256');
  for (const p of parts) h.update(p);
  return h.digest('hex').slice(0, 16);
}

const RUN_ONE = path.join(__dirname, 'lib', 'run-one.js');
const TRIALS = Number(process.env.TRIALS || 5);
const ARMS = ['base', 'ctrl', 'curr'];
const filter = process.argv[2];

function measure(impl, scenarioIdx, opName) {
  const out = execFileSync(
    process.execPath,
    [RUN_ONE, impl, String(scenarioIdx), opName],
    { encoding: 'utf8', cwd: path.join(__dirname, '..') }
  );
  return JSON.parse(out.trim().split('\n').pop());
}

function median(xs) {
  const s = xs.slice().sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function fmtHz(hz) {
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)}M/s`.padStart(9);
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)}k/s`.padStart(9);
  return `${hz.toFixed(1)}/s`.padStart(9);
}

function sign(n) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

const SRC_DIR = path.join(__dirname, '..', '.bench-curr', 'src');
const srcHashBefore = treeHash(SRC_DIR);
const baselineRef = (() => {
  try {
    return fs.readFileSync(path.join(__dirname, '..', '.bench-baseline', 'REF'), 'utf8').trim();
  } catch (e) {
    return 'unknown';
  }
})();

console.log(`baseline ref ${baselineRef}   src ${srcHashBefore}`);

const results = [];

for (let si = 0; si < SCENARIOS.length; si++) {
  const scenario = SCENARIOS[si];
  const ops = Object.keys(scenario.build().ops).filter(
    op =>
      !filter ||
      `${scenario.name} ${op}`.toLowerCase().includes(filter.toLowerCase())
  );

  if (!ops.length) continue;

  console.log(`\n## ${scenario.name}`);
  console.log(`  ${'op'.padEnd(28)} ${'base'.padStart(9)} ${'curr'.padStart(9)}      curr     ctrl`);

  for (const op of ops) {
    const hz = { base: [], ctrl: [], curr: [] };
    const currDeltas = [];
    const ctrlDeltas = [];

    for (let t = 0; t < TRIALS; t++) {
      // Rotate the arm order so no arm is systematically measured first.
      const order = ARMS.slice(t % ARMS.length).concat(ARMS.slice(0, t % ARMS.length));
      const got = {};
      for (const arm of order) got[arm] = measure(arm, si, op);

      for (const arm of ARMS) hz[arm].push(got[arm].hz);
      currDeltas.push((got.curr.hz / got.base.hz - 1) * 100);
      ctrlDeltas.push((got.ctrl.hz / got.base.hz - 1) * 100);
    }

    const currDelta = median(currDeltas);
    const ctrlDelta = median(ctrlDeltas);
    // Error bar for the row: how far the control strayed from the 0% it should
    // read, plus the trial-to-trial swing of the control.
    const noise =
      Math.abs(ctrlDelta) + (Math.max(...ctrlDeltas) - Math.min(...ctrlDeltas)) / 2;

    results.push({ scenario: scenario.name, op, currDelta, ctrlDelta, noise });

    console.log(
      `  ${op.padEnd(28)} ${fmtHz(median(hz.base))} ${fmtHz(median(hz.curr))}  ` +
        `${sign(currDelta).padStart(8)} ${sign(ctrlDelta).padStart(8)}` +
        `${Math.abs(currDelta) > noise ? '' : '   (within noise)'}`
    );
  }
}

console.log(`\n## summary (median of ${TRIALS} trials, rotating arm order)\n`);
console.log('  curr = optimised vs baseline. ctrl = baseline copy vs baseline,');
console.log('  i.e. the measurement error for that row. A result counts only');
console.log('  when |curr| exceeds the row\'s noise estimate.\n');

for (const r of results)
  console.log(
    `  ${(r.op + ' — ' + r.scenario).padEnd(58)} ${sign(r.currDelta).padStart(8)}` +
      `   (ctrl ${sign(r.ctrlDelta)}, noise ±${r.noise.toFixed(1)}%)` +
      `${Math.abs(r.currDelta) > r.noise ? '' : '  WITHIN NOISE'}`
  );

const srcHashAfter = treeHash(SRC_DIR);

if (srcHashAfter !== srcHashBefore) {
  console.log('');
  console.log('  *** WARNING: src changed during the sweep ***');
  console.log(`  before ${srcHashBefore}, after ${srcHashAfter}.`);
  console.log('  Rows measured before and after the edit are not comparable. Re-run.');
}

const solid = results.filter(r => Math.abs(r.currDelta) > r.noise);

console.log(
  `\n  ${solid.length}/${results.length} rows exceed their own noise floor.`
);
if (solid.length)
  console.log(
    `  Median gain among those: ${sign(median(solid.map(r => r.currDelta)))}`
  );
