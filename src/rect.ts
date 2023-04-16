import { Collision, ICoords, IRect } from '.';
import { DELTA } from './constants';
import nearest from './helpers/generic/nearest';

export function rect_getNearestCorner(
  rect: IRect,
  px: number,
  py: number
): ICoords {
  return {
    x: nearest(px, rect.x, rect.x + rect.w),
    y: nearest(py, rect.y, rect.y + rect.h),
  };
}

// This is a generalized implementation of the liang-barsky algorithm, which also returns
// the normals of the sides where the segment intersects.
// Returns null if the segment never touches the rect
// Notice that normals are only guaranteed to be accurate when initially ti1, ti2 == -math.huge, math.huge
export function rect_getSegmentIntersectionIndices(
  rect: IRect,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ti1: number,
  ti2: number
): [number, number, number, number, number, number] | undefined {
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

  for (let side = 1; side < 5; side++) {
    // left
    if (side === 1) {
      nx = -1;
      ny = 0;
      p = -dx;
      q = x1 - rect.x;
    }
    // right
    else if (side === 2) {
      nx = 1;
      ny = 0;
      p = dx;
      q = rect.x + rect.w - x1;
    }
    // top
    else if (side === 3) {
      nx = 0;
      ny = -1;
      p = -dy;
      q = y1 - rect.y;
    }
    // bottom
    else {
      nx = 0;
      ny = 1;
      p = dy;
      q = rect.y + rect.h - y1;
    }

    if (p === 0) {
      if (q <= 0) return undefined;
    } else {
      r = q / p;

      if (p < 0) {
        if (r > _ti2) return undefined;
        else if (r > _ti1) {
          _ti1 = r;
          nx1 = nx;
          ny1 = ny;
        }
      } // p > 0
      else {
        if (r < _ti1) return undefined;
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

// Calculates the Minkowsky difference between 2 rects, which is another rect
export function rect_getDiff(rect: IRect, otherRect: IRect): IRect {
  return {
    x: otherRect.x - rect.x - rect.w,
    y: otherRect.y - rect.y - rect.h,
    w: rect.w + otherRect.w,
    h: rect.h + otherRect.h,
  };
}

export function rect_containsPoint(
  rect: IRect,
  px: number,
  py: number
): boolean {
  return (
    px - rect.x > DELTA &&
    py - rect.y > DELTA &&
    rect.x + rect.w - px > DELTA &&
    rect.y + rect.h - py > DELTA
  );
}

export function rect_isIntersecting(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  otherRect: IRect
): boolean {
  return (
    x1 < otherRect.x + otherRect.w &&
    otherRect.x < x1 + w1 &&
    y1 < otherRect.y + otherRect.h &&
    otherRect.y < y1 + h1
  );
}

export function rect_getSquareDistance(rect: IRect, otherRect: IRect): number {
  const dx = rect.x - otherRect.x + (rect.w - otherRect.w) / 2;
  const dy = rect.y - otherRect.y + (rect.h - otherRect.h) / 2;

  return dx * dx + dy * dy;
}

export function rect_detectCollision(
  rect: IRect,
  otherRect: IRect,
  goalX?: number,
  goalY?: number
): undefined | Partial<Collision> {
  let dx: number = (goalX ?? rect.x) - rect.x;
  let dy: number = (goalY ?? rect.y) - rect.y;

  const diffRect = rect_getDiff(rect, otherRect);

  let overlaps: boolean;
  let nx, ny;
  let ti: number | undefined;

  // If the item was intersecting other
  if (rect_containsPoint(diffRect, 0, 0)) {
    let { x: px, y: py } = rect_getNearestCorner(diffRect, 0, 0);

    let wi: number = Math.min(rect.w, Math.abs(px)); // area of intersection
    let hi: number = Math.min(rect.h, Math.abs(py)); // area of intersection

    ti = -wi * hi; // `ti` is the negative area of intersection

    overlaps = true;
  } else {
    const insersections = rect_getSegmentIntersectionIndices(
      diffRect,
      0,
      0,
      dx,
      dy,
      -Number.MAX_SAFE_INTEGER,
      Number.MAX_SAFE_INTEGER
    );

    if (!insersections) return;

    const [ti1, ti2, nx1, ny1] = insersections;

    // item tunnels into other
    if (
      typeof ti1 === 'number' &&
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

  if (typeof ti !== 'number') return;

  let tx, ty;

  if (overlaps!)
    if (dx === 0 && dy === 0) {
      //intersecting and not moving - use minimum displacement vector
      let { x: px, y: py } = rect_getNearestCorner(diffRect, 0, 0);

      if (px >>> 1 < py >>> 1) py = 0;
      else px = 0;

      nx = Math.sign(px);
      ny = Math.sign(py);

      tx = rect.x + px;
      ty = rect.y + py;
    } else {
      // Intersecting and moving - move in the opposite direction.
      const insersections = rect_getSegmentIntersectionIndices(
        diffRect,
        0,
        0,
        dx,
        dy,
        -Number.MAX_SAFE_INTEGER,
        1
      );

      if (!insersections) return;

      const [ti1, _, _nx, _ny] = insersections;

      nx = _nx;
      ny = _ny;

      if (!ti1) return;

      tx = rect.x + dx * ti1;
      ty = rect.y + dy * ti1;
    }
  //tunnel
  else {
    tx = rect.x + dx * ti;
    ty = rect.y + dy * ti;
  }

  return {
    overlaps: overlaps!,
    // @ts-ignore
    ti,
    move: { x: dx, y: dy },
    normal: { x: nx as number, y: ny as number },
    touch: { x: tx, y: ty },
    itemRect: rect,
    otherRect,
  };
}
