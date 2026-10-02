import { useState } from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface BulkSelectCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}

export function BulkSelectCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onCheckedChange,
  label,
}: BulkSelectCheckboxProps) {
  return (
    <Checkbox
      checked={indeterminate ? "indeterminate" : checked}
      disabled={disabled}
      onCheckedChange={(value) => onCheckedChange(value === true)}
      aria-label={label}
    />
  );
}

interface BulkActionBarProps {
  selectedCount: number;
  itemLabel: string;
  canDelete: boolean;
  deleting?: boolean;
  onDelete?: () => Promise<void>;
  onClear: () => void;
  children?: React.ReactNode;
}

export function BulkActionBar({
  selectedCount,
  itemLabel,
  canDelete,
  deleting = false,
  onDelete,
  onClear,
  children,
}: BulkActionBarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    if (!onDelete) return;
    try {
      await onDelete();
      setConfirmOpen(false);
    } catch {
      // Mutation hooks surface their own error feedback; keep confirmation open.
    }
  };

  if (selectedCount === 0) return null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
        <span className="text-sm font-medium" aria-live="polite">
          {selectedCount} selected
        </span>
        {children}
        {canDelete && onDelete && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={deleting}
          aria-label="Clear selection"
          title="Clear selection"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected {itemLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected {itemLabel}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {deleting ? "Deleting..." : `Delete ${selectedCount}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}