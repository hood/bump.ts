import Bump from '../src/index';

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
});
