import { useState } from "react";
import { format } from "date-fns";
import { Pencil, Save, X } from "lucide-react";
import type { Product } from "@/hooks/useProducts";
import { useProductVariations } from "@/hooks/useProductVariations";
import { useInventoryBatches, useUpdateInventoryBatchExpiration } from "@/hooks/useInventoryBatches";
import { formatProductStockQuantity } from "@/lib/product-units";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  canEditBatchExpiry?: boolean;
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
  canEditBatchExpiry = false,
}: ProductDetailsDialogProps) {
  const [editingExpiry, setEditingExpiry] = useState<{ batchId: string; value: string } | null>(null);
  const { data: variations = [] } = useProductVariations(
    product?.item_type === "variable" ? product.id : null,
  );
  const { data: inventoryBatches = [] } = useInventoryBatches(
    product?.id,
    open && !!product?.id,
  );
  const updateBatchExpiration = useUpdateInventoryBatchExpiration();

  const saveBatchExpiry = async () => {
    if (!editingExpiry) return;
    try {
      await updateBatchExpiration.mutateAsync({
        batchId: editingExpiry.batchId,
        expirationDate: editingExpiry.value || null,
      });
      setEditingExpiry(null);
    } catch {
      // The mutation reports update errors through the toast.
    }
  };

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
              <Detail label="Generic name" value={product.generic_name} />
              <Detail
                label="Brand name"
                value={product.brands?.name}
              />
              <Detail label="NAFDAC number" value={product.nafdac_number} />
              <Detail
                label="Manufacturing date"
                value={product.manufacturing_date}
              />
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
            </dl>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold">Inventory batches</h3>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Variation</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead>Expiry</TableHead>
                    {canEditBatchExpiry && <TableHead className="w-24">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventoryBatches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canEditBatchExpiry ? 6 : 5} className="py-6 text-center text-muted-foreground">
                        No batch records found.
                      </TableCell>
                    </TableRow>
                  ) : inventoryBatches.map((batch) => (
                    <TableRow key={batch.id}>
                      <TableCell>{batch.batch_number}</TableCell>
                      <TableCell>
                        {variations.find((variation) => variation.id === batch.variation_id)?.sku || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(batch.initial_quantity).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        {Number(batch.remaining_quantity).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {editingExpiry?.batchId === batch.id ? (
                          <Input
                            type="date"
                            aria-label={`Expiry date for batch ${batch.batch_number}`}
                            value={editingExpiry.value}
                            onChange={(event) => setEditingExpiry({ ...editingExpiry, value: event.target.value })}
                            className="min-w-36"
                          />
                        ) : batch.expiration_date ? (
                          format(new Date(`${batch.expiration_date}T00:00:00`), "MMM d, yyyy")
                        ) : "—"}
                      </TableCell>
                      {canEditBatchExpiry && (
                        <TableCell>
                          {editingExpiry?.batchId === batch.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Save batch expiry"
                                title="Save expiry"
                                disabled={updateBatchExpiration.isPending}
                                onClick={() => void saveBatchExpiry()}
                              >
                                <Save className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label="Cancel batch expiry edit"
                                title="Cancel"
                                disabled={updateBatchExpiration.isPending}
                                onClick={() => setEditingExpiry(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit expiry for batch ${batch.batch_number}`}
                              title="Edit expiry"
                              onClick={() => setEditingExpiry({ batchId: batch.id, value: batch.expiration_date || "" })}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
