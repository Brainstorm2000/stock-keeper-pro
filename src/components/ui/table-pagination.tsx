import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DEFAULT_PAGE_SIZE_OPTIONS } from '@/hooks/usePagination';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: TablePaginationProps) {
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const safeTotal = Math.max(1, totalPages);
  const windowSize = 5;
  const pageNumbers: number[] = [];
  if (safeTotal <= windowSize) {
    for (let i = 1; i <= safeTotal; i++) pageNumbers.push(i);
  } else {
    let start = Math.max(1, currentPage - 2);
    let end = start + windowSize - 1;
    if (end > safeTotal) {
      end = safeTotal;
      start = end - windowSize + 1;
    }
    for (let i = start; i <= end; i++) pageNumbers.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-4 mt-4 border-t border-slate-100 dark:border-slate-800">
      <div className="flex items-center gap-4">
        <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          Showing{' '}
          <span className="text-[#000B26] dark:text-white font-bold">{startItem}</span> to{' '}
          <span className="text-[#000B26] dark:text-white font-bold">{endItem}</span> of{' '}
          <span className="text-[#000B26] dark:text-white font-bold">{totalItems}</span> entries
        </div>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">Rows:</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[70px] bg-transparent border-slate-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 border-slate-200 dark:border-slate-800"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-1">
          {pageNumbers.map((p) => (
            <Button
              key={p}
              size="sm"
              onClick={() => onPageChange(p)}
              className={`h-9 w-9 p-0 font-bold transition-all ${
                p === currentPage
                  ? 'bg-[#FF9E3D] text-[#000B26] shadow-sm hover:bg-[#FF9E3D]/90'
                  : 'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-400'
              }`}
            >
              {p}
            </Button>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 w-9 p-0 border-slate-200 dark:border-slate-800"
          onClick={() => onPageChange(Math.min(safeTotal, currentPage + 1))}
          disabled={currentPage >= safeTotal}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
