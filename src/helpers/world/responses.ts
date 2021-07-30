import { World } from '../../index';

// type ResponseType = (
//   world: World,
//   col: any,
//   x: number,
//   y: number,
//   w: number,
//   h: number,
//   goalX: number,
//   goalY: number,
//   filter: any
// ) => [number, number, any, number];

export function touch(
  _world: World,
  col: any,
  _x: number,
  _y: number,
  _w: number,
  _h: number,
  _goalX: number,
  _goalY: number,
  _filter: any
): { x: number; y: number; collisions: any[] } {
  return { x: col.touch.x, y: col.touch.y, collisions: [] };
}

export function cross(
  world: any,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter: any
): { x: number; y: number; collisions: any[] } {
  const collisions = world.project(col.item, x, y, w, h, goalX, goalY, filter);

  return { x: goalX, y: goalY, collisions };
}

export function slide(
  world: World,
  col: any,
  x: number,
  y: number,
  w: number,
  h: number,
  goalX: number,
  goalY: number,
  filter?: any
): { x: number; y: number; collisions: any[] } {
  goalX = goalX || x;
  goalY = goalY || y;

  let [tch, move] = [col.touch, col.move];

  if (move.x != 0 || move.y != 0)
    if (col.normal.x != 0) goalX = tch.x;
    else goalY = tch.y;

  col.slide = { x: goalX, y: goalY };

  x = tch.x;
  y = tch.y;

  let cols = world.project(col.item, x, y, w, h, goalX, goalY, filter);

  return { x: goalX, y: goalY, collisions: cols };
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
): { x: number; y: number; collisions: any[] } {
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
