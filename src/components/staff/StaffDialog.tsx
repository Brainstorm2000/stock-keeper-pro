import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateStaff, useUpdateStaff, type Staff, type StaffInput } from '@/hooks/useStaff';
import { useBranches } from '@/hooks/useBranches';

interface StaffDialogProps {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffDialog({ staff, open, onOpenChange }: StaffDialogProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StaffInput>();
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const { data: branches = [] } = useBranches();
  const isActive = watch('is_active') ?? true;

  useEffect(() => {
    if (staff) {
      reset({
        staff_id: staff.staff_id,
        full_name: staff.full_name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role,
        department: staff.department,
        branch_id: staff.branch_id,
        employment_date: staff.employment_date,
        is_active: staff.is_active,
        notes: staff.notes,
      });
    } else {
      reset({ full_name: '', is_active: true });
    }
  }, [staff, open, reset]);

  const onSubmit = async (data: StaffInput) => {
    if (staff) {
      await updateStaff.mutateAsync({ id: staff.id, ...data });
    } else {
      await createStaff.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit Staff' : 'Add Staff Member'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Staff ID</Label>
              <Input {...register('staff_id')} placeholder="e.g. EMP-001" />
            </div>
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input {...register('full_name', { required: 'Required' })} />
              {errors.full_name && <p className="text-xs text-destructive">{errors.full_name.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register('email')} />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register('phone')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role / Position</Label>
              <Input {...register('role')} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input {...register('department')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={watch('branch_id') || 'none'} onValueChange={v => setValue('branch_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No branch</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employment Date</Label>
              <Input type="date" {...register('employment_date')} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isActive} onCheckedChange={v => setValue('is_active', v)} />
            <Label>Active</Label>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea {...register('notes')} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createStaff.isPending || updateStaff.isPending}>
              {staff ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
