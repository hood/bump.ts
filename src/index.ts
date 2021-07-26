const DELTA = 1e-10; // floating-point margin of error

function nearest(x: number, a: number, b: number): number {
  return Math.abs(a - x) < Math.abs(b - x) ? a : b;
}

function assertType(desiredType: string, value: any, name: string): void {
  if (typeof value !== desiredType)
    throw new Error(
      `${name} must be a ${desiredType}, but was a ${value} (${typeof value})`
    );
}

function assertIsPositiveNumber(value: any, name: string): void {
  if (isNaN(value) || value <= 0)
    throw new Error(
      name +
        ' must be a positive integer, but was ' +
        value +
        '(' +
        typeof value +
        ')'
    );
}

function assertIsRect(x: number, y: number, w: number, h: number): void {
  assertType('number', x, 'x');
  assertType('number', y, 'y');
  assertIsPositiveNumber(w, 'w');
  assertIsPositiveNumber(h, 'h');
}

function defaultFilter(): string {
  return 'slide';
}

// //////////////////////////////////////////
// // Rectangle functions
// //////////////////////////////////////////

const rect_getNearestCorner = (
  x: number,
  y: number,
  w: number,
  h: number,
  px: number,
  py: number
) => {
  return [nearest(px, x, x + w), nearest(py, y, y + h)];
};

// This is a generalized implementation of the liang-barsky algorithm, which also returns
// the normals of the sides where the segment intersects.
// Returns null if the segment never touches the rect
// Notice that normals are only guaranteed to be accurate when initially ti1, ti2 == -math.huge, math.huge
function rect_getSegmentIntersectionIndices(
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
  ti1 = ti1 || 0;
  ti2 = ti2 || 1;

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
      p = -dx;
      q = x + w - x1;
    }
    // top
    else if (side === 3) {
      nx = 0;
      ny = -1;
      p = -dy;
      q = y1 - y;
    }
    //// bottom
    else {
      nx = 0;
      ny = 1;
      p = dy;
      q = y + h - y1;
    }

    if (p == 0) {
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
        if (r > ti2)
          return [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
          ];
        else if (r > ti1) {
          ti1 = r;
          nx1 = nx;
          ny1 = ny;
        }
      } // p > 0
      else {
        if (r < ti1)
          return [
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
          ];
        else if (r < ti2) {
          ti2 = r;
          nx2 = nx;
          ny2 = ny;
        }
      }
    }
  }

  return [ti1, ti2, nx1, ny1, nx2, ny2];
}

// //Calculates the minkowsky difference between 2 rects, which is another rect
function rect_getDiff(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): [number, number, number, number] {
  return [x2 - x1 - w1, y2 - y1 - h1, w1 + w2, h1 + h2];
}

function rect_containsPoint(
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

function rect_isIntersecting(
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

function rect_getSquareDistance(
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

function rect_detectCollision(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number,
  goalX: number,
  goalY: number
):
  | undefined
  | {
      overlaps: boolean;
      ti: number;
      move: {
        x: number;
        y: number;
      };
      normal: {
        x: number;
        y: number;
      };
      touch: {
        x: number;
        y: number;
      };
      itemRect: {
        x: number;
        y: number;
        w: number;
        h: number;
      };
      otherRect: {
        x: number;
        y: number;
        w: number;
        h: number;
      };
    } {
  goalX = goalX || x1;
  goalY = goalY || y1;

  let dx: number = goalX - x1;
  let dy: number = goalY - y1;

  // TODO make the function return an array instead of variargs
  let [x, y, w, h] = rect_getDiff(x1, y1, w1, h1, x2, y2, w2, h2);

  let overlaps: boolean;

  let nx, ny;
  let ti: number;

  if (rect_containsPoint(x, y, w, h, 0, 0)) {
    // // item was intersecting other
    // TODO make the function return an array instead of variargs
    let [px, py] = rect_getNearestCorner(x, y, w, h, 0, 0);

    let wi: number = Math.min(w1, Math.abs(px)); // // area of intersection
    let hi: number = Math.min(h1, Math.abs(py)); // // area of intersection

    ti = -wi * hi; // // ti is the negative area of intersection

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

    // item tunnels into other
    if (
      ti1 &&
      ti1 < 1 &&
      Math.abs(ti1 - (ti2 || 0)) >= DELTA && // special case for rect going through another rect's corner
      (0 < ti1 + DELTA || (0 == ti1 && (ti2 || 0) > 0))
    ) {
      ti = ti1;
      nx = nx1;
      ny = ny1;

      overlaps = false;
    }
  }

  if (!ti!) return;

  let tx, ty;

  if (overlaps!)
    if (dx == 0 && dy == 0) {
      //intersecting and not moving - use minimum displacement vector
      let [px, py] = rect_getNearestCorner(x, y, w, h, 0, 0);

      if (Math.abs(px) < Math.abs(py)) py = 0;
      else px = 0;

      nx = Math.sign(px);
      ny = Math.sign(py);

      tx = x1 + px;
      ty = y1 + py;
    } else {
      //intersecting and moving - move in the opposite direction
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
    tx = x1 + dx * ti;
    ty = y1 + dy * ti;
  }

  return {
    overlaps: overlaps!,
    ti,
    move: { x: dx, y: dy },
    normal: { x: nx as number, y: ny as number },
    touch: { x: tx, y: ty },
    itemRect: { x: x1, y: y1, w: w1, h: h1 },
    otherRect: { x: x2, y: y2, w: w2, h: h2 },
  };
}

//////////////////////////////////////////
//Grid functions
//////////////////////////////////////////

function grid_toWorld(
  cellSize: number,
  cx: number,
  cy: number
): [number, number] {
  return [(cx - 1) * cellSize, (cy - 1) * cellSize];
}

function grid_toCell(cellSize: number, x: number, y: number): [number, number] {
  return [Math.floor(x / cellSize) + 1, Math.floor(y / cellSize) + 1];
}

//grid_traverse * functions are based on "A Fast Voxel Traversal Algorithm for Ray Tracing",
//by John Amanides and Andrew Woo - http://www.cse.yorku.ca/~amana/research/grid.pdf
//It has been modified to include both cells when the ray "touches a grid corner",
//and with a different exit condition

function grid_traverse_initStep(
  cellSize: number,
  ct: number,
  t1: number,
  t2: number
): [number, number, number] {
  let v: number = t2 - t1;

  if (v > 0) return [1, cellSize / v, ((ct + v) * cellSize - t1) / v];
  else if (v < 0)
    return [-1, -cellSize / v, ((ct + v - 1) * cellSize - t1) / v];
  else return [0, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
}

function grid_traverse(
  cellSize: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  f: any
): void {
  let [cx1, cy1] = grid_toCell(cellSize, x1, y1);
  let [cx2, cy2] = grid_toCell(cellSize, x2, y2);
  let [stepX, dx, tx] = grid_traverse_initStep(cellSize, cx1, x1, x2);
  let [stepY, dy, ty] = grid_traverse_initStep(cellSize, cy1, y1, y2);
  let [cx, cy] = [cx1, cy1];

  f(cx, cy);

  //The default implementation had an infinite loop problem when
  //approaching the last cell in some occassions.We finish iterating
  //when we are * next * to the last cell
  do {
    if (tx < ty) {
      [tx, cx] = [tx + dx, cx + stepX];

      f(cx, cy);
    } else {
      // Addition: include both cells when going through corners
      if (tx == ty) f(cx + stepX, cy);

      ty = ty + dy;
      cy = cy + stepY;

      f(cx, cy);
    }
  } while (Math.abs(cx - cx2) + Math.abs(cy - cy2) > 1);

  //If we have not arrived to the last cell, use it
  if (cx != cx2 || cy != cy2) f(cx2, cy2);
}

function grid_toCellRect(
  cellSize: number,
  x: number,
  y: number,
  w: number,
  h: number
): [number, number, number, number] {
  let [cx, cy] = grid_toCell(cellSize, x, y);
  let [cr, cb] = [Math.ceil((x + w) / cellSize), Math.ceil((y + h) / cellSize)];

  return [cx, cy, cr - cx + 1, cb - cy + 1];
}

//////////////////////////////////////////
// Responses
//////////////////////////////////////////

type ResponseType = (
  world: World,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
) => [number, number, any, number];

function touch(
  world: any,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
): [number, number, any, number] {
  return [col.touch.x, col.touch.y, {}, 0];
}

function cross(
  world: any,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
): [number, number, any, number] {
  const [cols, len] = world.project(col.item, x, y, w, h, goalX, goalY, filter);
  return [goalX, goalY, cols, len];
}

function slide(
  world: World,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
): [number, number, any, number] {
  goalX = goalX || x;
  goalY = goalY || y;

  let [tch, move] = [col.touch, col.move];

  if (move.x != 0 || move.y != 0)
    if (col.normal.x != 0) goalX = tch.x;
    else goalY = tch.y;

  col.slide = { x: goalX, y: goalY };

  x = tch.x;
  y = tch.y;

  let [cols, len] = world.project(col.item, x, y, w, h, goalX, goalY, filter);

  return [goalX, goalY, cols, len];
}

function bounce(
  world: World,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
): [number, number, any, number] {
  goalX = goalX || x;
  goalY = goalY || y;

  let [tch, move] = [col.touch, col.move];
  let [tx, ty] = [tch.x, tch.y];

  let [bx, by] = [tx, ty];

  if (move.x != 0 || move.y != 0) {
    let [bnx, bny] = [goalX - tx, goalY - ty];

    if (col.normal.x == 0) bny = -bny;
    else bnx = -bnx;

    bx = tx + bnx;
    ty = ty + bny;
  }

  col.bounce = { x: bx, y: by };

  x = tch.x;
  y = tch.y;

  goalX = bx;
  goalY = by;

  const [cols, len] = world.project(col.item, x, y, w, h, goalX, goalY, filter);

  return [goalX, goalY, cols, len];
}

//////////////////////////////////////////
//World
//////////////////////////////////////////

//Private functions and methods

function sortByWeight(a: any, b: any): boolean {
  return a.weight < b.weight;
}

function sortByTiAndDistance(a: any, b: any): boolean {
  if (a.ti == b.ti) {
    const [ir, ar, br] = [a.itemRect, a.otherRect, b.otherRect];

    const ad = rect_getSquareDistance(
      ir.x,
      ir.y,
      ir.w,
      ir.h,
      ar.x,
      ar.y,
      ar.w,
      ar.h
    );
    const bd = rect_getSquareDistance(
      ir.x,
      ir.y,
      ir.w,
      ir.h,
      br.x,
      br.y,
      br.w,
      br.h
    );

    return ad < bd;
  }

  return a.ti < b.ti;
}

function addItemToCell(
  self: World,
  itemID: string,
  cx: number,
  cy: number
): void {
  self.rows[cy] = self.rows[cy] || {};

  let row = self.rows[cy];

  row[cx] = row[cx] || { itemCount: 0, x: cx, y: cy, items: {} };

  let cell = row[cx];

  self.nonEmptyCells[cell] = true;

  if (!cell.items[itemID]) {
    cell.items[itemID] = true;
    cell.itemCount = cell.itemCount + 1;
  }
}

function removeItemFromCell(
  self: World,
  itemID: string,
  cx: number,
  cy: number
): boolean {
  let row = self['rows'][cy];

  if (!row?.[cx]?.['items']?.[itemID]) return false;

  let cell = row[cx];

  cell.items[itemID] = null;

  cell.itemCount = cell.itemCount - 1;

  if (cell.itemCount == 0) self['nonEmptyCells'][cell] = null;

  return true;
}

function getDictItemsInCellRect(
  self: World,
  cl: number,
  ct: number,
  cw: number,
  ch: number
): { [itemID: string]: boolean } {
  let items_dict: { [itemID: string]: boolean } = {};

  for (let cy = ct; cy < ct + ch - 1; cy++) {
    let row = self.rows[cy];

    if (row) {
      for (let cx = cl; cx < cl + cw - 1; cx++) {
        let cell = row[cx];

        if (cell?.itemCount > 0)
          // no cell.itemCount > 1 because tunneling
          for (const itemID of Object.keys(cell.items))
            items_dict[itemID] = true;
      }
    }
  }

  return items_dict;
}

function getCellsTouchedBySegment(
  self: World,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): [any, number] {
  let cells: any = {};
  let cellsLen = 0;
  let visited: { [itemID: string]: boolean } = {};

  grid_traverse(self.cellSize, x1, y1, x2, y2, function(
    cx: number,
    cy: number
  ) {
    let row: any[] = self.rows[cy];

    if (!row) return;

    let cell = row[cx];

    if (!cell || visited[cell]) return;

    visited[cell] = true;
    cellsLen++;
    cells[cellsLen] = cell;
  });

  return [cells, cellsLen];
}

function getInfoAboutItemsTouchedBySegment(
  self: World,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  filter: any
): [any, number] {
  let [cells, len] = getCellsTouchedBySegment(self, x1, y1, x2, y2);
  let cell, rect, l, t, w, h, ti1, ti2;

  let visited: { [itemID: string]: boolean } = {};
  let itemInfo: any[] = [];
  let itemInfoLen = 0;

  for (const i in Array.from({ length: len }).fill(1)) {
    cell = cells[i];

    for (const item of cell.items) {
      if (!visited[item]) {
        visited[item] = true;

        if (!filter || filter(item)) {
          rect = self['rects'][item];
          l = rect.x;
          t = rect.y;
          w = rect.w;
          h = rect.h;

          const arr1 = rect_getSegmentIntersectionIndices(
            l,
            t,
            w,
            h,
            x1,
            y1,
            x2,
            y2,
            0,
            1
          );

          ti1 = arr1![0];
          ti2 = arr1![1];

          if (
            ti1 &&
            ((0 < ti1 && ti1 < 1) || (0 < (ti2 || 0) && (ti2 || 0) < 1))
          ) {
            // -- the sorting is according to the t of an infinite line, not the segment
            const [tii0, tii1] = rect_getSegmentIntersectionIndices(
              l,
              t,
              w,
              h,
              x1,
              y1,
              x2,
              y2,
              -Number.MAX_SAFE_INTEGER,
              Number.MAX_SAFE_INTEGER
            );

            itemInfo[itemInfoLen++] = {
              item: item,
              ti1: ti1,
              ti2: ti2,
              weight: Math.min(tii0 || 0, tii1 || 0),
            };
          }
        }
      }
    }
  }

  tableSort(itemInfo, sortByWeight);

  return [itemInfo, itemInfoLen];
}

function tableSort(table: any, fn: (...args: any[]) => any) {
  return table.sort(fn);
}

//Misc Public Methods

class World {
  responses: { [responseID: string]: any } = {};
  cellSize: number = 0;
  rows: any[][];
  rects: { [itemID: string]: any };
  nonEmptyCells: any;

  constructor(input: {
    cellSize: number;
    rects: {};
    rows: [];
    nonEmptyCells: {};
    responses: {};
  }) {
    this.cellSize = input.cellSize;
    this.rects = input.rects;
    this.rows = input.rows;
    this.nonEmptyCells = input.nonEmptyCells;
    this.responses = input.responses;
  }

  addResponse(name: string, response: any): void {
    this.responses[name] = response;
  }

  getResponseByName(name: string): any {
    const response = this.responses[name];

    if (!response)
      throw new Error(`Unknown collision type: ${name} (${typeof name})`);

    return response;
  }

  project(
    itemID: string,
    x: number,
    y: number,
    w: number,
    h: number,
    goalX: number,
    goalY: number,
    filter: any
  ): [any[], number] {
    assertIsRect(x, y, w, h);

    goalX = goalX || x;
    goalY = goalY || y;
    filter = filter || defaultFilter;

    let collisions: any[] = [];
    let len: number = 0;

    let visited: { [itemID: string]: boolean } = {};

    if (itemID) visited[itemID] = true;

    //This could probably be done with less cells using a polygon raster over the cells instead of a
    //bounding rect of the whole movement.Conditional to building a queryPolygon method
    let tl: number = Math.min(goalX, x);
    let tt: number = Math.min(goalY, y);

    let tr: number = Math.max(goalX + w, x + w);
    let tb: number = Math.max(goalY + h, y + h);

    let tw: number = tr - tl;
    let th: number = tb - tt;

    let [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, tl, tt, tw, th);

    let dictItemsInCellRect = getDictItemsInCellRect(this, cl, ct, cw, ch);

    for (const other of Object.keys(dictItemsInCellRect)) {
      if (!visited[other]) {
        visited[other] = true;

        let responseName = filter(itemID, other);

        if (responseName) {
          let [ox, oy, ow, oh] = this.getRect(other);

          let col: any = rect_detectCollision(
            x,
            y,
            w,
            h,
            ox,
            oy,
            ow,
            oh,
            goalX,
            goalY
          );

          if (col) {
            col.other = other;
            col.item = itemID;
            col.type = responseName;

            collisions[len++] = col;
          }
        }
      }
    }

    tableSort(collisions, sortByTiAndDistance);

    return [collisions, len];
  }

  countCells(): number {
    let count = 0;

    for (const row of this.rows) for (const col of row) count++;

    return count;
  }

  hasItem(item: string): boolean {
    return !!this.rects[item];
  }

  getItems() {
    let items: any[] = [];
    let len = 0;

    for (const rect of Object.keys(this.rects)) items[len++] = this.rects[rect];

    return [items, len];
  }

  countItems(): number {
    return Object.keys(this.rects).length;
  }

  getRect(itemID: string): [number, number, number, number] {
    let rect = this.rects[itemID];

    if (!rect)
      throw new Error(
        `Item "${itemID}" must be added to the world before getting its rect. Use world:add(item, x,y,w,h) to add it first.`
      );

    return [rect.x, rect.y, rect.w, rect.h];
  }

  toWorld(cx: number, cy: number): [number, number] {
    return grid_toWorld(this.cellSize, cx, cy);
  }

  toCell(x: number, y: number): [number, number] {
    return grid_toCell(this.cellSize, x, y);
  }

  //- Query methods
  queryRect(
    x: number,
    y: number,
    w: number,
    h: number,
    filter: any
  ): [any, number] {
    assertIsRect(x, y, w, h);

    let [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, x, y, w, h);
    let dictItemsInCellRect = getDictItemsInCellRect(this, cl, ct, cw, ch);

    let items: any[] = [];
    let len = 0;

    let rect;

    for (const itemID of Object.keys(dictItemsInCellRect)) {
      rect = this.rects[itemID];

      if (
        (!filter || filter(itemID)) &&
        rect_isIntersecting(x, y, w, h, rect.x, rect.y, rect.w, rect.h)
      )
        items[len++] = itemID;
    }

    return [items, len];
  }

  queryPoint(x: number, y: number, filter: any): [any[], number] {
    let [cx, cy] = this.toCell(x, y);
    let dictItemsInCellRect = getDictItemsInCellRect(this, cx, cy, 1, 1);

    let items: any[] = [];
    let len = 0;

    let rect: any;

    for (const itemID of Object.keys(dictItemsInCellRect)) {
      rect = this.rects[itemID];

      if (
        (!filter || filter(itemID)) &&
        rect_containsPoint(rect.x, rect.y, rect.w, rect.h, x, y)
      )
        items[len++] = itemID;
    }

    return [items, len];
  }

  querySegment(x1: number, y1: number, x2: number, y2: number, filter: any) {
    let [itemInfo, len] = getInfoAboutItemsTouchedBySegment(
      this,
      x1,
      y1,
      x2,
      y2,
      filter
    );
    let items: any[] = [];

    for (const i in Array.from({ length: len }).fill(1))
      items[i] = itemInfo[i].item;

    return [items, len];
  }

  querySegmentWithCoords(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filter: any
  ): [any, number] {
    let [itemInfo, len] = getInfoAboutItemsTouchedBySegment(
      this,
      x1,
      y1,
      x2,
      y2,
      filter
    );
    let dx: number = x2 - x1;
    let dy: number = y2 - y1;

    let info;
    let ti1: number;
    let ti2: number;

    for (const i in Array.from({ length: len }).fill(1)) {
      info = itemInfo[Number(i)];
      ti1 = info.ti1;
      ti2 = info.ti2;

      info.weight = null;
      info.x1 = x1 + dx * ti1;
      info.y1 = y1 + dy * ti1;
      info.x2 = x1 + dx * ti2;
      info.y2 = y1 + dy * ti2;
    }

    return [itemInfo, len];
  }

  //- Main methods

  add(itemID: string, x: number, y: number, w: number, h: number) {
    let rect = this.rects[itemID];

    if (rect) throw new Error(`Item "${itemID}" added to the world twice.`);

    assertIsRect(x, y, w, h);

    this.rects[itemID] = { x, y, w, h };

    let [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, x, y, w, h);

    for (let cy = ct; cy < ct + ch - 1; cy++)
      for (let cx = cl; cy < cl + cw - 1; cx++)
        addItemToCell(this, itemID, cx, cy);

    return itemID;
  }

  remove(itemID: string): void {
    let [x, y, w, h] = this.getRect(itemID);

    this.rects[itemID] = null;

    let [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, x, y, w, h);

    for (let cy = ct; cy < ct + ch - 1; cy++)
      for (let cx = cl; cx < cl + cw - 1; cx++)
        removeItemFromCell(this, itemID, cx, cy);
  }

  update(itemID: string, x2: number, y2: number, w2?: any, h2?: number): void {
    let [x1, y1, w1, h1] = this.getRect(itemID);

    w2 = w2 || w1;
    h2 = h2 || h1;

    assertIsRect(x2, y2, w2, h2);

    if (x1 != x2 || y1 != y2 || w1 != w2 || h1 != h2) {
      let [cl1, ct1, cw1, ch1] = grid_toCellRect(this.cellSize, x1, y1, w1, h1);
      let [cl2, ct2, cw2, ch2] = grid_toCellRect(this.cellSize, x2, y2, w2, h2);

      if (cl1 != cl2 || ct1 != ct2 || cw1 != cw2 || ch1 != ch2) {
        let cr1: number = cl1 + cw1 - 1;
        let cb1: number = ct1 + ch1 - 1;

        let cr2: number = cl2 + cw2 - 1;
        let cb2: number = ct2 + ch2 - 1;

        let cyOut;

        for (let cy = ct1; cy < cb1; cy++) {
          cyOut = Number(cy) < ct2 || cy > cb2;

          for (let cx = cl1; cx < cr1; cy++)
            if (cyOut || cx < cl2 || cx > cr2)
              removeItemFromCell(this, itemID, cx, cy);
        }

        for (let cy = ct2; cy < cb2; cy++) {
          cyOut = cy < ct1 || cy > cb1;

          for (let cx = cl2; cx < cr2; cx++)
            if (cyOut || cx < cl1 || cx > cr1)
              addItemToCell(this, itemID, cx, cy);
        }
      }

      let rect: any = this.rects[itemID];

      rect.x = x2;
      rect.y = y2;
      rect.w = w2;
      rect.h = h2;
    }
  }

  public move(
    itemID: string,
    goalX: number,
    goalY: number,
    filter?: any
  ): [number, number, number, number] {
    let [actualX, actualY, cols, len] = this.check(
      itemID,
      goalX,
      goalY,
      filter
    );

    this.update(itemID, actualX, actualY);

    return [actualX, actualY, cols, len];
  }

  check(
    itemID: string,
    goalX: number,
    goalY: number,
    filter?: any
  ): [number, number, any, number] {
    filter = filter || defaultFilter;

    let visited: { [itemID: string]: boolean } = {};
    visited[itemID] = true;

    const visitedFilter = (itm: any, other: any) =>
      !!visited[other] ? false : filter(itm, other);

    let cols: any[] = [];
    let len = 0;

    let [x, y, w, h] = this.getRect(itemID);

    let [projected_cols, projected_len] = this.project(
      itemID,
      x,
      y,
      w,
      h,
      goalX,
      goalY,
      visitedFilter
    );

    while (projected_len > 0) {
      let col: any = projected_cols[1];

      cols[len++] = col;

      visited[col.other] = true;

      let response = this.getResponseByName(col.type);

      // TODO: What if `response` is not defined?
      const [_goalX, _goalY, _projected_cols, _projected_len] = response(
        this,
        col,
        x,
        y,
        w,
        h,
        goalX,
        goalY,
        visitedFilter
      );

      goalX = _goalX;
      goalY = _goalY;
      projected_cols = _projected_cols;
      projected_len = _projected_len;
    }

    return [goalX, goalY, cols, len];
  }
}

// Public library functions

let bump = {
  _VERSION: 'bumpTS v0.0.1',
  _URL: 'https://github.com/hood/bump.ts',
  _DESCRIPTION:
    'A collision detection library for TypeScript. Ported from `bump.lua`.',
  _LICENSE: `M.I.T.`,

  newWorld: function(cellSize: number) {
    cellSize = cellSize || 64;

    assertIsPositiveNumber(cellSize, 'cellSize');

    let world = new World({
      cellSize: cellSize,
      rects: {},
      rows: [],
      nonEmptyCells: {},
      responses: {},
    });

    world.addResponse('touch', touch);
    world.addResponse('cross', cross);
    world.addResponse('slide', slide);
    world.addResponse('bounce', bounce);

    return world;
  },
  rect: {
    getNearestCorner: rect_getNearestCorner,
    getSegmentIntersectionIndices: rect_getSegmentIntersectionIndices,
    getDiff: rect_getDiff,
    containsPoint: rect_containsPoint,
    isIntersecting: rect_isIntersecting,
    getSquareDistance: rect_getSquareDistance,
    detectCollision: rect_detectCollision,
  },
  responses: {
    touch,
    cross,
    slide,
    bounce,
  },
};

export default bump;
