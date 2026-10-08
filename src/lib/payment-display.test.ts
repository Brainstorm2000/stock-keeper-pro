import { describe, expect, it } from 'vitest';
import { getPaymentMethodDisplayName } from './payment-display';

describe('getPaymentMethodDisplayName', () => {
  it('prefers the saved organization payment method name', () => {
    expect(getPaymentMethodDisplayName('mobile_money', 'Orange Money')).toBe('Orange Money');
  });

  it('uses a standard label when no custom name is saved', () => {
    expect(getPaymentMethodDisplayName('bank_transfer')).toBe('Bank Transfer');
  });

  it('formats unknown method identifiers as readable labels', () => {
    expect(getPaymentMethodDisplayName('store_credit')).toBe('store credit');
  });
});