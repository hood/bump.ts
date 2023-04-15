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

function defaultFilter(): 'slide' {
  return 'slide';
}

type ResponseType = 'bounce' | 'slide' | 'cross' | 'touch';

type Filter = (item: string, other: string) => ResponseType;

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
  type?: ResponseType;
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
  items: Record<string, boolean>;
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
  const visited: Record<string, boolean> = {};

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

  let visited: Record<string, boolean> = {};
  let itemInfo: IItemInfo[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];

    if (cell?.items)
      for (const itemID of Object.keys(cell.items)) {
        if (!visited[itemID]) {
          visited[itemID] = true;

          if (!filter || filter(itemID)) {
            rect = self['getRect'](itemID);
            l = rect.x;
            t = rect.y;
            w = rect.w;
            h = rect.h;

            const intersections1 = rect_getSegmentIntersectionIndices(
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

            if (!intersections1) continue;

            ti1 = intersections1[0];
            ti2 = intersections1[1];

            if (
              !isNaN(ti1 as number) &&
              ((0 < ti1! && ti1! < 1) || (0 < ti2! && ti2! < 1))
            ) {
              // -- the sorting is according to the t of an infinite line, not the segment
              const intersections2 = rect_getSegmentIntersectionIndices(
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

              if (!intersections2) continue;

              const [tii0, tii1] = intersections2;

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
  responses: Record<ResponseType, Response> = {} as Record<
    ResponseType,
    Response
  >;
  cellSize: number = 0;
  rows: Cell[][];
  rects: Map<string, IRect> = new Map<string, IRect>();
  nonEmptyCells: Record<string, boolean>;

  constructor(input: {
    cellSize: number;
    rects: {};
    rows: [];
    nonEmptyCells: {};
    responses: Record<ResponseType, Response>;
  }) {
    this.cellSize = input.cellSize;

    this.rects = new Map(Object.entries(input.rects));

    this.rows = input.rows;
    this.nonEmptyCells = input.nonEmptyCells;
    this.responses = input.responses;
  }

  addResponse(name: ResponseType, response: Response): void {
    this.responses[name] = response;
  }

  getResponseByName(name: ResponseType): Response {
    const response = this.responses[name];

    if (!response)
      throw new Error(`Unknown collision type: ${name} (${typeof name})`);

    return response;
  }

  project(
    itemID: string | null,
    rect: IRect,
    goalX?: number,
    goalY?: number,
    filter?: (item: string, other: string) => ResponseType | false
  ): Collision[] {
    const _goalX = goalX ?? rect.x;
    const _goalY = goalY ?? rect.y;

    const _filter = filter || defaultFilter;

    let collisions: Collision[] = [];

    let visited: Record<string, boolean> = {};

    if (itemID) visited[itemID] = true;

    // This could probably be done with less cells using a polygon raster over
    // the cells instead of a bounding rect of the whole movement. Conditional
    // to building a queryPolygon method.
    let tl: number = _goalX !== rect.x ? Math.min(_goalX, rect.x) : _goalX;
    let tt: number = _goalY !== rect.y ? Math.min(_goalY, rect.y) : _goalY;

    let tr: number =
      _goalX !== rect.x ? Math.max(_goalX + rect.w, rect.x + rect.w) : _goalX;
    let tb: number =
      _goalY !== rect.y ? Math.max(_goalY + rect.h, rect.y + rect.h) : _goalY;

    let tw: number = tr - tl;
    let th: number = tb - tt;

    let cellRect = grid_toCellRect(this.cellSize, tl, tt, tw, th);

    let dictItemsInCellRect: Record<
      string,
      boolean
    > = this.getDictItemsInCellRect(cellRect);

    for (const other of Object.keys(dictItemsInCellRect)) {
      if (!visited[other]) {
        visited[other] = true;

        if (!this.hasItem(other)) continue;

        const responseName: ResponseType | false = _filter(itemID!, other);

        if (responseName !== false) {
          let otherRect = this.getRect(other);

          let collision: Partial<Collision> | undefined = rect_detectCollision(
            rect,
            otherRect,
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
    return this.rects.has(item);
  }

  getItems(): IRect[] {
    return Array.from(this.rects.values());
  }

  countItems(): number {
    return this.rects.size;
  }

  private addItemToCell(itemID: string, cx: number, cy: number): void {
    this.rows[cy] = this.rows[cy] || [];

    const row = this.rows[cy];

    // Initialize a cell if no cell is present at this point.
    if (!row[cx])
      row[cx] = {
        ID: `Cell_${cx}:${cy}`,
        x: cx,
        y: cy,
        items: {},
      };

    const cell = row[cx];

    this.nonEmptyCells[cell.ID] = true;

    if (!cell.items[itemID]) cell.items[itemID] = true;
  }

  getRect(itemID: string): IRect {
    const rect = this.rects.get(itemID);

    if (!rect)
      throw new Error(
        `Item "${itemID}" must be added to the world before getting its rect. Use world:add(item, x,y,w,h) to add it first.`
      );

    return rect;
  }

  getDictItemsInCellRect(cellRect: IRect): Record<string, boolean> {
    const items_dict: Record<string, boolean> = {};

    for (let cy = cellRect.y; cy <= cellRect.y + cellRect.h - 1; cy++) {
      let row = this.rows[cy];

      if (row)
        for (let cx = cellRect.x; cx <= cellRect.x + cellRect.w - 1; cx++) {
          let cell = row[cx];

          if (cell?.items && Object.keys(cell.items)?.length > 0)
            // no cell.itemCount > 1 because tunneling
            for (const itemID of Object.keys(cell.items))
              items_dict[itemID] = true;
        }
    }

    return items_dict;
  }

  // Optimized version of getDictItemsInCellRect only used in
  // queryPoint, made to avoid an unneeded object creation.
  getDictItemsInCellPoint(x: number, y: number): Record<string, boolean> {
    const items_dict: Record<string, boolean> = {};

    for (let cy = y; cy <= y; cy++) {
      let row = this.rows[cy];

      if (row)
        for (let cx = x; cx <= x; cx++) {
          let cell = row[cx];

          if (cell?.items && Object.keys(cell.items)?.length > 0)
            // no cell.itemCount > 1 because tunneling
            for (const itemID of Object.keys(cell.items))
              items_dict[itemID] = true;
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

    const cellRect = grid_toCellRect(this.cellSize, x, y, w, h);
    const dictItemsInCellRect = this.getDictItemsInCellRect(cellRect);

    const items: string[] = [];

    for (const itemID of Object.keys(dictItemsInCellRect))
      if (
        (!filter || filter(itemID)) &&
        rect_isIntersecting(x, y, w, h, this.getRect(itemID))
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
    const dictItemsInCellRect = this.getDictItemsInCellPoint(cx, cy);

    const items: string[] = [];

    for (const itemID of Object.keys(dictItemsInCellRect))
      if (
        (!filter || filter(itemID)) &&
        rect_containsPoint(this.getRect(itemID), x, y)
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

    if (itemsInfo)
      for (let i = 0; i < itemsInfo.length; i++) items.push(itemsInfo[i].item);

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
    const rect: IRect | undefined = this.rects.get(itemID);

    if (rect) throw new Error(`Item "${itemID}" added to the world twice.`);

    assertIsRect(x, y, w, h);

    this.rects.set(itemID, { x, y, w, h });

    const /* [cl, ct, cw, ch] */ cellRect = grid_toCellRect(
        this.cellSize,
        x,
        y,
        w,
        h
      );

    for (let cy = cellRect.y; cy < cellRect.y + cellRect.h; cy++)
      for (let cx = cellRect.x; cx < cellRect.x + cellRect.w; cx++)
        this.addItemToCell(itemID, cx, cy);

    return itemID;
  }

  remove(itemID: string): void {
    const _itemRect = this.getRect(itemID);
    const itemRect: IRect = {
      x: _itemRect.x,
      y: _itemRect.y,
      w: _itemRect.w,
      h: _itemRect.h,
    };

    this.rects.delete(itemID);

    let cellRect = grid_toCellRect(
      this.cellSize,
      itemRect.x,
      itemRect.y,
      itemRect.w,
      itemRect.h
    );

    for (let cy = cellRect.y; cy < cellRect.y + cellRect.h; cy++)
      for (let cx = cellRect.x; cx < cellRect.x + cellRect.w; cx++)
        if (this.removeItemFromCell(itemID, cx, cy)) return;
  }

  update(
    itemID: string,
    x2: number,
    y2: number,
    w2?: number,
    h2?: number
  ): void {
    let itemRect = this.getRect(itemID);

    w2 = isNaN(w2!) ? itemRect.w : w2;
    h2 = isNaN(h2!) ? itemRect.h : h2;

    assertIsRect(x2, y2, w2!, h2!);

    if (
      itemRect.x != x2 ||
      itemRect.y != y2 ||
      itemRect.w != w2 ||
      itemRect.h != h2
    ) {
      const cellRect1 = grid_toCellRect(
        this.cellSize,
        itemRect.x,
        itemRect.y,
        itemRect.w,
        itemRect.h
      );

      const cellRect2 = grid_toCellRect(this.cellSize, x2, y2, w2!, h2!);

      if (
        cellRect1.x != cellRect2.x ||
        cellRect1.y != cellRect2.y ||
        cellRect1.w != cellRect2.w ||
        cellRect1.h != cellRect2.h
      ) {
        const cr1: number = cellRect1.x + cellRect1.w - 1;
        const cb1: number = cellRect1.y + cellRect1.h - 1;

        const cr2: number = cellRect2.x + cellRect2.w - 1;
        const cb2: number = cellRect2.y + cellRect2.h - 1;

        let cyOut: boolean;

        for (let cy = cellRect1.y; cy <= cb1; cy++) {
          cyOut = Number(cy) < cellRect2.y || cy > cb2;

          for (let cx = cellRect1.x; cx <= cr1; cx++)
            if (cyOut || cx < cellRect2.x || cx > cr2)
              this.removeItemFromCell(itemID, cx, cy);
        }

        for (let cy = cellRect2.y; cy <= cb2; cy++) {
          cyOut = cy < cellRect1.y || cy > cb1;

          for (let cx = cellRect2.x; cx <= cr2; cx++)
            if (cyOut || cx < cellRect1.x || cx > cr1)
              this.addItemToCell(itemID, cx, cy);
        }
      }

      this.rects.set(itemID, {
        x: x2,
        y: y2,
        w: w2!,
        h: h2!,
      });
    }
  }

  public move(
    itemID: string,
    goalX: number,
    goalY: number,
    filter?: Filter
  ): ReturnType<Response> {
    const { x, y, collisions } = this.check(itemID, goalX, goalY, filter);

    this.update(itemID, x, y);

    return { x, y, collisions };
  }

  check(
    itemID: string,
    goalX: number,
    goalY: number,
    filter?: Filter
  ): ReturnType<Response> {
    const checkFilter: Filter = filter || defaultFilter;

    let visited: Record<string, boolean> = {};
    visited[itemID] = true;

    const visitedFilter = (item: string, other: string) =>
      !!visited[other] ? false : checkFilter(item, other);

    let detectedCollisions: Collision[] = [];

    const itemRect: IRect = this.getRect(itemID);

    let projectedCollisions: Collision[] = this.project(
      itemID,
      itemRect,
      goalX,
      goalY,
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
        goalX,
        goalY,
        visitedFilter
      );

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
  newWorld: function(cellSize: number): World {
    cellSize = cellSize || 64;

    assertIsPositiveNumber(cellSize, 'cellSize');

    const world: World = new World({
      cellSize: cellSize,
      rects: {},
      rows: [],
      nonEmptyCells: {},
      responses: {} as Record<string, Response>,
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
