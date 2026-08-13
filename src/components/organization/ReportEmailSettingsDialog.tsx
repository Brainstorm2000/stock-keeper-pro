import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Mail, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useReportEmailSettings, useReportEmailLog, useSaveReportEmailSettings,
  useSendReportNow, type ReportFrequency,
} from '@/hooks/useReportEmails';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const REPORTS = [
  { id: 'sales', label: 'Sales' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'expenses', label: 'Expenses' },
];

const FORMATS = [
  { id: 'excel', label: 'Excel (.xlsx)' },
  { id: 'pdf', label: 'PDF' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ReportEmailSettingsDialog({ open, onOpenChange }: Props) {
  const { data: settings, isLoading } = useReportEmailSettings();
  const { data: log = [] } = useReportEmailLog();
  const save = useSaveReportEmailSettings();
  const sendNow = useSendReportNow();
  const { toast } = useToast();

  const [isEnabled, setIsEnabled] = useState(false);
  const [recipients, setRecipients] = useState('');
  const [subject, setSubject] = useState('Your business report');
  const [reports, setReports] = useState<string[]>(['sales', 'inventory', 'purchases', 'expenses']);
  const [formats, setFormats] = useState<string[]>(['excel', 'pdf']);
  const [frequency, setFrequency] = useState<ReportFrequency>('weekly');
  const [sendTime, setSendTime] = useState('08:00');
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [dayOfMonth, setDayOfMonth] = useState('1');
  const [timezone, setTimezone] = useState('Africa/Lagos');

  useEffect(() => {
    if (!open) return;
    if (settings) {
      setIsEnabled(settings.is_enabled);
      setRecipients((settings.recipient_emails ?? []).join(', '));
      setSubject(settings.subject ?? 'Your business report');
      setReports(settings.reports?.length ? settings.reports : ['sales']);
      setFormats(settings.formats?.length ? settings.formats : ['excel', 'pdf']);
      setFrequency(settings.frequency ?? 'weekly');
      setSendTime((settings.send_time ?? '08:00').slice(0, 5));
      setDayOfWeek(String(settings.day_of_week ?? 1));
      setDayOfMonth(String(settings.day_of_month ?? 1));
      setTimezone(settings.timezone ?? 'Africa/Lagos');
    }
  }, [settings, open]);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const parsedRecipients = recipients
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);

  const handleSave = () => {
    const invalid = parsedRecipients.filter((e) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (isEnabled && !parsedRecipients.length) {
      toast({ title: 'Add at least one recipient email', variant: 'destructive' });
      return;
    }
    if (invalid.length) {
      toast({ title: 'Invalid email address', description: invalid.join(', '), variant: 'destructive' });
      return;
    }
    if (!reports.length) {
      toast({ title: 'Select at least one report', variant: 'destructive' });
      return;
    }
    if (!formats.length) {
      toast({ title: 'Select at least one file format', variant: 'destructive' });
      return;
    }
    save.mutate({
      is_enabled: isEnabled,
      recipient_emails: parsedRecipients,
      subject: subject.trim() || 'Your business report',
      reports,
      formats,
      frequency,
      send_time: sendTime,
      day_of_week: Number(dayOfWeek),
      day_of_month: Number(dayOfMonth),
      timezone: timezone.trim() || 'Africa/Lagos',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Scheduled Report Emails
          </DialogTitle>
          <DialogDescription>
            Email Excel and PDF reports to a chosen address on a schedule you control.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 mt-2">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label className="text-sm font-medium">Enable scheduled reports</Label>
                <p className="text-xs text-muted-foreground">Reports are sent automatically when enabled.</p>
              </div>
              <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="recipients">Recipient email(s)</Label>
              <Input
                id="recipients"
                placeholder="owner@company.com, manager@company.com"
                value={recipients}
                onChange={(e) => setRecipients(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Separate multiple addresses with commas.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject">Email subject</Label>
              <Input
                id="subject"
                placeholder="Your business report"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">The report period is appended automatically.</p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Reports to include</Label>
              <div className="grid grid-cols-2 gap-2">
                {REPORTS.map((r) => (
                  <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={reports.includes(r.id)}
                      onCheckedChange={() => toggle(reports, setReports, r.id)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Attachment formats</Label>
              <div className="grid grid-cols-2 gap-2">
                {FORMATS.map((f) => (
                  <label key={f.id} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={formats.includes(f.id)}
                      onCheckedChange={() => toggle(formats, setFormats, f.id)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={(v) => setFrequency(v as ReportFrequency)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sendTime">Send time</Label>
                <Input
                  id="sendTime"
                  type="time"
                  value={sendTime}
                  onChange={(e) => setSendTime(e.target.value)}
                />
              </div>

              {frequency === 'weekly' && (
                <div className="space-y-2">
                  <Label>Day of week</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((d, i) => (
                        <SelectItem key={d} value={String(i)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {frequency === 'monthly' && (
                <div className="space-y-2">
                  <Label>Day of month</Label>
                  <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                        <SelectItem key={d} value={String(d)}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="tz">Timezone</Label>
                <Input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
              </div>
            </div>

            {settings?.last_sent_at && (
              <p className="text-xs text-muted-foreground">
                Last sent: {new Date(settings.last_sent_at).toLocaleString('en-NG')}
              </p>
            )}

            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={save.isPending} className="flex-1">
                {save.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                ) : 'Save Settings'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => sendNow.mutate()}
                disabled={sendNow.isPending || !settings}
              >
                {sendNow.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <><Send className="mr-2 h-4 w-4" />Send now</>
                )}
              </Button>
            </div>

            {log.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <Label className="text-sm">Recent sends</Label>
                <div className="space-y-1">
                  {log.slice(0, 5).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground truncate mr-2">
                        {new Date(entry.created_at).toLocaleString('en-NG')} · {entry.recipients.join(', ')}
                      </span>
                      <Badge variant={entry.status === 'sent' ? 'secondary' : 'destructive'}>
                        {entry.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
