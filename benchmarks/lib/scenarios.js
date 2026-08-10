/*
 * Workload definitions shared by the A/B benchmark driver and its child
 * processes.
 *
 * Every scenario is built from a seeded PRNG, so a given (scenario, op) pair
 * does byte-identical work regardless of which implementation is driving it or
 * how many times it has been run.
 */

function lcg(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/*
 * Every op must feed its result into this sink. Without it V8 dead-code-
 * eliminates the call under measurement: discarding the return value of
 * `getSegmentIntersectionIndices` made it "measure" ~6ns/call, which is well
 * below what the function can possibly cost.
 *
 * `process.on('exit')` reads the accumulator so it can never be optimised out.
 */
const sink = { n: 0 };
process.on('exit', function() {
  if (sink.n === Number.MIN_SAFE_INTEGER) process.stderr.write('');
});

function consume(v) {
  if (v === undefined || v === null) sink.n += 1;
  else if (typeof v === 'number') sink.n += v;
  else if (typeof v === 'object') sink.n += v.length !== undefined ? v.length : 1;
}

module.exports.consume = consume;

// A platformer-style world: a lattice of static blocks plus entities that
// collide and slide against them. This is the real hot path
// (move -> check -> project -> detectCollision).
function gameLoop(blocks, entities, cellSize) {
  return {
    setup(bump) {
      const world = bump.newWorld(cellSize);
      const rand = lcg(0xc0ffee);

      const side = Math.ceil(Math.sqrt(blocks));
      for (let i = 0; i < blocks; i++)
        world.add(
          `block${i}`,
          (i % side) * 96 + 32,
          Math.floor(i / side) * 96 + 32,
          48,
          48
        );

      const ents = [];
      for (let i = 0; i < entities; i++) {
        const id = `ent${i}`;
        world.add(id, rand() * side * 96, rand() * side * 96, 14, 14);
        ents.push({ id, vx: (rand() - 0.5) * 12, vy: (rand() - 0.5) * 12 });
      }

      return { world, ents, extent: side * 96 };
    },
    ops: {
      // One simulated frame. Positions wrap, so the workload is stationary
      // however many frames get run.
      'move (frame)': function(s) {
        const { world, ents, extent } = s;
        for (let i = 0; i < ents.length; i++) {
          const e = ents[i];
          const r = world.getRect(e.id);
          let gx = r.x + e.vx;
          let gy = r.y + e.vy;

          if (gx < 0) gx += extent;
          else if (gx > extent) gx -= extent;
          if (gy < 0) gy += extent;
          else if (gy > extent) gy -= extent;

          consume(world.move(e.id, gx, gy).collisions);
        }
      },
      // Collision resolution without committing the move.
      'check (frame)': function(s) {
        const { world, ents } = s;
        for (let i = 0; i < ents.length; i++) {
          const e = ents[i];
          const r = world.getRect(e.id);
          consume(world.check(e.id, r.x + e.vx, r.y + e.vy).collisions);
        }
      },
    },
  };
}

function queries(items, cellSize) {
  return {
    setup(bump) {
      const world = bump.newWorld(cellSize);
      const rand = lcg(0xbeef);
      const extent = 2048;

      for (let i = 0; i < items; i++)
        world.add(`item${i}`, rand() * extent, rand() * extent, 24, 24);

      // Pre-computed probes so the PRNG is not part of the measurement.
      const probes = [];
      for (let i = 0; i < 64; i++)
        probes.push([rand() * extent, rand() * extent]);

      return { world, probes, cursor: 0 };
    },
    ops: {
      queryRect: function(s) {
        const p = s.probes[s.cursor++ & 63];
        consume(s.world.queryRect(p[0], p[1], 128, 128));
      },
      'queryRect (wide)': function(s) {
        const p = s.probes[s.cursor++ & 63];
        consume(s.world.queryRect(p[0], p[1], 640, 640));
      },
      queryPoint: function(s) {
        const p = s.probes[s.cursor++ & 63];
        consume(s.world.queryPoint(p[0], p[1]));
      },
      querySegment: function(s) {
        const p = s.probes[s.cursor++ & 63];
        consume(s.world.querySegment(p[0], p[1], p[0] + 512, p[1] + 384));
      },
    },
  };
}

function churn(items, cellSize) {
  return {
    setup(bump) {
      const world = bump.newWorld(cellSize);
      const rand = lcg(0xd00d);
      const extent = 2048;
      const ids = [];

      for (let i = 0; i < items; i++) {
        const id = `item${i}`;
        world.add(id, rand() * extent, rand() * extent, 24, 24);
        ids.push(id);
      }

      // Fixed pool of churn IDs: reused so string length (and the shape of the
      // rects Map) stays constant across iterations.
      const churnIDs = [];
      for (let i = 0; i < 256; i++) churnIDs.push(`churn${i}`);

      return { world, ids, churnIDs, cursor: 0, extent };
    },
    ops: {
      'add + remove': function(s) {
        const i = s.cursor++ & 255;
        const id = s.churnIDs[i];
        consume(s.world.add(id, (i * 37) % s.extent, (i * 53) % s.extent, 24, 24));
        s.world.remove(id);
        consume(s.world.hasItem(id) ? 1 : 0);
      },
      'update (move across cells)': function(s) {
        const id = s.ids[s.cursor++ % s.ids.length];
        const r = s.world.getRect(id);
        s.world.update(id, (r.x + 97) % s.extent, (r.y + 61) % s.extent);
        consume(s.world.getRect(id).x);
      },
      'update (in place)': function(s) {
        const id = s.ids[s.cursor++ % s.ids.length];
        const r = s.world.getRect(id);
        s.world.update(id, r.x + 0.25, r.y + 0.25);
        consume(s.world.getRect(id).x);
      },
    },
  };
}

function rectMicro() {
  return {
    setup(bump) {
      return {
        bump,
        a: { x: 0, y: 0, w: 32, h: 32 },
        b: { x: 20, y: 20, w: 32, h: 32 },
        c: { x: 200, y: 200, w: 32, h: 32 },
      };
    },
    ops: {
      'detectCollision (overlap)': function(s) {
        consume(s.bump.rect.detectCollision(s.a, s.b, 12, 9));
      },
      'detectCollision (tunnel)': function(s) {
        consume(s.bump.rect.detectCollision(s.a, s.c, 400, 400));
      },
      'detectCollision (miss)': function(s) {
        consume(s.bump.rect.detectCollision(s.a, s.c, 2, 2));
      },
      'segmentIntersectionIndices': function(s) {
        consume(s.bump.rect.getSegmentIntersectionIndices(s.b, 0, 0, 300, 220, 0, 1));
      },
    },
  };
}

const SCENARIOS = [
  { name: 'game loop (400 blocks, 200 entities)', build: () => gameLoop(400, 200, 64) },
  { name: 'queries (4000 items)', build: () => queries(4000, 64) },
  { name: 'churn (2000 items)', build: () => churn(2000, 64) },
  { name: 'rect micro', build: () => rectMicro() },
];

module.exports.SCENARIOS = SCENARIOS;
