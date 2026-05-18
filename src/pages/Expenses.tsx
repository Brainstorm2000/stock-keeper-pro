import { useState, useEffect, useMemo } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Trash2,
  Pencil,
  Upload,
  Tags,
  Calendar,
  Loader2,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ModuleAccessGuard,
  useModuleAccess,
} from "@/components/access/ModuleAccessGuard";
import { useBranches, useDefaultBranchId } from "@/hooks/useBranches";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/lib/auth";
import {
  useExpenses,
  useExpenseCategories,
  useCreateExpense,
  useUpdateExpense,
  useDeleteExpense,
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  uploadExpenseReceipt,
  getExpenseReceiptUrl,
  type Expense,
  type ExpenseCategory,
} from "@/hooks/useExpenses";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

export default function Expenses() {
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [uploading, setUploading] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [categoryId, setCategoryId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  // Category form
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDescription, setNewCategoryDescription] = useState("");

  const {
    user,
    loading: authLoading,
    isAdmin,
    hasCompletedOnboarding,
  } = useAuth();
  const { canCreate, canEdit, canDelete } = useModuleAccess("expenses");
  const { data: expenses = [], isLoading: expensesLoading } = useExpenses();
  const { data: categories = [] } = useExpenseCategories();
  const { data: branches = [] } = useBranches();
  const defaultBranchId = useDefaultBranchId();
  const { data: organization } = useOrganization();
  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const deleteExpense = useDeleteExpense();
  const createCategory = useCreateExpenseCategory();
  const deleteCategory = useDeleteExpenseCategory();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && user && hasCompletedOnboarding === false) {
      navigate("/onboarding");
    }
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  // Default branch for new expenses
  useEffect(() => {
    if (!editingExpense && !branchId && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [defaultBranchId, editingExpense, branchId]);

  // Filter expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      const matchesSearch =
        expense.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (expense.notes &&
          expense.notes.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        filterCategory === "all" || expense.category_id === filterCategory;
      const matchesBranch =
        filterBranch === "all" || expense.branch_id === filterBranch;
      return matchesSearch && matchesCategory && matchesBranch;
    });
  }, [expenses, searchQuery, filterCategory, filterBranch]);

  const {
    paginatedItems: paginatedExpenses,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    goToPage,
  } = usePagination(filteredExpenses);

  // Calculate totals
  const totalExpenses = filteredExpenses.reduce(
    (sum, e) => sum + Number(e.amount),
    0,
  );

  const resetForm = () => {
    setAmount("");
    setDescription("");
    setExpenseDate(format(new Date(), "yyyy-MM-dd"));
    setCategoryId("");
    setBranchId(defaultBranchId || "");
    setNotes("");
    setReceiptUrl("");
    setReceiptFile(null);
    setEditingExpense(null);
  };

  const handleEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setAmount(String(expense.amount));
    setDescription(expense.description);
    setExpenseDate(expense.expense_date);
    setCategoryId(expense.category_id || "");
    setBranchId(expense.branch_id || "");
    setNotes(expense.notes || "");
    setReceiptUrl(expense.receipt_url || "");
    setExpenseDialogOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Only JPG, JPEG, and PNG allowed",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Maximum file size is 5MB",
          variant: "destructive",
        });
        e.target.value = "";
        return;
      }
      setReceiptFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!organization?.id) {
      toast({ title: "Organization not found", variant: "destructive" });
      return;
    }

    if (!amount || !description) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    let finalReceiptUrl = receiptUrl;

    // Upload receipt if file selected
    if (receiptFile) {
      try {
        setUploading(true);
        finalReceiptUrl = await uploadExpenseReceipt(
          receiptFile,
          organization.id,
        );
      } catch (error) {
        toast({ title: "Failed to upload receipt", variant: "destructive" });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const expenseData = {
      organization_id: organization.id,
      amount: Number(amount),
      description,
      expense_date: expenseDate,
      category_id: categoryId && categoryId !== "none" ? categoryId : undefined,
      branch_id: branchId && branchId !== "none" ? branchId : undefined,
      notes: notes || undefined,
      receipt_url: finalReceiptUrl || undefined,
    };

    if (editingExpense) {
      await updateExpense.mutateAsync({
        id: editingExpense.id,
        ...expenseData,
      });
    } else {
      await createExpense.mutateAsync(expenseData);
    }

    setExpenseDialogOpen(false);
    resetForm();
  };

  const handleCreateCategory = async () => {
    if (!organization?.id || !newCategoryName) {
      toast({ title: "Please enter category name", variant: "destructive" });
      return;
    }

    await createCategory.mutateAsync({
      organization_id: organization.id,
      name: newCategoryName,
      description: newCategoryDescription || undefined,
    });

    setNewCategoryName("");
    setNewCategoryDescription("");
    setCategoryDialogOpen(false);
  };

  const confirmDelete = async () => {
    if (deleteExpenseId) {
      await deleteExpense.mutateAsync(deleteExpenseId);
      setDeleteExpenseId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="expenses">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Expenses</h1>
              <p className="text-muted-foreground">
                Track and manage your expenses
              </p>
            </div>

            {isAdmin && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCategoryDialogOpen(true)}
                >
                  <Tags className="mr-2 h-4 w-4" />
                  Categories
                </Button>
                <Button
                  onClick={() => {
                    resetForm();
                    setExpenseDialogOpen(true);
                  }}
                  className="bg-[#FF9E3D] hover:bg-[#e88d30] text-[#000B26] font-bold shadow-md shadow-amber-500/10 transition-all active:scale-[0.98]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </div>
            )}
          </div>

          {/* Summary Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Expenses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(totalExpenses)}
              </div>
              <p className="text-sm text-muted-foreground">
                {filteredExpenses.length} expense records
              </p>
            </CardContent>
          </Card>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {branches.length > 0 && (
              <Select value={filterBranch} onValueChange={setFilterBranch}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Expenses Table */}
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  {branches.length > 0 && <TableHead>Branch</TableHead>}
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  {isAdmin && (
                    <TableHead className="w-[100px]">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {expensesLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={branches.length > 0 ? 7 : 6}
                      className="text-center py-8"
                    >
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredExpenses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={branches.length > 0 ? 7 : 6}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No expenses found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>
                        {format(new Date(expense.expense_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{expense.description}</p>
                          {expense.notes && (
                            <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {expense.notes}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {expense.expense_categories ? (
                          <Badge variant="secondary">
                            {expense.expense_categories.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {branches.length > 0 && (
                        <TableCell>{expense.branches?.name || "-"}</TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(expense.amount))}
                      </TableCell>
                      <TableCell>
                        {expense.receipt_url ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              try {
                                const url = await getExpenseReceiptUrl(
                                  expense.receipt_url!,
                                );
                                window.open(
                                  url,
                                  "_blank",
                                  "noopener,noreferrer",
                                );
                              } catch (e: any) {
                                toast({
                                  title: "Could not open receipt",
                                  description: e?.message ?? "Unknown error",
                                  variant: "destructive",
                                });
                              }
                            }}
                          >
                            <FileText className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(expense)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteExpenseId(expense.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={goToPage}
            />
          </Card>
        </div>

        {/* Expense Dialog */}
        <Dialog
          open={expenseDialogOpen}
          onOpenChange={(open) => {
            setExpenseDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {editingExpense ? "Edit Expense" : "Add Expense"}
              </DialogTitle>
            </DialogHeader>

            {/* Scrollable middle section */}
            <div className="flex-1 overflow-y-auto pr-2 space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description *</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Office supplies"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {branches.length > 0 && (
                  <div className="space-y-2">
                    <Label>Branch</Label>
                    <Select value={branchId} onValueChange={setBranchId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select branch" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No branch</SelectItem>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Receipt</Label>
                <div className="flex gap-2">
                  <Input
                    type="file"
                    accept=".jpg,.jpeg,.png"
                    onChange={handleFileChange}
                    className="flex-1"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, JPEG, or PNG only. Max 5MB.
                </p>
                {receiptUrl && !receiptFile && (
                  <a
                    href={receiptUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#FF9E3D] flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View current receipt
                  </a>
                )}
                {receiptFile && (
                  <p className="text-sm text-muted-foreground">
                    New file: {receiptFile.name}
                  </p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setExpenseDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                className="bg-[#FF9E3D] hover:bg-[#e88d30] text-[#000B26] font-bold"
                disabled={
                  createExpense.isPending ||
                  updateExpense.isPending ||
                  uploading
                }
              >
                {createExpense.isPending ||
                updateExpense.isPending ||
                uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {uploading ? "Uploading..." : "Saving..."}
                  </>
                ) : editingExpense ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Dialog */}
        <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Expense Categories</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>New Category Name</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Office Supplies"
                  />
                  <Button
                    onClick={handleCreateCategory}
                    disabled={createCategory.isPending}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Existing Categories</Label>
                {categories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No categories yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center justify-between p-2 rounded bg-muted"
                      >
                        <span>{cat.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteCategory.mutate(cat.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCategoryDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog
          open={!!deleteExpenseId}
          onOpenChange={() => setDeleteExpenseId(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Expense</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this expense? This action cannot
                be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
