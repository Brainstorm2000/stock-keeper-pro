import { useState, useMemo } from 'react';

interface UsePaginationOptions {
  pageSize?: number;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function usePagination<T>(
  items: T[],
  optionsOrPageSize: UsePaginationOptions | number = {},
) {
  const initialPageSize =
    typeof optionsOrPageSize === 'number'
      ? optionsOrPageSize
      : optionsOrPageSize.pageSize ?? 10;

  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = currentPage > totalPages ? 1 : currentPage;

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setCurrentPage(1);
  };

  return {
    paginatedItems,
    currentPage: safePage,
    totalPages,
    totalItems: items.length,
    pageSize,
    goToPage,
    setCurrentPage: goToPage,
    setPageSize,
  };
}
