import assertIsPositiveNumber from './assertIsPositiveNumber';
import assertType from './assertType';

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
