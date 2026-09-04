// Stable ordering belongs to the caller. An explicit count also detects a server
// row cap smaller than the requested page, instead of silently dropping records.
export async function readAllPages<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown; count: number | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (;;) {
    const page = await fetchPage(rows.length, rows.length + 499);
    if (page.error) throw page.error;
    const data = page.data ?? [];
    if (!data.length) {
      if (page.count !== null && rows.length < page.count) throw new Error("Incomplete shift query result");
      return rows;
    }
    rows.push(...data);
    if (page.count !== null ? rows.length >= page.count : data.length < 500) return rows;
  }
}
