import { useState, useRef } from 'react';
import { Plus, Upload, Download, Pencil, Trash2, Search, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand, useBulkCreateBrands, Brand, BrandInput } from '@/hooks/useBrands';
import { useOrganization } from '@/hooks/useOrganization';
import { parseGenericCSV, exportToCSV, generateBrandsCSVTemplate, downloadCSV } from '@/lib/csv-utils';
import { useToast } from '@/hooks/use-toast';

export function BrandsDialog() {
  const [open, setOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: brands = [], isLoading } = useBrands();
  const { data: organization } = useOrganization();
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const deleteBrand = useDeleteBrand();
  const bulkCreateBrands = useBulkCreateBrands();
  const { toast } = useToast();

  const [formData, setFormData] = useState<BrandInput>({
    name: '',
    description: '',
  });

  const filteredBrands = brands.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.description?.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormData({ name: '', description: '' });
    setEditingBrand(null);
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      name: brand.name,
      description: brand.description || '',
    });
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization?.id) return;

    if (editingBrand) {
      await updateBrand.mutateAsync({ id: editingBrand.id, ...formData });
    } else {
      await createBrand.mutateAsync({ ...formData, organization_id: organization.id });
    }
    setFormOpen(false);
    resetForm();
  };

  const handleDelete = async () => {
    if (deleteId) {
      await deleteBrand.mutateAsync(deleteId);
      setDeleteId(null);
    }
  };

  const handleExport = () => {
    const csvData = brands.map(b => ({
      name: b.name,
      description: b.description || '',
    }));
    exportToCSV(csvData, 'brands.csv');
    toast({ title: 'Brands exported successfully' });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    try {
      const rows = await parseGenericCSV(file);
      
      // Create a set of existing brand names (lowercase for case-insensitive comparison)
      const existingNames = new Set(brands.map(b => b.name.toLowerCase().trim()));
      
      const allParsed = rows.map(row => ({
        name: row.name || '',
        description: row.description || undefined,
        organization_id: organization.id,
      })).filter(b => b.name);

      // Filter out duplicates (existing in DB or duplicates within the CSV itself)
      const seenInCsv = new Set<string>();
      const brandsToImport = allParsed.filter(b => {
        const key = b.name.toLowerCase().trim();
        if (existingNames.has(key) || seenInCsv.has(key)) {
          return false;
        }
        seenInCsv.add(key);
        return true;
      });

      const skippedCount = allParsed.length - brandsToImport.length;

      if (brandsToImport.length === 0) {
        toast({ 
          title: skippedCount > 0 
            ? `All ${skippedCount} brands already exist` 
            : 'No valid brands found in CSV', 
          variant: 'destructive' 
        });
        return;
      }

      await bulkCreateBrands.mutateAsync(brandsToImport);
      
      if (skippedCount > 0) {
        toast({ title: `Imported ${brandsToImport.length} brands, skipped ${skippedCount} duplicates` });
      }
    } catch {
      toast({ title: 'Failed to parse CSV file', variant: 'destructive' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Brands
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Manage Brands</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search brands..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="outline" size="sm" onClick={() => { downloadCSV(generateBrandsCSVTemplate(), 'brands_template.csv'); toast({ title: 'Template downloaded' }); }}>
            <FileDown className="h-4 w-4 mr-1" /> Template
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1" /> Import
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={brands.length === 0}>
            <Download className="h-4 w-4 mr-1" /> Export
          </Button>
          <Dialog open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Brand
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBrand ? 'Edit Brand' : 'Add Brand'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => { setFormOpen(false); resetForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createBrand.isPending || updateBrand.isPending}>
                    {editingBrand ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredBrands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No brands found
                  </TableCell>
                </TableRow>
              ) : (
                filteredBrands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">{brand.name}</TableCell>
                    <TableCell className="max-w-[300px] truncate">{brand.description || '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(brand)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(brand.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Brand</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this brand? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
