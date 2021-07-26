import assertIsPositiveNumber from '../../../src/helpers/generic/assertIsPositiveNumber';

describe('assertIsPositiveNumber helper function', () => {
  it('should properly assert a number is positive', () => {
    expect(() => assertIsPositiveNumber(1, 'One')).not.toThrow();
    expect(() => assertIsPositiveNumber(-1, 'Minus one')).toThrow();
    expect(() => assertIsPositiveNumber(0, 'Zero')).toThrow();
  });
});
