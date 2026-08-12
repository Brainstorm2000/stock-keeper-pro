import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export type ReportFrequency = 'daily' | 'weekly' | 'monthly';

export interface ReportEmailSettings {
  id: string;
  organization_id: string;
  is_enabled: boolean;
  recipient_emails: string[];
  subject: string;
  reports: string[];
  formats: string[];
  frequency: ReportFrequency;
  send_time: string;
  day_of_week: number;
  day_of_month: number;
  timezone: string;
  last_sent_at: string | null;
}

export interface ReportEmailLogEntry {
  id: string;
  recipients: string[];
  subject: string | null;
  period_start: string | null;
  period_end: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export function useReportEmailSettings() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ['report-email-settings', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_email_settings' as any)
        .select('*')
        .eq('organization_id', organizationId!)
        .maybeSingle();
      if (error) throw error;
      return (data as any as ReportEmailSettings) ?? null;
    },
  });
}

export function useReportEmailLog() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ['report-email-log', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('report_email_log' as any)
        .select('*')
        .eq('organization_id', organizationId!)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data as any as ReportEmailLogEntry[]) ?? [];
    },
  });
}

export function useSaveReportEmailSettings() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: Partial<ReportEmailSettings>) => {
      if (!organizationId) throw new Error('No organization');
      const { error } = await supabase
        .from('report_email_settings' as any)
        .upsert(
          { organization_id: organizationId, ...input },
          { onConflict: 'organization_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-email-settings'] });
      toast({ title: 'Report email settings saved' });
    },
    onError: (e: Error) => {
      const { title, description } = parseDbError(e, 'save report email settings');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useSendReportNow() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: { sendNow: true },
      });
      if (error) {
        const details = (error as any)?.context?.text
          ? await (error as any).context.text()
          : error.message;
        throw new Error(details || error.message);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-email-log'] });
      qc.invalidateQueries({ queryKey: ['report-email-settings'] });
      toast({ title: 'Report sent', description: 'Check the recipient inbox.' });
    },
    onError: (e: Error) => {
      toast({ title: 'Could not send report', description: e.message, variant: 'destructive' });
    },
  });
}
