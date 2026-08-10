/*
 * A/B benchmark driver: current `src/` vs the pristine snapshot in
 * `.bench-baseline/src/`.
 *
 *   node benchmarks/compare.bench.js                 # everything
 *   node benchmarks/compare.bench.js move            # ops matching "move"
 *   TRIALS=7 node benchmarks/compare.bench.js        # more trials
 *
 * Each measurement runs in its own child process, and the base/curr order is
 * alternated between trials so warm-up order cannot favour either side. The
 * reported delta is the median across trials; `spread` is the gap between the
 * best and worst trial and is the honest noise floor for that row — treat any
 * delta smaller than the spread as "no measurable change".
 */
const { execFileSync } = require('child_process');
const path = require('path');
const { SCENARIOS } = require('./lib/scenarios');

const RUN_ONE = path.join(__dirname, 'lib', 'run-one.js');
const TRIALS = Number(process.env.TRIALS || 5);
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

function sign(n, digits = 1) {
  return `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;
}

const results = [];

for (let si = 0; si < SCENARIOS.length; si++) {
  const scenario = SCENARIOS[si];
  const ops = Object.keys(scenario.build().ops).filter(
    op => !filter || `${scenario.name} ${op}`.toLowerCase().includes(filter.toLowerCase())
  );

  if (!ops.length) continue;

  console.log(`\n## ${scenario.name}`);

  for (const op of ops) {
    const deltas = [];
    const baseHz = [];
    const currHz = [];

    for (let t = 0; t < TRIALS; t++) {
      // Alternate which implementation runs first.
      const order = t % 2 === 0 ? ['base', 'curr'] : ['curr', 'base'];
      const got = {};
      for (const impl of order) got[impl] = measure(impl, si, op);

      baseHz.push(got.base.hz);
      currHz.push(got.curr.hz);
      deltas.push((got.curr.hz / got.base.hz - 1) * 100);
    }

    const delta = median(deltas);
    const spread = Math.max(...deltas) - Math.min(...deltas);

    results.push({ scenario: scenario.name, op, delta, spread });

    console.log(
      `  ${op.padEnd(30)} base ${fmtHz(median(baseHz))}  curr ${fmtHz(median(currHz))}  ` +
        `${sign(delta).padStart(7)}  spread ${spread.toFixed(1)}%`
    );
  }
}

console.log(`\n## summary (median of ${TRIALS} trials, alternating order)\n`);
for (const r of results) {
  const meaningful = Math.abs(r.delta) > r.spread;
  console.log(
    `  ${(r.op + ' — ' + r.scenario).padEnd(60)} ${sign(r.delta).padStart(7)}` +
      `${meaningful ? '' : '   (within noise)'}`
  );
}

const solid = results.filter(r => Math.abs(r.delta) > r.spread);
if (solid.length)
  console.log(
    `\n  ${solid.length}/${results.length} rows exceed their own noise floor; ` +
      `median delta among those: ${sign(median(solid.map(r => r.delta)))}`
  );
