export type ExpirationStatus = 'normal' | 'almost_expired' | 'expired';
export type ExpirationFilter = 'all' | 'expired' | 'not_expired';

const WARNING_WINDOW_DAYS = 30;

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getExpirationStatus(expirationDate: string | null | undefined, today: Date = new Date()): ExpirationStatus {
  if (!expirationDate) return 'normal';

  const todayKey = toDateKey(today);
  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + WARNING_WINDOW_DAYS);
  const warningDateKey = toDateKey(warningDate);

  if (expirationDate < todayKey) return 'expired';
  if (expirationDate <= warningDateKey) return 'almost_expired';
  return 'normal';
}

export function matchesExpirationFilter(
  filter: ExpirationFilter,
  batchExpirationDates: Array<string | null | undefined>,
  productExpirationDate: string | null | undefined,
  today: Date = new Date(),
): boolean {
  if (filter === 'all') return true;

  const datedBatches = batchExpirationDates.filter(
    (expirationDate): expirationDate is string => !!expirationDate,
  );
  const expirationDates = datedBatches.length > 0
    ? datedBatches
    : productExpirationDate
      ? [productExpirationDate]
      : [];

  if (filter === 'expired') {
    return expirationDates.some(
      (expirationDate) => getExpirationStatus(expirationDate, today) === 'expired',
    );
  }

  return expirationDates.length > 0 && expirationDates.every(
    (expirationDate) => getExpirationStatus(expirationDate, today) !== 'expired',
  );
}
