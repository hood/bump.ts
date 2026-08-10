/*
 * Differential fuzzer: drives the pristine baseline in `.bench-baseline/src`
 * and the current `src` through identical randomised workloads and asserts the
 * results are bit-for-bit identical.
 *
 * The optimisation work rewrote floating-point branch logic (the unrolled
 * Liang-Barsky routine, the inlined Minkowsky difference), and the 58 unit tests
 * do not come close to covering it. This does.
 *
 *   node benchmarks/lib/fuzz-diff.js [iterations]
 */
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs' },
});

const base = require('../../.bench-baseline/src/index').default;
const curr = require('../../src/index').default;
const baseRect = require('../../.bench-baseline/src/rect');
const currRect = require('../../src/rect');
const baseGrid = require('../../.bench-baseline/src/grid');
const currGrid = require('../../src/grid');

const ITERATIONS = Number(process.argv[2] || 20000);

let failures = 0;
const seen = new Set();

function fail(what, detail) {
  failures++;
  if (seen.has(what) || seen.size > 20) return;
  seen.add(what);
  console.error(`\nMISMATCH: ${what}\n${detail}`);
}

// Object.is semantics for numbers, so NaN === NaN and -0 !== 0. Both sides
// should be computing identical bits, not merely close values.
function deepSame(a, b, path = '') {
  if (typeof a === 'number' || typeof b === 'number')
    return Object.is(a, b) ? null : `${path}: ${a} !== ${b}`;

  if (a === b) return null;
  if (a === null || b === null || a === undefined || b === undefined)
    return `${path}: ${String(a)} !== ${String(b)}`;

  if (Array.isArray(a) !== Array.isArray(b))
    return `${path}: array-ness differs`;

  if (Array.isArray(a)) {
    if (a.length !== b.length)
      return `${path}: length ${a.length} !== ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const r = deepSame(a[i], b[i], `${path}[${i}]`);
      if (r) return r;
    }
    return null;
  }

  if (typeof a === 'object') {
    // Compare the union of keys, but ignore keys whose value is undefined on
    // both sides (shape may legitimately differ, values may not).
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (a[k] === undefined && b[k] === undefined) continue;
      const r = deepSame(a[k], b[k], `${path}.${k}`);
      if (r) return r;
    }
    return null;
  }

  return `${path}: ${String(a)} !== ${String(b)}`;
}

function check(what, a, b) {
  const r = deepSame(a, b);
  if (r) fail(what, `  ${r}\n  base=${JSON.stringify(a)}\n  curr=${JSON.stringify(b)}`);
}

function lcg(seed) {
  let s = seed >>> 0;
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const rand = lcg(0x5eed1234);

// Mix of tidy integers, half-cell offsets and awkward fractions: the DELTA and
// corner-case branches only trigger on exact hits.
function coord(scale) {
  const r = rand();
  if (r < 0.35) return Math.floor(rand() * scale) - scale / 2;
  if (r < 0.6) return Math.floor(rand() * scale) - scale / 2 + 0.5;
  if (r < 0.75) return (Math.floor(rand() * scale) - scale / 2) * 16;
  return (rand() - 0.5) * scale;
}

function size(scale) {
  const r = rand();
  if (r < 0.4) return Math.floor(rand() * scale) + 1;
  if (r < 0.7) return 16;
  return rand() * scale + 0.001;
}

// ---------------------------------------------------------------------------
// 1. Pure rect / grid functions
// ---------------------------------------------------------------------------
console.log(`rect + grid functions (${ITERATIONS} cases each)...`);

for (let i = 0; i < ITERATIONS; i++) {
  const r = { x: coord(64), y: coord(64), w: size(48), h: size(48) };
  const o = { x: coord(64), y: coord(64), w: size(48), h: size(48) };
  const gx = coord(96);
  const gy = coord(96);

  check(
    'rect.detectCollision',
    baseRect.rect_detectCollision(r, o, gx, gy),
    currRect.rect_detectCollision(r, o, gx, gy)
  );

  // Also exercise the omitted-goal overload.
  check(
    'rect.detectCollision (no goal)',
    baseRect.rect_detectCollision(r, o),
    currRect.rect_detectCollision(r, o)
  );

  const x1 = coord(64);
  const y1 = coord(64);
  const x2 = coord(64);
  const y2 = coord(64);
  const t1 = rand() < 0.5 ? 0 : -Number.MAX_SAFE_INTEGER;
  const t2 = rand() < 0.5 ? 1 : Number.MAX_SAFE_INTEGER;

  check(
    'rect.getSegmentIntersectionIndices',
    baseRect.rect_getSegmentIntersectionIndices(r, x1, y1, x2, y2, t1, t2),
    currRect.rect_getSegmentIntersectionIndices(r, x1, y1, x2, y2, t1, t2)
  );

  check(
    'rect.getNearestCorner',
    baseRect.rect_getNearestCorner(r, gx, gy),
    currRect.rect_getNearestCorner(r, gx, gy)
  );

  check(
    'rect.containsPoint',
    baseRect.rect_containsPoint(r, gx, gy),
    currRect.rect_containsPoint(r, gx, gy)
  );

  const cellSize = [1, 8, 16, 64, 100][Math.floor(rand() * 5)];

  check(
    'grid.toCellRect',
    baseGrid.grid_toCellRect(cellSize, r),
    currGrid.grid_toCellRect(cellSize, r)
  );

  check(
    'grid.toCell',
    baseGrid.grid_toCell(cellSize, gx, gy),
    currGrid.grid_toCell(cellSize, gx, gy)
  );

  // grid_traverse: record the exact callback sequence from both.
  const bSeq = [];
  const cSeq = [];
  try {
    baseGrid.grid_traverse(cellSize, x1, y1, x2, y2, (cx, cy) => {
      if (bSeq.length < 4096) bSeq.push(cx, cy);
    });
  } catch (e) {
    bSeq.push('threw', e.message);
  }
  try {
    currGrid.grid_traverse(cellSize, x1, y1, x2, y2, (cx, cy) => {
      if (cSeq.length < 4096) cSeq.push(cx, cy);
    });
  } catch (e) {
    cSeq.push('threw', e.message);
  }
  check('grid.traverse sequence', bSeq, cSeq);
}

console.log(`  ${failures === 0 ? 'identical' : failures + ' mismatches'}`);

// ---------------------------------------------------------------------------
// 2. World-level operation streams
// ---------------------------------------------------------------------------
const RESPONSES = ['slide', 'touch', 'cross', 'bounce'];

function snapshot(world, ids) {
  const rects = [];
  for (const id of ids) rects.push(world.hasItem(id) ? world.getRect(id) : null);

  const cells = [];
  for (let cy = 0; cy < world.rows.length; cy++) {
    const row = world.rows[cy];
    if (!row) continue;
    for (let cx = 0; cx < row.length; cx++) {
      const cell = row[cx];
      if (!cell) continue;
      cells.push([cell.ID, cell.x, cell.y, Array.from(cell.items).sort()]);
    }
  }
  cells.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  // nonEmptyCells is derived on read in the optimised build; its VALUE must
  // still match the eagerly-maintained baseline object.
  const nec = Object.keys(world.nonEmptyCells).sort();

  return {
    rects,
    cells,
    nec,
    items: world.countItems(),
    cellCount: world.countCells(),
  };
}

function runWorldTrial(trial, opCount) {
  const seed = 0xa5a5 + trial * 7919;
  const cellSize = [8, 16, 64][trial % 3];

  const worlds = [base.newWorld(cellSize), curr.newWorld(cellSize)];
  const rngs = [lcg(seed), lcg(seed)];
  const ids = [];

  // Identical initial population in both worlds.
  const seedRng = lcg(seed ^ 0x1234);
  const n = 30 + Math.floor(seedRng() * 40);
  for (let i = 0; i < n; i++) {
    const id = `it${i}`;
    const x = Math.floor(seedRng() * 400) - 200;
    const y = Math.floor(seedRng() * 400) - 200;
    const w = 1 + Math.floor(seedRng() * 40);
    const h = 1 + Math.floor(seedRng() * 40);
    for (const wd of worlds) wd.add(id, x, y, w, h);
    ids.push(id);
  }

  // Apply the same op stream to both, comparing every return value.
  for (let step = 0; step < opCount; step++) {
    const r = rngs[0]();
    rngs[1]();

    const pick = ids[Math.floor(rngs[0]() * ids.length)];
    rngs[1]();
    const a = coord(400);
    const b = coord(400);
    const c = size(64);
    const d = size(64);
    // Segment endpoints must be drawn OUTSIDE the per-world closure, or each
    // implementation gets handed a different segment.
    const segDx = coord(300);
    const segDy = coord(300);
    const respIdx = Math.floor(rand() * RESPONSES.length);
    const filterOn = rand() < 0.3;

    const filter2 = filterOn
      ? (_item, other) => (other.charCodeAt(2) % 2 === 0 ? RESPONSES[respIdx] : false)
      : undefined;
    const filter1 = filterOn ? other => other.charCodeAt(2) % 2 === 0 : undefined;

    const call = (fn) => {
      const out = [];
      for (const wd of worlds) {
        try {
          out.push({ ok: fn(wd) });
        } catch (e) {
          out.push({ err: e.message });
        }
      }
      return out;
    };

    let label;
    let res;

    if (r < 0.22) {
      label = 'world.move';
      res = call(wd => wd.move(pick, a, b, filter2));
    } else if (r < 0.42) {
      label = 'world.check';
      res = call(wd => wd.check(pick, a, b, filter2));
    } else if (r < 0.52) {
      label = 'world.update';
      res = call(wd => {
        wd.update(pick, a, b, c, d);
        return null;
      });
    } else if (r < 0.58) {
      label = 'world.update (pos only)';
      res = call(wd => {
        wd.update(pick, a, b);
        return null;
      });
    } else if (r < 0.66) {
      label = 'world.queryRect';
      res = call(wd => wd.queryRect(a, b, c, d, filter1));
    } else if (r < 0.74) {
      label = 'world.queryPoint';
      res = call(wd => wd.queryPoint(a, b, filter1));
    } else if (r < 0.84) {
      label = 'world.querySegment';
      res = call(wd => wd.querySegment(a, b, a + segDx, b + segDy, filter1));
    } else if (r < 0.90) {
      label = 'world.querySegmentWithCoords';
      res = call(wd =>
        wd.querySegmentWithCoords(a, b, a + segDx, b + segDy, filter1)
      );
    } else if (r < 0.95) {
      label = 'world.remove';
      res = call(wd => {
        wd.remove(pick);
        return null;
      });
    } else {
      label = 'world.add (re-add)';
      res = call(wd => wd.add(pick, a, b, c, d));
    }

    check(label, res[0], res[1]);
    check(`${label} -> state`, snapshot(worlds[0], ids), snapshot(worlds[1], ids));
  }
}

const TRIALS = 60;
const OPS = 150;
console.log(`world op streams (${TRIALS} trials x ${OPS} ops)...`);
const before = failures;
for (let t = 0; t < TRIALS; t++) runWorldTrial(t, OPS);
console.log(`  ${failures === before ? 'identical' : failures - before + ' mismatches'}`);

console.log(
  failures === 0
    ? '\nOK: baseline and current are behaviourally identical across all cases.'
    : `\nFAILED: ${failures} mismatches`
);

process.exit(failures === 0 ? 0 : 1);
