import nearest from '../../../src/helpers/generic/nearest';

describe('nearest helper function', () => {
  it('should properly return the nearest value', () => {
    expect(nearest(10, 9, 7)).toEqual(9);
    expect(nearest(10, 11, 13)).toEqual(11);
  });
});
