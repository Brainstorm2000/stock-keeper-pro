import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Factory, Pencil, Plus, Trash2 } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";
import {
  useDeleteManualProduction,
  useManualProductionHistory,
  useRecordManualProduction,
  useUpdateManualProduction,
  type ManualProductionRecord,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  const updateProduction = useUpdateManualProduction();
  const deleteProduction = useDeleteManualProduction();
  const { canCreate, canEdit } = useModuleAccess("production");
  const [editingRecord, setEditingRecord] = useState<ManualProductionRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<ManualProductionRecord | null>(null);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
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
  const selectedProduct =
    availableProducts.find((product) => product.id === productId) ||
    (editingRecord ? products.find((product) => product.id === productId) : undefined);

  const resetForm = () => {
    setProductId("");
    setQuantity("");
    setExpirationDate("");
    setNotes("");
    setEditingRecord(null);
  };

  const startEditing = (record: ManualProductionRecord) => {
    if (!record.products) return;
    setEditingRecord(record);
    setProductId(record.product_id);
    setQuantity(
      String(
        Number(record.batch_initial_quantity ?? record.change_amount) /
          getProductStockFactor(record.products),
      ),
    );
    setExpirationDate(record.expiration_date || "");
    setNotes(record.notes || "");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(quantity);
    if (!selectedProduct || !Number.isFinite(amount) || amount <= 0) return;

    const stockQuantity = amount * getProductStockFactor(selectedProduct);
    if (editingRecord) {
      await updateProduction.mutateAsync({
        historyId: editingRecord.id,
        quantity: stockQuantity,
        notes,
        expirationDate: expirationDate || null,
      });
    } else {
      await recordProduction.mutateAsync({
        productId: selectedProduct.id,
        quantity: stockQuantity,
        notes,
        expirationDate: expirationDate || null,
      });
    }
    resetForm();
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
          {canCreate || (editingRecord && canEdit) ? (
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="quick-production-product">Product</Label>
                <Select value={productId} onValueChange={setProductId} disabled={!!editingRecord}>
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
              <div className="space-y-2">
                <Label htmlFor="quick-production-expiration">Expiry date (optional)</Label>
                <Input
                  id="quick-production-expiration"
                  type="date"
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(event.target.value)}
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
                  disabled={
                    !selectedProduct ||
                    !quantity ||
                    recordProduction.isPending ||
                    updateProduction.isPending
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {recordProduction.isPending || updateProduction.isPending
                    ? "Saving..."
                    : editingRecord
                      ? "Save Changes"
                      : "Record Production"}
                </Button>
                {editingRecord && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel Edit
                  </Button>
                )}
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
                  {canEdit && <TableHead>Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5} className="py-8 text-center text-muted-foreground">
                      Loading production records...
                    </TableCell>
                  </TableRow>
                ) : accessibleRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 6 : 5} className="py-8 text-center text-muted-foreground">
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
                        {(
                          Number(record.batch_initial_quantity ?? record.change_amount) /
                          (record.products
                            ? getProductStockFactor(record.products)
                            : 1)
                        ).toLocaleString()}{" "}
                        {record.products?.sub_units?.abbreviation || record.products?.units?.abbreviation || ""}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">
                        {record.notes || "—"}
                      </TableCell>
                      {canEdit && (
                        <TableCell>
                          {record.batch_source_type === "manual_production" ? (
                            <div className="flex gap-1">
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                aria-label="Edit production record"
                                onClick={() => startEditing(record)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive"
                                aria-label="Delete production record"
                                onClick={() => setDeletingRecord(record)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : record.batch_source_type === "manual_production_deleted" ? (
                            <span className="text-xs text-muted-foreground">
                              Reversed
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Legacy record
                            </span>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <AlertDialog
        open={!!deletingRecord}
        onOpenChange={(open) => !open && setDeletingRecord(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete production record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the produced quantity from stock. It can only be
              deleted if the units from this batch have not already been used.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Record</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteProduction.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (event) => {
                event.preventDefault();
                if (!deletingRecord) return;
                await deleteProduction.mutateAsync(deletingRecord.id);
                if (editingRecord?.id === deletingRecord.id) resetForm();
                setDeletingRecord(null);
              }}
            >
              Delete Record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
