import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Loader2, CreditCard } from "lucide-react";
import {
  usePaymentMethods,
  useCreatePaymentMethod,
  useUpdatePaymentMethod,
  useDeletePaymentMethod,
  type OrgPaymentMethod,
} from "@/hooks/usePaymentMethods";
import { PaymentIcon, PAYMENT_ICON_NAMES } from "@/lib/payment-icons";
import type { PaymentMethod } from "@/hooks/useSales";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAPPED_TYPES: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "mobile_money", label: "Mobile Money" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "credit", label: "Credit" },
  { value: "pos", label: "POS" },
];

export function PaymentMethodsDialog({ open, onOpenChange }: Props) {
  const { data: methods = [], isLoading } = usePaymentMethods();
  const createMethod = useCreatePaymentMethod();
  const updateMethod = useUpdatePaymentMethod();
  const deleteMethod = useDeletePaymentMethod();

  const [editing, setEditing] = useState<OrgPaymentMethod | null>(null);
  const [form, setForm] = useState({
    name: "",
    icon: "Banknote",
    mapped_type: "cash" as PaymentMethod,
  });
  const [showForm, setShowForm] = useState(false);

  const resetForm = () => {
    setForm({ name: "", icon: "Banknote", mapped_type: "cash" });
    setEditing(null);
    setShowForm(false);
  };

  const startEdit = (m: OrgPaymentMethod) => {
    setEditing(m);
    setForm({ name: m.name, icon: m.icon, mapped_type: m.mapped_type });
    setShowForm(true);
  };

  const submit = async () => {
    if (!form.name.trim()) return;
    if (editing) {
      await updateMethod.mutateAsync({ id: editing.id, ...form });
    } else {
      await createMethod.mutateAsync(form);
    }
    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Methods
          </DialogTitle>
          <DialogDescription>
            Add, edit, or disable payment methods for your organization. Built-in
            methods can be renamed and re-styled but not deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {methods.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border",
                    !m.is_active && "opacity-60",
                  )}
                >
                  <div className="p-2 bg-muted rounded-md">
                    <PaymentIcon name={m.icon} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{m.name}</span>
                      {m.is_builtin && (
                        <Badge variant="secondary" className="text-xs">
                          Built-in
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Counts as: {m.mapped_type.replace("_", " ")}
                    </p>
                  </div>
                  <Switch
                    checked={m.is_active}
                    onCheckedChange={(checked) =>
                      updateMethod.mutate({ id: m.id, is_active: checked })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(m)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    disabled={m.is_builtin}
                    onClick={() => {
                      if (confirm(`Delete "${m.name}"?`))
                        deleteMethod.mutate(m.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {showForm ? (
            <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
              <h4 className="font-medium">
                {editing ? "Edit method" : "New method"}
              </h4>
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Opay, PayPal, Voucher"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category (for reporting)</Label>
                  <Select
                    value={form.mapped_type}
                    onValueChange={(v) =>
                      setForm({ ...form, mapped_type: v as PaymentMethod })
                    }
                    disabled={editing?.is_builtin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MAPPED_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <div className="flex items-center gap-2 p-2 border rounded-md bg-background max-h-24 overflow-y-auto flex-wrap">
                    {PAYMENT_ICON_NAMES.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setForm({ ...form, icon: name })}
                        className={cn(
                          "p-2 rounded-md border transition-colors",
                          form.icon === name
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-transparent hover:bg-muted",
                        )}
                        title={name}
                      >
                        <PaymentIcon name={name} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={
                    !form.name.trim() ||
                    createMethod.isPending ||
                    updateMethod.isPending
                  }
                >
                  {editing ? "Save changes" : "Create method"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add payment method
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}