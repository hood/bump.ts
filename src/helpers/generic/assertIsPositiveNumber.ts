export default function assertIsPositiveNumber(
  value: number,
  name: string
): void {
  if (isNaN(value) || value <= 0)
    throw new Error(
      `"${name}" must be a positive integer, but was ${value} (${typeof value})`
    );
}
