import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useStaffTasks } from '@/hooks/useActionTasks';
import { Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { Staff } from '@/hooks/useStaff';

interface StaffTasksDialogProps {
  staff: Staff | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StaffTasksDialog({ staff, open, onOpenChange }: StaffTasksDialogProps) {
  const { data: tasks = [], isLoading } = useStaffTasks(staff?.id || '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tasks for {staff?.full_name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : tasks.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No tasks assigned</p>
        ) : (
          <div className="space-y-3">
            {tasks.map(t => (
              <div key={t.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium">{t.title}</h4>
                  <div className="flex gap-2 shrink-0">
                    <Badge variant={t.status === 'completed' ? 'default' : 'secondary'} className="flex items-center gap-1">
                      {t.status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> : t.status === 'in_progress' ? <AlertCircle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {t.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline">{t.priority}</Badge>
                  </div>
                </div>
                {t.description && <p className="text-sm text-muted-foreground">{t.description}</p>}
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Created: {format(new Date(t.created_at), 'MMM d, yyyy')}</span>
                  {t.start_date && <span>Start: {format(new Date(t.start_date), 'MMM d, yyyy')}</span>}
                  {t.due_date && <span>Due: {format(new Date(t.due_date), 'MMM d, yyyy')}</span>}
                  {t.completion_date && <span className="text-green-600">Completed: {format(new Date(t.completion_date), 'MMM d, yyyy')}</span>}
                </div>
                {/* Timeline progress bar */}
                {t.start_date && t.due_date && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${t.status === 'completed' ? 'bg-green-500' : 'bg-primary'}`}
                      style={{
                        width: t.status === 'completed' ? '100%' :
                          `${Math.min(100, Math.max(0, ((Date.now() - new Date(t.start_date).getTime()) / (new Date(t.due_date).getTime() - new Date(t.start_date).getTime())) * 100))}%`
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
