import { useMemo, useState } from 'react';
import { AlertTriangle, Clock, Search, X } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { getExpirationStatus, type ExpirationStatus } from '@/lib/expiration-status';
import { usePagination } from '@/hooks/usePagination';
import { useInventoryBatches } from '@/hooks/useInventoryBatches';
import { TablePagination } from '@/components/ui/table-pagination';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const WARNING_WINDOW_DAYS = 30;

export function ExpirationAlerts({ products }: { products: Product[] }) {
  const today = new Date();
  const [selectedStatus, setSelectedStatus] = useState<ExpirationStatus | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expirationDateFrom, setExpirationDateFrom] = useState('');
  const [expirationDateTo, setExpirationDateTo] = useState('');
  const { data: batches = [] } = useInventoryBatches();
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const trackedBatches = batches.filter((batch) => {
    const product = batch.product_id ? productsById.get(batch.product_id) : null;
    return product && product.item_type !== 'service' && batch.remaining_quantity > 0;
  });

  const expiredProducts = trackedBatches
    .filter((batch) => getExpirationStatus(batch.expiration_date, today) === 'expired')
    .sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''));
  const almostExpiredProducts = trackedBatches
    .filter((batch) => getExpirationStatus(batch.expiration_date, today) === 'almost_expired')
    .sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''));
  const selectedProducts = selectedStatus === 'expired'
    ? expiredProducts
    : almostExpiredProducts;
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return selectedProducts.filter((batch) => {
      const product = batch.product_id ? productsById.get(batch.product_id) : null;
      if (!product) return false;

      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.generic_name?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.brands?.name?.toLowerCase().includes(query) ||
        batch.batch_number.toLowerCase().includes(query) ||
        product.branches?.name?.toLowerCase().includes(query);
      if (!matchesSearch) return false;

      if (expirationDateFrom && (!batch.expiration_date || batch.expiration_date < expirationDateFrom)) {
        return false;
      }
      if (expirationDateTo && (!batch.expiration_date || batch.expiration_date > expirationDateTo)) {
        return false;
      }
      return true;
    });
  }, [selectedProducts, productsById, searchQuery, expirationDateFrom, expirationDateTo]);
  const pagination = usePagination(filteredProducts);
  const selectedTitle = selectedStatus === 'expired'
    ? 'Expired Products'
    : 'Products Expiring Soon';
  const dateFormatter = new Intl.DateTimeFormat();
  const hasActiveFilters = !!searchQuery || !!expirationDateFrom || !!expirationDateTo;

  const clearFilters = () => {
    setSearchQuery('');
    setExpirationDateFrom('');
    setExpirationDateTo('');
    pagination.setCurrentPage(1);
  };

  if (expiredProducts.length === 0 && almostExpiredProducts.length === 0) return null;

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2" aria-label="Product expiration alerts">
        {expiredProducts.length > 0 && (
          <button
            type="button"
            onClick={() => {
              pagination.setCurrentPage(1);
              setSelectedStatus('expired');
            }}
            className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-left text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-haspopup="dialog"
          >
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {expiredProducts.length} expired batch{expiredProducts.length === 1 ? '' : 'es'}
              </p>
              <p className="mt-1 text-sm">
                {expiredProducts.slice(0, 3).map((batch) => productsById.get(batch.product_id!)?.name).join(', ')}
                {expiredProducts.length > 3 ? ', and more' : ''}
              </p>
            </div>
          </button>
        )}
        {almostExpiredProducts.length > 0 && (
          <button
            type="button"
            onClick={() => {
              pagination.setCurrentPage(1);
              setSelectedStatus('almost_expired');
            }}
            className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left text-amber-700 transition-colors hover:bg-amber-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-amber-400"
            aria-haspopup="dialog"
          >
            <Clock className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {almostExpiredProducts.length} batch{almostExpiredProducts.length === 1 ? '' : 'es'} expiring soon
              </p>
              <p className="mt-1 text-sm">
                Within the next {WARNING_WINDOW_DAYS} days:{' '}
                {almostExpiredProducts.slice(0, 3).map((batch) => productsById.get(batch.product_id!)?.name).join(', ')}
                {almostExpiredProducts.length > 3 ? ', and more' : ''}
              </p>
            </div>
          </button>
        )}
      </div>
      <Dialog
        open={selectedStatus !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedStatus(null);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTitle}</DialogTitle>
            <DialogDescription>
              {selectedStatus === 'expired'
                ? 'Products that have passed their expiration date.'
                : `Products expiring within the next ${WARNING_WINDOW_DAYS} days.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search product, SKU, batch, or branch..."
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  pagination.setCurrentPage(1);
                }}
                aria-label="Search expiring products"
                className="pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-auto">
              <div className="space-y-1">
                <label htmlFor="expiration-date-from" className="text-xs text-muted-foreground">
                  Expiration from
                </label>
                <Input
                  id="expiration-date-from"
                  type="date"
                  value={expirationDateFrom}
                  onChange={(event) => {
                    setExpirationDateFrom(event.target.value);
                    pagination.setCurrentPage(1);
                  }}
                  aria-label="Filter expiration date from"
                  className="w-full sm:w-40"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="expiration-date-to" className="text-xs text-muted-foreground">
                  Expiration to
                </label>
                <Input
                  id="expiration-date-to"
                  type="date"
                  value={expirationDateTo}
                  onChange={(event) => {
                    setExpirationDateTo(event.target.value);
                    pagination.setCurrentPage(1);
                  }}
                  aria-label="Filter expiration date to"
                  className="w-full sm:w-40"
                />
              </div>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="self-end"
              >
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {filteredProducts.length} of {selectedProducts.length} batches
          </p>
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Batch Stock</TableHead>
                  <TableHead>Expiration Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {hasActiveFilters
                        ? 'No batches match your search and date filters.'
                        : 'No products in this category.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedItems.map((batch) => {
                    const product = productsById.get(batch.product_id!);
                    if (!product) return null;
                    return (
                      <TableRow key={batch.id}>
                        <TableCell className="min-w-[180px] font-medium">{product.name}</TableCell>
                        <TableCell className="whitespace-nowrap">{product.sku || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{batch.batch_number}</TableCell>
                        <TableCell className="whitespace-nowrap">{product.branches?.name || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{batch.remaining_quantity.toLocaleString()}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {batch.expiration_date
                            ? dateFormatter.format(new Date(`${batch.expiration_date}T00:00:00`))
                            : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <TablePagination
            currentPage={pagination.currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.totalItems}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setCurrentPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
