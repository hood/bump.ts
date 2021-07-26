import assertIsRect from '../../../src/helpers/generic/assertIsRect';

describe('assertIsRect helper function', () => {
  it('should properly assert something is a rectangle', () => {
    expect(() => assertIsRect(2, 2, 2, 2)).not.toThrow();
    expect(() => assertIsRect(2, -5455, -2, 22)).toThrow();
  });
});
