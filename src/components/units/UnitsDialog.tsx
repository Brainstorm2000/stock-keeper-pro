import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUnits, useCreateUnit, useDeleteUnit, type Unit } from '@/hooks/useUnits';
import { Loader2, Plus, Trash2, Ruler } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UnitsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UnitsDialog({ open, onOpenChange }: UnitsDialogProps) {
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitAbbr, setNewUnitAbbr] = useState('');
  
  const { data: units = [], isLoading } = useUnits();
  const createUnit = useCreateUnit();
  const deleteUnit = useDeleteUnit();
  const { toast } = useToast();

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUnitName.trim()) {
      toast({ title: 'Unit name is required', variant: 'destructive' });
      return;
    }

    await createUnit.mutateAsync({
      name: newUnitName.trim(),
      abbreviation: newUnitAbbr.trim() || undefined,
    });

    setNewUnitName('');
    setNewUnitAbbr('');
  };

  const handleDeleteUnit = async (unit: Unit) => {
    try {
      await deleteUnit.mutateAsync(unit.id);
    } catch (error) {
      // Error is handled in the hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5" />
            Manage Units of Measurement
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAddUnit} className="flex gap-2 p-1">
          <div className="flex-1">
            <Input
              placeholder="Unit name (e.g., Kilogram)"
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
            />
          </div>
          <div className="w-24">
            <Input
              placeholder="Abbr (kg)"
              value={newUnitAbbr}
              onChange={(e) => setNewUnitAbbr(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={createUnit.isPending}>
            {createUnit.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit Name</TableHead>
                <TableHead>Abbreviation</TableHead>
                <TableHead className="w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : units.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    No units defined yet
                  </TableCell>
                </TableRow>
              ) : (
                units.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell className="font-medium">{unit.name}</TableCell>
                    <TableCell className="text-muted-foreground">{unit.abbreviation || '—'}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteUnit(unit)}
                        disabled={deleteUnit.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
