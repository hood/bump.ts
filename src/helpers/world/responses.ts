import { Collision, ICoords, World } from '../../index';

export type Response = (
  world: World,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
) => { x: number; y: number; collisions: Collision[] };

export function touch(
  _world: World,
  column: {
    touch: ICoords;
    move: ICoords;
    normal: ICoords;
    slide: ICoords;
    item: any;
  },
  _x: number,
  _y: number,
  _w: number,
  _h: number,
  _goalX: number,
  _goalY: number,
  _filter: any
): { x: number; y: number; collisions: Collision[] } {
  return { x: column.touch.x, y: column.touch.y, collisions: [] };
}

export function cross(
  world: any,
  column: {
    touch: ICoords;
    move: ICoords;
    normal: ICoords;
    slide: ICoords;
    item: any;
  },
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
): { x: number; y: number; collisions: Collision[] } {
  const collisions = world.project(
    column.item,
    x,
    y,
    w,
    h,
    goalX,
    goalY,
    filter
  );

  return { x: goalX, y: goalY, collisions };
}

export function slide(
  world: World,
  column: {
    touch: ICoords;
    move: ICoords;
    normal: ICoords;
    slide: ICoords;
    item: any;
  },
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter?: any
): { x: number; y: number; collisions: Collision[] } {
  let _goalX: number = isNaN(goalX) ? x : goalX;
  let _goalY: number = isNaN(goalY) ? y : goalY;

  const tch: ICoords = column.touch;
  const move: ICoords = column.move;

  if (move.x !== 0 || move.y !== 0)
    if (column.normal.x !== 0) _goalX = tch.x;
    else _goalY = tch.y;

  column.slide = { x: _goalX, y: _goalY };

  const _x: number = tch.x;
  const _y: number = tch.y;

  const collisions = world.project(
    column.item,
    _x,
    _y,
    w,
    h,
    _goalX,
    _goalY,
    filter
  );

  return { x: _goalX, y: _goalY, collisions };
}

export function bounce(
  world: World,
  collision: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX?: number,
  goalY?: number,
  filter?: any
): { x: number; y: number; collisions: Collision[] } {
  const _goalX: number = isNaN(goalX as number) ? x : goalX!;
  const _goalY: number = isNaN(goalY as number) ? y : goalY!;

  const { touch, move } = collision;

  let bx = touch.x;
  let by = touch.y;

  if (move.x !== 0 || move.y !== 0) {
    let bnx = _goalX - touch.x;
    let bny = _goalY - touch.y;

    if (collision.normal.x === 0) bny = -bny;
    else bnx = -bnx;

    bx = touch.x + bnx;
    by = touch.y + bny;
  }

  collision.bounce = { x: bx, y: by };

  const collisions = world.project(
    collision.item,
    touch.x,
    touch.y,
    w,
    h,
    bx,
    by,
    filter
  );

  return { x: bx, y: by, collisions };
}
