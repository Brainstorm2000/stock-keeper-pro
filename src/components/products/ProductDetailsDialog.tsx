import { format } from "date-fns";
import type { Product } from "@/hooks/useProducts";
import { useProductVariations } from "@/hooks/useProductVariations";
import { formatProductStockQuantity } from "@/lib/product-units";
import { formatCurrency } from "@/lib/currency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ProductDetailsDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="break-words font-medium">{value || "-"}</dd>
    </div>
  );
}

function formatStock(product: Product, stock: number) {
  return formatProductStockQuantity(product, Number(stock));
}

export function ProductDetailsDialog({
  product,
  open,
  onOpenChange,
}: ProductDetailsDialogProps) {
  const { data: variations = [] } = useProductVariations(
    product?.item_type === "variable" ? product.id : null,
  );

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
          <DialogDescription>Complete product information</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-3">
            <h3 className="font-semibold">Product details</h3>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail label="SKU" value={product.sku} />
              <Detail
                label="Type"
                value={
                  <Badge variant="outline" className="capitalize">
                    {product.item_type}
                  </Badge>
                }
              />
              <Detail
                label="Category"
                value={product.product_categories?.name || "Uncategorized"}
              />
              <Detail label="Product category" value={product.category} />
              <Detail label="Branch" value={product.branches?.name} />
              <Detail label="Supplier" value={product.suppliers?.name} />
              <Detail label="Brand" value={product.brands?.name} />
              <Detail
                label="Archived"
                value={product.is_archived ? "Yes" : "No"}
              />
              <Detail
                label="Taxable"
                value={product.is_taxable ? "Yes" : "No"}
              />
              <Detail
                label="Unit"
                value={[
                  product.units?.name,
                  product.units?.abbreviation &&
                    `(${product.units.abbreviation})`,
                ]
                  .filter(Boolean)
                  .join(" ")}
              />
              {product.sub_unit_id && (
                <>
                  <Detail
                    label="Subunit"
                    value={[
                      product.sub_units?.name,
                      product.sub_units?.abbreviation &&
                        `(${product.sub_units.abbreviation})`,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  />
                  <Detail
                    label="Subunits per unit"
                    value={product.sub_unit_factor}
                  />
                  <Detail
                    label="Subunit selling price"
                    value={
                      product.sub_unit_selling_price == null
                        ? "-"
                        : formatCurrency(Number(product.sub_unit_selling_price))
                    }
                  />
                </>
              )}
              <Detail label="Description" value={product.description} />
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Stock and pricing</h3>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Detail
                label="Opening stock"
                value={formatStock(product, product.opening_stock)}
              />
              <Detail
                label="Current stock"
                value={formatStock(product, product.current_stock)}
              />
              <Detail
                label="Low stock threshold"
                value={formatStock(product, product.low_stock_threshold)}
              />
              <Detail
                label="Out of stock threshold"
                value={formatStock(product, product.out_of_stock_threshold)}
              />
              <Detail
                label="Cost price"
                value={formatCurrency(Number(product.cost_price))}
              />
              <Detail
                label="Selling price"
                value={formatCurrency(Number(product.selling_price))}
              />
              <Detail
                label="Expiration date"
                value={product.expiration_date || "-"}
              />
            </dl>
          </section>

          {product.item_type === "variable" && (
            <section className="space-y-3">
              <h3 className="font-semibold">Variations</h3>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variation</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {variations.map((variation) => (
                      <TableRow key={variation.id}>
                        <TableCell>
                          {variation.attributes
                            ?.map(
                              (attribute) =>
                                `${attribute.attribute_name}: ${attribute.value}`,
                            )
                            .join(", ") || "-"}
                        </TableCell>
                        <TableCell>{variation.sku || "-"}</TableCell>
                        <TableCell className="text-right">
                          {Number(variation.current_stock).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(variation.cost_price))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(variation.selling_price))}
                        </TableCell>
                        <TableCell>
                          {variation.is_active ? "Active" : "Inactive"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {variations.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="text-center text-muted-foreground"
                        >
                          No variations found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </section>
          )}

          
        </div>
      </DialogContent>
    </Dialog>
  );
}
