export default function assertType(desiredType: string, value: any, name: string): void {
  if (typeof value !== desiredType)
    throw new Error(
      `"${name}" must be a ${desiredType}, but was a ${value} (${typeof value})`
    );
}
