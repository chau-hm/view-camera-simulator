export type MessageShape<T> = {
  [K in keyof T]: T[K] extends Record<string, unknown> ? MessageShape<T[K]> : string;
};
