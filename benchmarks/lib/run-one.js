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

/*
 * Three implementations:
 *   base — pristine snapshot
 *   ctrl — a second copy of that same snapshot
 *   curr — the working tree
 *
 * `ctrl` is the control. Measuring it in the same trial loop as `curr` gives a
 * noise floor observed under the same machine conditions, which a separate
 * calibration pass does not: identical baseline code measured 10.4M ops/s in one
 * pass and 23.6M in the next.
 */
const SRC_BY_TAG = {
  base: '../../.bench-baseline/src/index',
  ctrl: '../../.bench-baseline2/src/index',
  curr: '../../.bench-curr/src/index',
};

const src = SRC_BY_TAG[implTag];

if (!src) {
  console.error(`unknown impl "${implTag}"`);
  process.exit(2);
}

const bump = require(src).default;

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
