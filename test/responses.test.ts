import Bump from '../src/index';
import { rect_detectCollision } from '../src/rect';

const world = Bump.newWorld(64);

function touch(
  x: number,
  y: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  goalX?: number,
  goalY?: number
) {
  const collision = rect_detectCollision(
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

  return [
    collision!.touch!.x,
    collision!.touch!.y,
    collision!.normal!.x,
    collision!.normal!.y,
  ];
}

function slide(
  x: number,
  y: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  goalX?: number,
  goalY?: number
) {
  const collision = rect_detectCollision(
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

  // @ts-ignore
  Bump.responses.slide(world, collision, x, y, w, h, goalX!, goalY!);

  return [
    collision!.touch!.x,
    collision!.touch!.y,
    collision!.normal!.x,
    collision!.normal!.y,
    collision!['slide']!.x!,
    collision!['slide']!.y!,
  ];
}

function bounce(
  x: number,
  y: number,
  w: number,
  h: number,
  ox: number,
  oy: number,
  ow: number,
  oh: number,
  goalX?: number,
  goalY?: number
) {
  const collision = rect_detectCollision(
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

  Bump.responses.bounce(world, collision, x, y, w, h, goalX, goalY);

  return [
    collision!.touch!.x,
    collision!.touch!.y,
    collision!.normal!.x,
    collision!.normal!.y,
    collision!['bounce']!.x!,
    collision!['bounce']!.y!,
  ];
}

describe('responses', () => {
  describe('touch', () => {
    it('should return the left ,top coordinates of the minimum displacement on static items when there is no movement when resolvicng collisions on overlaps', () => {
      //                                          -2-1 0 1 2 3 4 5 6 7 8 9 10
      //      -2 -1 0 1 2 3 4 5 6 7 8 9           -2 · ┌–––┐ · ┌–––┐ · ┌–––┐ ·
      //      -1  ┌–––┐ · ┌–––┐ · ┌–––┐           -1 · │0-1│ · │0-1│ · │0-1│ ·
      //       0  │ ┌–––––––––––––––┐ │ 1  2  3    0 · └–┌–––––––––––––––┐–┘ ·
      //       1  └–│–┘ · └–––┘ · └–│–┘            1 · · │ · · · · · · · │ · ·
      //       2  · │ · · · · · · · │ ·            2 · · │ · · · · · · · │ · ·
      //       3  ┌–│–┐ · ┌–––┐ · ┌–│–┐            3 ┌–––│ · · · · · · · │–––┐
      //       4  │ │ │ · │ · │ · │ │ │ 4  5  6    4 -1 0│ · · · · · · · │1 0│
      //       5  └–│–┘ · └–––┘ · └–│–┘            5 └–––│ · · · · · · · │–––┘
      //       6  · │ · · · · · · · │ ·            6 · · │ · · · · · · · │ · ·
      //       7  ┌–│–┐ · ┌–––┐ · ┌–│–┐            7 · · │ · · · · · · · │ · ·
      //       8  │ └–––––––––––––––┘ │ 7  8  9    8 · ┌–└–––––––––––––––┘–┐ ·
      //       9  └–––┘ · └–––┘ · └–––┘            9 · │0 1│ · ╎0 1╎ · │0 1│ ·
      //      10                                  10 · └–––┘ · └╌╌╌┘ · └–––┘ ·

      expect(touch(-1, -1, 2, 2, 0, 0, 8, 8)).toEqual([-1, -2, 0, -1]); // 1
      expect(touch(3, -1, 2, 2, 0, 0, 8, 8)).toEqual([3, -2, 0, -1]); // 2
      expect(touch(7, -1, 2, 2, 0, 0, 8, 8)).toEqual([7, -2, 0, -1]); // 3

      expect(touch(-1, 3, 2, 2, 0, 0, 8, 8)).toEqual([-2, 3, -1, 0]); // 4
      expect(touch(3, 3, 2, 2, 0, 0, 8, 8)).toEqual([3, 8, 0, 1]); // 5
      expect(touch(7, 3, 2, 2, 0, 0, 8, 8)).toEqual([8, 3, 1, 0]); // 6

      expect(touch(-1, 7, 2, 2, 0, 0, 8, 8)).toEqual([-1, 8, 0, 1]); // 7
      expect(touch(3, 7, 2, 2, 0, 0, 8, 8)).toEqual([3, 8, 0, 1]); // 8
      expect(touch(7, 7, 2, 2, 0, 0, 8, 8)).toEqual([7, 8, 0, 1]); // 9/
    });

    it('should return the left, top coordinates of the overlaps with the movement line, opposide direction, when the item is moving', () => {
      expect(touch(3, 3, 2, 2, 0, 0, 8, 8, 4, 3)).toEqual([-2, 3, -1, 0]);
      expect(touch(3, 3, 2, 2, 0, 0, 8, 8, 2, 3)).toEqual([8, 3, 1, 0]);
      expect(touch(3, 3, 2, 2, 0, 0, 8, 8, 2, 3)).toEqual([8, 3, 1, 0]);
      expect(touch(3, 3, 2, 2, 0, 0, 8, 8, 3, 4)).toEqual([3, -2, 0, -1]);
      expect(touch(3, 3, 2, 2, 0, 0, 8, 8, 3, 2)).toEqual([3, 8, 0, 1]);
    });

    it('should return the coordinates of the item when it starts touching the other, and the normal, on tunnels', () => {
      expect(touch(-3, 3, 2, 2, 0, 0, 8, 8, 3, 3)).toEqual([-2, 3, -1, 0]);
      expect(touch(9, 3, 2, 2, 0, 0, 8, 8, 3, 3)).toEqual([8, 3, 1, 0]);
      expect(touch(3, -3, 2, 2, 0, 0, 8, 8, 3, 3)).toEqual([3, -2, 0, -1]);
      expect(touch(3, 9, 2, 2, 0, 0, 8, 8, 3, 3)).toEqual([3, 8, 0, 1]);
    });
  });

  describe('slide', () => {
    it('should slide on overlaps', () => {
      expect(slide(3, 3, 2, 2, 0, 0, 8, 8, 4, 5)).toEqual([
        0.5,
        -2,
        0,
        -1,
        4,
        -2,
      ]);
      expect(slide(3, 3, 2, 2, 0, 0, 8, 8, 5, 4)).toEqual([
        -2,
        0.5,
        -1,
        0,
        -2,
        4,
      ]);
      expect(slide(3, 3, 2, 2, 0, 0, 8, 8, 2, 1)).toEqual([5.5, 8, 0, 1, 2, 8]);
      expect(slide(3, 3, 2, 2, 0, 0, 8, 8, 1, 2)).toEqual([8, 5.5, 1, 0, 8, 2]);
    });

    it('should slide over tunnels', () => {
      expect(slide(10, 10, 2, 2, 0, 0, 8, 8, 1, 4)).toEqual([7, 8, 0, 1, 1, 8]);
      expect(slide(10, 10, 2, 2, 0, 0, 8, 8, 4, 1)).toEqual([8, 7, 1, 0, 8, 1]);

      // perfect corner case:
      expect(slide(10, 10, 2, 2, 0, 0, 8, 8, 1, 1)).toEqual([8, 8, 1, 0, 8, 1]);
    });
  });

  describe('bounce', () => {
    it('should bounce on overlaps', () => {
      expect(bounce(3, 3, 2, 2, 0, 0, 8, 8, 4, 5)).toEqual([
        0.5,
        -2,
        0,
        -1,
        4,
        -9,
      ]);
      expect(bounce(3, 3, 2, 2, 0, 0, 8, 8, 5, 4)).toEqual([
        -2,
        0.5,
        -1,
        0,
        -9,
        4,
      ]);
      expect(bounce(3, 3, 2, 2, 0, 0, 8, 8, 2, 1)).toEqual([
        5.5,
        8,
        0,
        1,
        2,
        15,
      ]);
      expect(bounce(3, 3, 2, 2, 0, 0, 8, 8, 1, 2)).toEqual([
        8,
        5.5,
        1,
        0,
        15,
        2,
      ]);
    });

    it('should bounce over tunnels', () => {
      expect(bounce(10, 10, 2, 2, 0, 0, 8, 8, 1, 4)).toEqual([
        7,
        8,
        0,
        1,
        1,
        12,
      ]);
      expect(bounce(10, 10, 2, 2, 0, 0, 8, 8, 4, 1)).toEqual([
        8,
        7,
        1,
        0,
        12,
        1,
      ]);

      // perfect corner case:
      expect(bounce(10, 10, 2, 2, 0, 0, 8, 8, 1, 1)).toEqual([
        8,
        8,
        1,
        0,
        15,
        1,
      ]);
    });
  });
});
