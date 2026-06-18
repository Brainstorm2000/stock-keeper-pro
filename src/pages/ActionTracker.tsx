import { useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Plus, Search, Loader2, CheckCircle2, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { TaskCommentsDialog } from '@/components/tasks/TaskCommentsDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard, useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { useActionTasks, useDeleteActionTask, type ActionTask } from '@/hooks/useActionTasks';
import { TaskDialog } from '@/components/tasks/TaskDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';

const priorityColors: Record<string, string> = {
  low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  in_progress: <AlertCircle className="h-3 w-3" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
};

function ActionTrackerContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ActionTask | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [removingTaskIds, setRemovingTaskIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [commentsTask, setCommentsTask] = useState<{ id: string; title: string } | null>(null);

  const { data: tasks = [], isLoading } = useActionTasks();
  const deleteTask = useDeleteActionTask();
  const { canCreate, canDelete } = useModuleAccess('tasks' as any);

  const filtered = tasks.filter(t => {
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.staff?.full_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchSearch && matchStatus && matchPriority;
  });

  const { paginatedItems: paginatedTasks, currentPage, totalPages, totalItems, pageSize, goToPage, setPageSize } = usePagination(filtered);

  const handleEdit = (t: ActionTask) => { setEditingTask(t); setDialogOpen(true); };
  const handleDialogClose = (open: boolean) => { setDialogOpen(open); if (!open) setEditingTask(null); };

  const handleMarkComplete = async (task: ActionTask) => {
    setRemovingTaskIds((prev) => [...prev, task.id]);
    window.setTimeout(async () => {
      try {
        await deleteTask.mutateAsync(task.id);
      } finally {
        setRemovingTaskIds((prev) => prev.filter((id) => id !== task.id));
      }
    }, 2400);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Action Tracker</h1>
            <p className="text-muted-foreground">Track and manage tasks assigned to staff</p>
          </div>
          {canCreate && (
            <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New Task</Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{tasks.length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">{tasks.filter(t => t.status === 'pending').length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">In Progress</p>
            <p className="text-2xl font-bold text-blue-600">{tasks.filter(t => t.status === 'in_progress').length}</p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm text-muted-foreground">Completed</p>
            <p className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === 'completed').length}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="hidden sm:table-cell">Branch</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Due Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Completed</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tasks found</TableCell></TableRow>
                ) : paginatedTasks.map(t => (
                  <TableRow
                    key={t.id}
                    className={
                      removingTaskIds.includes(t.id)
                        ? 'transition-opacity duration-200 opacity-0'
                        : 'transition-opacity duration-200 opacity-100'
                    }
                  >
                    <TableCell className="font-medium max-w-[200px] truncate">{t.title}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.staff?.full_name && (
                          <Badge variant="outline" className="text-xs">{t.staff.full_name}</Badge>
                        )}
                        {t.action_task_staff?.map(ats => ats.staff && (
                          <Badge key={ats.staff_id} variant="outline" className="text-xs">{ats.staff.full_name}</Badge>
                        ))}
                        {!t.staff?.full_name && (!t.action_task_staff || t.action_task_staff.length === 0) && '-'}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{t.branches?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge className={priorityColors[t.priority]}>{t.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'completed' ? 'default' : 'secondary'} className="flex items-center gap-1 w-fit">
                        {statusIcons[t.status]}
                        {t.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{t.due_date ? format(new Date(t.due_date), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{t.completion_date ? format(new Date(t.completion_date), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleMarkComplete(t)}>
                          Complete
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setCommentsTask({ id: t.id, title: t.title })}>
                          <MessageSquare className="h-3 w-3 mr-1" />Comments
                        </Button>
                        {canCreate && <Button variant="ghost" size="sm" onClick={() => handleEdit(t)}>Edit</Button>}
                        {canDelete && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(t.id)}>Delete</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={goToPage} onPageSizeChange={setPageSize} />
          </div>
        )}
      </div>

      <TaskDialog task={editingTask} open={dialogOpen} onOpenChange={handleDialogClose} />

      <TaskCommentsDialog
        taskId={commentsTask?.id || null}
        taskTitle={commentsTask?.title || ''}
        open={!!commentsTask}
        onOpenChange={(open) => { if (!open) setCommentsTask(null); }}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this task?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { if (deleteId) { await deleteTask.mutateAsync(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

export default function ActionTracker() {
  return (
    <ModuleAccessGuard module={'tasks' as any} minLevel="view">
      <ActionTrackerContent />
    </ModuleAccessGuard>
  );
}
