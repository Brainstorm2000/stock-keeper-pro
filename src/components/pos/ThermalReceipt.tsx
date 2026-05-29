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
          fontSize: "12px", // Increased base size for readability
          lineHeight: "1.3",
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
          .receipt-divider { border-top: 1px dashed #000; margin: 6px 0; }
          .receipt-bold-divider { border-top: 1.5px solid #000; margin: 6px 0; }
          .item-grid {
            display: grid;
            grid-template-columns: 1fr 25px 65px; /* Fixed widths for QTY and TOTAL */
            gap: 4px;
            align-items: start;
          }
        `,
          }}
        />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <div
            style={{
              fontWeight: "900", // Extra bold for brand name
              fontSize: "16px",
              textTransform: "uppercase",
            }}
          >
            {organizationName || "RECEIPT"}
          </div>
          {organizationAddress && (
            <div
              style={{ fontSize: "11px", marginTop: "2px", fontWeight: "600" }}
            >
              {organizationAddress.toUpperCase()}
            </div>
          )}
          {organizationEmail && (
            <div style={{ fontSize: "10px" }}>{organizationEmail}</div>
          )}
        </div>

        <div className="receipt-bold-divider" />

        {/* Sale Meta */}
        <div style={{ fontSize: "11px", fontWeight: "700" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>INVOICE NO:</span>
            <span>{sale.sale_number}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>DATE:</span>
            <span>{format(new Date(sale.created_at), "dd/MM/yy HH:mm")}</span>
          </div>
          {sale.customer_name && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CUSTOMER:</span>
              <span>{sale.customer_name.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="receipt-divider" />

        {/* Items Table Header */}
        <div
          className="item-grid"
          style={{ fontWeight: "900", fontSize: "10px", marginBottom: "4px" }}
        >
          <span>ITEM</span>
          <span style={{ textAlign: "center" }}>QTY</span>
          <span style={{ textAlign: "right" }}>TOTAL</span>
        </div>

        {/* Items List */}
        <div style={{ marginBottom: "6px" }}>
          {sale.sale_items?.map((item, idx) => (
            <div key={item.id || idx} style={{ marginBottom: "6px" }}>
              <div className="item-grid" style={{ fontSize: "11px" }}>
                {/* Product Name Column - Will wrap automatically */}
                <span
                  style={{
                    textTransform: "uppercase",
                    fontWeight: "700",
                    wordBreak: "break-word",
                  }}
                >
                  {item.product_name}
                </span>
                <span style={{ textAlign: "center", fontWeight: "600" }}>
                  {item.quantity}
                </span>
                <span style={{ textAlign: "right", fontWeight: "900" }}>
                  {formatCurrency(Number(item.total_price))}
                </span>
              </div>
              {/* Unit Price row - shown underneath name for clarity */}
              <div
                style={{ fontSize: "10px", color: "#333", marginTop: "1px" }}
              >
                @{formatCurrency(Number(item.unit_price))}
              </div>
            </div>
          ))}
        </div>

        <div className="receipt-bold-divider" />

        {/* Totals Section */}
        <div style={{ fontWeight: "700" }}>
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

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "15px",
              fontWeight: "900",
              marginTop: "4px",
              borderTop: "1px solid #000",
              paddingTop: "4px",
            }}
          >
            <span>TOTAL:</span>
            <span>{formatCurrency(Number(sale.total_amount))}</span>
          </div>
        </div>

        <div className="receipt-divider" />

        {/* Payment */}
        <div style={{ fontSize: "11px" }}>
          {hasSplitPayment ? (
            <div>
              <div
                style={{
                  fontWeight: "900",
                  marginBottom: "4px",
                  textDecoration: "underline",
                }}
              >
                PAYMENT BREAKDOWN:
              </div>
              {paymentDetails.map((payment, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "2px",
                  }}
                >
                  <span style={{ fontWeight: "600" }}>
                    {paymentMethodLabels[payment.method] || payment.method}:
                  </span>
                  <span>{formatCurrency(Number(payment.amount))}</span>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: "700",
              }}
            >
              <span>METHOD:</span>
              <span>
                {paymentMethodLabels[sale.payment_method] ||
                  sale.payment_method.toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Footer & Powered By */}
        <div
          style={{ textAlign: "center", marginTop: "15px", fontSize: "11px" }}
        >
          <div className="receipt-divider" />
          <div style={{ fontWeight: "900", letterSpacing: "1px" }}>
            THANK YOU!
          </div>

          <div
            style={{
              fontSize: "9px",
              marginTop: "10px",
              fontWeight: "700",
              border: "1px solid #000",
              padding: "4px",
            }}
          >
            POWERED BY STOQKIP@{currentYear}
          </div>

          <div style={{ fontSize: "8px", marginTop: "6px" }}>
            {format(new Date(), "dd/MM/yyyy HH:mm:ss")}
          </div>

          {/* Feed space for manual cutting */}
          <div style={{ height: "15mm" }} />
        </div>
      </div>
    );
  },
);

ThermalReceipt.displayName = "ThermalReceipt";
