export function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getSaleDateTimestamp(
  saleDate: string,
  now = new Date(),
): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(saleDate);
  if (!match || saleDate > getLocalDateString(now)) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const isToday = saleDate === getLocalDateString(now);
  const date = new Date(
    year,
    month - 1,
    day,
    isToday ? now.getHours() : 12,
    isToday ? now.getMinutes() : 0,
    isToday ? now.getSeconds() : 0,
    isToday ? now.getMilliseconds() : 0,
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date.toISOString();
}