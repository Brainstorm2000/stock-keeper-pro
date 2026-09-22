import { useMemo, useState } from "react";
import { FileText, Plus, ReceiptText, ShieldCheck, WalletCards, Pencil, Search, Trash2 } from "lucide-react";
import { startOfYear, endOfYear, format } from "date-fns";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ModuleAccessGuard } from "@/components/access/ModuleAccessGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { usePagination } from "@/hooks/usePagination";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useSales } from "@/hooks/useSales";
import { useExpenses } from "@/hooks/useExpenses";
import { useAssets } from "@/hooks/useAssets";
import { useStaff } from "@/hooks/useStaff";
import { useProducts } from "@/hooks/useProducts";
import { useCreateWhtCredit, useDeleteWhtCredit, useUpdateWhtCredit, useWhtCredits, type WhtCredit } from "@/hooks/useTax";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { getTaxableSales } from "@/lib/taxable-sales";

const DEFAULT_CIT_RATE = 7.5;

export default function Tax() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { data: sales = [] } = useSales();
  const { data: products = [] } = useProducts();
  const { data: expenses = [] } = useExpenses();
  const { data: assets = [] } = useAssets();
  const { data: staff = [] } = useStaff();
  const { data: whtCredits = [] } = useWhtCredits();
  const createWhtCredit = useCreateWhtCredit();
  const updateWhtCredit = useUpdateWhtCredit();
  const deleteWhtCredit = useDeleteWhtCredit();
  const [citRate, setCitRate] = useState(DEFAULT_CIT_RATE);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDate, setCreditDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reference, setReference] = useState("");
  const [editingCredit, setEditingCredit] = useState<WhtCredit | null>(null);
  const [deleteCreditId, setDeleteCreditId] = useState<string | null>(null);
  const [whtSearch, setWhtSearch] = useState("");
  const [whtSource, setWhtSource] = useState("all");
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());
  const inYear = (date: string) => { const value = new Date(date); return value >= yearStart && value <= yearEnd; };

  const currentSales = sales.filter((sale) => inYear(sale.created_at) && sale.status === "completed");
  const taxableSales = getTaxableSales(currentSales, products);
  const taxableProductIds = new Set(products.filter((product) => product.is_taxable).map((product) => product.id));
  const currentExpenses = expenses.filter((expense) => inYear(expense.expense_date));
  const revenue = taxableSales.reduce((sum, sale) => {
    const taxableItems = (sale.sale_items || []).filter((item) => taxableProductIds.has(item.product_id));
    return sum + taxableItems.reduce((items, item) => items + Number(item.total_price ?? (Number(item.quantity || 0) * Number(item.unit_price || 0))), 0);
  }, 0);
  const costOfSales = taxableSales.reduce((sum, sale) => {
    const taxableItems = (sale.sale_items || []).filter((item) => taxableProductIds.has(item.product_id));
    return sum + taxableItems.reduce((items, item) => items + Number(item.quantity || 0) * Number(item.cost_price || 0), 0);
  }, 0);
  const allowableExpenses = currentExpenses.filter((expense) => expense.is_tax_allowable).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const disallowableExpenses = currentExpenses.filter((expense) => !expense.is_tax_allowable).reduce((sum, expense) => sum + Number(expense.amount), 0);
  const taxableProfit = Math.max(0, revenue - costOfSales - allowableExpenses);
  const estimatedCit = taxableProfit * (citRate / 100);
  const whtTotal = whtCredits.filter((credit) => inYear(credit.credit_date)).reduce((sum, credit) => sum + Number(credit.amount), 0);
  const saleWhtTotal = taxableSales.reduce((sum, sale) => sum + Number(sale.wht_amount || 0), 0);
  const totalWhtCredits = whtTotal + saleWhtTotal;
  const netLiability = Math.max(0, estimatedCit - totalWhtCredits);
  const gaugePercent = estimatedCit ? Math.min(100, (netLiability / estimatedCit) * 100) : 0;
  const currentYearAssets = assets.filter((asset) => asset.purchase_date && inYear(asset.purchase_date));
  const taxableSaleIds = new Set(taxableSales.map((sale) => sale.id));
  const whtRows = [
    ...sales
      .filter((sale) => taxableSaleIds.has(sale.id) && Number(sale.wht_amount || 0) > 0)
      .map((sale) => ({
        id: `sale-${sale.id}`,
        date: sale.created_at,
        source: "Sale",
        payer: sale.customer_name || "Walk-in customer",
        reference: sale.sale_number,
        amount: Number(sale.wht_amount || 0),
      })),
    ...whtCredits.map((credit) => ({
      id: `credit-${credit.id}`,
      date: credit.credit_date,
      source: "Manual credit",
      payer: credit.payer_name,
      reference: credit.reference || "-",
      amount: Number(credit.amount || 0),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const filteredWhtRows = useMemo(() => {
    const query = whtSearch.trim().toLowerCase();
    return whtRows.filter((row) => {
      const matchesSearch = !query || `${row.payer} ${row.reference}`.toLowerCase().includes(query);
      const matchesSource = whtSource === "all" || row.source === whtSource;
      return matchesSearch && matchesSource;
    });
  }, [whtRows, whtSearch, whtSource]);
  const { paginatedItems: paginatedWhtRows, currentPage, totalPages, totalItems, pageSize, goToPage, setPageSize } = usePagination(filteredWhtRows);

  const saveCredit = async () => {
    if (!payerName || !creditAmount) return;
    const input = { credit_date: creditDate, payer_name: payerName, reference: reference || null, amount: Number(creditAmount), notes: editingCredit?.notes || null };
    if (editingCredit) {
      await updateWhtCredit.mutateAsync({ id: editingCredit.id, ...input });
    } else {
      await createWhtCredit.mutateAsync(input);
    }
    setPayerName(""); setCreditAmount(""); setReference(""); setEditingCredit(null); setCreditDialogOpen(false);
  };

  const openEditCredit = (credit: WhtCredit) => {
    setEditingCredit(credit);
    setPayerName(credit.payer_name);
    setCreditAmount(String(credit.amount));
    setCreditDate(credit.credit_date);
    setReference(credit.reference || "");
    setCreditDialogOpen(true);
  };

  const confirmDeleteCredit = async () => {
    if (!deleteCreditId) return;
    await deleteWhtCredit.mutateAsync(deleteCreditId);
    setDeleteCreditId(null);
  };

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="tax">
        <div className="space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h1 className="text-2xl font-bold">Tax readiness</h1><p className="text-muted-foreground">Year-to-date estimate and filing schedules for {format(new Date(), "yyyy")}.</p></div>
            <div className="flex gap-2">
              {isAdmin && <Button onClick={() => { setEditingCredit(null); setCreditDialogOpen(true); }}><Plus className="mr-2 h-4 w-4" />Add WHT credit</Button>}
            </div>
          </div>

          <Tabs defaultValue="readiness" className="space-y-6">
            <TabsList>
              <TabsTrigger value="readiness">Readiness</TabsTrigger>
              <TabsTrigger value="wht">WHT records ({whtRows.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="readiness" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ReceiptText className="h-4 w-4" />Estimated CIT accrued</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(estimatedCit)}</p><p className="text-xs text-muted-foreground">{citRate}% of estimated taxable profit</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" />WHT credits available</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalWhtCredits)}</p><p className="text-xs text-muted-foreground">{formatCurrency(saleWhtTotal)} from sales, {formatCurrency(whtTotal)} manual credits</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><WalletCards className="h-4 w-4" />Net estimated liability</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(netLiability)}</p><p className="text-xs text-muted-foreground">After WHT offsets</p></CardContent></Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <Card><CardHeader><CardTitle>Liability gauge</CardTitle></CardHeader><CardContent className="flex flex-col items-center gap-5">
              <div className="relative grid h-48 w-48 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) ${gaugePercent}%, hsl(var(--muted)) 0)` }}><div className="grid h-36 w-36 place-items-center rounded-full bg-background text-center"><span className="text-3xl font-bold">{Math.round(gaugePercent)}%</span><span className="text-xs text-muted-foreground">unoffset</span></div></div>
              <div className="grid w-full grid-cols-2 gap-3 text-sm"><span className="text-muted-foreground">Taxable profit</span><span className="text-right font-medium">{formatCurrency(taxableProfit)}</span><span className="text-muted-foreground">Allowable expenses</span><span className="text-right font-medium">{formatCurrency(allowableExpenses)}</span><span className="text-muted-foreground">Disallowable expenses</span><span className="text-right font-medium">{formatCurrency(disallowableExpenses)}</span></div>
              <div className="flex w-full items-center gap-2"><Label htmlFor="cit-rate">CIT rate</Label><Input id="cit-rate" type="number" min="0" max="100" value={citRate} onChange={(event) => setCitRate(Number(event.target.value))} className="w-24" /><span className="text-sm text-muted-foreground">%</span></div>
            </CardContent></Card>
            <Card><CardHeader><CardTitle>Tax activity</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><p className="text-muted-foreground">Review the current-year activity contributing to your estimated tax position.</p><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-lg border p-3"><FileText className="mb-2 h-4 w-4 text-primary" /><p className="font-medium">Taxable sales</p><p className="text-xs text-muted-foreground">{taxableSales.length} recorded</p></div><div className="rounded-lg border p-3"><FileText className="mb-2 h-4 w-4 text-primary" /><p className="font-medium">Allowable expenses</p><p className="text-xs text-muted-foreground">{currentExpenses.filter((expense) => expense.is_tax_allowable).length} deductible entries</p></div><div className="rounded-lg border p-3"><FileText className="mb-2 h-4 w-4 text-primary" /><p className="font-medium">Assets acquired</p><p className="text-xs text-muted-foreground">{currentYearAssets.length} this year</p></div></div></CardContent></Card>
          </div>

            </TabsContent>

            <TabsContent value="wht">
              <Card>
                <CardHeader>
                  <CardTitle>All WHT records</CardTitle>
                  <p className="text-sm text-muted-foreground">Sale-linked withholding and manually recorded tax certificates.</p>
                  <div className="flex flex-col gap-3 pt-3 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input value={whtSearch} onChange={(event) => setWhtSearch(event.target.value)} placeholder="Search payer or invoice/reference..." className="pl-9" />
                    </div>
                    <Select value={whtSource} onValueChange={setWhtSource}>
                      <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All sources" /></SelectTrigger>
                      <SelectContent><SelectItem value="all">All sources</SelectItem><SelectItem value="Sale">Sales</SelectItem><SelectItem value="Manual credit">Manual credits</SelectItem></SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Payer</TableHead>
                          <TableHead>Invoice / Reference</TableHead>
                          <TableHead className="text-right">WHT amount</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedWhtRows.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{format(new Date(row.date), "MMM dd, yyyy")}</TableCell>
                            <TableCell><Badge variant={row.source === "Sale" ? "secondary" : "outline"}>{row.source}</Badge></TableCell>
                            <TableCell>{row.payer}</TableCell>
                            <TableCell className="font-mono text-sm">{row.reference}</TableCell>
                            <TableCell className="text-right font-medium text-emerald-600">{formatCurrency(row.amount)}</TableCell>
                            <TableCell>
                              {row.source === "Manual credit" && isAdmin && (() => {
                                const credit = whtCredits.find((item) => `credit-${item.id}` === row.id);
                                return credit ? <div className="flex gap-1"><Button variant="ghost" size="icon" title="Edit WHT credit" onClick={() => openEditCredit(credit)}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="icon" title="Delete WHT credit" onClick={() => setDeleteCreditId(credit.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div> : null;
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                        {!whtRows.length && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No WHT records found</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={goToPage} onPageSizeChange={setPageSize} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <Dialog open={creditDialogOpen} onOpenChange={(open) => { setCreditDialogOpen(open); if (!open) setEditingCredit(null); }}><DialogContent><DialogHeader><DialogTitle>{editingCredit ? "Edit WHT credit" : "Record WHT credit"}</DialogTitle></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label>Payer</Label><Input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="Customer or withholding agent" /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Amount</Label><Input type="number" min="0" step="0.01" value={creditAmount} onChange={(event) => setCreditAmount(event.target.value)} /></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={creditDate} onChange={(event) => setCreditDate(event.target.value)} /></div></div><div className="space-y-2"><Label>Certificate/reference</Label><Input value={reference} onChange={(event) => setReference(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCreditDialogOpen(false)}>Cancel</Button><Button onClick={saveCredit} disabled={createWhtCredit.isPending || updateWhtCredit.isPending || !payerName || !creditAmount}>{editingCredit ? "Update credit" : "Save credit"}</Button></DialogFooter></DialogContent></Dialog>
          <AlertDialog open={!!deleteCreditId} onOpenChange={(open) => { if (!open) setDeleteCreditId(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete WHT credit?</AlertDialogTitle><AlertDialogDescription>This manual WHT credit will be removed from the tax dashboard and WHT records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteCredit} disabled={deleteWhtCredit.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </div>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}