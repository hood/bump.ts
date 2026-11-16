import assertIsPositiveNumber from './assertIsPositiveNumber.js';
import assertType from './assertType.js';

export default function assertIsRect(
  x: number,
  y: number,
  w: number,
  h: number
): void {
  assertType('number', x, 'x');
  assertType('number', y, 'y');
  assertIsPositiveNumber(w, 'w');
  assertIsPositiveNumber(h, 'h');
}
