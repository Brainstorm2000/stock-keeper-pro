import { forwardRef } from "react";
import { format } from "date-fns";
import type { Sale, PaymentDetail } from "@/hooks/useSales";
import { formatCurrency } from "@/lib/currency";

interface ThermalReceiptProps {
  sale: Sale;
  organizationName?: string;
  organizationAddress?: string;
  organizationEmail?: string;
}

export const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(
  ({ sale, organizationName, organizationAddress, organizationEmail }, ref) => {
    const currentYear = new Date().getFullYear();
    const paymentMethodLabels: Record<string, string> = {
      cash: "CASH",
      card: "CARD",
      mobile_money: "MOBILE MONEY",
      bank_transfer: "TRANSFER",
      credit: "CREDIT",
    };

    const paymentDetails = sale.payment_details as PaymentDetail[] | undefined;
    const hasSplitPayment = paymentDetails && paymentDetails.length > 1;

    return (
      <div
        ref={ref}
        className="thermal-print-container"
        style={{
          width: "58mm",
          padding: "2mm",
          backgroundColor: "white",
          color: "black",
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: "11px",
          lineHeight: "1.2",
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
            @page { margin: 0; size: 58mm auto; }
            body { margin: 0; padding: 0; }
            .thermal-print-container { width: 58mm !important; margin: 0 !important; padding: 2mm !important; }
          }
          .receipt-divider { border-top: 1px dashed #000; margin: 4px 0; }
          .receipt-bold-divider { border-top: 1px solid #000; margin: 4px 0; }
        `,
          }}
        />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <div
            style={{
              fontWeight: "bold",
              fontSize: "14px",
              textTransform: "uppercase",
            }}
          >
            {organizationName || "RECEIPT"}
          </div>
          {organizationAddress && (
            <div style={{ fontSize: "10px", marginTop: "2px" }}>
              {organizationAddress}
            </div>
          )}
          {organizationEmail && (
            <div style={{ fontSize: "10px" }}>{organizationEmail}</div>
          )}
        </div>

        <div className="receipt-divider" />

        {/* Sale Meta */}
        <div style={{ fontSize: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>INV:</span>
            <span style={{ fontWeight: "bold" }}>{sale.sale_number}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>DATE:</span>
            <span>{format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</span>
          </div>
          {sale.customer_name && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CUST:</span>
              <span>{sale.customer_name.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="receipt-divider" />

        {/* Items Table Header */}
        <div
          style={{
            display: "flex",
            fontWeight: "bold",
            fontSize: "9px",
            marginBottom: "2px",
          }}
        >
          <span style={{ flex: "1" }}>ITEM</span>
          <span style={{ width: "15mm", textAlign: "right" }}>QTY</span>
          <span style={{ width: "18mm", textAlign: "right" }}>TOTAL</span>
        </div>

        {/* Items List */}
        <div style={{ marginBottom: "4px" }}>
          {sale.sale_items?.map((item, idx) => (
            <div key={item.id || idx} style={{ marginBottom: "3px" }}>
              <div style={{ textTransform: "uppercase", fontSize: "10px" }}>
                {item.product_name}
              </div>
              <div style={{ display: "flex", fontSize: "10px" }}>
                <span style={{ flex: "1", fontSize: "9px" }}>
                  {formatCurrency(Number(item.unit_price))}
                </span>
                <span style={{ width: "15mm", textAlign: "right" }}>
                  {item.quantity}
                </span>
                <span
                  style={{
                    width: "18mm",
                    textAlign: "right",
                    fontWeight: "bold",
                  }}
                >
                  {formatCurrency(Number(item.total_price))}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="receipt-divider" />

        {/* Totals */}
        <div style={{ marginLeft: "10mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>SUBTOTAL:</span>
            <span>{formatCurrency(Number(sale.subtotal))}</span>
          </div>
          {Number(sale.discount_amount) > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>DISCOUNT:</span>
              <span>-{formatCurrency(Number(sale.discount_amount))}</span>
            </div>
          )}
          <div className="receipt-bold-divider" />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontWeight: "bold",
              fontSize: "13px",
            }}
          >
            <span>TOTAL:</span>
            <span>{formatCurrency(Number(sale.total_amount))}</span>
          </div>
        </div>

        <div className="receipt-divider" />

        {/* Payment */}
        <div style={{ fontSize: "10px" }}>
          {hasSplitPayment ? (
            <div>
              <div style={{ fontWeight: "bold", marginBottom: "2px" }}>
                PAYMENT BREAKDOWN:
              </div>
              {paymentDetails.map((payment, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingLeft: "2mm",
                  }}
                >
                  <span>
                    {paymentMethodLabels[payment.method] || payment.method}:
                  </span>
                  <span>{formatCurrency(Number(payment.amount))}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>PAYMENT METHOD:</span>
              <span style={{ fontWeight: "bold" }}>
                {paymentMethodLabels[sale.payment_method] ||
                  sale.payment_method.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Footer & Powered By */}
        <div
          style={{ textAlign: "center", marginTop: "12px", fontSize: "10px" }}
        >
          <div className="receipt-divider" />
          <div style={{ fontWeight: "bold" }}>THANK YOU FOR YOUR BUSINESS!</div>

          <div
            style={{
              fontSize: "8px",
              marginTop: "8px",
              textTransform: "uppercase",
            }}
          >
            Powered by StoqKip @{currentYear}
            <br />
            All Rights Reserved
          </div>

          <div style={{ fontSize: "7px", marginTop: "4px" }}>
            Printed: {format(new Date(), "dd/MM/yyyy HH:mm:ss")}
          </div>

          {/* Feed space for manual cutting */}
          <div style={{ height: "12mm" }} />
        </div>
      </div>
    );
  },
);

ThermalReceipt.displayName = "ThermalReceipt";
