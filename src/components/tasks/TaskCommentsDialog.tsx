import { useState } from 'react';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTaskComments, useCreateTaskComment, useDeleteTaskComment } from '@/hooks/useTaskComments';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';

interface TaskCommentsDialogProps {
  taskId: string | null;
  taskTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskCommentsDialog({ taskId, taskTitle, open, onOpenChange }: TaskCommentsDialogProps) {
  const [newComment, setNewComment] = useState('');
  const { user } = useAuth();
  const { data: comments = [], isLoading } = useTaskComments(open ? taskId : null);
  const createComment = useCreateTaskComment();
  const deleteComment = useDeleteTaskComment();

  const handleSubmit = async () => {
    if (!taskId || !newComment.trim()) return;
    await createComment.mutateAsync({ taskId, comment: newComment.trim() });
    setNewComment('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comments: {taskTitle}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[400px] pr-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No comments yet</p>
          ) : (
            <div className="space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-lg border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{c.comment}</p>
                    </div>
                    {c.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive shrink-0"
                        onClick={() => deleteComment.mutate({ id: c.id, taskId: c.task_id })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2 pt-2 border-t">
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            className="flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!newComment.trim() || createComment.isPending}
            className="shrink-0 self-end"
          >
            {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
