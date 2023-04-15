export function memoizeWithCustomSerializer<T extends (...args: any[]) => any>(
  fn: T,
  serializer: (...args: any[]) => any
): T {
  const cache = new Map();

  return ((...args: any[]) => {
    const key = serializer(...args);

    if (cache.has(key)) return cache.get(key);

    const result = fn(...args);

    cache.set(key, result);

    return result;
  }) as T;
}
