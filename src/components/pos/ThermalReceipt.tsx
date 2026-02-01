import { forwardRef } from 'react';
import { format } from 'date-fns';
import type { Sale, SaleItem } from '@/hooks/useSales';

interface ThermalReceiptProps {
  sale: Sale;
  organizationName?: string;
  organizationAddress?: string;
  organizationEmail?: string;
}

// Receipt optimized for 58mm thermal printers (approx 32 characters per line)
export const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(
  ({ sale, organizationName, organizationAddress, organizationEmail }, ref) => {
    const paymentMethodLabels: Record<string, string> = {
      cash: 'Cash',
      card: 'Card',
      mobile_money: 'Mobile Money',
      bank_transfer: 'Bank Transfer',
      credit: 'Credit',
    };

    return (
      <div
        ref={ref}
        className="thermal-receipt bg-white text-black p-2 font-mono text-[10px] leading-tight"
        style={{
          width: '58mm',
          maxWidth: '58mm',
          minWidth: '58mm',
        }}
      >
        {/* Header */}
        <div className="text-center mb-2">
          <div className="font-bold text-sm uppercase">{organizationName || 'Store'}</div>
          {organizationAddress && (
            <div className="text-[9px] whitespace-pre-wrap">{organizationAddress}</div>
          )}
          {organizationEmail && <div className="text-[9px]">{organizationEmail}</div>}
        </div>

        <div className="border-t border-dashed border-black my-1" />

        {/* Invoice Info */}
        <div className="flex justify-between">
          <span>Invoice:</span>
          <span className="font-bold">{sale.sale_number}</span>
        </div>
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{format(new Date(sale.created_at), 'dd/MM/yy HH:mm')}</span>
        </div>
        {sale.customer_name && (
          <div className="flex justify-between">
            <span>Customer:</span>
            <span className="truncate max-w-[60%] text-right">{sale.customer_name}</span>
          </div>
        )}

        <div className="border-t border-dashed border-black my-1" />

        {/* Items */}
        <div className="space-y-1">
          {sale.sale_items?.map((item, idx) => (
            <div key={item.id || idx}>
              <div className="truncate font-medium">{item.product_name}</div>
              <div className="flex justify-between pl-2">
                <span>
                  {item.quantity} x {Number(item.unit_price).toLocaleString()}
                </span>
                <span>{Number(item.total_price).toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-dashed border-black my-1" />

        {/* Totals */}
        <div className="space-y-0.5">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{Number(sale.subtotal).toLocaleString()}</span>
          </div>
          {Number(sale.discount_amount) > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>-{Number(sale.discount_amount).toLocaleString()}</span>
            </div>
          )}
          {Number(sale.tax_amount) > 0 && (
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>{Number(sale.tax_amount).toLocaleString()}</span>
            </div>
          )}
          <div className="border-t border-black my-0.5" />
          <div className="flex justify-between font-bold text-xs">
            <span>TOTAL:</span>
            <span>{Number(sale.total_amount).toLocaleString()}</span>
          </div>
        </div>

        <div className="border-t border-dashed border-black my-1" />

        {/* Payment Info */}
        <div className="flex justify-between">
          <span>Payment:</span>
          <span>{paymentMethodLabels[sale.payment_method] || sale.payment_method}</span>
        </div>

        {sale.notes && (
          <>
            <div className="border-t border-dashed border-black my-1" />
            <div className="text-[9px]">
              <div className="font-bold">Notes:</div>
              <div className="whitespace-pre-wrap">{sale.notes}</div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="border-t border-dashed border-black my-1" />
        <div className="text-center text-[9px]">
          <div>Thank you for your purchase!</div>
          <div className="mt-1 text-[8px] opacity-60">
            {format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
          </div>
        </div>
      </div>
    );
  }
);

ThermalReceipt.displayName = 'ThermalReceipt';
