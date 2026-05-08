import { useEffect, useState } from 'react';
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
import { useDepartments } from '@/hooks/useDepartments';
import { useStaffPositions, useCreateStaffPosition, useCreateDepartment } from '@/hooks/useStaffPositions';
import { Plus, Upload, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface StaffDialogProps {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffDialog({ staff, open, onOpenChange }: StaffDialogProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<StaffInput>();
  // Register photo_url so setValue triggers re-renders for watch()
  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useDepartments();
  const { data: positions = [] } = useStaffPositions();
  const createPosition = useCreateStaffPosition();
  const createDepartment = useCreateDepartment();
  const isActive = watch('is_active') ?? true;
  const photoUrl = watch('photo_url');
  const fullName = watch('full_name') || '';
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const [newPosition, setNewPosition] = useState('');
  const [showNewPosition, setShowNewPosition] = useState(false);
  const [newDepartment, setNewDepartment] = useState('');
  const [showNewDepartment, setShowNewDepartment] = useState(false);

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
        photo_url: staff.photo_url,
      });
    } else {
      reset({ full_name: '', is_active: true, photo_url: null });
    }
    setShowNewPosition(false);
    setShowNewDepartment(false);
    setNewPosition('');
    setNewDepartment('');
  }, [staff, open, reset]);

  const onSubmit = async (data: StaffInput) => {
    if (staff) {
      await updateStaff.mutateAsync({ id: staff.id, ...data });
    } else {
      await createStaff.mutateAsync(data);
    }
    onOpenChange(false);
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: 'File too large', description: 'Max 500KB', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('staff-photos').upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from('staff-photos').getPublicUrl(path);
      setValue('photo_url', data.publicUrl, { shouldDirty: true, shouldTouch: true });
      toast({ title: 'Photo uploaded' });
    } catch (err) {
      toast({ title: 'Upload failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const initials = fullName
    .split(' ')
    .map((n) => n.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  const handleAddPosition = async () => {
    if (!newPosition.trim()) return;
    await createPosition.mutateAsync(newPosition.trim());
    setValue('role', newPosition.trim());
    setNewPosition('');
    setShowNewPosition(false);
  };

  const handleAddDepartment = async () => {
    if (!newDepartment.trim()) return;
    await createDepartment.mutateAsync(newDepartment.trim());
    setValue('department', newDepartment.trim());
    setNewDepartment('');
    setShowNewDepartment(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{staff ? 'Edit Staff' : 'Add Staff Member'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-muted border-2 border-primary flex items-center justify-center overflow-hidden text-xl font-bold text-primary shrink-0">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initials || '?'
              )}
            </div>
            <div className="space-y-2">
              <Label>Photo</Label>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-3 w-3 mr-1" />
                    {uploading ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handlePhotoUpload(e.target.files[0])}
                    />
                  </label>
                </Button>
                {photoUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setValue('photo_url', null, { shouldDirty: true })}>
                    <X className="h-3 w-3 mr-1" />Remove
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Max 500KB. If empty, initials will be used on the ID card.</p>
            </div>
          </div>
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
              <div className="flex items-center justify-between">
                <Label>Role / Position</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowNewPosition(!showNewPosition)}>
                  <Plus className="h-3 w-3 mr-1" />New
                </Button>
              </div>
              {showNewPosition ? (
                <div className="flex gap-1">
                  <Input value={newPosition} onChange={e => setNewPosition(e.target.value)} placeholder="Position name" className="text-sm" />
                  <Button type="button" size="sm" onClick={handleAddPosition} disabled={createPosition.isPending}>Add</Button>
                </div>
              ) : (
                <Select value={watch('role') || 'none'} onValueChange={v => setValue('role', v === 'none' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select position" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No position</SelectItem>
                    {positions.map(p => <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Department</Label>
                <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setShowNewDepartment(!showNewDepartment)}>
                  <Plus className="h-3 w-3 mr-1" />New
                </Button>
              </div>
              {showNewDepartment ? (
                <div className="flex gap-1">
                  <Input value={newDepartment} onChange={e => setNewDepartment(e.target.value)} placeholder="Department name" className="text-sm" />
                  <Button type="button" size="sm" onClick={handleAddDepartment} disabled={createDepartment.isPending}>Add</Button>
                </div>
              ) : (
                <Select value={watch('department') || 'none'} onValueChange={v => setValue('department', v === 'none' ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No department</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
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
