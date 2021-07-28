import assertIsPositiveNumber from './helpers/generic/assertIsPositiveNumber';
import {
  rect_containsPoint,
  rect_detectCollision,
  rect_getDiff,
  rect_getNearestCorner,
  rect_getSegmentIntersectionIndices,
  rect_getSquareDistance,
  rect_isIntersecting,
} from './rect';
import {
  grid_toCell,
  grid_toCellRect,
  grid_toWorld,
  grid_traverse,
} from './grid';
import assertIsRect from './helpers/generic/assertIsRect';
import { bounce, cross, slide, touch } from './helpers/world/responses';
import sortByTiAndDistance from './helpers/world/sortByTiAndDistance';

function defaultFilter(): string {
  return 'slide';
}

//////////////////////////////////////////
//World
//////////////////////////////////////////

//Private functions and methods

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function sortByWeight(a: any, b: any): boolean {
  return a.weight < b.weight;
}

// TODO: FIx this. it should return an array but returns an object with number keys
function getCellsTouchedBySegment(
  self: World,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): any[] {
  let cells: any[] = [];
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

  return cells;
}

function getInfoAboutItemsTouchedBySegment(
  self: World,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  filter?: any
): any[] {
  let cells = getCellsTouchedBySegment(self, x1, y1, x2, y2);
  let rect, l, t, w, h, ti1, ti2;

  let visited: { [itemID: string]: boolean } = {};
  let itemInfo: any[] = [];

  for (const cell of cells) {
    if (cell?.items)
      for (const itemID of Object.keys(cell.items)) {
        if (!visited[itemID]) {
          visited[itemID] = true;

          if (!filter || filter(itemID)) {
            rect = self['rects'][itemID];
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
              !isNaN(ti1 as number) &&
              ((0 < ti1! && ti1! < 1) || (0 < ti2! && ti2! < 1))
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

              itemInfo.push({
                item: itemID,
                ti1: ti1,
                ti2: ti2,
                weight: Math.min(tii0 || 0, tii1 || 0),
              });
            }
          }
        }
      }
  }

  tableSort(itemInfo, sortByWeight);

  return itemInfo;
}

function tableSort(table: any, fn: (...args: any[]) => any) {
  return table.sort(fn);
}

//Misc Public Methods

export class World {
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

  // TODO: Fiure out why this returns N Collisions for N items in the original bump
  project(
    itemID: string | null,
    x: number,
    y: number,
    w: number,
    h: number,
    goalX?: number,
    goalY?: number,
    filter?: any
  ): any[] {
    // TODO: Should return `Collision[]`
    assertIsRect(x, y, w, h);

    const _goalX = isNaN(goalX as number) ? x : goalX!;
    const _goalY = isNaN(goalY as number) ? y : goalY!;

    filter = filter || defaultFilter;

    let collisions: any[] = [];

    let visited: { [itemID: string]: boolean } = {};

    if (itemID) visited[itemID] = true;

    // This could probably be done with less cells using a polygon raster over the cells instead of a
    // bounding rect of the whole movement.Conditional to building a queryPolygon method
    let tl: number = Math.min(_goalX, x);
    let tt: number = Math.min(_goalY, y);

    let tr: number = Math.max(_goalX + w, x + w);
    let tb: number = Math.max(_goalY + h, y + h);

    let tw: number = tr - tl;
    let th: number = tb - tt;

    let [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, tl, tt, tw, th);

    let dictItemsInCellRect: {
      [itemID: string]: boolean;
    } = this.getDictItemsInCellRect(cl, ct, cw, ch);

    for (const other of Object.keys(dictItemsInCellRect)) {
      if (!visited[other]) {
        visited[other] = true;

        const responseName: string = filter(itemID, other);

        if (responseName) {
          let otherRect = this.getRect(other);

          let collision: any = rect_detectCollision(
            x,
            y,
            w,
            h,
            otherRect.x,
            otherRect.y,
            otherRect.w,
            otherRect.h,
            _goalX,
            _goalY
          );

          if (collision) {
            collision.other = other;
            collision.item = itemID;
            collision.type = responseName;

            collisions.push(collision);
          }
        }
      }
    }

    tableSort(collisions, sortByTiAndDistance) /* .reverse() */;

    return collisions;
  }

  countCells(): number {
    let count = 0;

    for (const row of this.rows.filter((row) => !!row))
      for (const _col of row) if (!!_col) count++;

    return count;
  }

  hasItem(item: string): boolean {
    return !!this.rects[item];
  }

  getItems(): any[] {
    let items: any[] = [];
    let len = 0;

    for (const rect of Object.keys(this.rects)) items[len++] = this.rects[rect];

    return items;
  }

  countItems(): number {
    return Object.keys(this.rects).length;
  }

  private addItemToCell(itemID: string, cx: number, cy: number): void {
    this.rows[cy] = this.rows[cy] || [];

    const row = this.rows[cy];

    row[cx] = row[cx] || { itemCount: 0, x: cx, y: cy, items: {} };

    const cell = row[cx];

    this.nonEmptyCells[cell] = true;

    if (!cell.items[itemID]) {
      cell.items[itemID] = true;
      cell.itemCount++;
    }
  }

  getRect(itemID: string): Rect {
    let rect = this.rects[itemID];

    if (!rect)
      throw new Error(
        `Item "${itemID}" must be added to the world before getting its rect. Use world:add(item, x,y,w,h) to add it first.`
      );

    return {
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
    };
  }

  getDictItemsInCellRect(
    cl: number,
    ct: number,
    cw: number,
    ch: number
  ): { [itemID: string]: boolean } {
    let items_dict: { [itemID: string]: boolean } = {};

    for (let cy = ct; cy <= ct + ch - 1; cy++) {
      let row = this.rows[cy];

      if (row) {
        for (let cx = cl; cx <= cl + cw - 1; cx++) {
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

  private removeItemFromCell(itemID: string, cx: number, cy: number): boolean {
    let row = this.rows[cy];

    if (!row?.[cx]?.['items']?.[itemID]) return false;

    let cell = row[cx];

    cell.items[itemID] = null;

    cell.itemCount--;

    if (cell.itemCount === 0) this.nonEmptyCells[cell] = null;

    return true;
  }

  toWorld(cx: number, cy: number): [number, number] {
    return grid_toWorld(this.cellSize, cx, cy);
  }

  toCell(x: number, y: number): [number, number] {
    return grid_toCell(this.cellSize, x, y);
  }

  //- Query methods
  queryRect(x: number, y: number, w: number, h: number, filter: any): any[] {
    assertIsRect(x, y, w, h);

    let [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, x, y, w, h);
    let dictItemsInCellRect = this.getDictItemsInCellRect(cl, ct, cw, ch);

    let items: any[] = [];

    let rect;

    for (const itemID of Object.keys(dictItemsInCellRect)) {
      rect = this.rects[itemID];

      if (
        (!filter || filter(itemID)) &&
        rect_isIntersecting(x, y, w, h, rect.x, rect.y, rect.w, rect.h)
      )
        items.push(itemID);
    }

    return items;
  }

  queryPoint(x: number, y: number, filter: any): any[] {
    let [cx, cy] = this.toCell(x, y);
    let dictItemsInCellRect = this.getDictItemsInCellRect(cx, cy, 1, 1);

    let items: any[] = [];

    let rect: any;

    for (const itemID of Object.keys(dictItemsInCellRect)) {
      rect = this.rects[itemID];

      if (
        (!filter || filter(itemID)) &&
        rect_containsPoint(rect.x, rect.y, rect.w, rect.h, x, y)
      )
        items.push(itemID);
    }

    return items;
  }

  querySegment(x1: number, y1: number, x2: number, y2: number, filter?: any) {
    const itemsInfo = getInfoAboutItemsTouchedBySegment(
      this,
      x1,
      y1,
      x2,
      y2,
      filter
    );

    let items: any[] = [];

    if (itemsInfo) for (const itemInfo of itemsInfo) items.push(itemInfo.item);

    return items;
  }

  querySegmentWithCoords(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filter: any
  ): any[] {
    let itemInfo = getInfoAboutItemsTouchedBySegment(
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

    for (const itemID of itemInfo) {
      info = itemInfo[itemID];

      ti1 = info.ti1;
      ti2 = info.ti2;

      info.weight = null;
      info.x1 = x1 + dx * ti1;
      info.y1 = y1 + dy * ti1;
      info.x2 = x1 + dx * ti2;
      info.y2 = y1 + dy * ti2;
    }

    return itemInfo;
  }

  //- Main methods

  add(itemID: string, x: number, y: number, w: number, h: number) {
    let rect = this.rects[itemID];

    if (rect) throw new Error(`Item "${itemID}" added to the world twice.`);

    assertIsRect(x, y, w, h);

    this.rects[itemID] = { x, y, w, h };

    let [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, x, y, w, h);

    for (let cy = ct; cy < ct + ch; cy++)
      for (let cx = cl; cx < cl + cw; cx++) this.addItemToCell(itemID, cx, cy);

    return itemID;
  }

  remove(itemID: string): void {
    let itemRect = this.getRect(itemID);

    this.rects[itemID] = null;

    let [cl, ct, cw, ch] = grid_toCellRect(
      this.cellSize,
      itemRect.x,
      itemRect.y,
      itemRect.w,
      itemRect.h
    );

    for (let cy = ct; cy < ct + ch; cy++)
      for (let cx = cl; cx < cl + cw; cx++)
        this.removeItemFromCell(itemID, cx, cy);
  }

  update(itemID: string, x2: number, y2: number, w2?: any, h2?: number): void {
    let itemRect = this.getRect(itemID);

    w2 = isNaN(w2 as number) ? itemRect.w : w2;
    h2 = isNaN(h2 as number) ? itemRect.h : h2;

    assertIsRect(x2, y2, w2, h2!);

    if (
      itemRect.x != x2 ||
      itemRect.y != y2 ||
      itemRect.w != w2 ||
      itemRect.h != h2
    ) {
      let [cl1, ct1, cw1, ch1] = grid_toCellRect(
        this.cellSize,
        itemRect.x,
        itemRect.y,
        itemRect.w,
        itemRect.h
      );

      let [cl2, ct2, cw2, ch2] = grid_toCellRect(
        this.cellSize,
        x2,
        y2,
        w2,
        h2!
      );

      if (cl1 != cl2 || ct1 != ct2 || cw1 != cw2 || ch1 != ch2) {
        let cr1: number = cl1 + cw1 - 1;
        let cb1: number = ct1 + ch1 - 1;

        let cr2: number = cl2 + cw2 - 1;
        let cb2: number = ct2 + ch2 - 1;

        let cyOut: boolean;

        for (let cy = ct1; cy <= cb1; cy++) {
          cyOut = Number(cy) < ct2 || cy > cb2;

          for (let cx = cl1; cx <= cr1; cy++)
            if (cyOut || cx < cl2 || cx > cr2)
              this.removeItemFromCell(itemID, cx, cy);
        }

        for (let cy = ct2; cy <= cb2; cy++) {
          cyOut = cy < ct1 || cy > cb1;

          for (let cx = cl2; cx <= cr2; cx++)
            if (cyOut || cx < cl1 || cx > cr1)
              this.addItemToCell(itemID, cx, cy);
        }
      }

      const rect: Rect = this.rects[itemID];

      rect.x = x2;
      rect.y = y2;
      rect.w = w2!;
      rect.h = h2!;
    }
  }

  public move(
    itemID: string,
    goalX: number,
    goalY: number,
    filter?: any
  ): { x: number; y: number; collisions: any[] } {
    let { x, y, collisions } = this.check(itemID, goalX, goalY, filter);

    this.update(itemID, x, y);

    return { x, y, collisions };
  }

  check(
    itemID: string,
    goalX: number,
    goalY: number,
    filter?: any
  ): { x: number; y: number; collisions: any[] } {
    const checkFilter: any = filter || defaultFilter;

    let visited: { [itemID: string]: boolean } = {};
    visited[itemID] = true;

    const visitedFilter = (itm: any, other: any) =>
      !!visited[other] ? false : checkFilter(itm, other);

    let detectedCollisions: any[] = [];

    let itemRect: Rect = this.getRect(itemID);

    let projectedCollisions = this.project(
      itemID,
      itemRect.x,
      itemRect.y,
      itemRect.w,
      itemRect.h,
      goalX,
      goalY,
      visitedFilter
    );

    // Current broken test prints otherRect = {h:2, w:1,x:0, y:2} i lua
    // require('console').dir(
    //   {
    //     projectedCollisions,
    //   },
    //   { depth: null }
    // );

    let collisionsCounter = projectedCollisions?.length || 0;

    while (collisionsCounter > 0) {
      let collision: any = projectedCollisions[0];

      detectedCollisions.push(collision);

      visited[collision.other] = true;

      let response = this.getResponseByName(collision.type);

      // TODO: What if `response` is not defined?
      const { x, y, collisions } = response(
        this,
        collision,
        itemRect.x,
        itemRect.y,
        itemRect.w,
        itemRect.h,
        goalX,
        goalY,
        visitedFilter
      );

      // This prints once in TS and once in lua. Whilelen is 0 in lua
      // require('console').dir({
      //   afterCols: collisions,
      //   whillelen: projectedCollisions?.length,
      // });

      goalX = x;
      goalY = y;
      projectedCollisions = collisions;

      collisionsCounter = collisions?.length || 0;
    }

    return { x: goalX, y: goalY, collisions: detectedCollisions };
  }
}

// Public library functions

const bump = {
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

export default Object.seal(bump);
