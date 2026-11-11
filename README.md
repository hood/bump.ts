# bump.ts

![version](https://img.shields.io/npm/v/bump-ts)
![maintenance](https://img.shields.io/maintenance/yes/2021)
![open-issues](https://img.shields.io/github/issues-raw/hood/bump.ts)

> A collision detection library for TypeScript. Ported from `bump.lua`.

`bump.ts` is a collision-detection library for axis-aligned rectangles. Its main features are:

- Axis-aligned bounding-box (AABB) collisions.
- Tunneling - all items are treated as "bullets". The fact that we only use AABBs allows doing this fast.
- Strives to be fast while being economic in memory
- It's centered on detection, but it also offers some (minimal & basic) collision response
- Can also return the items that touch a point, a segment or a rectangular zone.
- "Gameistic" instead of realistic approach to collision detection.

#### `bump.ts` is ideal for:

Tile-based games, and games where most entities can be represented as axis-aligned rectangles.
Games which require some physics, but not a full realistic simulation - like a platformer.
Examples of genres: top-down games (Zelda), Shoot-them-ups, fighting games (Street Fighter), platformers (Super Mario).

#### `bump.ts` is not a good match for:

Games that require polygons for the collision detection
Games that require highly realistic simulations of physics - things "stacking up", "rolling over slides", etc.
Games that require very fast objects colliding reallistically against each other (in bump, being gameistic, objects are moved and collided one at a time)
Simulations where the order in which the collisions are resolved isn't known.

#### Requirements

`bump-ts` v1 requires **Node.js 24+** (the current Active LTS) and ships ES2022 output. If you need
to support older runtimes, stay on `0.6.x`.

#### Usage example:

```ts
import Bump from 'bump-ts'

// The grid cell size can be specified via the initialize method
// By default, the cell size is 64
const world = Bump.newWorld(50)

// Insert two rectangles into bump
world.add('A',   0, 0,    64, 256) // x,y, width, height
world.add('B',   0, -100, 32, 32)

// Try to move B to 0,64. If it collides with A, "slide over it"
const { x, y, collisions } = world.move('B', 0, 64)

// console.logs "Attempted to move to 0,64, but ended up in 0,-32 due to 1 collisions"
if (collisions.length > 0) 
  console.log(`Attempted to move to x:0, y:64, but ended up in x:${x}, y:${y} due to ${collisions.length} collisions`)
else
  console.log("Moved B to 100,100 without collisions")

// console.logs the new coordinates of B: 0, -32, 32, 32
console.log(world.getRect('B'))

// console.logs "Collision with A"
for (const collision of collisions) // If more than one simultaneous collision, they are sorted out by proximity
  console.log(`Collision with ${collision.other}`)

// remove A and B from the world
world.remove(A)
world.remove(B)
```

#### Benchmarks

v1 vs the pre-optimisation baseline (`d436f67`), measured with the A/B harness in `benchmarks/`.
Median of 5 trials, one process per measurement, rotating arm order. Apple M1 Pro, Node 26.13.

| Scenario | Op | Baseline | v1 | Δ |
|---|---|---:|---:|---:|
| game loop (400 blocks, 200 entities) | `move` (full frame) | 2.0k/s | 2.5k/s | **+25.7%** |
| | `check` (full frame) | 10.4k/s | 11.2k/s | +7.8% |
| queries (4000 items) | `queryRect` | 313.5k/s | 262.9k/s | -15.7% |
| | `queryRect` (wide) | 27.1k/s | 29.3k/s | +9.3% |
| | `queryPoint` | 5.78M/s | 5.95M/s | +5.0% |
| | `querySegment` | 91.1k/s | 111.4k/s | **+24.7%** |
| churn (2000 items) | `add` + `remove` | 2.64M/s | 3.11M/s | +18.6% |
| | `update` (across cells) | 2.63M/s | 3.22M/s | **+23.1%** |
| | `update` (in place) | 13.07M/s | 13.74M/s | +5.1% |
| rect micro | `detectCollision` (overlap) | 31.70M/s | 26.62M/s | -14.6% |
| | `detectCollision` (tunnel) | 25.08M/s | 24.29M/s | within noise |
| | `detectCollision` (miss) | 37.83M/s | 39.06M/s | within noise |
| | `getSegmentIntersectionIndices` | 53.99M/s | 40.59M/s | -24.7% |

Noise floor per row is ±2-5% (a byte-identical copy of the baseline is measured alongside as a control).

To reproduce:

```sh
node benchmarks/lib/prepare-baseline.js
TRIALS=5 node benchmarks/compare.bench.js
```
