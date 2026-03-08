import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ALL_MODULES, MODULE_LABELS, type AppModule } from '@/hooks/useModulePermissions';

interface OrgModulesDialogProps {
  orgId: string | null;
  orgName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OrgModulesDialog({ orgId, orgName, open, onOpenChange }: OrgModulesDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState<string | null>(null);

  const { data: orgModules, isLoading } = useQuery({
    queryKey: ['org-modules', orgId],
    enabled: !!orgId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_modules')
        .select('module, is_enabled')
        .eq('organization_id', orgId!);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.module] = row.is_enabled;
      });
      return map;
    },
  });

  const isModuleEnabled = (mod: AppModule) => {
    if (!orgModules) return true; // default enabled
    return orgModules[mod] !== false;
  };

  const handleToggle = async (mod: AppModule) => {
    if (!orgId) return;
    setSaving(mod);
    const newValue = !isModuleEnabled(mod);
    try {
      const { error } = await supabase
        .from('organization_modules')
        .upsert(
          { organization_id: orgId, module: mod, is_enabled: newValue },
          { onConflict: 'organization_id,module' }
        );
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['org-modules', orgId] });
      toast({ title: `${MODULE_LABELS[mod]} ${newValue ? 'enabled' : 'disabled'}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Module Access{orgName ? ` — ${orgName}` : ''}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enable or disable modules for this organization. Disabled modules will be inaccessible to all users in the organization.
            </p>
            {ALL_MODULES.map((mod) => (
              <div key={mod} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <Label className="text-sm font-medium">{MODULE_LABELS[mod]}</Label>
                <div className="flex items-center gap-2">
                  {saving === mod && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={isModuleEnabled(mod)}
                    onCheckedChange={() => handleToggle(mod)}
                    disabled={saving === mod}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
