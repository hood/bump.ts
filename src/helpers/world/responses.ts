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
  _world: any,
  col: any,
  _x: number,
  _y: number,
  _w: number,
  _h: number,
  _goalX: number,
  _goalY: number,
  _filter: any
): [number, number, any, number] {
  return [col.touch.x, col.touch.y, {}, 0];
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
): [number, number, any, number] {
  const [cols, len] = world.project(col.item, x, y, w, h, goalX, goalY, filter);
  return [goalX, goalY, cols, len];
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

export function bounce(
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
