import assertType from '../../../src/helpers/generic/assertType';

describe('assertType helper function', () => {
  it('should properly assert types', () => {
    expect(() => assertType('number', 1, 'One')).not.toThrow();
    expect(() => assertType('string', 'Hi', 'Greeting')).not.toThrow();
    expect(() => assertType('boolean', false, 'Negation')).not.toThrow();
    expect(() => assertType('object', [], 'Empty list')).not.toThrow();
    expect(() => assertType('object', {}, 'Empty list')).not.toThrow();
  });
});
