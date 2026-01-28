import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseCSV, generateCSVTemplate, downloadCSV, type ParsedCSVProduct } from '@/lib/csv-utils';
import { useUnits, useCreateUnit } from '@/hooks/useUnits';
import { useBranches, useCreateBranch } from '@/hooks/useBranches';
import { useCreateProduct, checkProductDuplicate } from '@/hooks/useProducts';
import { useToast } from '@/hooks/use-toast';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'complete' | 'error';

interface ImportResult {
  imported: number;
  skipped: number;
  skippedProducts: string[];
}

export function CSVImportDialog({ open, onOpenChange }: CSVImportDialogProps) {
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [parsedProducts, setParsedProducts] = useState<ParsedCSVProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: units = [] } = useUnits();
  const { data: branches = [] } = useBranches();
  const createUnit = useCreateUnit();
  const createBranch = useCreateBranch();
  const createProduct = useCreateProduct();
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus('parsing');
    setError(null);

    try {
      const content = await file.text();
      const products = parseCSV(content);
      setParsedProducts(products);
      setStatus('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
      setStatus('error');
    }
  };

  const handleImport = async () => {
    setStatus('importing');
    setImportProgress({ current: 0, total: parsedProducts.length });
    
    const result: ImportResult = {
      imported: 0,
      skipped: 0,
      skippedProducts: [],
    };

    try {
      // Create missing units and branches first
      const unitMap = new Map(units.map((u) => [u.name.toLowerCase(), u.id]));
      const branchMap = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));

      for (const product of parsedProducts) {
        const unitName = product.unit_name.toLowerCase();
        if (!unitMap.has(unitName)) {
          const newUnit = await createUnit.mutateAsync({ 
            name: product.unit_name,
            abbreviation: product.unit_name.substring(0, 3).toLowerCase(),
          });
          unitMap.set(unitName, newUnit.id);
        }

        if (product.branch_name) {
          const branchName = product.branch_name.toLowerCase();
          if (!branchMap.has(branchName)) {
            const newBranch = await createBranch.mutateAsync({ 
              name: product.branch_name 
            });
            branchMap.set(branchName, newBranch.id);
          }
        }
      }

      // Import products with duplicate checking
      for (let i = 0; i < parsedProducts.length; i++) {
        const product = parsedProducts[i];
        const unitId = unitMap.get(product.unit_name.toLowerCase());
        const branchId = product.branch_name 
          ? branchMap.get(product.branch_name.toLowerCase()) 
          : undefined;

        if (!unitId) {
          throw new Error(`Unit not found for product: ${product.name}`);
        }

        // Check for duplicates before importing
        const duplicateCheck = await checkProductDuplicate(
          product.name,
          branchId || null,
          product.sku || null
        );

        if (duplicateCheck.isDuplicate) {
          result.skipped++;
          result.skippedProducts.push(
            `${product.name}${product.sku ? ` (SKU: ${product.sku})` : ''}`
          );
          setImportProgress({ current: i + 1, total: parsedProducts.length });
          continue;
        }

        await createProduct.mutateAsync({
          name: product.name,
          unit_id: unitId,
          opening_stock: product.opening_stock,
          current_stock: product.current_stock,
          low_stock_threshold: product.low_stock_threshold,
          out_of_stock_threshold: product.out_of_stock_threshold,
          sku: product.sku,
          description: product.description,
          branch_id: branchId,
        });

        result.imported++;
        setImportProgress({ current: i + 1, total: parsedProducts.length });
      }

      setImportResult(result);
      setStatus('complete');
      
      if (result.skipped > 0) {
        toast({
          title: 'Import Complete with Duplicates',
          description: `Imported ${result.imported} products, skipped ${result.skipped} duplicates`,
        });
      } else {
        toast({
          title: 'Import Complete',
          description: `Successfully imported ${result.imported} products`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStatus('error');
    }
  };

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate();
    downloadCSV(template, 'products_template.csv');
  };

  const handleClose = () => {
    setStatus('idle');
    setParsedProducts([]);
    setError(null);
    setImportProgress({ current: 0, total: 0 });
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Products from CSV
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {status === 'idle' && (
            <>
              <div className="border-2 border-dashed rounded-lg p-8 text-center">
                <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  Select a CSV file to import products
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload">
                  <Button asChild>
                    <span>Select CSV File</span>
                  </Button>
                </label>
              </div>
              <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
                Download Template
              </Button>
            </>
          )}

          {status === 'parsing' && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Parsing CSV file...</span>
            </div>
          )}

          {status === 'preview' && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-status-normal" />
                <AlertDescription>
                  Found {parsedProducts.length} products ready to import
                </AlertDescription>
              </Alert>
              <ScrollArea className="h-[200px] border rounded-lg p-3">
                <div className="space-y-2">
                  {parsedProducts.slice(0, 10).map((product, index) => (
                    <div key={index} className="text-sm p-2 bg-muted rounded">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-muted-foreground ml-2">
                        ({product.unit_name}, Stock: {product.current_stock})
                      </span>
                      {product.branch_name && (
                        <span className="text-muted-foreground ml-2">
                          @ {product.branch_name}
                        </span>
                      )}
                    </div>
                  ))}
                  {parsedProducts.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ...and {parsedProducts.length - 10} more
                    </p>
                  )}
                </div>
              </ScrollArea>
            </>
          )}

          {status === 'importing' && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Importing products... {importProgress.current} / {importProgress.total}
              </p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{
                    width: `${(importProgress.current / importProgress.total) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          {status === 'complete' && importResult && (
            <div className="space-y-3">
              <Alert>
                <CheckCircle2 className="h-4 w-4 text-status-normal" />
                <AlertDescription>
                  Successfully imported {importResult.imported} products!
                </AlertDescription>
              </Alert>
              
              {importResult.skipped > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-status-low" />
                  <AlertDescription>
                    <p className="font-medium">Skipped {importResult.skipped} duplicate(s):</p>
                    <ScrollArea className="h-[100px] mt-2">
                      <ul className="text-sm space-y-1">
                        {importResult.skippedProducts.map((name, index) => (
                          <li key={index}>• {name}</li>
                        ))}
                      </ul>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          {status === 'preview' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport}>
                Import {parsedProducts.length} Products
              </Button>
            </>
          )}
          {(status === 'complete' || status === 'error') && (
            <Button onClick={handleClose}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
