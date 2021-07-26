import Bump from '../src/index';

function collect(list: any[], fieldName: string): any[] {
  return list.map(item => item[fieldName]);
}

describe('Bump world', () => {
  it('should properly add and check for existence of items', () => {
    const world = Bump.newWorld(64);

    world.add('TEST_ITEM', 2, 2, 2, 2);

    expect(world.hasItem('TEST_ITEM')).toBe(true);
  });

  it('should throw if adding an item with the same ID twice', () => {
    const world = Bump.newWorld(64);

    world.add('TEST_ITEM', 2, 2, 2, 2);

    expect(() => world.add('TEST_ITEM', 2, 2, 2, 2)).toThrow();
  });

  it('should create enough cells to hold an item added when the world is empty', () => {
    const world = Bump.newWorld(64);

    world.add('TEST_ITEM1', 0, 0, 10, 10); // adds one cell
    expect(world.countCells()).toEqual(1);

    world.add('TEST_ITEM2', 100, 100, 10, 10); // adds a separate single cell
    expect(world.countCells()).toEqual(2);

    world.add('TEST_ITEM3', 0, 0, 100, 10); // occupies 2 cells, but just adds one (the other is already added)
    expect(world.countCells()).toEqual(3);

    world.add('TEST_ITEM4', 0, 0, 100, 10); // occupies 2 cells, but just adds one (the other is already added)
    expect(world.countCells()).toEqual(3);

    world.add('TEST_ITEM6', 300, 300, 64, 64); // adds 8 new cells
    expect(world.countCells()).toEqual(7);
  });

  describe('update', () => {
    it('should throw an error if trying to update a non-existing item', () => {
      const world = Bump.newWorld(64);

      expect(() => world.update('TEST_ITEM', 0, 0)).toThrow();
    });

    it("should properly an item's coordinates", () => {
      const world = Bump.newWorld(64);

      const worldItemID: string = world.add('TEST_ITEM', 0, 0, 10, 10);

      world.update('TEST_ITEM', 40, 40, 20, 20);

      expect(world.getRect(worldItemID)).toEqual([40, 40, 20, 20]);
    });

    it('should use previous width and height if not provided', () => {
      const world = Bump.newWorld(64);

      const worldItemID: string = world.add('TEST_ITEM', 0, 0, 10, 10);

      world.update(worldItemID, 5, 5);

      expect(world.getRect(worldItemID)).toEqual([5, 5, 10, 10]);
    });

    it('should not invoke `remove` and `add` when an item stays in the same group of cells', () => {
      const world = Bump.newWorld(64);

      const worldItemID: string = world.add('TEST_ITEM', 0, 0, 10, 10);

      world.update(worldItemID, 1, 1, 11, 11);

      world.remove = jest.fn(world.remove);
      world.add = jest.fn(world.add);

      expect(world.remove).toHaveBeenCalledTimes(0);
      expect(world.add).toHaveBeenCalledTimes(0);
    });
  });

  describe('project', () => {
    it('should return an empty list of collisions when the world is empty', () => {
      const world = Bump.newWorld(64);

      expect(world.project('TEST_ITEM', 1, 2, 3, 4)).toEqual([]);
    });

    it.skip('FIXME: should return a list of collisions when the world is not empty', () => {
      const world = Bump.newWorld(64);

      world.add('TEST_ITEM1', 0, 0, 10, 10);
      world.add('TEST_ITEM2', 14, 16, 10, 10);

      expect(world.project('-', 4, 6, 10, 10)).toEqual([[], 1]);
    });

    // TODO: Why does it return `1` collision in the official tests (ref.: https://github.com/kikito/bump.lua/blob/7cae5d1ef796068a185d8e2d0c632a030ac8c148/spec/World_spec.lua#L116)
    //  if there's a single item in the world? What should it collide with?
    it.skip('FIXME: still handles intersections as before when next future X & Y are passed', () => {
      const world = Bump.newWorld(64);

      world.add('TEST_ITEM', 0, 0, 2, 2);

      expect(world.project('', 1, 1, 2, 2, 1, 1).length).toEqual(1);
    });

    // TODO: Figure out TS equivalent of world:move({})
    it.skip('should return list of collisions sorted by ti', () => {
      const world = Bump.newWorld(64);

      world.add('TEST_ITEM1', 70, 0, 10, 10);
      world.add('TEST_ITEM2', 50, 0, 10, 10);
      world.add('TEST_ITEM3', 90, 0, 10, 10);

      const collisions = world.project(null, 110, 0, 10, 10, 10, 0);

      expect(collect(collisions, 'ti')).toEqual([0.1, 0.3, 0.5]);
    });
  });

  describe('remove', () => {
    it("should throw an error if the item doesn't exist", () => {
      const world = Bump.newWorld(64);

      expect(() => world.remove('TEST_ITEM')).toThrow();
    });

    it.skip('should make an item disappear from the world', () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM', 0, 0, 10, 10);

      expect(world.project('TEST_ITEM', 5, 0, 1, 1).length).toEqual(1);

      world.remove(itemID);

      expect(world.project('TEST_ITEM', 5, 0, 1, 1).length).toEqual(0);
    });
  });

  // describe('toCell', () => {});

  // describe('toWorld', () => {});

  // describe('queryRect', () => {});

  // describe('queryPoint', () => {});

  // describe('querySegment', () => {});

  // describe('hasItem', () => {});

  // describe('getItems', () => {});

  // describe('countItems', () => {});

  describe('move', () => {});
});
