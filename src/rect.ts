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

/*
 * Non-allocating core of `rect_getSegmentIntersectionIndices`.
 *
 * Takes the rect as four scalars and writes its six results into `out` instead
 * of returning a tuple, because this runs once or twice per collision candidate
 * and the tuple was the single largest source of garbage in a frame. The
 * four-sided loop is unrolled so `nx`/`ny` fold into constants.
 *
 * `out` layout: [ti1, ti2, nx1, ny1, nx2, ny2]. Returns false when the segment
 * never touches the rect, in which case `out` is left untouched.
 */
function segmentIntersection(
  out: Float64Array,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ti1: number,
  ti2: number
): boolean {
  let t1: number = isNaN(ti1) ? 0 : ti1;
  let t2: number = isNaN(ti2) ? 1 : ti2;

  const dx: number = x2 - x1;
  const dy: number = y2 - y1;

  let nx1 = 0;
  let ny1 = 0;
  let nx2 = 0;
  let ny2 = 0;
  let r: number;

  // left: nx = -1, ny = 0
  let p: number = -dx;
  let q: number = x1 - rx;

  if (p === 0) {
    if (q <= 0) return false;
  } else {
    r = q / p;

    if (p < 0) {
      if (r > t2) return false;
      else if (r > t1) {
        t1 = r;
        nx1 = -1;
        ny1 = 0;
      }
    } else {
      if (r < t1) return false;
      else if (r < t2) {
        t2 = r;
        nx2 = -1;
        ny2 = 0;
      }
    }
  }

  // right: nx = 1, ny = 0
  p = dx;
  q = rx + rw - x1;

  if (p === 0) {
    if (q <= 0) return false;
  } else {
    r = q / p;

    if (p < 0) {
      if (r > t2) return false;
      else if (r > t1) {
        t1 = r;
        nx1 = 1;
        ny1 = 0;
      }
    } else {
      if (r < t1) return false;
      else if (r < t2) {
        t2 = r;
        nx2 = 1;
        ny2 = 0;
      }
    }
  }

  // top: nx = 0, ny = -1
  p = -dy;
  q = y1 - ry;

  if (p === 0) {
    if (q <= 0) return false;
  } else {
    r = q / p;

    if (p < 0) {
      if (r > t2) return false;
      else if (r > t1) {
        t1 = r;
        nx1 = 0;
        ny1 = -1;
      }
    } else {
      if (r < t1) return false;
      else if (r < t2) {
        t2 = r;
        nx2 = 0;
        ny2 = -1;
      }
    }
  }

  // bottom: nx = 0, ny = 1
  p = dy;
  q = ry + rh - y1;

  if (p === 0) {
    if (q <= 0) return false;
  } else {
    r = q / p;

    if (p < 0) {
      if (r > t2) return false;
      else if (r > t1) {
        t1 = r;
        nx1 = 0;
        ny1 = 1;
      }
    } else {
      if (r < t1) return false;
      else if (r < t2) {
        t2 = r;
        nx2 = 0;
        ny2 = 1;
      }
    }
  }

  out[0] = t1;
  out[1] = t2;
  out[2] = nx1;
  out[3] = ny1;
  out[4] = nx2;
  out[5] = ny2;

  return true;
}

/*
 * Scratch buffers for `segmentIntersection`. Each call site owns its own so a
 * buffer can never be clobbered by a nested call; every site reads its results
 * out before calling again.
 */
const segScratchPublic = new Float64Array(6);
const segScratchDetect = new Float64Array(6);
export const segScratchSegment = new Float64Array(6);

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
  const o = segScratchPublic;

  if (
    !segmentIntersection(
      o,
      rect.x,
      rect.y,
      rect.w,
      rect.h,
      x1,
      y1,
      x2,
      y2,
      ti1,
      ti2
    )
  )
    return undefined;

  return [o[0], o[1], o[2], o[3], o[4], o[5]];
}

// Same computation as `rect_getSegmentIntersectionIndices`, but writes into a
// caller-owned buffer so hot internal callers allocate nothing.
export function rect_getSegmentIntersectionIndicesInto(
  out: Float64Array,
  rect: IRect,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  ti1: number,
  ti2: number
): boolean {
  return segmentIntersection(
    out,
    rect.x,
    rect.y,
    rect.w,
    rect.h,
    x1,
    y1,
    x2,
    y2,
    ti1,
    ti2
  );
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
  const rx = rect.x;
  const ry = rect.y;
  const rw = rect.w;
  const rh = rect.h;

  const dx: number = (goalX ?? rx) - rx;
  const dy: number = (goalY ?? ry) - ry;

  // Minkowsky difference, kept as scalars: allocating a rect here cost one
  // object per candidate, and most candidates miss.
  const dfx: number = otherRect.x - rx - rw;
  const dfy: number = otherRect.y - ry - rh;
  const dfw: number = rw + otherRect.w;
  const dfh: number = rh + otherRect.h;

  const o = segScratchDetect;

  let overlaps: boolean;
  let nx: number | undefined;
  let ny: number | undefined;
  let ti: number | undefined;

  // If the item was intersecting other — rect_containsPoint(diffRect, 0, 0)
  if (-dfx > DELTA && -dfy > DELTA && dfx + dfw > DELTA && dfy + dfh > DELTA) {
    // rect_getNearestCorner(diffRect, 0, 0)
    const px: number = nearest(0, dfx, dfx + dfw);
    const py: number = nearest(0, dfy, dfy + dfh);

    const wi: number = Math.min(rw, Math.abs(px)); // area of intersection
    const hi: number = Math.min(rh, Math.abs(py)); // area of intersection

    ti = -wi * hi; // `ti` is the negative area of intersection

    overlaps = true;
  } else {
    if (
      segmentIntersection(
        o,
        dfx,
        dfy,
        dfw,
        dfh,
        0,
        0,
        dx,
        dy,
        -Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER
      )
    ) {
      const ti1 = o[0];
      const ti2 = o[1];

      // item tunnels into other
      if (
        ti1 < 1 &&
        Math.abs(ti1 - ti2) >= DELTA && // special case for rect going through another rect's corner
        (0 < ti1 + DELTA || (0 === ti1 && ti2 > 0))
      ) {
        ti = ti1;
        nx = o[2];
        ny = o[3];

        overlaps = false;
      }
    }
  }

  if (typeof ti !== 'number') return;

  let tx: number | undefined;
  let ty: number | undefined;

  if (overlaps!)
    if (dx === 0 && dy === 0) {
      //intersecting and not moving - use minimum displacement vector
      let px: number = nearest(0, dfx, dfx + dfw);
      let py: number = nearest(0, dfy, dfy + dfh);

      if (Math.abs(px) < Math.abs(py)) py = 0;
      else px = 0;

      nx = Math.sign(px);
      ny = Math.sign(py);

      tx = rx + px;
      ty = ry + py;
    } else {
      // Intersecting and moving - move in the opposite direction.
      if (
        segmentIntersection(
          o,
          dfx,
          dfy,
          dfw,
          dfh,
          0,
          0,
          dx,
          dy,
          -Number.MAX_SAFE_INTEGER,
          1
        )
      ) {
        const ti1 = o[0];

        nx = o[2];
        ny = o[3];

        if (!ti1) return;

        tx = rx + dx * ti1;
        ty = ry + dy * ti1;
      }
    }
  //tunnel
  else {
    tx = rx + dx * ti;
    ty = ry + dy * ti;
  }

  return {
    overlaps: overlaps!,
    ti,
    move: { x: dx, y: dy },
    normal: { x: nx as number, y: ny as number },
    touch: { x: tx!, y: ty! },
    itemRect: rect,
    otherRect,
  };
}
