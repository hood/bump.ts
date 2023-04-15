import { Collision, ICoords, IRect, World } from '../../index';

export type Response = (
  world: World,
  col: any,
  rect: IRect,
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
  _rect: IRect,
  _goalX: number,
  _goalY: number,
  _filter: any
): ReturnType<Response> {
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
  rect: IRect,
  goalX: number,
  goalY: number,
  filter: any
): ReturnType<Response> {
  const collisions = world.project(column.item, rect, goalX, goalY, filter);

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
  rect: IRect,
  goalX: number,
  goalY: number,
  filter?: any
): ReturnType<Response> {
  let _goalX: number = goalX ?? rect.x;
  let _goalY: number = goalY ?? rect.y;

  const tch: ICoords = column.touch;
  const move: ICoords = column.move;

  if (move.x !== 0 || move.y !== 0)
    if (column.normal.x !== 0) _goalX = tch.x;
    else _goalY = tch.y;

  // TODO: What does his affect?
  column.slide = { x: _goalX, y: _goalY };

  const _x: number = tch.x;
  const _y: number = tch.y;

  const collisions = world.project(
    column.item,
    { x: _x, y: _y, w: rect.w, h: rect.h },
    _goalX,
    _goalY,
    filter
  );

  return { x: _goalX, y: _goalY, collisions };
}

export function bounce(
  world: World,
  collision: any,
  rect: IRect,
  goalX?: number,
  goalY?: number,
  filter?: any
): ReturnType<Response> {
  let _goalX: number = goalX ?? rect.x;
  let _goalY: number = goalY ?? rect.y;

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
    { x: touch.x, y: touch.y, w: rect.w, h: rect.h },
    bx,
    by,
    filter
  );

  return { x: bx, y: by, collisions };
}
