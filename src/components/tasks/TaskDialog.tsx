import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useCreateActionTask, useUpdateActionTask, type ActionTask, type ActionTaskInput } from '@/hooks/useActionTasks';
import { useStaff } from '@/hooks/useStaff';
import { useBranches } from '@/hooks/useBranches';
import { supabase } from '@/integrations/supabase/client';

interface TaskDialogProps {
  task: ActionTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDialog({ task, open, onOpenChange }: TaskDialogProps) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ActionTaskInput>();
  const createTask = useCreateActionTask();
  const updateTask = useUpdateActionTask();
  const { data: staff = [] } = useStaff();
  const { data: branches = [] } = useBranches();
  const activeStaff = staff.filter(s => s.is_active);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (task) {
      reset({
        staff_id: task.staff_id,
        branch_id: task.branch_id,
        title: task.title,
        description: task.description,
        start_date: task.start_date,
        due_date: task.due_date,
        priority: task.priority,
        status: task.status,
      });
      // Load additional staff from junction table
      supabase
        .from('action_task_staff')
        .select('staff_id')
        .eq('task_id', task.id)
        .then(({ data }) => {
          const ids = data?.map(d => d.staff_id) || [];
          // Include primary staff_id + junction staff
          const allIds = [...new Set([task.staff_id, ...ids])];
          setSelectedStaffIds(allIds);
        });
    } else {
      reset({ title: '', staff_id: '', priority: 'medium', status: 'pending' });
      setSelectedStaffIds([]);
    }
  }, [task, open, reset]);

  const toggleStaff = (staffId: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const onSubmit = async (data: ActionTaskInput) => {
    if (selectedStaffIds.length === 0) return;

    // Use the first selected staff as the primary staff_id
    const primaryStaffId = selectedStaffIds[0];
    const additionalStaffIds = selectedStaffIds.slice(1);

    if (task) {
      await updateTask.mutateAsync({ id: task.id, ...data, staff_id: primaryStaffId });
      // Update junction table
      await supabase.from('action_task_staff').delete().eq('task_id', task.id);
      if (additionalStaffIds.length > 0) {
        await supabase.from('action_task_staff').insert(
          additionalStaffIds.map(sid => ({ task_id: task.id, staff_id: sid }))
        );
      }
    } else {
      const result = await createTask.mutateAsync({ ...data, staff_id: primaryStaffId });
      // Add additional staff to junction table
      if (additionalStaffIds.length > 0 && result?.id) {
        await supabase.from('action_task_staff').insert(
          additionalStaffIds.map(sid => ({ task_id: result.id, staff_id: sid }))
        );
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Title *</Label>
            <Input {...register('title', { required: 'Required' })} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Assign to Staff * ({selectedStaffIds.length} selected)</Label>
            {selectedStaffIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {selectedStaffIds.map(id => {
                  const s = activeStaff.find(st => st.id === id);
                  return s ? (
                    <Badge key={id} variant="secondary" className="flex items-center gap-1">
                      {s.full_name}
                      <button type="button" onClick={() => toggleStaff(id)} className="ml-1">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            <ScrollArea className="h-40 border rounded-md p-2">
              {activeStaff.map(s => (
                <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                  <Checkbox
                    checked={selectedStaffIds.includes(s.id)}
                    onCheckedChange={() => toggleStaff(s.id)}
                  />
                  <span className="text-sm">{s.full_name}</span>
                  {s.role && <span className="text-xs text-muted-foreground">({s.role})</span>}
                </label>
              ))}
            </ScrollArea>
            {selectedStaffIds.length === 0 && (
              <p className="text-xs text-destructive">Please select at least one staff member</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea {...register('description')} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" {...register('start_date')} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" {...register('due_date')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={watch('priority') || 'medium'} onValueChange={v => setValue('priority', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={watch('status') || 'pending'} onValueChange={v => setValue('status', v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {branches.length > 0 && (
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
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending || selectedStaffIds.length === 0}>
              {task ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
