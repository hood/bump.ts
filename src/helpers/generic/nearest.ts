export default function nearest(x: number, a: number, b: number): number {
  return Math.abs(a - x) < Math.abs(b - x) ? a : b;
}
