# bump.ts
![version](https://img.shields.io/npm/v/bump-ts)
![maintenance](https://img.shields.io/maintenance/yes/2021)
![open-issues](https://img.shields.io/github/issues-raw/hood/bump.ts)

> A collision detection library for TypeScript. Ported from `bump.lua`.

`bump.ts` is a collision-detection library for axis-aligned rectangles. Its main features are:

* Axis-aligned bounding-box (AABB) collisions.
* Tunneling - all items are treated as "bullets". The fact that we only use AABBs allows doing this fast.
* Strives to be fast while being economic in memory
* It's centered on detection, but it also offers some (minimal & basic) collision response
* Can also return the items that touch a point, a segment or a rectangular zone.
* "Gameistic" instead of realistic approach to collision detection.

#### `bump.ts` is ideal for:

Tile-based games, and games where most entities can be represented as axis-aligned rectangles.
Games which require some physics, but not a full realistic simulation - like a platformer.
Examples of genres: top-down games (Zelda), Shoot-them-ups, fighting games (Street Fighter), platformers (Super Mario).

#### `bump.ts` is not a good match for:

Games that require polygons for the collision detection
Games that require highly realistic simulations of physics - things "stacking up", "rolling over slides", etc.
Games that require very fast objects colliding reallistically against each other (in bump, being gameistic, objects are moved and collided one at a time)
Simulations where the order in which the collisions are resolved isn't known.
