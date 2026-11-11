import Bump from '../src/index';

const PLAYER = 1;
const WALL = 2;
const PICKUP = 4;

describe('World layers', () => {
  it('defaults to category 1 colliding with everything', () => {
    const world = Bump.newWorld(64);

    world.add('a', 0, 0, 10, 10);

    expect(world.getLayers('a')).toEqual({ category: 1, mask: 0xffffffff });
  });

  it('skips pairs whose masks do not match, in move', () => {
    const world = Bump.newWorld(64);

    world.add('player', 0, 0, 10, 10, { category: PLAYER, mask: WALL });
    world.add('wall', 20, 0, 10, 10, { category: WALL });
    world.add('coin', 12, 0, 4, 10, { category: PICKUP });

    const { x, collisions } = world.move('player', 30, 0);

    expect(collisions.map(c => c.other)).toEqual(['wall']);
    expect(x).toEqual(10);
  });

  it('requires both sides to accept the pair', () => {
    const world = Bump.newWorld(64);

    world.add('player', 0, 0, 10, 10, { category: PLAYER });
    world.add('ghost', 20, 0, 10, 10, { category: WALL, mask: PICKUP });

    expect(world.move('player', 30, 0).collisions).toEqual([]);
  });

  it('does not call the filter for masked-out pairs', () => {
    const world = Bump.newWorld(64);

    world.add('player', 0, 0, 10, 10, { mask: WALL });
    world.add('coin', 12, 0, 4, 10, { category: PICKUP });

    const seen: string[] = [];

    world.move('player', 30, 0, (_item, other) => {
      seen.push(other);
      return 'slide';
    });

    expect(seen).toEqual([]);
  });

  it('can change layers after adding', () => {
    const world = Bump.newWorld(64);

    world.add('player', 0, 0, 10, 10);
    world.add('wall', 20, 0, 10, 10);

    world.setLayers('wall', { category: PICKUP });
    world.setLayers('player', { mask: WALL });

    expect(world.move('player', 30, 0).collisions).toEqual([]);
    expect(world.getLayers('wall')).toEqual({
      category: PICKUP,
      mask: 0xffffffff,
    });
  });

  it('accepts a numeric mask as a query filter', () => {
    const world = Bump.newWorld(16);

    world.add('wall', 0, 0, 40, 40, { category: WALL });
    world.add('coin', 5, 5, 4, 4, { category: PICKUP });

    expect(world.queryRect(0, 0, 50, 50, WALL)).toEqual(['wall']);
    expect(world.queryPoint(6, 6, PICKUP)).toEqual(['coin']);
    expect(world.querySegment(-10, 7, 50, 7, PICKUP | WALL)).toEqual([
      'wall',
      'coin',
    ]);
    expect(world.querySegment(-10, 7, 50, 7, PICKUP)).toEqual(['coin']);
  });

  it('throws for unknown items', () => {
    const world = Bump.newWorld(64);

    expect(() => world.setLayers('nope', { mask: 0 })).toThrow();
    expect(() => world.getLayers('nope')).toThrow();
  });
});

describe('World handles', () => {
  it('reuses handles without leaking state from the removed item', () => {
    const world = Bump.newWorld(64);

    world.add('a', 0, 0, 10, 10, { category: PICKUP });
    world.remove('a');
    world.add('b', 100, 100, 10, 10);

    expect(world.getLayers('b')).toEqual({ category: 1, mask: 0xffffffff });
    expect(world.queryPoint(5, 5)).toEqual([]);
    expect(world.queryPoint(105, 105)).toEqual(['b']);
    expect(world.getItems()).toEqual([{ x: 100, y: 100, w: 10, h: 10 }]);
  });

  it('grows past the initial capacity', () => {
    const world = Bump.newWorld(64);

    for (let i = 0; i < 1000; i++) world.add(`i${i}`, i * 3, 0, 2, 2);

    expect(world.countItems()).toEqual(1000);
    expect(world.getRect('i999')).toEqual({ x: 2997, y: 0, w: 2, h: 2 });
    expect(world.queryRect(0, 0, 3000, 2)).toHaveLength(1000);
  });

  it('returns rect copies from getRect', () => {
    const world = Bump.newWorld(64);

    world.add('a', 0, 0, 10, 10);
    world.getRect('a').x = 500;

    expect(world.getRect('a').x).toEqual(0);
  });

  it('dedupes correctly when a filter queries the world mid-query', () => {
    const world = Bump.newWorld(8);

    world.add('big', 0, 0, 30, 30);
    world.add('other', 4, 4, 30, 30);

    const result = world.queryRect(0, 0, 40, 40, other => {
      world.queryRect(0, 0, 40, 40);
      return other !== undefined;
    });

    expect(result).toEqual(['big', 'other']);
  });

  it('dedupes correctly when a move filter queries the world', () => {
    const world = Bump.newWorld(8);

    world.add('player', 0, 0, 4, 4);
    world.add('wall', 20, 0, 30, 30);

    const { collisions } = world.move('player', 40, 0, () => {
      world.queryRect(0, 0, 60, 60);
      return 'touch';
    });

    expect(collisions.map(c => c.other)).toEqual(['wall']);
  });
});
