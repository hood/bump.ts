import assertIsPositiveNumber from './helpers/generic/assertIsPositiveNumber';
import {
  detectCollision,
  rect_containsPoint,
  rect_detectCollision,
  rect_getDiff,
  rect_getNearestCorner,
  rect_getSegmentIntersectionIndices,
  rect_getSquareDistance,
  rect_isIntersecting,
  segmentIntersection,
  segScratchSegment,
} from './rect';
import { grid_toCell, grid_toWorld, grid_traverse } from './grid';
import assertIsRect from './helpers/generic/assertIsRect';
import { DELTA } from './constants';
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

/*
 * A query filter is either a predicate on the other item's ID, or a layer mask:
 * a number keeps the items whose category shares at least one bit with it.
 */
type QueryFilter = ((other?: string) => boolean) | number;

export interface ILayers {
  /* Bits this item belongs to. Defaults to 1. */
  category?: number;
  /* Bits this item collides with. Defaults to all of them. */
  mask?: number;
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

/*
 * `items` holds integer item handles, not IDs: see `World.names` to map one
 * back. It is kept in insertion order so every query returns items in the same
 * order the previous `Set<string>` did.
 */
export type Cell = {
  ID: string;
  x: number;
  y: number;
  items: number[];
};

const DEFAULT_CATEGORY = 1;
const DEFAULT_MASK = 0xffffffff;
const INITIAL_CAPACITY = 64;

/*
 * `check` hands its responses a filter that hides already-resolved items. It
 * has to stay a plain `(item, other)` callback for custom responses, but when it
 * comes back into `project` the state attached here lets the cell walk skip
 * those items by handle and skip the call entirely for the default filter.
 */
const CHECK_STATE = '__bumpCheck';

interface ICheckState {
  excluded: number[];
  filter: Filter;
}

function sortByWeight(a: IItemInfo, b: IItemInfo): number {
  return a.weight - b.weight;
}

function removeFromCell(items: number[], handle: number): void {
  const n = items.length;
  let i = items.indexOf(handle);

  if (i < 0) return;

  // Shift rather than swap-remove: query results follow cell order.
  for (i++; i < n; i++) items[i - 1] = items[i];

  items.pop();
}

export class World {
  responses: Record<ResponseType, Response> = {} as Record<
    ResponseType,
    Response
  >;
  cellSize: number = 0;
  rows: Cell[][] = [];

  /*
   * Item storage is data-oriented: each item gets an integer handle, and its
   * rect lives at `boxes[handle * 4 .. + 3]`. The cell walk then touches only
   * small integers and a flat float array, with no string hashing per
   * candidate. The ID -> handle Map is consulted once per public call, and its
   * insertion order is the item order `getItems` reports.
   */
  private handles: Map<string, number> = new Map();
  /* handle -> item ID; `undefined` for a free handle. */
  names: (string | undefined)[] = [];
  private boxes: Float64Array = new Float64Array(INITIAL_CAPACITY * 4);
  private categories: Uint32Array = new Uint32Array(INITIAL_CAPACITY);
  private masks: Uint32Array = new Uint32Array(INITIAL_CAPACITY);
  private capacity: number = INITIAL_CAPACITY;
  private nextHandle: number = 0;
  private freeHandles: number[] = [];

  /*
   * Dedup marks: an item is visited when `marks[handle] === epoch`. Bumping
   * the epoch clears every mark at once. A filter may call back into the world
   * mid-query, so each nesting depth gets its own mark array.
   */
  private visitMarks: Uint32Array[] = [];
  private visitEpochs: number[] = [];
  private visitDepth: number = 0;

  /*
   * Derived on read, not maintained on write.
   *
   * The enumeration must go through `Object.keys`, NOT a numeric `0..length`
   * walk. `rows` is indexed by cell coordinate, which goes negative for negative
   * world coordinates, and negative indices are string-keyed properties outside
   * the array's index range: a numeric walk silently drops them.
   */
  get nonEmptyCells(): Record<string, boolean> {
    const cells: Record<string, boolean> = {};
    const rows = this.rows as unknown as Record<string, Cell[]>;

    for (const cy of Object.keys(rows)) {
      const row = rows[cy] as unknown as Record<string, Cell>;

      if (!row) continue;

      for (const cx of Object.keys(row)) {
        const cell = row[cx];

        if (cell && cell.items.length > 0) cells[cell.ID] = true;
      }
    }

    return cells;
  }

  /* A snapshot of every item's rect, keyed by ID. */
  get rects(): Map<string, IRect> {
    const rects = new Map<string, IRect>();

    for (const [itemID, handle] of this.handles)
      rects.set(itemID, this.rectOf(handle));

    return rects;
  }

  constructor(input: {
    cellSize: number;
    rects: Record<string, IRect>;
    rows: [];
    nonEmptyCells: {};
    responses: Record<ResponseType, Response>;
  }) {
    this.cellSize = input.cellSize;
    this.responses = input.responses;

    for (const [itemID, r] of Object.entries(input.rects))
      this.add(itemID, r.x, r.y, r.w, r.h);
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

  private handleOf(itemID: string): number {
    const handle = this.handles.get(itemID);

    if (handle === undefined)
      throw new Error(
        `Item "${itemID}" must be added to the world before getting its rect. Use world:add(item, x,y,w,h) to add it first.`
      );

    return handle;
  }

  private rectOf(handle: number): IRect {
    const b = this.boxes;
    const i = handle << 2;

    return { x: b[i], y: b[i + 1], w: b[i + 2], h: b[i + 3] };
  }

  private grow(): void {
    const capacity = this.capacity * 2;

    const boxes = new Float64Array(capacity * 4);
    boxes.set(this.boxes);
    this.boxes = boxes;

    const categories = new Uint32Array(capacity);
    categories.set(this.categories);
    this.categories = categories;

    const masks = new Uint32Array(capacity);
    masks.set(this.masks);
    this.masks = masks;

    this.capacity = capacity;
  }

  private beginVisit(): Uint32Array {
    const depth = this.visitDepth++;
    let marks = this.visitMarks[depth];

    if (marks === undefined || marks.length < this.capacity) {
      marks = new Uint32Array(this.capacity);
      this.visitMarks[depth] = marks;
      this.visitEpochs[depth] = 0;
    }

    let epoch = this.visitEpochs[depth] + 1;

    if (epoch > 0xfffffffe) {
      marks.fill(0);
      epoch = 1;
    }

    this.visitEpochs[depth] = epoch;

    return marks;
  }

  private endVisit(): void {
    this.visitDepth--;
  }

  private currentEpoch(): number {
    return this.visitEpochs[this.visitDepth - 1];
  }

  /*
   * Sets which layers an item belongs to and which it collides with. Two items
   * only collide when each one's mask shares a bit with the other's category;
   * pairs that fail this are skipped before the filter is called.
   */
  setLayers(itemID: string, layers: ILayers): void {
    const handle = this.handleOf(itemID);

    if (layers.category !== undefined)
      this.categories[handle] = layers.category;
    if (layers.mask !== undefined) this.masks[handle] = layers.mask;
  }

  getLayers(itemID: string): Required<ILayers> {
    const handle = this.handleOf(itemID);

    return { category: this.categories[handle], mask: this.masks[handle] };
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

    let userFilter: ((item: string, other: string) => ResponseType | false) | undefined = filter;
    let excluded: number[] | null = null;

    const checkState: ICheckState | undefined =
      filter && (filter as any)[CHECK_STATE];

    if (checkState !== undefined) {
      excluded = checkState.excluded;
      userFilter = checkState.filter;
    }

    const callFilter = userFilter !== undefined && userFilter !== defaultFilter;

    const collisions: Collision[] = [];

    const own: number =
      itemID === null || itemID === undefined
        ? -1
        : (this.handles.get(itemID) ?? -1);
    const ownCategory = own < 0 ? DEFAULT_CATEGORY : this.categories[own];
    const ownMask = own < 0 ? DEFAULT_MASK : this.masks[own];

    // Bounding rect of the whole movement, in cells.
    const tl: number = _goalX !== rect.x ? Math.min(_goalX, rect.x) : _goalX;
    const tt: number = _goalY !== rect.y ? Math.min(_goalY, rect.y) : _goalY;

    const tr: number =
      _goalX !== rect.x
        ? Math.max(_goalX + rect.w, rect.x + rect.w)
        : _goalX + rect.w;
    const tb: number =
      _goalY !== rect.y
        ? Math.max(_goalY + rect.h, rect.y + rect.h)
        : _goalY + rect.h;

    const cellSize = this.cellSize;
    const cx1: number = Math.floor(tl / cellSize) + 1;
    const cy1: number = Math.floor(tt / cellSize) + 1;
    // `tl + (tr - tl)`, not `tr`: it can round differently, and the cell range
    // has to match the one grid_toCellRect produced before.
    const cxEnd: number = Math.ceil((tl + (tr - tl)) / cellSize);
    const cyEnd: number = Math.ceil((tt + (tb - tt)) / cellSize);

    const rows = this.rows;
    const boxes = this.boxes;
    const categories = this.categories;
    const masks = this.masks;
    const names = this.names;

    const marks = this.beginVisit();
    const epoch = this.currentEpoch();

    if (own >= 0) marks[own] = epoch;

    try {
      for (let cy = cy1; cy <= cyEnd; cy++) {
        const row: Cell[] = rows[cy];

        if (!row) continue;

        for (let cx = cx1; cx <= cxEnd; cx++) {
          const cell = row[cx];

          if (!cell) continue;

          const items = cell.items;

          for (let k = 0; k < items.length; k++) {
            const other = items[k];

            if (marks[other] === epoch) continue;

            marks[other] = epoch;

            if (excluded !== null && excluded.includes(other)) continue;

            if (
              (ownMask & categories[other]) === 0 ||
              (masks[other] & ownCategory) === 0
            )
              continue;

            const responseName: ResponseType | false = callFilter
              ? userFilter!(itemID!, names[other]!)
              : 'slide';

            if (responseName === false) continue;

            const b = other << 2;

            const collision: Partial<Collision> | undefined = detectCollision(
              rect,
              boxes[b],
              boxes[b + 1],
              boxes[b + 2],
              boxes[b + 3],
              null,
              _goalX,
              _goalY
            );

            if (collision) {
              collision.other = names[other];
              collision.item = itemID;
              collision.type = responseName;

              collisions.push(collision as Collision);
            }
          }
        }
      }
    } finally {
      this.endVisit();
    }

    if (collisions.length > 1) collisions.sort(sortByTiAndDistance);

    return collisions;
  }

  countCells(): number {
    let count = 0;

    for (const row of this.rows) {
      if (!row) continue;

      for (const _col of row) if (_col) count++;
    }

    return count;
  }

  hasItem(item: string): boolean {
    return this.handles.has(item);
  }

  getItems(): IRect[] {
    const items: IRect[] = [];

    for (const handle of this.handles.values())
      items.push(this.rectOf(handle));

    return items;
  }

  countItems(): number {
    return this.handles.size;
  }

  private addToCells(
    handle: number,
    cx1: number,
    cy1: number,
    cx2: number,
    cy2: number
  ): void {
    for (let cy = cy1; cy <= cy2; cy++) {
      let row = this.rows[cy];

      if (!row) {
        row = [];
        this.rows[cy] = row;
      }

      for (let cx = cx1; cx <= cx2; cx++) {
        let cell = row[cx];

        if (!cell) {
          cell = { ID: `Cell_${cx}:${cy}`, x: cx, y: cy, items: [] };
          row[cx] = cell;
        }

        cell.items.push(handle);
      }
    }
  }

  private removeFromCells(
    handle: number,
    cx1: number,
    cy1: number,
    cx2: number,
    cy2: number
  ): void {
    for (let cy = cy1; cy <= cy2; cy++) {
      const row = this.rows[cy];

      if (!row) continue;

      for (let cx = cx1; cx <= cx2; cx++) {
        const cell = row[cx];

        if (cell) removeFromCell(cell.items, handle);
      }
    }
  }

  /* Returns a copy: mutating it does not move the item. */
  getRect(itemID: string): IRect {
    return this.rectOf(this.handleOf(itemID));
  }

  // Optimized version of getDictItemsInCellRect only used in
  // queryPoint, made to avoid an unneeded object creation.
  getItemsInCellPoint(x: number, y: number): IItemInfo['item'][] {
    const row = this.rows[y];
    if (!row) return [];

    const cell = row[x];
    if (!cell?.items?.length) return [];

    const names = this.names;

    return cell.items.map(handle => names[handle]!);
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
    filter?: QueryFilter
  ): string[] {
    assertIsRect(x, y, w, h);

    const cellSize = this.cellSize;
    const cx1: number = Math.floor(x / cellSize) + 1;
    const cy1: number = Math.floor(y / cellSize) + 1;
    const cxEnd: number = Math.ceil((x + w) / cellSize);
    const cyEnd: number = Math.ceil((y + h) / cellSize);

    const fn = typeof filter === 'function' ? filter : null;
    const layerMask = typeof filter === 'number' ? filter : DEFAULT_MASK;

    const items: string[] = [];
    const rows = this.rows;
    const boxes = this.boxes;
    const categories = this.categories;
    const names = this.names;

    // An item straddling several cells is reachable from each of them, so it
    // has to be deduped, but only when the query spans more than one cell.
    const dedupe = cxEnd > cx1 || cyEnd > cy1;
    const marks = this.beginVisit();
    const epoch = this.currentEpoch();

    try {
      for (let cy = cy1; cy <= cyEnd; cy++) {
        const row: Cell[] = rows[cy];

        if (!row) continue;

        for (let cx = cx1; cx <= cxEnd; cx++) {
          const cell = row[cx];

          if (!cell) continue;

          const cellItems = cell.items;

          for (let k = 0; k < cellItems.length; k++) {
            const handle = cellItems[k];

            if (dedupe) {
              if (marks[handle] === epoch) continue;

              marks[handle] = epoch;
            }

            if ((categories[handle] & layerMask) === 0) continue;

            const itemID = names[handle]!;

            if (fn !== null && !fn(itemID)) continue;

            const b = handle << 2;
            const ox = boxes[b];
            const oy = boxes[b + 1];

            if (
              x < ox + boxes[b + 2] &&
              ox < x + w &&
              y < oy + boxes[b + 3] &&
              oy < y + h
            )
              items.push(itemID);
          }
        }
      }
    } finally {
      this.endVisit();
    }

    return items;
  }

  queryPoint(x: number, y: number, filter?: QueryFilter): string[] {
    const cellSize = this.cellSize;
    const cx: number = Math.floor(x / cellSize) + 1;
    const cy: number = Math.floor(y / cellSize) + 1;

    const items: string[] = [];

    const row: Cell[] = this.rows[cy];

    if (!row) return items;

    const cell = row[cx];

    if (!cell) return items;

    const fn = typeof filter === 'function' ? filter : null;
    const layerMask = typeof filter === 'number' ? filter : DEFAULT_MASK;

    const cellItems = cell.items;
    const boxes = this.boxes;
    const categories = this.categories;
    const names = this.names;

    for (let k = 0; k < cellItems.length; k++) {
      const handle = cellItems[k];

      if ((categories[handle] & layerMask) === 0) continue;

      const itemID = names[handle]!;

      if (fn !== null && !fn(itemID)) continue;

      const b = handle << 2;
      const rx = boxes[b];
      const ry = boxes[b + 1];

      // rect_containsPoint, inlined.
      if (
        x - rx > DELTA &&
        y - ry > DELTA &&
        rx + boxes[b + 2] - x > DELTA &&
        ry + boxes[b + 3] - y > DELTA
      )
        items.push(itemID);
    }

    return items;
  }

  /*
   * Walks the cells a segment crosses and collects the items it actually
   * intersects, in one pass. A cell the traversal reaches twice is rescanned,
   * but its items are already marked, so it costs a few integer compares.
   */
  private itemsTouchedBySegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filter?: QueryFilter
  ): IItemInfo[] {
    const itemInfo: IItemInfo[] = [];
    const seg = segScratchSegment;
    const rows = this.rows;
    const boxes = this.boxes;
    const categories = this.categories;
    const names = this.names;

    const fn = typeof filter === 'function' ? filter : null;
    const layerMask = typeof filter === 'number' ? filter : DEFAULT_MASK;

    const marks = this.beginVisit();
    const epoch = this.currentEpoch();

    try {
      grid_traverse(
        this.cellSize,
        x1,
        y1,
        x2,
        y2,
        function (cx: number, cy: number) {
          const row: Cell[] = rows[cy];

          if (!row) return;

          const cell = row[cx];

          if (!cell) return;

          const cellItems = cell.items;

          for (let k = 0; k < cellItems.length; k++) {
            const handle = cellItems[k];

            if (marks[handle] === epoch) continue;

            marks[handle] = epoch;

            if ((categories[handle] & layerMask) === 0) continue;

            const itemID = names[handle]!;

            if (fn !== null && !fn(itemID)) continue;

            const b = handle << 2;
            const rx = boxes[b];
            const ry = boxes[b + 1];
            const rw = boxes[b + 2];
            const rh = boxes[b + 3];

            if (!segmentIntersection(seg, rx, ry, rw, rh, x1, y1, x2, y2, 0, 1))
              continue;

            const ti1 = seg[0];
            const ti2 = seg[1];

            if (
              !isNaN(ti1) &&
              ((0 < ti1 && ti1 < 1) || (0 < ti2 && ti2 < 1))
            ) {
              // The sorting is according to the t of an infinite line, not
              // the segment.
              if (
                !segmentIntersection(
                  seg,
                  rx,
                  ry,
                  rw,
                  rh,
                  x1,
                  y1,
                  x2,
                  y2,
                  -Number.MAX_SAFE_INTEGER,
                  Number.MAX_SAFE_INTEGER
                )
              )
                continue;

              itemInfo.push({
                item: itemID,
                ti1,
                ti2,
                weight: Math.min(seg[0] || 0, seg[1] || 0),
              });
            }
          }
        }
      );
    } finally {
      this.endVisit();
    }

    if (itemInfo.length > 1) itemInfo.sort(sortByWeight);

    return itemInfo;
  }

  querySegment(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filter?: QueryFilter
  ): string[] {
    const itemsInfo = this.itemsTouchedBySegment(x1, y1, x2, y2, filter);

    const items: string[] = [];

    for (let i = 0; i < itemsInfo.length; i++) items.push(itemsInfo[i].item);

    return items;
  }

  querySegmentWithCoords(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    filter?: QueryFilter
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
    const itemInfo: any[] = this.itemsTouchedBySegment(
      x1,
      y1,
      x2,
      y2,
      filter
    );

    const dx: number = x2 - x1;
    const dy: number = y2 - y1;

    for (const info of itemInfo) {
      const ti1: number = info.ti1;
      const ti2: number = info.ti2;

      info.weight = null;
      info.x1 = x1 + dx * ti1;
      info.y1 = y1 + dy * ti1;
      info.x2 = x1 + dx * ti2;
      info.y2 = y1 + dy * ti2;
    }

    return itemInfo;
  }

  public add(
    itemID: string,
    x: number,
    y: number,
    w: number,
    h: number,
    layers?: ILayers
  ): string {
    if (this.handles.has(itemID))
      throw new Error(`Item "${itemID}" added to the world twice.`);

    assertIsRect(x, y, w, h);

    let handle: number;

    if (this.freeHandles.length > 0) handle = this.freeHandles.pop()!;
    else {
      handle = this.nextHandle++;

      if (handle >= this.capacity) this.grow();
    }

    this.handles.set(itemID, handle);
    this.names[handle] = itemID;

    const b = handle << 2;
    this.boxes[b] = x;
    this.boxes[b + 1] = y;
    this.boxes[b + 2] = w;
    this.boxes[b + 3] = h;

    this.categories[handle] = layers?.category ?? DEFAULT_CATEGORY;
    this.masks[handle] = layers?.mask ?? DEFAULT_MASK;

    const cellSize = this.cellSize;

    this.addToCells(
      handle,
      Math.floor(x / cellSize) + 1,
      Math.floor(y / cellSize) + 1,
      Math.ceil((x + w) / cellSize),
      Math.ceil((y + h) / cellSize)
    );

    return itemID;
  }

  remove(itemID: string): void {
    const handle = this.handleOf(itemID);
    const b = handle << 2;
    const boxes = this.boxes;
    const x = boxes[b];
    const y = boxes[b + 1];
    const cellSize = this.cellSize;

    this.removeFromCells(
      handle,
      Math.floor(x / cellSize) + 1,
      Math.floor(y / cellSize) + 1,
      Math.ceil((x + boxes[b + 2]) / cellSize),
      Math.ceil((y + boxes[b + 3]) / cellSize)
    );

    this.handles.delete(itemID);
    this.names[handle] = undefined;
    this.freeHandles.push(handle);
  }

  update(
    itemID: string,
    x2: number,
    y2: number,
    w2?: number,
    h2?: number
  ): void {
    const handle = this.handleOf(itemID);
    const boxes = this.boxes;
    const b = handle << 2;

    const x1 = boxes[b];
    const y1 = boxes[b + 1];
    const w1 = boxes[b + 2];
    const h1 = boxes[b + 3];

    // `w2 === undefined` first: the omitted-argument case is by far the common
    // one, and it avoids isNaN's ToNumber coercion. Explicit NaN still falls
    // back, as before.
    w2 = w2 === undefined || isNaN(w2) ? w1 : w2;
    h2 = h2 === undefined || isNaN(h2) ? h1 : h2;

    assertIsRect(x2, y2, w2, h2);

    if (x1 == x2 && y1 == y2 && w1 == w2 && h1 == h2) return;

    const cellSize = this.cellSize;

    // Old and new cell ranges, inclusive.
    const cl1 = Math.floor(x1 / cellSize) + 1;
    const ct1 = Math.floor(y1 / cellSize) + 1;
    const cr1 = Math.ceil((x1 + w1) / cellSize);
    const cb1 = Math.ceil((y1 + h1) / cellSize);

    const cl2 = Math.floor(x2 / cellSize) + 1;
    const ct2 = Math.floor(y2 / cellSize) + 1;
    const cr2 = Math.ceil((x2 + w2) / cellSize);
    const cb2 = Math.ceil((y2 + h2) / cellSize);

    if (cl1 != cl2 || ct1 != ct2 || cr1 != cr2 || cb1 != cb2) {
      const rows = this.rows;
      let cyOut: boolean;

      for (let cy = ct1; cy <= cb1; cy++) {
        cyOut = cy < ct2 || cy > cb2;

        const row = rows[cy];

        if (!row) continue;

        for (let cx = cl1; cx <= cr1; cx++)
          if (cyOut || cx < cl2 || cx > cr2) {
            const cell = row[cx];

            if (cell) removeFromCell(cell.items, handle);
          }
      }

      for (let cy = ct2; cy <= cb2; cy++) {
        cyOut = cy < ct1 || cy > cb1;

        for (let cx = cl2; cx <= cr2; cx++)
          if (cyOut || cx < cl1 || cx > cr1)
            this.addToCells(handle, cx, cy, cx, cy);
      }
    }

    boxes[b] = x2;
    boxes[b + 1] = y2;
    boxes[b + 2] = w2;
    boxes[b + 3] = h2;
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
    const handles = this.handles;

    const itemRect: IRect = this.getRect(itemID);

    // Handles already resolved in this check, starting with the item itself.
    const excluded: number[] = [handles.get(itemID)!];

    // Custom responses may call this directly; `project` instead reads the
    // attached state and skips both the closure and the ID lookups.
    const visitedFilter = (item: string, other: string) =>
      excluded.includes(handles.get(other)!) ? false : checkFilter(item, other);

    (visitedFilter as any)[CHECK_STATE] = {
      excluded,
      filter: checkFilter,
    } as ICheckState;

    const detectedCollisions: Collision[] = [];

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

      excluded.push(handles.get(collision.other)!);

      const response = this.getResponseByName(collision.type!);

      const { x, y, collisions } = response(
        this,
        collision,
        itemRect,
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
  newWorld: function (cellSize: number): World {
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
