import Bump from '../src/index';

function collect(list: any[], fieldName: string): any[] {
  return list.map((item) => item[fieldName]);
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

      expect(world.getRect(worldItemID)).toEqual({
        x: 40,
        y: 40,
        w: 20,
        h: 20,
      });
    });

    it('should use previous width and height if not provided', () => {
      const world = Bump.newWorld(64);

      const worldItemID: string = world.add('TEST_ITEM', 0, 0, 10, 10);

      world.update(worldItemID, 5, 5);

      expect(world.getRect(worldItemID)).toEqual({ x: 5, y: 5, w: 10, h: 10 });
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

    it('should return a list of collisions when the world is not empty', () => {
      const world = Bump.newWorld(64);

      world.add('TEST_ITEM1', 0, 0, 10, 10);
      world.add('TEST_ITEM2', 14, 16, 10, 10);

      expect(world.project('-', 4, 6, 10, 10).length).toEqual(1);
    });

    it('still handles intersections as before when next future X & Y are passed', () => {
      const world = Bump.newWorld(64);

      world.add('TEST_ITEM', 0, 0, 2, 2);

      expect(world.project(null, 1, 1, 2, 2, 1, 1).length).toEqual(1);
    });

    it('should return list of collisions sorted by ti', () => {
      const world = Bump.newWorld(64);

      world.add('TEST_ITEM1', 70, 0, 10, 10);
      world.add('TEST_ITEM2', 50, 0, 10, 10);
      world.add('TEST_ITEM3', 90, 0, 10, 10);

      const collisions = world.project('_', 110, 0, 10, 10, 10, 0);

      expect(collect(collisions, 'ti')).toEqual([0.1, 0.3, 0.5]);
    });
  });

  describe('remove', () => {
    it("should throw an error if the item doesn't exist", () => {
      const world = Bump.newWorld(64);

      expect(() => world.remove('TEST_ITEM')).toThrow();
    });

    it('should make an item disappear from the world', () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM', 0, 0, 10, 10);

      expect(world.project('-', 5, 0, 1, 1).length).toEqual(1);

      world.remove(itemID);

      expect(world.project('-', 5, 0, 1, 1).length).toEqual(0);
    });

    it("should remove the item ID from the world's rect's keys", () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM', 0, 0, 10, 10);

      expect(world['rects'].hasOwnProperty(itemID)).toBe(true);

      world.remove(itemID);

      expect(world['rects'].hasOwnProperty(itemID)).toBe(false);
    });

    it("should remove the item ID from the containing world's cell", () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM', 0, 0, 10, 10);

      expect(
        world['rows'].some((cols) =>
          cols.some((cell) => cell.items.hasOwnProperty(itemID))
        )
      ).toBe(true);

      world.remove(itemID);

      expect(
        world['rows'].some((cols) =>
          cols.some((cell) => cell.items.hasOwnProperty(itemID))
        )
      ).toBe(false);
    });
  });

  describe('toCell', () => {
    it('should return the coordinates of the cell containing a point', () => {
      const world = Bump.newWorld(64);

      expect(world.toCell(0, 0)).toEqual([1, 1]);
      expect(world.toCell(63.9, 63.9)).toEqual([1, 1]);
      expect(world.toCell(64, 64)).toEqual([2, 2]);
      expect(world.toCell(-1, -1)).toEqual([0, 0]);
    });
  });

  describe('toWorld', () => {
    it('should return the left and top corners of the given cell', () => {
      const world = Bump.newWorld(64);

      expect(world.toWorld(1, 1)).toEqual([0, 0]);
      expect(world.toWorld(2, 2)).toEqual([64, 64]);
      expect(world.toWorld(-1, 1)).toEqual([-128, 0]);
    });
  });

  describe('queryRect', () => {
    it('should throw an error when given an invalid rect', () => {
      const world = Bump.newWorld(64);

      expect(() => world.queryRect(0, 0, -1, -1)).toThrow();
    });

    it('should should return nothing in an empty world', () => {
      const world = Bump.newWorld(64);

      expect(world.queryRect(0, 0, 1, 1)).toEqual([]);
    });

    it('should return the items inside or partially inside the given rect when the world has items', () => {
      const world = Bump.newWorld(64);

      const a = world.add('a', 10, 0, 10, 10);
      const b = world.add('b', 70, 0, 10, 10);
      const c = world.add('c', 50, 0, 10, 10);
      const d = world.add('d', 90, 0, 10, 10);

      expect(world.queryRect(55, 5, 20, 20, () => true)).toEqual(['c', 'b']);
      expect(world.queryRect(0, 5, 100, 20)).toEqual(['a', 'c', 'b', 'd']);
    });

    it('should only return the items for which the given filter returns true when the world has items', () => {
      const world = Bump.newWorld(64);

      const filter = (other?: string) =>
        other === 'a' || other === 'b' || other === 'd';

      const a = world.add('a', 10, 0, 10, 10);
      const b = world.add('b', 70, 0, 10, 10);
      const c = world.add('c', 50, 0, 10, 10);
      const d = world.add('d', 90, 0, 10, 10);

      expect(world.queryRect(55, 5, 20, 20, filter)).toEqual(['b']);
      expect(world.queryRect(0, 5, 100, 20, filter)).toEqual(['a', 'b', 'd']);
    });
  });

  describe('queryPoint', () => {
    it('should return nothing in an empty world', () => {
      const world = Bump.newWorld(64);

      expect(world.queryPoint(0, 0)).toEqual([]);
    });

    it('should return the items inside or partially inside the given rect when the world has items', () => {
      const world = Bump.newWorld(64);
    });
  });

  // describe('hasItem', () => {});

  describe('querySegment', () => {
    it('should return nothing when the world is empty', () => {
      const world = Bump.newWorld(64);

      expect(world.querySegment(0, 0, 1, 1)).toEqual([]);
    });

    it('should not touch borders', () => {
      const world = Bump.newWorld(64);

      world.add('a', 10, 0, 5, 5);
      world.add('b', 20, 0, 5, 5);

      expect(world.querySegment(0, 5, 10, 0)).toEqual([]);
      expect(world.querySegment(15, 5, 20, 0)).toEqual([]);
      expect(world.querySegment(26, 5, 25, 0)).toEqual([]);
    });

    it('should return the items touched by the segment, sorder by touch order', () => {
      const world = Bump.newWorld(64);

      world.add('a', 5, 0, 5, 10);
      world.add('b', 15, 0, 5, 10);
      world.add('c', 25, 0, 5, 10);

      expect(world.querySegment(0, 5, 11, 5)).toEqual(['a']);
      expect(world.querySegment(0, 5, 17, 5)).toEqual(['a', 'b']);
      expect(world.querySegment(0, 5, 30, 5)).toEqual(['a', 'b', 'c']);
      expect(world.querySegment(17, 5, 26, 5)).toEqual(['b', 'c']);
      expect(world.querySegment(22, 5, 26, 5)).toEqual(['c']);

      expect(world.querySegment(11, 5, 0, 5)).toEqual(['a']);
      expect(world.querySegment(17, 5, 0, 5)).toEqual(['b', 'a']);
      expect(world.querySegment(30, 5, 0, 5)).toEqual(['c', 'b', 'a']);
      expect(world.querySegment(26, 5, 17, 5)).toEqual(['c', 'b']);
      expect(world.querySegment(26, 5, 22, 5)).toEqual(['c']);
    });

    it('should filter out items when filter does not return true for them', () => {
      const world = Bump.newWorld(64);

      const a = world.add('a', 5, 0, 5, 10);
      const b = world.add('b', 15, 0, 5, 10);
      const c = world.add('c', 25, 0, 5, 10);

      const filter = (other: any) => other != a && other != c;

      expect(world.querySegment(0, 5, 11, 5, filter)).toEqual([]);
      expect(world.querySegment(0, 5, 17, 5, filter)).toEqual(['b']);
      expect(world.querySegment(0, 5, 30, 5, filter)).toEqual(['b']);
      expect(world.querySegment(17, 5, 26, 5, filter)).toEqual(['b']);
      expect(world.querySegment(22, 5, 26, 5, filter)).toEqual([]);

      expect(world.querySegment(11, 5, 0, 5, filter)).toEqual([]);
      expect(world.querySegment(17, 5, 0, 5, filter)).toEqual(['b']);
      expect(world.querySegment(30, 5, 0, 5, filter)).toEqual(['b']);
      expect(world.querySegment(26, 5, 17, 5, filter)).toEqual(['b']);
      expect(world.querySegment(26, 5, 22, 5, filter)).toEqual([]);
    });
  });

  describe('getItems', () => {
    it('should return all the items in the world', () => {
      const world = Bump.newWorld(64);

      world.add('a', 1, 1, 1, 1);
      world.add('b', 2, 2, 2, 2);

      expect(world.getItems()).toEqual([
        { x: 1, y: 1, w: 1, h: 1 },
        { x: 2, y: 2, w: 2, h: 2 },
      ]);
      expect(world.getItems().length).toEqual(2);
    });
  });

  describe('countItems', () => {
    it('should count the items in the world', () => {
      const world = Bump.newWorld(64);

      world.add('a', 1, 1, 1, 1);
      world.add('b', 2, 2, 2, 2);

      expect(world.countItems()).toEqual(2);
    });
  });

  describe('move', () => {
    it('should move an item and return no collisions when there are no collisions', () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM', 0, 0, 1, 1);

      expect(world.move(itemID, 1, 1)).toEqual({ x: 1, y: 1, collisions: [] });
    });

    it('when touching should return a collision with the first item a moved item touches', () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM1', 0, 0, 1, 1);
      world.add('TEST_ITEM2', 0, 2, 1, 1);
      world.add('TEST_ITEM3', 0, 3, 1, 1);

      const { x, y, collisions } = world.move(itemID, 0, 5, () => 'touch');

      expect(x).toEqual(0);
      expect(y).toEqual(1);
      expect(collect(collisions, 'other')).toEqual(['TEST_ITEM2']);
      expect(collect(collisions, 'type')).toEqual(['touch']);
      expect(world.getRect(itemID)).toEqual({ x: 0, y: 1, w: 1, h: 1 });
    });

    it('when crossing should return a collision with every item it crosses', () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM1', 0, 0, 1, 1);
      world.add('TEST_ITEM2', 0, 2, 1, 1);
      world.add('TEST_ITEM3', 0, 3, 1, 1);

      const { x, y, collisions } = world.move(itemID, 0, 5, () => 'cross');

      expect(x).toEqual(0);
      expect(y).toEqual(5);
      expect(collect(collisions, 'other')).toEqual([
        'TEST_ITEM2',
        'TEST_ITEM3',
      ]);
      expect(collect(collisions, 'type')).toEqual(['cross', 'cross']);
      expect(world.getRect(itemID)).toEqual({ x: 0, y: 5, w: 1, h: 1 });
    });

    it('when sliding should slide with every element', () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM1', 0, 0, 1, 1);
      world.add('TEST_ITEM2', 0, 2, 1, 2);
      world.add('TEST_ITEM3', 2, 1, 1, 1);

      const { x, y, collisions } = world.move(itemID, 5, 5, () => 'slide');

      expect(x).toEqual(1);
      expect(y).toEqual(5);
      expect(collect(collisions, 'other')).toEqual(['TEST_ITEM3']);
      expect(collect(collisions, 'type')).toEqual(['slide']);
      expect(world.getRect(itemID)).toEqual({ x: 1, y: 5, w: 1, h: 1 });
    });

    it('when bouncing should bounce on each element', () => {
      const world = Bump.newWorld(64);

      const itemID = world.add('TEST_ITEM1', 0, 0, 1, 1);
      world.add('TEST_ITEM2', 0, 2, 1, 2);

      const { x, y, collisions } = world.move(itemID, 0, 5, () => 'bounce');

      expect(x).toEqual(0);
      expect(y).toEqual(-3);
      expect(collect(collisions, 'other')).toEqual(['TEST_ITEM2']);
      expect(collect(collisions, 'type')).toEqual(['bounce']);
      expect(world.getRect(itemID)).toEqual({ x: 0, y: -3, w: 1, h: 1 });
    });
  });
});
