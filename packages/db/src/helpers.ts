/** Drizzle's `.returning()` types as `T[]`, so this makes the "always exactly one row" case ergonomic. */
export async function one<T>(rows: Promise<T[]> | T[]): Promise<T> {
  const resolved = await rows;
  const [row] = resolved;
  if (!row) throw new Error("Expected exactly one row, got none");
  return row;
}
