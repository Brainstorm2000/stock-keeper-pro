const DEFAULT_PAGE_SIZE = 1000;

function isUnboundedTableRead(request: Request): boolean {
  if (request.method !== "GET") return false;

  const url = new URL(request.url);
  if (!url.pathname.startsWith("/rest/v1/") || url.pathname.includes("/rpc/")) {
    return false;
  }
  if (url.searchParams.has("limit") || request.headers.has("range")) {
    return false;
  }
  return !request.headers
    .get("accept")
    ?.includes("application/vnd.pgrst.object+");
}

function getPageSize(response: Response, fallback: number): number {
  const contentRange = response.headers.get("content-range");
  const range = contentRange?.split("/")[0];
  const match = range?.match(/^(\d+)-(\d+)$/);
  if (!match) return fallback;
  return Number(match[2]) - Number(match[1]) + 1 || fallback;
}

function getTotalCount(response: Response): number | null {
  const total = response.headers.get("content-range")?.split("/")[1];
  if (!total || total === "*") return null;
  const count = Number(total);
  return Number.isFinite(count) ? count : null;
}

function getRangeStart(response: Response): number | null {
  const range = response.headers.get("content-range")?.split("/")[0];
  const match = range?.match(/^(\d+)-\d+$/);
  return match ? Number(match[1]) : null;
}

function withAggregateHeaders(
  response: Response,
  rowCount: number,
  totalCount: number | null,
): Headers {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.set(
    "content-range",
    `${rowCount ? `0-${rowCount - 1}` : "*"}/${totalCount ?? "*"}`,
  );
  return headers;
}

export function createPaginatedFetch(fetchImplementation: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    const firstResponse = await fetchImplementation(request);
    if (!firstResponse.ok || !isUnboundedTableRead(request)) return firstResponse;

    let rows: unknown;
    try {
      rows = await firstResponse.clone().json();
    } catch {
      return firstResponse;
    }
    if (!Array.isArray(rows)) return firstResponse;

    const allRows = [...rows];
    const totalCount = getTotalCount(firstResponse);
    let pageSize = getPageSize(firstResponse, DEFAULT_PAGE_SIZE);
    let offset = rows.length;
    let latestResponse = firstResponse;

    while (rows.length === pageSize && (totalCount === null || offset < totalCount)) {
      const pageRequest = new Request(request.clone(), {
        headers: new Headers(request.headers),
      });
      pageRequest.headers.set("range-unit", "items");
      pageRequest.headers.set("range", `${offset}-${offset + pageSize - 1}`);

      const pageResponse = await fetchImplementation(pageRequest);
      if (!pageResponse.ok) return pageResponse;
      const returnedStart = getRangeStart(pageResponse);
      if (returnedStart !== null && returnedStart !== offset) {
        return new Response(
          JSON.stringify({ message: "The server did not advance the requested row range." }),
          { status: 500, headers: { "content-type": "application/json" } },
        );
      }

      let pageRows: unknown;
      try {
        pageRows = await pageResponse.clone().json();
      } catch {
        return pageResponse;
      }
      if (!Array.isArray(pageRows)) return pageResponse;

      latestResponse = pageResponse;
      if (pageRows.length === 0) break;

      const returnedPageSize = getPageSize(pageResponse, pageSize);
      allRows.push(...pageRows);
      offset += pageRows.length;
      rows = pageRows;
      pageSize = returnedPageSize;
    }

    return new Response(JSON.stringify(allRows), {
      status: firstResponse.status === 206 ? 200 : firstResponse.status,
      statusText: firstResponse.statusText,
      headers: withAggregateHeaders(latestResponse, allRows.length, totalCount),
    });
  };
}