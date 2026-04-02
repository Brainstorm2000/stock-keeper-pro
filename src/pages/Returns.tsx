import { useState } from 'react';
import { format } from 'date-fns';
import { RotateCcw, Package, Eye, Search, Filter } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard } from '@/components/access/ModuleAccessGuard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSaleReturns, type SaleReturn } from '@/hooks/useSaleReturns';
import { usePurchaseReturns, type PurchaseReturn } from '@/hooks/usePurchaseReturns';
import { formatCurrency } from '@/lib/currency';

export default function Returns() {
  const { data: saleReturns = [], isLoading: saleLoading } = useSaleReturns();
  const { data: purchaseReturns = [], isLoading: purchaseLoading } = usePurchaseReturns();
  const [search, setSearch] = useState('');
  const [detailReturn, setDetailReturn] = useState<SaleReturn | PurchaseReturn | null>(null);
  const [detailType, setDetailType] = useState<'sale' | 'purchase'>('sale');

  const filteredSaleReturns = saleReturns.filter(r =>
    r.return_number.toLowerCase().includes(search.toLowerCase()) ||
    r.sales?.sale_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredPurchaseReturns = purchaseReturns.filter(r =>
    r.return_number.toLowerCase().includes(search.toLowerCase()) ||
    r.purchases?.purchase_number?.toLowerCase().includes(search.toLowerCase()) ||
    r.reason?.toLowerCase().includes(search.toLowerCase())
  );

  const totalSaleReturns = saleReturns.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalPurchaseReturns = purchaseReturns.reduce((s, r) => s + Number(r.total_amount), 0);

  const viewDetail = (ret: SaleReturn | PurchaseReturn, type: 'sale' | 'purchase') => {
    setDetailReturn(ret);
    setDetailType(type);
  };

  return (
    <ModuleAccessGuard module="sales" minLevel="view">
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <RotateCcw className="h-6 w-6" /> Returns
            </h1>
            <p className="text-muted-foreground">View all sales and purchase returns</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Sale Returns</div>
                <div className="text-2xl font-bold text-foreground">{saleReturns.length}</div>
                <div className="text-sm text-muted-foreground">{formatCurrency(totalSaleReturns)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Purchase Returns</div>
                <div className="text-2xl font-bold text-foreground">{purchaseReturns.length}</div>
                <div className="text-sm text-muted-foreground">{formatCurrency(totalPurchaseReturns)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Net Returns Value</div>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(totalSaleReturns + totalPurchaseReturns)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search returns..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Tabs defaultValue="sales" className="space-y-4">
            <TabsList>
              <TabsTrigger value="sales">Sale Returns ({filteredSaleReturns.length})</TabsTrigger>
              <TabsTrigger value="purchases">Purchase Returns ({filteredPurchaseReturns.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sale Returns</CardTitle>
                </CardHeader>
                <CardContent>
                  {saleLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : filteredSaleReturns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No sale returns found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Return #</TableHead>
                            <TableHead>Sale #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Refund Method</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Items</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredSaleReturns.map(ret => (
                            <TableRow
                              key={ret.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => viewDetail(ret, 'sale')}
                            >
                              <TableCell className="font-medium">{ret.return_number}</TableCell>
                              <TableCell>{ret.sales?.sale_number || '—'}</TableCell>
                              <TableCell>{format(new Date(ret.return_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>{ret.branches?.name || '—'}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="capitalize">
                                  {ret.refund_method?.replace('_', ' ')}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">{ret.reason || '—'}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(ret.total_amount)}</TableCell>
                              <TableCell>{ret.sale_return_items?.length || 0} items</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="purchases">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Purchase Returns</CardTitle>
                </CardHeader>
                <CardContent>
                  {purchaseLoading ? (
                    <div className="text-center py-8 text-muted-foreground">Loading...</div>
                  ) : filteredPurchaseReturns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">No purchase returns found</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Return #</TableHead>
                            <TableHead>Purchase #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Items</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPurchaseReturns.map(ret => (
                            <TableRow
                              key={ret.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => viewDetail(ret, 'purchase')}
                            >
                              <TableCell className="font-medium">{ret.return_number}</TableCell>
                              <TableCell>{ret.purchases?.purchase_number || '—'}</TableCell>
                              <TableCell>{format(new Date(ret.return_date), 'MMM d, yyyy')}</TableCell>
                              <TableCell>{ret.branches?.name || '—'}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{ret.reason || '—'}</TableCell>
                              <TableCell className="text-right font-medium">{formatCurrency(ret.total_amount)}</TableCell>
                              <TableCell>{ret.purchase_return_items?.length || 0} items</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Detail Dialog */}
        <Dialog open={!!detailReturn} onOpenChange={() => setDetailReturn(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5" />
                {detailType === 'sale' ? 'Sale' : 'Purchase'} Return Details
              </DialogTitle>
            </DialogHeader>
            {detailReturn && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Return #:</span>
                    <span className="ml-2 font-medium">{detailReturn.return_number}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Date:</span>
                    <span className="ml-2">{format(new Date(detailReturn.return_date), 'MMM d, yyyy')}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {detailType === 'sale' ? 'Sale' : 'Purchase'} #:
                    </span>
                    <span className="ml-2">
                      {detailType === 'sale'
                        ? (detailReturn as SaleReturn).sales?.sale_number
                        : (detailReturn as PurchaseReturn).purchases?.purchase_number}
                    </span>
                  </div>
                  {detailType === 'sale' && (
                    <div>
                      <span className="text-muted-foreground">Refund:</span>
                      <span className="ml-2 capitalize">{(detailReturn as SaleReturn).refund_method?.replace('_', ' ')}</span>
                    </div>
                  )}
                  {detailReturn.reason && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Reason:</span>
                      <span className="ml-2">{detailReturn.reason}</span>
                    </div>
                  )}
                  {detailReturn.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes:</span>
                      <span className="ml-2">{detailReturn.notes}</span>
                    </div>
                  )}
                </div>

                <div>
                  <h4 className="font-medium mb-2">Returned Items</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-center">Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailType === 'sale'
                        ? (detailReturn as SaleReturn).sale_return_items?.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>{item.products?.name || 'Unknown'}</TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.total_price)}</TableCell>
                            </TableRow>
                          ))
                        : (detailReturn as PurchaseReturn).purchase_return_items?.map(item => (
                            <TableRow key={item.id}>
                              <TableCell>{item.products?.name || 'Unknown'}</TableCell>
                              <TableCell className="text-center">{item.quantity}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                              <TableCell className="text-right">{formatCurrency(item.total_cost)}</TableCell>
                            </TableRow>
                          ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="text-right text-lg font-bold border-t pt-3">
                  Total: {formatCurrency(detailReturn.total_amount)}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DashboardLayout>
    </ModuleAccessGuard>
  );
}
