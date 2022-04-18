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
import {
  bounce,
  cross,
  Response,
  slide,
  touch,
} from './helpers/world/responses';
import sortByTiAndDistance from './helpers/world/sortByTiAndDistance';

function defaultFilter(): string {
  return 'slide';
}

interface IItemInfo {
  item: string;
  ti1: number;
  ti2: number;
  weight: number;
}

export interface IRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ICoords {
  x: number;
  y: number;
}

export interface Collision {
  other: any | null | undefined;
  item: string | null | undefined;
  type?: 'touch' | 'cross' | 'slide' | 'bounce' | string;
  overlaps: boolean;
  ti: number;
  move: ICoords;
  normal: ICoords;
  touch: ICoords;
  itemRect: IRect;
  otherRect: IRect;
  slide?: ICoords;
  bounce?: ICoords;
}

export type Cell = {
  ID: string;
  x: number;
  y: number;
  items: { [itemID: string]: boolean };
};

function sortByWeight(a: IItemInfo, b: IItemInfo): number {
  return a.weight - b.weight;
}

function getCellsTouchedBySegment(
  self: World,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Cell[] {
  const cells: Cell[] = [];
  const visited: { [itemID: string]: boolean } = {};

  grid_traverse(self.cellSize, x1, y1, x2, y2, function(
    cx: number,
    cy: number
  ) {
    let row: Cell[] = self.rows[cy];

    if (!row) return;

    let cell = row[cx];

    if (!cell || visited[cell.ID]) return;

    visited[cell.ID] = true;

    cells.push(cell);
  });

  return cells;
}

function getInfoAboutItemsTouchedBySegment(
  self: World,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  filter?: (other?: string) => boolean
): { item: string; ti1: number; ti2: number; weight: number | null }[] {
  let cells = getCellsTouchedBySegment(self, x1, y1, x2, y2);
  let rect, l, t, w, h, ti1, ti2;

  let visited: { [itemID: string]: boolean } = {};
  let itemInfo: IItemInfo[] = [];

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
                ti1: ti1!,
                ti2: ti2!,
                weight: Math.min(tii0 || 0, tii1 || 0),
              });
            }
          }
        }
      }
  }

  return itemInfo.sort(sortByWeight);
}

export class World {
  responses: { [responseID: string]: Response } = {};
  cellSize: number = 0;
  rows: Cell[][];
  rects: { [itemID: string]: IRect };
  nonEmptyCells: { [cellID: string]: boolean };

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

  addResponse(
    name: 'bounce' | 'slide' | 'cross' | 'touch',
    response: Response
  ): void {
    this.responses[name] = response;
  }

  getResponseByName(name: string): any {
    const response = this.responses[name];

    if (!response)
      throw new Error(`Unknown collision type: ${name} (${typeof name})`);

    return response;
  }

  project(
    itemID: string | null,
    x: number,
    y: number,
    w: number,
    h: number,
    goalX?: number,
    goalY?: number,
    filter?: (...args: any[]) => string
  ): Collision[] {
    assertIsRect(x, y, w, h);

    const _goalX = isNaN(goalX as number) ? x : goalX!;
    const _goalY = isNaN(goalY as number) ? y : goalY!;

    const _filter = filter || defaultFilter;

    let collisions: Collision[] = [];

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

        const responseName: string = _filter(itemID, other);

        if (
          responseName &&
          /* why do I have to do this extra check? */ this.hasItem(other)
        ) {
          let otherRect = this.getRect(other);

          let collision: Partial<Collision> | undefined = rect_detectCollision(
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

            collisions.push(collision as Collision);
          }
        }
      }
    }

    return collisions.sort(sortByTiAndDistance);
  }

  countCells(): number {
    let count = 0;

    for (const row of this.rows.filter(row => !!row))
      for (const _col of row) if (!!_col) count++;

    return count;
  }

  hasItem(item: string): boolean {
    return !!this.rects[item];
  }

  getItems(): IRect[] {
    return Object.keys(this.rects).map(rectID => this.rects[rectID]);
  }

  countItems(): number {
    return Object.keys(this.rects).length;
  }

  private addItemToCell(itemID: string, cx: number, cy: number): void {
    this.rows[cy] = this.rows[cy] || [];

    const row = this.rows[cy];

    // Initialize a cell if no cell is present at this point
    if (!row[cx])
      row[cx] = {
        ID: `Cell_${Math.ceil(Math.random() * Date.now()).toString(36)}`,
        x: cx,
        y: cy,
        items: {},
      };

    const cell = row[cx];

    this.nonEmptyCells[cell.ID] = true;

    if (!cell.items[itemID]) cell.items[itemID] = true;
  }

  getRect(itemID: string): IRect {
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
    const items_dict: { [itemID: string]: boolean } = {};

    for (let cy = ct; cy <= ct + ch - 1; cy++) {
      let row = this.rows[cy];

      if (row) {
        for (let cx = cl; cx <= cl + cw - 1; cx++) {
          let cell = row[cx];

          if (cell?.items && Object.keys(cell.items)?.length > 0)
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

    delete cell.items[itemID];

    if (Object.keys(cell.items)?.length === 0)
      delete this.nonEmptyCells[cell.ID];

    return true;
  }

  toWorld(cx: number, cy: number): [number, number] {
    return grid_toWorld(this.cellSize, cx, cy);
  }

  toCell(x: number, y: number): [number, number] {
    return grid_toCell(this.cellSize, x, y);
  }

  queryRect(
    x: number,
    y: number,
    w: number,
    h: number,
    filter?: (other?: string) => boolean
  ): string[] {
    assertIsRect(x, y, w, h);

    const [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, x, y, w, h);
    const dictItemsInCellRect = this.getDictItemsInCellRect(cl, ct, cw, ch);

    const items: string[] = [];

    for (const itemID of Object.keys(dictItemsInCellRect))
      if (
        (!filter || filter(itemID)) &&
        rect_isIntersecting(
          x,
          y,
          w,
          h,
          this.rects[itemID].x,
          this.rects[itemID].y,
          this.rects[itemID].w,
          this.rects[itemID].h
        )
      )
        items.push(itemID);

    return items;
  }

  queryPoint(
    x: number,
    y: number,
    filter?: (other?: string) => boolean
  ): string[] {
    const [cx, cy] = this.toCell(x, y);
    const dictItemsInCellRect = this.getDictItemsInCellRect(cx, cy, 1, 1);

    const items: string[] = [];

    for (const itemID of Object.keys(dictItemsInCellRect))
      if (
        (!filter || filter(itemID)) &&
        rect_containsPoint(
          this.rects[itemID].x,
          this.rects[itemID].y,
          this.rects[itemID].w,
          this.rects[itemID].h,
          x,
          y
        )
      )
        items.push(itemID);

    return items;
  }

  querySegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filter?: (other?: string) => boolean
  ): string[] {
    const itemsInfo = getInfoAboutItemsTouchedBySegment(
      this,
      x1,
      y1,
      x2,
      y2,
      filter
    );

    const items: string[] = [];

    if (itemsInfo) for (const itemInfo of itemsInfo) items.push(itemInfo.item);

    return items;
  }

  querySegmentWithCoords(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filter?: (other?: string) => boolean
  ): {
    item: string;
    ti1: number;
    ti2: number;
    weight: number | null;
    x1: number;
    x2: number;
    y1: number;
    y2: number;
  }[] {
    let itemInfo: any = getInfoAboutItemsTouchedBySegment(
      this,
      x1,
      y1,
      x2,
      y2,
      filter
    );

    let dx: number = x2 - x1;
    let dy: number = y2 - y1;

    let info: any;
    let ti1: number;
    let ti2: number;

    for (const item of itemInfo) {
      info = item;

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

  add(itemID: string, x: number, y: number, w: number, h: number): string {
    const rect: IRect = this.rects[itemID];

    if (rect) throw new Error(`Item "${itemID}" added to the world twice.`);

    assertIsRect(x, y, w, h);

    this.rects[itemID] = { x, y, w, h };

    const [cl, ct, cw, ch] = grid_toCellRect(this.cellSize, x, y, w, h);

    for (let cy = ct; cy < ct + ch; cy++)
      for (let cx = cl; cx < cl + cw; cx++) this.addItemToCell(itemID, cx, cy);

    return itemID;
  }

  remove(itemID: string): void {
    const itemRect: IRect = JSON.parse(JSON.stringify(this.getRect(itemID)));

    delete this.rects[itemID];

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

  update(
    itemID: string,
    x2: number,
    y2: number,
    w2?: number,
    h2?: number
  ): void {
    let itemRect = this.getRect(itemID);

    w2 = isNaN(w2 as number) ? itemRect.w : w2;
    h2 = isNaN(h2 as number) ? itemRect.h : h2;

    assertIsRect(x2, y2, w2!, h2!);

    if (
      itemRect.x != x2 ||
      itemRect.y != y2 ||
      itemRect.w != w2 ||
      itemRect.h != h2
    ) {
      const [cl1, ct1, cw1, ch1] = grid_toCellRect(
        this.cellSize,
        itemRect.x,
        itemRect.y,
        itemRect.w,
        itemRect.h
      );

      const [cl2, ct2, cw2, ch2] = grid_toCellRect(
        this.cellSize,
        x2,
        y2,
        w2!,
        h2!
      );

      if (cl1 != cl2 || ct1 != ct2 || cw1 != cw2 || ch1 != ch2) {
        const cr1: number = cl1 + cw1 - 1;
        const cb1: number = ct1 + ch1 - 1;

        const cr2: number = cl2 + cw2 - 1;
        const cb2: number = ct2 + ch2 - 1;

        let cyOut: boolean;

        for (let cy = ct1; cy <= cb1; cy++) {
          cyOut = Number(cy) < ct2 || cy > cb2;

          for (let cx = cl1; cx <= cr1; cx++)
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

      const rect: IRect = this.rects[itemID];

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
    filter?: (...args: any[]) => any
  ): { x: number; y: number; collisions: Collision[] } {
    const { x, y, collisions } = this.check(itemID, goalX, goalY, filter);

    this.update(itemID, x, y);

    return { x, y, collisions };
  }

  check(
    itemID: string,
    goalX: number,
    goalY: number,
    filter?: (...args: any[]) => any
  ): { x: number; y: number; collisions: Collision[] } {
    let _goalX: number = goalX;
    let _goalY: number = goalY;

    const checkFilter: any = filter || defaultFilter;

    let visited: { [itemID: string]: boolean } = {};
    visited[itemID] = true;

    const visitedFilter = (itm: any, other: any) =>
      !!visited[other] ? false : checkFilter(itm, other);

    let detectedCollisions: Collision[] = [];

    const itemRect: IRect = this.getRect(itemID);

    // this is returning an empty array. WHY?
    let projectedCollisions: Collision[] = this.project(
      itemID,
      itemRect.x,
      itemRect.y,
      itemRect.w,
      itemRect.h,
      _goalX,
      _goalY,
      visitedFilter
    );

    let collisionsCounter: number = projectedCollisions?.length || 0;

    while (collisionsCounter > 0) {
      const collision: Collision = projectedCollisions[0];

      detectedCollisions.push(collision);

      visited[collision.other] = true;

      let response = this.getResponseByName(collision.type!);

      const { x, y, collisions } = response(
        this,
        collision,
        itemRect.x,
        itemRect.y,
        itemRect.w,
        itemRect.h,
        _goalX,
        _goalY,
        visitedFilter
      );

      _goalX = x;
      _goalY = y;
      projectedCollisions = collisions;

      collisionsCounter = collisions?.length || 0;
    }

    return { x: _goalX, y: _goalY, collisions: detectedCollisions };
  }
}

// Public library functions

const bump = {
  newWorld: function(cellSize: number): World {
    cellSize = cellSize || 64;

    assertIsPositiveNumber(cellSize, 'cellSize');

    const world: World = new World({
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

export default Object.freeze(bump);
