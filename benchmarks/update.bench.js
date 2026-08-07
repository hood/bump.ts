const Benchmark = require('benchmark');
const Bump = require('../dist/index.js');

const suite = new Benchmark.Suite();

const smallWorld = Bump.default.newWorld(64);

for (let i = 0; i < 128; i++) smallWorld.add(`item${i}`, i * 10, i * 10, 8, 8);

const largeWorld = Bump.default.newWorld(64);

for (let i = 0; i < 512; i++) largeWorld.add(`item${i}`, i * 10, i * 10, 8, 8);

const entries = new Set();

suite
  .add('update position only (small world)', function() {
    smallWorld.update('item0', 100, 100);
  })
  .add('update size only (small world)', function() {
    smallWorld.update('item0', 0, 0, 16, 16);
  })
  .add('update position and size (small world)', function() {
    smallWorld.update('item0', 100, 100, 16, 16);
  })
  .add('update position only (large world)', function() {
    largeWorld.update('item0', 1000, 1000);
  })
  .add('update size only (large world)', function() {
    largeWorld.update('item0', 0, 0, 32, 32);
  })
  .add('update position and size (large world)', function() {
    largeWorld.update('item0', 1000, 1000, 32, 32);
  })
  .on('cycle', function(event) {
    // console.dir({ event: event.target.stats.mean }, { depth: null });
    entries.add([event.target, event.target.stats.mean]);

    console.log(String(event.target));
  })
  .on('complete', function() {
    for (const [entry, mean] of entries) {
      console.dir({ entry: entry.name, mean }, { depth: null });
    }

    console.log('Fastest is ' + this.filter('fastest').map('name'));
  })
  .run({ async: true });
