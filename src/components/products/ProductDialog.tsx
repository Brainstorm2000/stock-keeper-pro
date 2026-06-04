import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { useUnits } from "@/hooks/useUnits";
import { useBranches, useDefaultBranchId } from "@/hooks/useBranches";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useBrands } from "@/hooks/useBrands";
import {
  useCreateProduct,
  useUpdateProduct,
  checkProductDuplicate,
  type Product,
  type ProductInput,
  type ProductCategory,
} from "@/hooks/useProducts";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, FileDown } from "lucide-react";
import {
  exportProductsToCSV,
  downloadCSV,
  generateCSVTemplate,
} from "@/lib/csv-utils";
import { CSVImportDialog } from "@/components/csv/CSVImportDialog";
import {
  useProductAttributes,
  useCreateAttribute,
  useCreateAttributeValue,
  useProductVariations,
  saveProductVariations,
  type VariationDraft,
} from "@/hooks/useProductVariations";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { generateSku } from "@/lib/sku";

const productSchema = z.object({
  name: z.string().trim().min(1, "Product name is required").max(200),
  unit_id: z.string().min(1, "Unit is required"),
  branch_id: z.string().min(1, "Branch is required"),
  supplier_id: z.string().optional(),
  brand_id: z.string().optional(),
  item_type: z.enum(["product", "service", "variable"]),
  category: z.enum(["sellable", "consumable"]),
  opening_stock: z.coerce.number().min(0, "Must be 0 or greater"),
  current_stock: z.coerce.number().min(0, "Must be 0 or greater"),
  low_stock_threshold: z.coerce.number().min(0, "Must be 0 or greater"),
  out_of_stock_threshold: z.coerce.number().min(0, "Must be 0 or greater"),
  cost_price: z.coerce.number().min(0, "Must be 0 or greater"),
  selling_price: z.coerce.number().min(0, "Must be 0 or greater"),
  sku: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductDialogProps {
  product?: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allProducts?: Product[];
}

export function ProductDialog({
  product,
  open,
  onOpenChange,
  allProducts = [],
}: ProductDialogProps) {
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [csvImportDialogOpen, setCsvImportDialogOpen] = useState(false);
  const [selectedAttributeIds, setSelectedAttributeIds] = useState<string[]>([]);
  const [variationDrafts, setVariationDrafts] = useState<VariationDraft[]>([]);
  const [newAttrName, setNewAttrName] = useState("");
  const [newValueByAttr, setNewValueByAttr] = useState<Record<string, string>>({});
  const { data: units = [] } = useUnits();
  const { data: branches = [] } = useBranches();
  const defaultBranchId = useDefaultBranchId();
  const { data: suppliers = [] } = useSuppliers();
  const { data: brands = [] } = useBrands();
  const { data: organization } = useOrganization();
  const { data: attributes = [] } = useProductAttributes();
  const createAttribute = useCreateAttribute();
  const createAttributeValue = useCreateAttributeValue();
  const { data: existingVariations = [] } = useProductVariations(
    product?.item_type === "variable" ? product?.id : null,
  );
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { isSuperAdmin } = useAuth();
  const { toast } = useToast();

  const isEditing = !!product;
  const isLoading =
    createProduct.isPending || updateProduct.isPending || isCheckingDuplicate;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      unit_id: "",
      branch_id: "",
      supplier_id: "",
      brand_id: "",
      item_type: "product",
      category: "sellable",
      opening_stock: 0,
      current_stock: 0,
      low_stock_threshold: 10,
      out_of_stock_threshold: 0,
      cost_price: 0,
      selling_price: 0,
      sku: "",
      description: "",
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        unit_id: product.unit_id,
        branch_id: product.branch_id || "",
        supplier_id: product.supplier_id || "",
        brand_id: product.brand_id || "",
        item_type: product.item_type || "product",
        category: product.category || "sellable",
        opening_stock: Number(product.opening_stock),
        current_stock: Number(product.current_stock),
        low_stock_threshold: Number(product.low_stock_threshold),
        out_of_stock_threshold: Number(product.out_of_stock_threshold),
        cost_price: Number(product.cost_price) || 0,
        selling_price: Number(product.selling_price) || 0,
        sku: product.sku || "",
        description: product.description || "",
      });
    } else {
      reset({
        name: "",
        unit_id: "",
        branch_id: defaultBranchId || "",
        supplier_id: "",
        brand_id: "",
        item_type: "product",
        category: "sellable",
        opening_stock: 0,
        current_stock: 0,
        low_stock_threshold: 10,
        out_of_stock_threshold: 0,
        cost_price: 0,
        selling_price: 0,
        sku: "",
        description: "",
      });
      setSelectedAttributeIds([]);
      setVariationDrafts([]);
    }
  }, [product, reset, defaultBranchId]);

  // Hydrate variation drafts when editing a variable product
  useEffect(() => {
    if (product?.item_type === "variable" && existingVariations.length > 0) {
      const attrIds = new Set<string>();
      existingVariations.forEach((v) =>
        v.attributes?.forEach((a) => attrIds.add(a.attribute_id)),
      );
      setSelectedAttributeIds(Array.from(attrIds));
      setVariationDrafts(
        existingVariations.map((v) => ({
          id: v.id,
          attribute_value_ids: (v.attributes || []).map((a) => ({
            attribute_id: a.attribute_id,
            value_id: a.value_id,
          })),
          sku: v.sku || "",
          opening_stock: Number(v.opening_stock),
          current_stock: Number(v.current_stock),
          low_stock_threshold: Number(v.low_stock_threshold),
          out_of_stock_threshold: Number(v.out_of_stock_threshold),
          cost_price: Number(v.cost_price),
          selling_price: Number(v.selling_price),
          is_active: v.is_active,
        })),
      );
    }
  }, [product?.id, product?.item_type, existingVariations]);

  const onSubmit = async (data: ProductFormData) => {
    setIsCheckingDuplicate(true);

    try {
      // Check for duplicates
      const duplicateCheck = await checkProductDuplicate(
        data.name,
        data.branch_id || null,
        data.sku || null,
        isEditing ? product?.id : undefined,
      );

      if (duplicateCheck.isDuplicate) {
        const message =
          duplicateCheck.reason === "sku"
            ? `A product with SKU "${data.sku}" already exists.`
            : `A product named "${data.name}" already exists in this branch.`;

        toast({
          title: "Duplicate product",
          description: message,
          variant: "destructive",
        });
        setIsCheckingDuplicate(false);
        return;
      }

      const productData: ProductInput = {
        name: data.name,
        unit_id: data.unit_id,
        branch_id: data.branch_id,
        supplier_id: data.supplier_id || undefined,
        brand_id: data.brand_id || undefined,
        item_type: data.item_type,
        category: data.category,
        opening_stock: data.item_type === "variable" ? 0 : data.opening_stock,
        current_stock: data.item_type === "variable" ? 0 : data.current_stock,
        low_stock_threshold: data.low_stock_threshold,
        out_of_stock_threshold: data.out_of_stock_threshold,
        cost_price: data.item_type === "variable" ? 0 : data.cost_price,
        selling_price: data.item_type === "variable" ? 0 : data.selling_price,
        sku: data.sku || undefined,
        description: data.description || undefined,
      };

      if (data.item_type === "variable" && variationDrafts.length === 0) {
        toast({
          title: "Add at least one variation",
          description: "Variable products need one or more variations.",
          variant: "destructive",
        });
        setIsCheckingDuplicate(false);
        return;
      }

      let savedProductId = product?.id;
      if (isEditing && product) {
        await updateProduct.mutateAsync({ id: product.id, ...productData });
      } else {
        if (!organization?.id) {
          toast({
            title: "Organization not found",
            description: "Please refresh the page and try again.",
            variant: "destructive",
          });
          return;
        }
        const created = await createProduct.mutateAsync({
          ...productData,
          organization_id: organization.id,
        });
        savedProductId = (created as any).id;
      }

      if (data.item_type === "variable" && savedProductId && organization?.id) {
        await saveProductVariations(savedProductId, organization.id, variationDrafts);
      }

      onOpenChange(false);
    } finally {
      setIsCheckingDuplicate(false);
    }
  };

  const selectedUnitId = watch("unit_id");
  const selectedBranchId = watch("branch_id");
  const selectedSupplierId = watch("supplier_id");
  const selectedBrandId = watch("brand_id");
  const selectedItemType = watch("item_type");
  const selectedCategory = watch("category");

  const isVariable = selectedItemType === "variable";

  const handleAddAttribute = async () => {
    if (!newAttrName.trim() || !organization?.id) return;
    const created = await createAttribute.mutateAsync({
      name: newAttrName.trim(),
      organization_id: organization.id,
    });
    setSelectedAttributeIds((prev) => [...prev, created.id]);
    setNewAttrName("");
  };

  const handleAddValue = async (attributeId: string) => {
    const value = newValueByAttr[attributeId]?.trim();
    if (!value) return;
    await createAttributeValue.mutateAsync({ attribute_id: attributeId, value });
    setNewValueByAttr((prev) => ({ ...prev, [attributeId]: "" }));
  };

  const toggleAttribute = (attrId: string) => {
    setSelectedAttributeIds((prev) =>
      prev.includes(attrId) ? prev.filter((id) => id !== attrId) : [...prev, attrId],
    );
  };

  const generateVariations = () => {
    const selectedAttrs = attributes.filter((a) => selectedAttributeIds.includes(a.id));
    if (selectedAttrs.length === 0) {
      toast({ title: "Select at least one attribute", variant: "destructive" });
      return;
    }
    const withValues = selectedAttrs.filter((a) => (a.values?.length || 0) > 0);
    if (withValues.length !== selectedAttrs.length) {
      toast({ title: "Each attribute needs at least one value", variant: "destructive" });
      return;
    }
    // Cartesian product
    let combos: { attribute_id: string; value_id: string; value: string; attribute_name: string }[][] = [[]];
    for (const attr of withValues) {
      const next: typeof combos = [];
      for (const combo of combos) {
        for (const v of attr.values!) {
          next.push([
            ...combo,
            { attribute_id: attr.id, value_id: v.id, value: v.value, attribute_name: attr.name },
          ]);
        }
      }
      combos = next;
    }
    // Avoid duplicates of existing drafts
    const key = (pairs: { attribute_id: string; value_id: string }[]) =>
      [...pairs].sort((a, b) => a.attribute_id.localeCompare(b.attribute_id))
        .map((p) => `${p.attribute_id}:${p.value_id}`).join("|");
    const existingKeys = new Set(variationDrafts.map((d) => key(d.attribute_value_ids)));
    const baseSku = watch("sku")?.trim() || generateSku("VAR");
    const newDrafts: VariationDraft[] = combos
      .filter((c) => !existingKeys.has(key(c.map((x) => ({ attribute_id: x.attribute_id, value_id: x.value_id })))))
      .map((c, idx) => ({
        attribute_value_ids: c.map((x) => ({ attribute_id: x.attribute_id, value_id: x.value_id })),
        sku: `${baseSku}-${variationDrafts.length + idx + 1}`,
        opening_stock: 0,
        current_stock: 0,
        low_stock_threshold: 10,
        out_of_stock_threshold: 0,
        cost_price: 0,
        selling_price: 0,
        is_active: true,
      }));
    setVariationDrafts((prev) => [...prev, ...newDrafts]);
  };

  const variationLabel = (d: VariationDraft) => {
    return d.attribute_value_ids
      .map((p) => {
        const attr = attributes.find((a) => a.id === p.attribute_id);
        const val = attr?.values?.find((v) => v.id === p.value_id);
        return val ? `${attr?.name}: ${val.value}` : "";
      })
      .filter(Boolean)
      .join(" / ");
  };

  const updateDraft = (idx: number, patch: Partial<VariationDraft>) => {
    setVariationDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  };

  const removeDraft = (idx: number) => {
    setVariationDrafts((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleExportCSV = () => {
    const csv = exportProductsToCSV(allProducts, branches, suppliers, brands);
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `products_export_${date}.csv`);
    toast({ title: "Products exported successfully" });
  };

  const handleDownloadTemplate = () => {
    downloadCSV(generateCSVTemplate(), "products_template.csv");
    toast({ title: "Template downloaded" });
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Product" : "Add New Product"}
            </DialogTitle>
          </DialogHeader>

          {!isEditing && (
            <div className="flex flex-wrap gap-2 pb-4 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                <FileDown className="h-4 w-4 mr-1" /> Template
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCsvImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-1" /> Import CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={allProducts.length === 0}
              >
                <Download className="h-4 w-4 mr-1" /> Export CSV
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g., Coca-Cola 500ml"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Type *</Label>
                <Select
                  value={selectedItemType}
                  onValueChange={(value: "product" | "service" | "variable") =>
                    setValue("item_type", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="variable">Variable Product</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value: "sellable" | "consumable") =>
                    setValue("category", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sellable">Sellable</SelectItem>
                    <SelectItem value="consumable">Consumable</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {selectedCategory === "sellable"
                    ? "Sold at POS, appears on invoices, generates revenue"
                    : "Not sold, purchased for internal use, stock managed"}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="unit_id">Unit of Measurement *</Label>
                <Select
                  value={selectedUnitId}
                  onValueChange={(value) => setValue("unit_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.id} value={unit.id}>
                        {unit.name}{" "}
                        {unit.abbreviation && `(${unit.abbreviation})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.unit_id && (
                  <p className="text-sm text-destructive">
                    {errors.unit_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="branch_id">Branch *</Label>
                <Select
                  value={selectedBranchId}
                  onValueChange={(value) => setValue("branch_id", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.branch_id && (
                  <p className="text-sm text-destructive">
                    {errors.branch_id.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Optional)</Label>
                <Input
                  id="sku"
                  {...register("sku")}
                  placeholder="e.g., SKU-001"
                />
              </div>

              {suppliers.length > 0 && (
                <div className="space-y-2">
                  <Label>Supplier (Optional)</Label>
                  <Select
                    value={selectedSupplierId || "none"}
                    onValueChange={(value) =>
                      setValue("supplier_id", value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {brands.length > 0 && (
                <div className="space-y-2">
                  <Label>Brand (Optional)</Label>
                  <Select
                    value={selectedBrandId || "none"}
                    onValueChange={(value) =>
                      setValue("brand_id", value === "none" ? "" : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No brand</SelectItem>
                      {brands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id}>
                          {brand.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!isVariable && (
                <div className="space-y-2">
                  <Label htmlFor="cost_price">Cost Price</Label>
                  <Input
                    id="cost_price"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("cost_price")}
                  />
                  {errors.cost_price && (
                    <p className="text-sm text-destructive">
                      {errors.cost_price.message}
                    </p>
                  )}
                </div>
              )}

              {!isVariable && selectedCategory === "sellable" && (
                <div className="space-y-2">
                  <Label htmlFor="selling_price">Selling Price</Label>
                  <Input
                    id="selling_price"
                    type="number"
                    min="0"
                    step="0.01"
                    {...register("selling_price")}
                  />
                  {errors.selling_price && (
                    <p className="text-sm text-destructive">
                      {errors.selling_price.message}
                    </p>
                  )}
                </div>
              )}

              {selectedItemType === "product" && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="opening_stock">Opening Stock</Label>
                    <Input
                      id="opening_stock"
                      type="number"
                      min="0.00001"
                      step="0.00001"
                      {...register("opening_stock")}
                    />
                    {errors.opening_stock && (
                      <p className="text-sm text-destructive">
                        {errors.opening_stock.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="current_stock">Current Stock</Label>
                    <Input
                      id="current_stock"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register("current_stock")}
                    />
                    {errors.current_stock && (
                      <p className="text-sm text-destructive">
                        {errors.current_stock.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="low_stock_threshold">
                      Low Stock Threshold
                    </Label>
                    <Input
                      id="low_stock_threshold"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register("low_stock_threshold")}
                    />
                    {errors.low_stock_threshold && (
                      <p className="text-sm text-destructive">
                        {errors.low_stock_threshold.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="out_of_stock_threshold">
                      Out of Stock Threshold
                    </Label>
                    <Input
                      id="out_of_stock_threshold"
                      type="number"
                      min="0"
                      step="0.01"
                      {...register("out_of_stock_threshold")}
                    />
                    {errors.out_of_stock_threshold && (
                      <p className="text-sm text-destructive">
                        {errors.out_of_stock_threshold.message}
                      </p>
                    )}
                  </div>
                </>
              )}

              {isVariable && (
                <div className="sm:col-span-2 space-y-4 border rounded-md p-4 bg-muted/30">
                  <div>
                    <Label className="text-base font-semibold">Variations</Label>
                    <p className="text-xs text-muted-foreground">
                      Define attributes (Size, Color, …), pick values, and generate variations. Each variation tracks its own stock and price.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Attributes</Label>
                    <div className="flex flex-wrap gap-2">
                      {attributes.map((a) => (
                        <button
                          type="button"
                          key={a.id}
                          onClick={() => toggleAttribute(a.id)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs border transition-colors",
                            selectedAttributeIds.includes(a.id)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background hover:bg-muted",
                          )}
                        >
                          {a.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="New attribute (e.g. Size)"
                        value={newAttrName}
                        onChange={(e) => setNewAttrName(e.target.value)}
                        className="h-8 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleAddAttribute}
                        disabled={!newAttrName.trim()}
                      >
                        <Plus className="h-3 w-3 mr-1" /> Add
                      </Button>
                    </div>
                  </div>

                  {selectedAttributeIds.map((attrId) => {
                    const attr = attributes.find((a) => a.id === attrId);
                    if (!attr) return null;
                    return (
                      <div key={attrId} className="space-y-2 pl-3 border-l-2 border-primary/40">
                        <Label className="text-sm">{attr.name} values</Label>
                        <div className="flex flex-wrap gap-1">
                          {(attr.values || []).map((v) => (
                            <span
                              key={v.id}
                              className="px-2 py-0.5 rounded bg-background border text-xs"
                            >
                              {v.value}
                            </span>
                          ))}
                          {(attr.values || []).length === 0 && (
                            <span className="text-xs text-muted-foreground">No values yet</span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Input
                            placeholder={`New ${attr.name} value`}
                            value={newValueByAttr[attrId] || ""}
                            onChange={(e) =>
                              setNewValueByAttr((p) => ({ ...p, [attrId]: e.target.value }))
                            }
                            className="h-8 text-sm"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleAddValue(attrId)}
                            disabled={!newValueByAttr[attrId]?.trim()}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}

                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={generateVariations}
                    disabled={selectedAttributeIds.length === 0}
                  >
                    <Wand2 className="h-3 w-3 mr-1" /> Generate variations
                  </Button>

                  {variationDrafts.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Variations ({variationDrafts.length})</Label>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="p-1">Variation</th>
                              <th className="p-1">SKU</th>
                              <th className="p-1">Stock</th>
                              <th className="p-1">Cost</th>
                              <th className="p-1">Price</th>
                              <th className="p-1">Low</th>
                              <th className="p-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {variationDrafts.map((d, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="p-1 font-medium">{variationLabel(d) || "—"}</td>
                                <td className="p-1">
                                  <Input
                                    className="h-7 text-xs"
                                    value={d.sku}
                                    onChange={(e) => updateDraft(idx, { sku: e.target.value })}
                                  />
                                </td>
                                <td className="p-1 w-20">
                                  <Input
                                    className="h-7 text-xs"
                                    type="number"
                                    min="0"
                                    value={d.current_stock}
                                    onChange={(e) =>
                                      updateDraft(idx, {
                                        current_stock: Number(e.target.value),
                                        opening_stock: d.id ? d.opening_stock : Number(e.target.value),
                                      })
                                    }
                                  />
                                </td>
                                <td className="p-1 w-24">
                                  <Input
                                    className="h-7 text-xs"
                                    type="number"
                                    min="0"
                                    value={d.cost_price}
                                    onChange={(e) => updateDraft(idx, { cost_price: Number(e.target.value) })}
                                  />
                                </td>
                                <td className="p-1 w-24">
                                  <Input
                                    className="h-7 text-xs"
                                    type="number"
                                    min="0"
                                    value={d.selling_price}
                                    onChange={(e) => updateDraft(idx, { selling_price: Number(e.target.value) })}
                                  />
                                </td>
                                <td className="p-1 w-16">
                                  <Input
                                    className="h-7 text-xs"
                                    type="number"
                                    min="0"
                                    value={d.low_stock_threshold}
                                    onChange={(e) => updateDraft(idx, { low_stock_threshold: Number(e.target.value) })}
                                  />
                                </td>
                                <td className="p-1">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => removeDraft(idx)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="Description..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isEditing ? "Updating..." : "Creating..."}
                  </>
                ) : isEditing ? (
                  "Update"
                ) : (
                  "Create"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CSVImportDialog
        open={csvImportDialogOpen}
        onOpenChange={setCsvImportDialogOpen}
      />
    </>
  );
}
