/** Fetch every ordered page, even when the server returns fewer rows than requested. */
export async function fetchAllPages<T extends { id: string }>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
  pageSize = 200,
): Promise<T[]> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new RangeError("pageSize must be positive");
  const rows: T[] = [];
  const seenIds = new Set<string>();
  let offset = 0;
  for (;;) {
    const { data, error } = await fetchPage(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    if (!page.length) return rows;
    for (const row of page) {
      if (seenIds.has(row.id)) continue;
      seenIds.add(row.id);
      rows.push(row);
    }
    offset += page.length;
  }
}
