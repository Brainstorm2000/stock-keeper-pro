import { useState } from 'react';
import { useShifts, useCreateShift, useUpdateShift, useDeleteShift, type Shift, type ShiftInput } from '@/hooks/useShifts';
import { useBranches } from '@/hooks/useBranches';
import { useDepartments } from '@/hooks/useDepartments';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';

function ShiftDialog({ shift, open, onOpenChange }: { shift: Shift | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { register, handleSubmit, reset, setValue, watch } = useForm<ShiftInput>();
  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useDepartments();

  useEffect(() => {
    if (shift) {
      reset({
        shift_name: shift.shift_name,
        start_time: shift.start_time,
        end_time: shift.end_time,
        clockin_start_time: shift.clockin_start_time,
        grace_period_minutes: shift.grace_period_minutes,
        overtime_start_time: shift.overtime_start_time,
        auto_clockout_time: shift.auto_clockout_time,
        max_overtime_hours: shift.max_overtime_hours,
        branch_id: shift.branch_id,
        department_id: shift.department_id,
        is_active: shift.is_active,
      });
    } else {
      reset({ shift_name: '', start_time: '08:00', end_time: '17:00', clockin_start_time: '07:30', grace_period_minutes: 10, auto_clockout_time: null, max_overtime_hours: null, is_active: true });
    }
  }, [shift, open, reset]);

  const onSubmit = async (data: ShiftInput) => {
    if (shift) {
      await updateShift.mutateAsync({ id: shift.id, ...data });
    } else {
      await createShift.mutateAsync(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{shift ? 'Edit Shift' : 'Add Shift'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Shift Name *</Label>
            <Input {...register('shift_name', { required: true })} placeholder="e.g. Morning Shift" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time *</Label>
              <Input type="time" {...register('start_time', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>End Time *</Label>
              <Input type="time" {...register('end_time', { required: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Clock-in Start *</Label>
              <Input type="time" {...register('clockin_start_time', { required: true })} />
            </div>
            <div className="space-y-2">
              <Label>Grace Period (min)</Label>
              <Input type="number" {...register('grace_period_minutes', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Overtime Start Time</Label>
            <Input type="time" {...register('overtime_start_time')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Automatic Clock-out Time</Label>
              <Input type="time" {...register('auto_clockout_time')} />
              <p className="text-xs text-muted-foreground">Open records will be auto-closed at this time.</p>
            </div>
            <div className="space-y-2">
              <Label>Max Overtime (hours)</Label>
              <Input type="number" step="0.25" min="0" {...register('max_overtime_hours', { valueAsNumber: true })} placeholder="No limit" />
              <p className="text-xs text-muted-foreground">Caps overtime credited per day.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Branch</Label>
              <Select value={watch('branch_id') || 'none'} onValueChange={v => setValue('branch_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={watch('department_id') || 'none'} onValueChange={v => setValue('department_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={watch('is_active') ?? true} onCheckedChange={v => setValue('is_active', v)} />
            <Label>Active</Label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createShift.isPending || updateShift.isPending}>
              {shift ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ShiftManagement() {
  const { data: shifts = [], isLoading } = useShifts();
  const deleteShift = useDeleteShift();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />Add Shift
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="hidden md:table-cell">Clock-in From</TableHead>
                <TableHead className="hidden md:table-cell">Grace (min)</TableHead>
                <TableHead className="hidden lg:table-cell">OT Start</TableHead>
                <TableHead className="hidden lg:table-cell">Auto Out</TableHead>
                <TableHead className="hidden lg:table-cell">Max OT</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shifts.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">No shifts configured</TableCell></TableRow>
              ) : shifts.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.shift_name}</TableCell>
                  <TableCell>{s.start_time.slice(0, 5)}</TableCell>
                  <TableCell>{s.end_time.slice(0, 5)}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.clockin_start_time.slice(0, 5)}</TableCell>
                  <TableCell className="hidden md:table-cell">{s.grace_period_minutes}</TableCell>
                  <TableCell className="hidden lg:table-cell">{s.overtime_start_time?.slice(0, 5) || '-'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{s.auto_clockout_time?.slice(0, 5) || '-'}</TableCell>
                  <TableCell className="hidden lg:table-cell">{s.max_overtime_hours != null ? `${s.max_overtime_hours}h` : '-'}</TableCell>
                  <TableCell>
                    <Badge variant={s.is_active ? 'default' : 'secondary'}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(s); setDialogOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteId(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ShiftDialog shift={editing} open={dialogOpen} onOpenChange={o => { setDialogOpen(o); if (!o) setEditing(null); }} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? Attendance records linked to this shift won't be affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { if (deleteId) { await deleteShift.mutateAsync(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
