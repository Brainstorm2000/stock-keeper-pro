import { AlertTriangle, Clock } from 'lucide-react';
import type { Product } from '@/hooks/useProducts';

const WARNING_WINDOW_DAYS = 30;

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ExpirationAlerts({ products }: { products: Product[] }) {
  const today = getDateString(new Date());
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + WARNING_WINDOW_DAYS);
  const warningDateString = getDateString(warningDate);

  const expiredProducts = products.filter(
    (product) => product.item_type !== 'service' && product.expiration_date && product.expiration_date < today,
  );
  const almostExpiredProducts = products.filter(
    (product) => product.item_type !== 'service' && product.expiration_date && product.expiration_date >= today && product.expiration_date <= warningDateString,
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
