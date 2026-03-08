import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateActionTask, useUpdateActionTask, type ActionTask, type ActionTaskInput } from '@/hooks/useActionTasks';
import { useStaff } from '@/hooks/useStaff';
import { useBranches } from '@/hooks/useBranches';

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

  useEffect(() => {
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
    } else {
      reset({ title: '', staff_id: '', priority: 'medium', status: 'pending' });
    }
  }, [task, open, reset]);

  const onSubmit = async (data: ActionTaskInput) => {
    if (task) {
      await updateTask.mutateAsync({ id: task.id, ...data });
    } else {
      await createTask.mutateAsync(data);
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
            <Label>Assign to Staff *</Label>
            <Select value={watch('staff_id') || ''} onValueChange={v => setValue('staff_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger>
              <SelectContent>
                {activeStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <Button type="submit" disabled={createTask.isPending || updateTask.isPending}>
              {task ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
