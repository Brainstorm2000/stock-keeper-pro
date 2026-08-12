import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import * as XLSX from 'npm:xlsx@0.18.5';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';
import { buildReport, type ReportBundle } from './report-data.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// ---------- scheduling helpers ----------
function localParts(tz: string, at = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
    weekday: 'short',
  });
  const p = Object.fromEntries(fmt.formatToParts(at).map((x) => [x.type, x.value]));
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    hour: Number(p.hour === '24' ? '0' : p.hour),
    minute: Number(p.minute),
    dayOfWeek: weekdayMap[p.weekday as string] ?? 0,
    dayOfMonth: Number(p.day),
  };
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

interface Setting {
  id: string;
  organization_id: string;
  recipient_emails: string[];
  subject: string;
  reports: string[];
  formats: string[];
  frequency: string;
  send_time: string;
  day_of_week: number;
  day_of_month: number;
  timezone: string;
  last_sent_at: string | null;
}

function isDue(s: Setting): boolean {
  const tz = s.timezone || 'Africa/Lagos';
  const now = localParts(tz);
  const [h, m] = String(s.send_time || '08:00').split(':').map(Number);
  const nowMinutes = now.hour * 60 + now.minute;
  const targetMinutes = h * 60 + (m || 0);
  // window: fires any time from the scheduled minute up to 90 minutes later
  if (nowMinutes < targetMinutes || nowMinutes > targetMinutes + 90) return false;

  if (s.frequency === 'weekly' && now.dayOfWeek !== s.day_of_week) return false;
  if (s.frequency === 'monthly' && now.dayOfMonth !== s.day_of_month) return false;

  if (s.last_sent_at) {
    const lastLocalDate = localParts(tz, new Date(s.last_sent_at)).date;
    if (lastLocalDate === now.date) return false;
  }
  return true;
}

function periodFor(s: Setting): { start: string; end: string } {
  const tz = s.timezone || 'Africa/Lagos';
  const today = localParts(tz).date;
  const end = addDays(today, -1);
  if (s.frequency === 'daily') return { start: end, end };
  if (s.frequency === 'weekly') return { start: addDays(end, -6), end };
  const d = new Date(`${today}T00:00:00Z`);
  const firstOfThis = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const lastOfPrev = addDays(firstOfThis, -1);
  const prev = new Date(`${lastOfPrev}T00:00:00Z`);
  const firstOfPrev = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-01`;
  return { start: firstOfPrev, end: lastOfPrev };
}

// ---------- file builders ----------
function buildXlsx(bundle: ReportBundle): string {
  const wb = XLSX.utils.book_new();
  for (const section of bundle.sections) {
    const aoa: (string | number)[][] = [];
    aoa.push([`${section.name} report`]);
    aoa.push([`${bundle.periodStart} to ${bundle.periodEnd}`]);
    aoa.push([]);
    Object.entries(section.summary).forEach(([k, v]) => aoa.push([k, v]));
    aoa.push([]);
    aoa.push(section.headers);
    section.rows.forEach((r) => aoa.push(r));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, section.name.slice(0, 31));
  }
  if (!bundle.sections.length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No reports selected']]), 'Empty');
  }
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
}

async function buildPdf(bundle: ReportBundle): Promise<string | null> {
  try {
    const { jsPDF } = await import('npm:jspdf@2.5.2');
    const autoTableMod = await import('npm:jspdf-autotable@3.8.4');
    const autoTable = (autoTableMod.default ?? autoTableMod) as (doc: unknown, opts: unknown) => void;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    let first = true;
    for (const section of bundle.sections) {
      if (!first) doc.addPage();
      first = false;
      doc.setFontSize(16);
      doc.text(`${bundle.orgName} — ${section.name} report`, 40, 40);
      doc.setFontSize(10);
      doc.text(`Period: ${bundle.periodStart} to ${bundle.periodEnd}`, 40, 58);
      const summaryLine = Object.entries(section.summary).map(([k, v]) => `${k}: ${v}`).join('    ');
      doc.text(summaryLine, 40, 74);
      autoTable(doc, {
        head: [section.headers],
        body: section.rows.map((r) => r.map((c) => String(c))),
        startY: 90,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [243, 244, 246], textColor: [55, 65, 81] },
        alternateRowStyles: { fillColor: [249, 250, 251] },
      });
    }
    if (first) {
      doc.setFontSize(14);
      doc.text('No reports selected', 40, 40);
    }
    const buf = doc.output('arraybuffer') as ArrayBuffer;
    let binary = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return btoa(binary);
  } catch (e) {
    console.error('PDF generation failed:', e instanceof Error ? e.message : String(e));
    return null;
  }
}

// ---------- SMTP ----------
function smtpConfig() {
  const host = Deno.env.get('SMTP_HOST');
  const port = Number(Deno.env.get('SMTP_PORT') ?? '587');
  const username = Deno.env.get('SMTP_USERNAME');
  const password = Deno.env.get('SMTP_PASSWORD');
  const from = Deno.env.get('SMTP_FROM_EMAIL');
  if (!host || !username || !password || !from) {
    throw new Error('SMTP is not configured. Missing SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD or SMTP_FROM_EMAIL.');
  }
  return { host, port, username, password, from, fromName: Deno.env.get('SMTP_FROM_NAME') ?? 'Reports' };
}

async function sendMail(
  to: string[],
  subject: string,
  bundle: ReportBundle,
  formats: string[],
) {
  const cfg = smtpConfig();
  const attachments: Array<Record<string, unknown>> = [];
  const stamp = `${bundle.periodStart}_to_${bundle.periodEnd}`;

  if (formats.includes('excel')) {
    attachments.push({
      filename: `report_${stamp}.xlsx`,
      content: buildXlsx(bundle),
      encoding: 'base64',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  }
  if (formats.includes('pdf')) {
    const pdf = await buildPdf(bundle);
    if (pdf) {
      attachments.push({
        filename: `report_${stamp}.pdf`,
        content: pdf,
        encoding: 'base64',
        contentType: 'application/pdf',
      });
    }
  }

  const summaryHtml = bundle.sections.map((s) => `
    <h3 style="margin:24px 0 8px;font-size:15px;color:#111;">${s.name}</h3>
    <table style="border-collapse:collapse;font-size:13px;">
      ${Object.entries(s.summary).map(([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#666;">${k}</td><td style="padding:4px 0;font-weight:600;color:#111;">${v}</td></tr>`
      ).join('')}
    </table>`).join('');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#333;padding:8px;">
      <h2 style="margin:0 0 4px;font-size:20px;color:#111;">${bundle.orgName}</h2>
      <p style="margin:0 0 16px;color:#666;font-size:13px;">
        Report period: <strong>${bundle.periodStart}</strong> to <strong>${bundle.periodEnd}</strong>
      </p>
      ${summaryHtml}
      <p style="margin-top:24px;font-size:13px;color:#666;">
        The full details are attached${attachments.length ? ` (${attachments.map((a) => a.filename).join(', ')})` : ''}.
      </p>
    </div>`;

  const client = new SMTPClient({
    connection: {
      hostname: cfg.host,
      port: cfg.port,
      tls: cfg.port === 465,
      auth: { username: cfg.username, password: cfg.password },
    },
  });
  try {
    await client.send({
      from: `${cfg.fromName} <${cfg.from}>`,
      to,
      subject,
      content: `${bundle.orgName} report for ${bundle.periodStart} to ${bundle.periodEnd}. See attachments.`,
      html,
      attachments,
    });
  } finally {
    await client.close();
  }
}

// ---------- handler ----------
async function processSetting(
  admin: ReturnType<typeof createClient>,
  s: Setting,
  override?: { start: string; end: string },
) {
  const period = override ?? periodFor(s);
  const recipients = (s.recipient_emails ?? []).filter((e) => !!e && e.includes('@'));
  if (!recipients.length) throw new Error('No valid recipient email addresses configured.');

  const bundle = await buildReport(admin, s.organization_id, period.start, period.end, s.reports ?? []);
  const subject = `${s.subject || 'Your business report'} (${period.start} to ${period.end})`;

  try {
    await sendMail(recipients, subject, bundle, s.formats?.length ? s.formats : ['excel', 'pdf']);
    await admin.from('report_email_log').insert({
      organization_id: s.organization_id,
      recipients,
      subject,
      period_start: period.start,
      period_end: period.end,
      status: 'sent',
    });
    await admin.from('report_email_settings')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', s.id);
    return { organization_id: s.organization_id, status: 'sent' as const };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('report_email_log').insert({
      organization_id: s.organization_id,
      recipients,
      subject,
      period_start: period.start,
      period_end: period.end,
      status: 'failed',
      error_message: message,
    });
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const body = await req.json().catch(() => ({}));

    // --- manual "send now" from the app (requires an authenticated org admin) ---
    if (body?.sendNow === true) {
      const authHeader = req.headers.get('Authorization') ?? '';
      const token = authHeader.replace('Bearer ', '');
      const { data: userData } = await admin.auth.getUser(token);
      const user = userData?.user;
      if (!user) {
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: profile } = await admin
        .from('profiles').select('organization_id').eq('user_id', user.id).maybeSingle();
      const orgId = profile?.organization_id;
      if (!orgId) {
        return new Response(JSON.stringify({ error: 'No organization for this user' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: roles } = await admin
        .from('user_roles').select('role').eq('user_id', user.id);
      const allowed = (roles ?? []).some((r: { role: string }) =>
        ['admin', 'super_admin', 'super_super_admin'].includes(r.role));
      if (!allowed) {
        return new Response(JSON.stringify({ error: 'Only administrators can send reports' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const { data: setting } = await admin
        .from('report_email_settings').select('*').eq('organization_id', orgId).maybeSingle();
      if (!setting) {
        return new Response(JSON.stringify({ error: 'Report email settings not configured yet' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const result = await processSetting(admin, setting as Setting);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- scheduled run: process every organization that is due ---
    const { data: settings, error } = await admin
      .from('report_email_settings').select('*').eq('is_enabled', true);
    if (error) throw error;

    const due = (settings ?? []).filter((s: Setting) => isDue(s));
    const results: unknown[] = [];
    for (const s of due) {
      try {
        results.push(await processSetting(admin, s as Setting));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`Report email failed for org ${s.organization_id}: ${message}`);
        results.push({ organization_id: s.organization_id, status: 'failed', error: message });
      }
    }
    return new Response(JSON.stringify({ checked: settings?.length ?? 0, due: due.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('send-report-email error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
