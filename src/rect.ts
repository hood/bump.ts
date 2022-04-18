import { Collision, ICoords, IRect } from '.';
import { DELTA } from './constants';
import nearest from './helpers/generic/nearest';

export function rect_getNearestCorner(
  x: number,
  y: number,
  w: number,
  h: number,
  px: number,
  py: number
): ICoords {
  return { x: nearest(px, x, x + w), y: nearest(py, y, y + h) };
}

// This is a generalized implementation of the liang-barsky algorithm, which also returns
// the normals of the sides where the segment intersects.
// Returns null if the segment never touches the rect
// Notice that normals are only guaranteed to be accurate when initially ti1, ti2 == -math.huge, math.huge
export function rect_getSegmentIntersectionIndices(
  x: number,
  y: number,
  w: number,
  h: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ti1: number,
  ti2: number
): [number?, number?, number?, number?, number?, number?] {
  let _ti1 = isNaN(ti1) ? 0 : ti1;
  let _ti2 = isNaN(ti2) ? 1 : ti2;

  let dx: number = x2 - x1;
  let dy: number = y2 - y1;
  let nx: number;
  let ny: number;
  let nx1: number = 0;
  let ny1: number = 0;
  let nx2: number = 0;
  let ny2: number = 0;
  let p, q, r;

  for (const side of [1, 2, 3, 4]) {
    // left
    if (side === 1) {
      nx = -1;
      ny = 0;
      p = -dx;
      q = x1 - x;
    }
    // right
    else if (side === 2) {
      nx = 1;
      ny = 0;
      p = dx;
      q = x + w - x1;
    }
    // top
    else if (side === 3) {
      nx = 0;
      ny = -1;
      p = -dy;
      q = y1 - y;
    }
    // bottom
    else {
      nx = 0;
      ny = 1;
      p = dy;
      q = y + h - y1;
    }

    if (p === 0) {
      if (q <= 0)
        return [
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        ];
    } else {
      r = q / p;

      if (p < 0) {
        if (r > _ti2)
          return [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
          ];
        else if (r > _ti1) {
          _ti1 = r;
          nx1 = nx;
          ny1 = ny;
        }
      } // p > 0
      else {
        if (r < _ti1)
          return [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
          ];
        else if (r < _ti2) {
          _ti2 = r;
          nx2 = nx;
          ny2 = ny;
        }
      }
    }
  }

  return [_ti1, _ti2, nx1, ny1, nx2, ny2];
}

// //Calculates the Minkowsky difference between 2 rects, which is another rect
export function rect_getDiff(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): IRect {
  return {
    x: x2 - x1 - w1,
    y: y2 - y1 - h1,
    w: w1 + w2,
    h: h1 + h2,
  };
}

export function rect_containsPoint(
  x: number,
  y: number,
  w: number,
  h: number,
  px: number,
  py: number
): boolean {
  return (
    px - x > DELTA && py - y > DELTA && x + w - px > DELTA && y + h - py > DELTA
  );
}

export function rect_isIntersecting(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): boolean {
  return x1 < x2 + w2 && x2 < x1 + w1 && y1 < y2 + h2 && y2 < y1 + h1;
}

export function rect_getSquareDistance(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): number {
  const dx = x1 - x2 + (w1 - w2) / 2;
  const dy = y1 - y2 + (h1 - h2) / 2;
  return dx * dx + dy * dy;
}

export function rect_detectCollision(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number,
  goalX?: number,
  goalY?: number
): undefined | Partial<Collision> {
  const _goalX: number = isNaN(goalX!) ? x1 : goalX!;
  const _goalY: number = isNaN(goalY!) ? y1 : goalY!;

  let dx: number = _goalX - x1;
  let dy: number = _goalY - y1;

  const { x, y, w, h } = rect_getDiff(x1, y1, w1, h1, x2, y2, w2, h2);

  let overlaps: boolean;

  let nx, ny;
  let ti: number;

  // If the item was intersecting other
  if (rect_containsPoint(x, y, w, h, 0, 0)) {
    let { x: px, y: py } = rect_getNearestCorner(x, y, w, h, 0, 0);

    let wi: number = Math.min(w1, Math.abs(px)); // area of intersection
    let hi: number = Math.min(h1, Math.abs(py)); // area of intersection

    ti = -wi * hi; // `ti` is the negative area of intersection

    overlaps = true;
  } else {
    let [ti1, ti2, nx1, ny1] = rect_getSegmentIntersectionIndices(
      x,
      y,
      w,
      h,
      0,
      0,
      dx,
      dy,
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER
    );

    // To make the compiler stop complaining
    ti1 = ti1!;

    // item tunnels into other
    if (
      !isNaN(ti1) &&
      ti1 < 1 &&
      Math.abs(ti1 - (ti2 || 0)) >= DELTA && // special case for rect going through another rect's corner
      (0 < ti1 + DELTA || (0 === ti1 && (ti2 || 0) > 0))
    ) {
      ti = ti1;
      nx = nx1;
      ny = ny1;

      overlaps = false;
    }
  }

  if (isNaN(ti!)) return;

  let tx, ty;

  if (overlaps!)
    if (dx === 0 && dy === 0) {
      //intersecting and not moving - use minimum displacement vector
      let { x: px, y: py } = rect_getNearestCorner(x, y, w, h, 0, 0);

      if (Math.abs(px) < Math.abs(py)) py = 0;
      else px = 0;

      nx = Math.sign(px);
      ny = Math.sign(py);

      tx = x1 + px;
      ty = y1 + py;
    } else {
      //intersecting and moving - move in the opposite direction
      // @ts-ignore
      let [ti1, _, _nx, _ny] = rect_getSegmentIntersectionIndices(
        x,
        y,
        w,
        h,
        0,
        0,
        dx,
        dy,
        -Number.MAX_SAFE_INTEGER,
        1
      );
      nx = _nx;
      ny = _ny;

      if (!ti1) return;

      tx = x1 + dx * ti1;
      ty = y1 + dy * ti1;
    }
  //tunnel
  else {
    // @ts-ignore
    tx = x1 + dx * ti;
    // @ts-ignore
    ty = y1 + dy * ti;
  }

  return {
    overlaps: overlaps!,
    // @ts-ignore
    ti,
    move: { x: dx, y: dy },
    normal: { x: nx as number, y: ny as number },
    touch: { x: tx, y: ty },
    itemRect: { x: x1, y: y1, w: w1, h: h1 },
    otherRect: { x: x2, y: y2, w: w2, h: h2 },
  };
}
