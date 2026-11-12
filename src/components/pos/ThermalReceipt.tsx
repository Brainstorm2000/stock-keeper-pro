import { forwardRef } from "react";
import { format } from "date-fns";
import { useSaleCreatorProfile, type Sale, type PaymentDetail } from "@/hooks/useSales";
import { useAuth } from "@/lib/auth";
import { useUserProfile } from "@/hooks/useOrganization";
import { formatCurrency } from "@/lib/currency";
import { getPaymentMethodDisplayName } from "@/lib/payment-display";
import type { ReceiptPaperSize } from "@/hooks/useOrganization";

interface ThermalReceiptProps {
  sale: Sale;
  paperSize?: ReceiptPaperSize;
  organizationName?: string;
  organizationLogoUrl?: string | null;
  organizationAddress?: string;
  organizationEmail?: string;
}

export const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>(
  ({ sale, paperSize = "80mm", organizationName, organizationLogoUrl, organizationAddress, organizationEmail }, ref) => {
    const { user } = useAuth();
    const { data: userProfile } = useUserProfile();
    const { data: saleCreatorProfile } = useSaleCreatorProfile(sale.created_by);
    const isCurrentUserCreator = !!sale.created_by && sale.created_by === user?.id;
    const currentCreatorName = isCurrentUserCreator
      ? (userProfile?.full_name as string | null) ||
        (user?.user_metadata?.full_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        user?.email
      : null;
    const salesBy =
      saleCreatorProfile?.full_name ||
      currentCreatorName ||
      saleCreatorProfile?.email ||
      null;
    const currentYear = new Date().getFullYear();
    const paymentDetails = sale.payment_details as PaymentDetail[] | undefined;
    const hasSplitPayment = paymentDetails && paymentDetails.length > 0;
    const amountPaid = Number(sale.amount_paid ?? 0);
    const balanceDue = Number(sale.balance_due ?? Math.max(0, Number(sale.total_amount) - amountPaid));
    const shouldShowBalance = sale.payment_status === 'partial' || sale.payment_status === 'outstanding';
    const isA4 = paperSize === "a4";
    const paperWidth = isA4 ? "190mm" : paperSize;
    const scale = paperSize === "57mm" ? 1 : isA4 ? 1.35 : 1.15;
    const font = (size: number) => `${Math.round(size * scale)}px`;
    const padding = isA4 ? "0" : paperSize === "57mm" ? "2mm" : "3mm";
    const itemColumns = paperSize === "57mm"
      ? "minmax(0, 1fr) 8mm 20mm"
      : isA4
        ? "minmax(0, 1fr) 20mm 40mm"
        : "minmax(0, 1fr) 10mm 25mm";

    return (
      <div
        ref={ref}
        className="thermal-print-container"
        style={{
          width: paperWidth,
          padding,
          backgroundColor: "white",
          color: "black",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: font(12),
          fontWeight: 700,
          lineHeight: "1.4",
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
          @media print {
              @page { margin: ${isA4 ? "10mm" : "0"}; size: ${isA4 ? "A4 portrait" : `${paperSize} auto`}; }
            body { margin: 0; padding: 0; }
              .thermal-print-container { width: ${paperWidth} !important; margin: 0 !important; padding: ${padding} !important; }
          }
          .receipt-divider { border-top: 1px dashed #000; margin: 6px 0; }
          .receipt-bold-divider { border-top: 1.5px solid #000; margin: 6px 0; }
          .item-grid {
            display: grid;
              grid-template-columns: ${itemColumns};
            gap: 4px;
            align-items: start;
          }
        `,
          }}
        />

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          {organizationLogoUrl && (
            <div style={{ marginBottom: "8px" }}>
              <img
                src={organizationLogoUrl}
                alt={organizationName ? `${organizationName} logo` : 'Organization logo'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '60px',
                  display: 'block',
                  margin: '0 auto',
                  objectFit: 'contain',
                }}
              />
            </div>
          )}
          <div
            style={{
              fontWeight: "900", // Extra bold for brand name
              fontSize: font(16),
              textTransform: "uppercase",
            }}
          >
            {organizationName || "RECEIPT"}
          </div>
          {organizationAddress && (
            <div
              style={{ fontSize: font(11), marginTop: "2px", fontWeight: "700" }}
            >
              {organizationAddress.toUpperCase()}
            </div>
          )}
          {organizationEmail && (
            <div style={{ fontSize: font(11), fontWeight: "700" }}>{organizationEmail}</div>
          )}
        </div>

        <div className="receipt-bold-divider" />

        {/* Sale Meta */}
        <div style={{ fontSize: font(11), fontWeight: "700" }}>
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
          {salesBy && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>SALES BY:</span>
              <span>{salesBy.toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="receipt-divider" />

        {/* Items Table Header */}
        <div
          className="item-grid"
          style={{ fontWeight: "900", fontSize: font(11), marginBottom: "4px" }}
        >
          <span>ITEM</span>
          <span style={{ textAlign: "center" }}>QTY</span>
          <span style={{ textAlign: "right" }}>TOTAL</span>
        </div>

        {/* Items List */}
        <div style={{ marginBottom: "6px" }}>
          {sale.sale_items?.map((item, idx) => (
            <div key={item.id || idx} style={{ marginBottom: "6px" }}>
              <div className="item-grid" style={{ fontSize: font(12), fontWeight: "700" }}>
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
                  {item.quantity} {item.unit_label || ""}
                </span>
                <span style={{ textAlign: "right", fontWeight: "900" }}>
                  {formatCurrency(Number(item.total_price))}
                </span>
              </div>
              {/* Unit Price row - shown underneath name for clarity */}
              <div
                style={{ fontSize: font(11), color: "#222", fontWeight: "700", marginTop: "1px" }}
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
              fontSize: font(15),
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
        <div style={{ fontSize: font(12), fontWeight: "700" }}>
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
                    {getPaymentMethodDisplayName(payment.method, payment.method_name).toUpperCase()}:
                  </span>
                  <span>{formatCurrency(Number(payment.amount))}</span>
                </div>
              ))}
              {shouldShowBalance && (
                <>
                  <div className="receipt-divider" />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "2px",
                      fontWeight: "700",
                    }}
                  >
                    <span>AMOUNT PAID:</span>
                    <span>{formatCurrency(amountPaid)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "2px",
                      fontWeight: "700",
                    }}
                  >
                    <span>BALANCE DUE:</span>
                    <span>{formatCurrency(balanceDue)}</span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: "700",
                }}
              >
                <span>METHOD:</span>
                <span>
                  {getPaymentMethodDisplayName(sale.payment_method).toUpperCase()}
                </span>
              </div>
              {shouldShowBalance && (
                <>
                  <div className="receipt-divider" />
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "2px",
                      fontWeight: "700",
                    }}
                  >
                    <span>AMOUNT PAID:</span>
                    <span>{formatCurrency(amountPaid)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "2px",
                      fontWeight: "700",
                    }}
                  >
                    <span>BALANCE DUE:</span>
                    <span>{formatCurrency(balanceDue)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer & Powered By */}
        <div
          style={{ textAlign: "center", marginTop: "15px", fontSize: font(12), fontWeight: "700" }}
        >
          <div className="receipt-divider" />
          <div style={{ fontWeight: "900", letterSpacing: "1px" }}>
            THANK YOU!
          </div>

          <div
            style={{
              fontSize: font(10),
              marginTop: "10px",
              fontWeight: "700",
              border: "1px solid #000",
              padding: "4px",
            }}
          >
            POWERED BY STOQKIP@{currentYear}
          </div>

          <div style={{ fontSize: font(10), fontWeight: "700", marginTop: "6px" }}>
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
