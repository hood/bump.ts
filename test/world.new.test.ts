import Bump from '../src/index';

describe('World (new tests)', () => {
  it('should properly evaluate next position if moving through obstacles', () => {
    const world = Bump.newWorld(64);

    const a = world.add('a', 0, 4, 2, 2);
    const b = world.add('b', 2, 4, 2, 2);

    const nextPosition = world.move(a, 4, 4, () => 'slide');

    expect(nextPosition.x).toEqual(0);
    expect(nextPosition.y).toEqual(4);
  });
});
