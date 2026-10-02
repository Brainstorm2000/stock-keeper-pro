import { describe, expect, it, vi } from "vitest";
import { createPaginatedFetch } from "./paginated-fetch";

describe("createPaginatedFetch", () => {
  it("fetches all pages for an unbounded table read", async () => {
    const records = Array.from({ length: 2305 }, (_, id) => ({ id }));
    const ranges: string[] = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const request = new Request(input);
      const range = request.headers.get("range");
      if (range) ranges.push(range);
      const start = range ? Number(range.split("-")[0]) : 0;
      const end = range ? Number(range.split("-")[1]) : start + 999;
      const page = records.slice(start, end + 1);
      const last = page.length ? start + page.length - 1 : "*";
      return new Response(JSON.stringify(page), {
        headers: { "content-range": `${page.length ? `${start}-${last}` : "*"}/${records.length}` },
      });
    });

    const response = await createPaginatedFetch(fetchMock as typeof fetch)(
      "https://example.supabase.co/rest/v1/products?select=*",
    );

    expect(await response.json()).toHaveLength(2305);
    expect(ranges).toEqual(["1000-1999", "2000-2999"]);
    expect(response.headers.get("content-range")).toBe("0-2304/2305");
  });

  it("does not change explicitly limited, ranged, single-row, or RPC requests", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify(Array.from({ length: 1000 }, (_, id) => ({ id })))),
    );
    const wrappedFetch = createPaginatedFetch(fetchMock as typeof fetch);

    await wrappedFetch("https://example.supabase.co/rest/v1/products?select=*&limit=5");
    await wrappedFetch(new Request("https://example.supabase.co/rest/v1/products?select=*", {
      headers: { range: "0-24" },
    }));
    await wrappedFetch(new Request("https://example.supabase.co/rest/v1/products?select=*", {
      headers: { accept: "application/vnd.pgrst.object+json" },
    }));
    await wrappedFetch("https://example.supabase.co/rest/v1/rpc/some_function");

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});