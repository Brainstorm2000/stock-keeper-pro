import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseCSV, generateCSVTemplate, downloadCSV, type ParsedCSVProduct } from '@/lib/csv-utils';
import { useUnits, useCreateUnit } from '@/hooks/useUnits';
import { useBranches, useCreateBranch } from '@/hooks/useBranches';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useBrands, useCreateBrand } from '@/hooks/useBrands';
import { useCreateProduct, checkProductDuplicate } from '@/hooks/useProducts';
import {
  useProductAttributes,
  useCreateAttribute,
  useCreateAttributeValue,
  saveProductVariations,
  type VariationDraft,
} from '@/hooks/useProductVariations';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useCreateProductCategory, useProductCategories } from '@/hooks/useProductCategories';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
 import { ArrowDown, FileText, AlertCircle, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ImportStatus = 'idle' | 'parsing' | 'preview' | 'importing' | 'complete' | 'error';

interface ImportResult {
  imported: number;
  updated: number;
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
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: units = [] } = useUnits();
  const { data: branches = [] } = useBranches();
  const { data: suppliers = [] } = useSuppliers();
  const { data: brands = [] } = useBrands();
  const { data: productCategories = [] } = useProductCategories();
  const { data: organization } = useOrganization();
  const { data: attributes = [], refetch: refetchAttributes } = useProductAttributes();
  const createAttribute = useCreateAttribute();
  const createAttributeValue = useCreateAttributeValue();
  const createUnit = useCreateUnit();
  const createBranch = useCreateBranch();
  const createSupplier = useCreateSupplier();
  const createBrand = useCreateBrand();
  const createProductCategory = useCreateProductCategory();
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
    if (!organization?.id) {
      toast({
        title: 'Organization not found',
        description: 'Please refresh the page and try again.',
        variant: 'destructive',
      });
      return;
    }

    setStatus('importing');
    const parentRows = parsedProducts.filter((p) => !p.is_variation);
    const variationRows = parsedProducts.filter((p) => p.is_variation);
    setImportProgress({ current: 0, total: parentRows.length + variationRows.length });
    
    const result: ImportResult = {
      imported: 0,
      updated: 0,
      skipped: 0,
      skippedProducts: [],
    };

    try {
      // Create missing units, branches, suppliers, and brands first
      const unitMap = new Map(units.map((u) => [u.name.toLowerCase(), u.id]));
      const branchMap = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));
      const supplierMap = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));
      const brandMap = new Map(brands.map((b) => [b.name.toLowerCase(), b.id]));
      const productCategoryMap = new Map(productCategories.map((category) => [category.name.toLowerCase(), category.id]));

      for (const product of parentRows) {
        const unitNames = [product.unit_name, product.sub_unit_name].filter(
          (name): name is string => !!name,
        );
        if (
          product.sub_unit_name &&
          product.sub_unit_name.toLowerCase() === product.unit_name.toLowerCase()
        ) {
          throw new Error(`Product "${product.name}" must use a different main unit and sub unit`);
        }
        for (const unitNameValue of unitNames) {
          const unitName = unitNameValue.toLowerCase();
          if (!unitMap.has(unitName)) {
            const newUnit = await createUnit.mutateAsync({
              name: unitNameValue,
              abbreviation: unitNameValue.substring(0, 3).toLowerCase(),
            });
            unitMap.set(unitName, newUnit.id);
          }
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

        if (product.supplier_name) {
          const supplierName = product.supplier_name.toLowerCase();
          if (!supplierMap.has(supplierName)) {
            const newSupplier = await createSupplier.mutateAsync({ 
              name: product.supplier_name,
              organization_id: organization.id,
            });
            supplierMap.set(supplierName, newSupplier.id);
          }
        }

        if (product.brand_name) {
          const brandName = product.brand_name.toLowerCase();
          if (!brandMap.has(brandName)) {
            const newBrand = await createBrand.mutateAsync({ 
              name: product.brand_name,
              organization_id: organization.id,
            });
            brandMap.set(brandName, newBrand.id);
          }
        }
      }

      // Import products with duplicate checking
      const createdParentIdBySku = new Map<string, string>();
      const createdParentIdByName = new Map<string, string>();
      for (let i = 0; i < parentRows.length; i++) {
        const product = parentRows[i];
        const unitId = unitMap.get(product.unit_name.toLowerCase());
        const subUnitId = product.sub_unit_name
          ? unitMap.get(product.sub_unit_name.toLowerCase())
          : undefined;
        const stockFactor = subUnitId ? product.sub_unit_factor : 1;
        const branchId = product.branch_name 
          ? branchMap.get(product.branch_name.toLowerCase()) 
          : undefined;
        const supplierId = product.supplier_name 
          ? supplierMap.get(product.supplier_name.toLowerCase()) 
          : undefined;
        const brandId = product.brand_name 
          ? brandMap.get(product.brand_name.toLowerCase()) 
          : undefined;

        if (!unitId) {
          throw new Error(`Unit not found for product: ${product.name}`);
        }

        const productCategoryName = product.product_category_name?.trim() || 'Uncategorized';
        const productCategoryKey = productCategoryName.toLowerCase();
        if (!productCategoryMap.has(productCategoryKey)) {
          const createdCategory = await createProductCategory.mutateAsync(productCategoryName);
          productCategoryMap.set(productCategoryKey, createdCategory.id);
        }

        // Match existing records by name and branch or by SKU, then update them.
        const duplicateCheck = await checkProductDuplicate(
          product.name,
          branchId || null,
          product.sku || null
        );

        const productFields = {
          name: product.name,
          unit_id: unitId,
          sub_unit_id: subUnitId ?? null,
          sub_unit_factor: stockFactor,
          sub_unit_selling_price: subUnitId ? product.sub_unit_selling_price ?? 0 : null,
          item_type: product.item_type,
          category: product.category,
          product_category_id: productCategoryMap.get(productCategoryKey),
          opening_stock: product.opening_stock * stockFactor,
          current_stock: product.current_stock * stockFactor,
          low_stock_threshold: product.low_stock_threshold * stockFactor,
          out_of_stock_threshold: product.out_of_stock_threshold * stockFactor,
          cost_price: product.cost_price,
          selling_price: product.selling_price,
          is_taxable: product.is_taxable,
          expiration_date: product.expiration_date || null,
          sku: product.sku,
          description: product.description,
          branch_id: branchId,
          supplier_id: supplierId,
          brand_id: brandId,
        };

        let parentId: string;
        if (duplicateCheck.existingProduct?.id) {
          parentId = duplicateCheck.existingProduct.id;
          const { data: updatedProduct, error: updateError } = await supabase
            .from('products')
            .update({
              ...productFields,
              branch_id: branchId ?? duplicateCheck.existingProduct.branch_id,
              supplier_id: supplierId ?? null,
              brand_id: brandId ?? null,
              sku: product.sku || null,
              description: product.description || null,
            })
            .eq('id', parentId)
            .select('id')
            .single();
          if (updateError) throw updateError;
          if (!updatedProduct) {
            throw new Error(`Product "${product.name}" was not updated. Check that you have edit access.`);
          }
          const previousStock = Number(duplicateCheck.existingProduct.current_stock);
          const newStock = productFields.current_stock;
          if (
            duplicateCheck.existingProduct.item_type === 'product' &&
            product.item_type === 'product' &&
            previousStock !== newStock
          ) {
            const { error: historyError } = await supabase.from('stock_history').insert({
              product_id: parentId,
              previous_stock: previousStock,
              new_stock: newStock,
              change_amount: newStock - previousStock,
              change_type: 'adjustment',
              notes: 'Stock adjusted during CSV import',
              changed_by: user?.id ?? null,
            });
            if (historyError) throw historyError;
          }
          result.updated++;
        } else {
          const created = await createProduct.mutateAsync({
            ...productFields,
            sku: product.sku || undefined,
            description: product.description || undefined,
            organization_id: organization.id,
          });
          parentId = (created as { id: string }).id;
          result.imported++;
        }

        if (product.sku) createdParentIdBySku.set(product.sku.toLowerCase(), parentId);
        createdParentIdByName.set(product.name.toLowerCase(), parentId);
        setImportProgress({ current: i + 1, total: parentRows.length + variationRows.length });
      }

      // === Pass 2: Variation rows ===
      // Build attribute map (auto-create as needed)
      const attrByName = new Map<string, { id: string; values: Map<string, string> }>();
      for (const a of attributes) {
        attrByName.set(a.name.toLowerCase(), {
          id: a.id,
          values: new Map((a.values || []).map((v) => [v.value.toLowerCase(), v.id])),
        });
      }

      // Group variation rows by parent
      const variationsByParent = new Map<string, typeof variationRows>();
      for (const v of variationRows) {
        const parentKey = (v.parent_sku || v.parent_name || '').toLowerCase();
        const arr = variationsByParent.get(parentKey) || [];
        arr.push(v);
        variationsByParent.set(parentKey, arr);
      }

      let varProgress = parentRows.length;
      for (const [parentKey, rows] of variationsByParent.entries()) {
        // Resolve parent product id
        let parentId = createdParentIdBySku.get(parentKey) || createdParentIdByName.get(parentKey);
        if (!parentId) {
          // Try DB lookup
          const { data: existing } = await supabase
            .from('products')
            .select('id, sku, name')
            .eq('organization_id', organization.id)
            .or(`sku.ilike.${parentKey},name.ilike.${parentKey}`)
            .limit(1);
          parentId = (existing as any)?.[0]?.id;
        }
        if (!parentId) {
          rows.forEach((r) => {
            result.skipped++;
            result.skippedProducts.push(`Variation of ${r.parent_sku || r.parent_name} (parent not found)`);
            varProgress++;
            setImportProgress({ current: varProgress, total: parentRows.length + variationRows.length });
          });
          continue;
        }

        const drafts: VariationDraft[] = [];
        for (const r of rows) {
          const pairs: { attribute_id: string; value_id: string }[] = [];
          for (const att of r.variation_attributes || []) {
            const aKey = att.attribute.toLowerCase();
            let attrEntry = attrByName.get(aKey);
            if (!attrEntry) {
              const created = await createAttribute.mutateAsync({
                name: att.attribute,
                organization_id: organization.id,
              });
              attrEntry = { id: (created as any).id, values: new Map() };
              attrByName.set(aKey, attrEntry);
            }
            const vKey = att.value.toLowerCase();
            let valId = attrEntry.values.get(vKey);
            if (!valId) {
              const createdVal = await createAttributeValue.mutateAsync({
                attribute_id: attrEntry.id,
                value: att.value,
              });
              valId = (createdVal as any).id;
              attrEntry.values.set(vKey, valId!);
            }
            pairs.push({ attribute_id: attrEntry.id, value_id: valId! });
          }
          drafts.push({
            attribute_value_ids: pairs,
            sku: r.variation_sku || '',
            opening_stock: r.variation_stock || 0,
            current_stock: r.variation_stock || 0,
            low_stock_threshold: 10,
            out_of_stock_threshold: 0,
            cost_price: r.variation_cost || 0,
            selling_price: r.variation_price || 0,
            is_active: true,
          });
          varProgress++;
          setImportProgress({ current: varProgress, total: parentRows.length + variationRows.length });
        }

        try {
          await saveProductVariations(parentId, organization.id, drafts);
          result.imported += drafts.length;
        } catch (err) {
          result.skipped += drafts.length;
          result.skippedProducts.push(`${drafts.length} variation(s) for ${parentKey} (save failed)`);
        }
      }

      await refetchAttributes();
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['stock-history'] });

      setImportResult(result);
      setStatus('complete');
      
      if (result.skipped > 0) {
        toast({
          title: 'Import Complete with Duplicates',
          description: `Added ${result.imported}, updated ${result.updated}, skipped ${result.skipped}`,
        });
      } else {
        toast({
          title: 'Import Complete',
          description: `Added ${result.imported}, updated ${result.updated} products`,
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
            <ArrowDown className="h-5 w-5" />
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
                  Added {importResult.imported} new product(s) and updated {importResult.updated}.
                </AlertDescription>
              </Alert>
              
              {importResult.skipped > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4 text-status-low" />
                  <AlertDescription>
                    <p className="font-medium">Skipped {importResult.skipped} row(s):</p>
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
