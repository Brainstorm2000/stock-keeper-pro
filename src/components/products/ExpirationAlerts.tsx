import { AlertTriangle, Clock } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';
import { getExpirationStatus, type ExpirationStatus } from '@/lib/expiration-status';

const WARNING_WINDOW_DAYS = 30;

export function ExpirationAlerts({ products }: { products: Product[] }) {
  const today = new Date();

  const expiredProducts = products.filter(
    (product) => product.item_type !== 'service' && getExpirationStatus(product.expiration_date, today) === 'expired',
  );
  const almostExpiredProducts = products.filter(
    (product) => product.item_type !== 'service' && getExpirationStatus(product.expiration_date, today) === 'almost_expired',
  );

  if (expiredProducts.length === 0 && almostExpiredProducts.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2" role="status" aria-label="Product expiration alerts">
      {expiredProducts.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-destructive">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{expiredProducts.length} expired product{expiredProducts.length === 1 ? '' : 's'}</p>
            <p className="mt-1 text-sm">{expiredProducts.slice(0, 3).map((product) => product.name).join(', ')}{expiredProducts.length > 3 ? ', and more' : ''}</p>
          </div>
        </div>
      )}
      {almostExpiredProducts.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-amber-700 dark:text-amber-400">
          <Clock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{almostExpiredProducts.length} product{almostExpiredProducts.length === 1 ? '' : 's'} expiring soon</p>
            <p className="mt-1 text-sm">Within the next {WARNING_WINDOW_DAYS} days: {almostExpiredProducts.slice(0, 3).map((product) => product.name).join(', ')}{almostExpiredProducts.length > 3 ? ', and more' : ''}</p>
          </div>
        </div>
      )}
    </div>
  );
}
