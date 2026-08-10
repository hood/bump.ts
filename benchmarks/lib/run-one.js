/*
 * Child process: measure ONE (implementation, scenario, op) triple and print a
 * single JSON line on stdout.
 *
 *   node benchmarks/lib/run-one.js <base|curr> <scenarioIndex> <opName>
 *
 * Running one measurement per process is deliberate. Loading both
 * implementations into a single process made the results useless: a byte-
 * identical copy of the baseline measured anywhere from -5% to +20% depending
 * only on which one benchmark.js happened to warm up first.
 */
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs' },
});

const Benchmark = require('benchmark');
const { SCENARIOS } = require('./scenarios');

const [implTag, scenarioIdxRaw, opName] = process.argv.slice(2);
const scenarioIdx = Number(scenarioIdxRaw);

// CURR_SRC lets the driver point "curr" at a copy of the baseline, which is how
// the harness's own noise floor gets measured.
const CURR_SRC = process.env.CURR_SRC || '../../src/index';

const bump = require(implTag === 'base' ? '../../.bench-baseline/src/index' : CURR_SRC)
  .default;

const spec = SCENARIOS[scenarioIdx].build();
const fn = spec.ops[opName];

if (!fn) {
  console.error(`unknown op "${opName}" in scenario ${scenarioIdx}`);
  process.exit(2);
}

const state = spec.setup(bump);

// Warm the JIT before measuring, so the reported samples reflect optimised
// code rather than the tier-up transition.
for (let i = 0; i < 50; i++) fn(state);

const bench = new Benchmark(opName, function() {
  fn(state);
}, {
  minSamples: 30,
  minTime: 0.1,
});

bench.on('complete', function() {
  process.stdout.write(
    JSON.stringify({
      impl: implTag,
      op: opName,
      hz: bench.hz,
      rme: bench.stats.rme,
      samples: bench.stats.sample.length,
    }) + '\n'
  );
});

bench.run({ async: false });
