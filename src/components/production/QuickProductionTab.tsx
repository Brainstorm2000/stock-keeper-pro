import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Factory, Plus } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import {
  useManualProductionHistory,
  useRecordManualProduction,
} from "@/hooks/useProduction";
import { useBranches, useMyBranchAssignments } from "@/hooks/useBranches";
import { useAuth } from "@/lib/auth";
import { useModuleAccess } from "@/components/access/ModuleAccessGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProductStockFactor, getProductSubUnitLabel } from "@/lib/product-units";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function QuickProductionTab({
  branchFilter,
}: {
  branchFilter?: string;
}) {
  const { isSuperAdmin } = useAuth();
  const { data: products = [] } = useProducts();
  const { data: branches = [] } = useBranches();
  const { data: assignments = [] } = useMyBranchAssignments();
  const { data: records = [], isLoading } = useManualProductionHistory();
  const recordProduction = useRecordManualProduction();
  const { canCreate } = useModuleAccess("production");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");

  const accessibleBranchIds = useMemo(
    () => new Set(isSuperAdmin ? branches.map((branch) => branch.id) : assignments.map((assignment) => assignment.branch_id)),
    [assignments, branches, isSuperAdmin],
  );
  const availableProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          product.category === "sellable" &&
          product.item_type === "product" &&
          accessibleBranchIds.has(product.branch_id) &&
          (!branchFilter || branchFilter === "all" || product.branch_id === branchFilter),
      ),
    [accessibleBranchIds, branchFilter, products],
  );
  const accessibleRecords = records.filter((record) => {
    const recordBranchId = record.products?.branch_id;
    return (
      !!recordBranchId &&
      accessibleBranchIds.has(recordBranchId) &&
      (!branchFilter || branchFilter === "all" || recordBranchId === branchFilter)
    );
  });
  const selectedProduct = availableProducts.find((product) => product.id === productId);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(quantity);
    if (!selectedProduct || !Number.isFinite(amount) || amount <= 0) return;

    await recordProduction.mutateAsync({
      productId: selectedProduct.id,
      quantity: amount * getProductStockFactor(selectedProduct),
      notes,
    });
    setProductId("");
    setQuantity("");
    setNotes("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Factory className="h-4 w-4" />
            Record Finished-Goods Production
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canCreate ? (
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-production-product">Product</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="quick-production-product">
                    <SelectValue placeholder="Select a stock-managed product" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} · {product.branches?.name || "Branch"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProduct && (
                  <p className="text-sm text-muted-foreground">
                    Current stock: {Number(selectedProduct.current_stock)}{" "}
                    {getProductSubUnitLabel(selectedProduct) || selectedProduct.units?.abbreviation || ""}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quick-production-quantity">Quantity produced</Label>
                <Input
                  id="quick-production-quantity"
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="quick-production-notes">Notes (optional)</Label>
                <Textarea
                  id="quick-production-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  type="submit"
                  disabled={!selectedProduct || !quantity || recordProduction.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {recordProduction.isPending ? "Recording..." : "Record Production"}
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              You need production create permission to record finished-goods production.
            </p>
          )}
          {canCreate && availableProducts.length === 0 && (
            <p className="mt-4 text-sm text-muted-foreground">
              No stock-managed sellable products are available for this branch.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Direct Production</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading production records...
                    </TableCell>
                  </TableRow>
                ) : accessibleRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No direct production records found
                    </TableCell>
                  </TableRow>
                ) : (
                  accessibleRecords.slice(0, 20).map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(record.created_at), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{record.products?.name || "—"}</TableCell>
                      <TableCell>{record.products?.branches?.name || "—"}</TableCell>
                      <TableCell className="text-right">
                        {Number(record.change_amount).toLocaleString()}{" "}
                        {record.products?.sub_units?.abbreviation || record.products?.units?.abbreviation || ""}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {record.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
