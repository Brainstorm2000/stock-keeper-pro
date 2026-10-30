import { useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { getExpirationStatus, type ExpirationStatus } from '@/lib/expiration-status';
import { formatProductStock } from '@/lib/product-units';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
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

  const expiredProducts = products
    .filter((product) =>
      product.item_type !== 'service' &&
      getExpirationStatus(product.expiration_date, today) === 'expired',
    )
    .sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''));
  const almostExpiredProducts = products
    .filter((product) =>
      product.item_type !== 'service' &&
      getExpirationStatus(product.expiration_date, today) === 'almost_expired',
    )
    .sort((a, b) => (a.expiration_date || '').localeCompare(b.expiration_date || ''));
  const selectedProducts = selectedStatus === 'expired'
    ? expiredProducts
    : almostExpiredProducts;
  const pagination = usePagination(selectedProducts);
  const selectedTitle = selectedStatus === 'expired'
    ? 'Expired Products'
    : 'Products Expiring Soon';
  const dateFormatter = new Intl.DateTimeFormat();

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
                {expiredProducts.length} expired product{expiredProducts.length === 1 ? '' : 's'}
              </p>
              <p className="mt-1 text-sm">
                {expiredProducts.slice(0, 3).map((product) => product.name).join(', ')}
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
                {almostExpiredProducts.length} product{almostExpiredProducts.length === 1 ? '' : 's'} expiring soon
              </p>
              <p className="mt-1 text-sm">
                Within the next {WARNING_WINDOW_DAYS} days:{' '}
                {almostExpiredProducts.slice(0, 3).map((product) => product.name).join(', ')}
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
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Expiration Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagination.paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No products in this category.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedItems.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="min-w-[180px] font-medium">{product.name}</TableCell>
                      <TableCell className="whitespace-nowrap">{product.sku || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{product.branches?.name || '-'}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatProductStock(product)}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {product.expiration_date
                          ? dateFormatter.format(new Date(`${product.expiration_date}T00:00:00`))
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
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
