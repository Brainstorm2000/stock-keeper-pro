const STANDARD_PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  credit: 'Credit',
  pos: 'POS',
};

export function getPaymentMethodDisplayName(
  method: string,
  methodName?: string | null,
) {
  const savedName = methodName?.trim();
  if (savedName) return savedName;

  return STANDARD_PAYMENT_LABELS[method] || method.replaceAll('_', ' ');
}