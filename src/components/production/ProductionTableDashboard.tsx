import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/currency';
import type { ProductionField, ProductionRecordValue } from '@/hooks/useProduction';

interface Props {
  fields: ProductionField[];
  records: Array<{ id: string; created_at: string; values: ProductionRecordValue[] }>;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

export function ProductionTableDashboard({ fields, records }: Props) {
  const numberFields = fields.filter(f => f.type === 'number' || f.type === 'currency');
  const selectFields = fields.filter(f => f.type === 'select');
  const dateFields = fields.filter(f => f.type === 'date');

  // Summary cards for number/currency fields
  const summaries = useMemo(() => {
    return numberFields.map(field => {
      const values = records
        .map(r => {
          const v = r.values.find(rv => rv.field_id === field.id);
          return v ? parseFloat(v.value || '0') : 0;
        })
        .filter(v => !isNaN(v));

      const total = values.reduce((s, v) => s + v, 0);
      const avg = values.length > 0 ? total / values.length : 0;

      return { field, total, avg, count: values.length };
    });
  }, [numberFields, records]);

  // Pie charts for select fields
  const selectCharts = useMemo(() => {
    return selectFields.map(field => {
      const counts: Record<string, number> = {};
      records.forEach(r => {
        const v = r.values.find(rv => rv.field_id === field.id);
        const val = v?.value || 'N/A';
        counts[val] = (counts[val] || 0) + 1;
      });
      const data = Object.entries(counts).map(([name, value]) => ({ name, value }));
      return { field, data };
    });
  }, [selectFields, records]);

  // Line charts: date field + number field combinations
  const lineCharts = useMemo(() => {
    if (dateFields.length === 0 || numberFields.length === 0) return [];

    const dateField = dateFields[0];
    return numberFields.slice(0, 3).map(numField => {
      const data = records
        .map(r => {
          const dateVal = r.values.find(rv => rv.field_id === dateField.id)?.value;
          const numVal = r.values.find(rv => rv.field_id === numField.id)?.value;
          if (!dateVal) return null;
          return { date: dateVal, value: parseFloat(numVal || '0') };
        })
        .filter(Boolean)
        .sort((a, b) => new Date(a!.date).getTime() - new Date(b!.date).getTime()) as { date: string; value: number }[];
      return { dateField, numField, data };
    });
  }, [dateFields, numberFields, records]);

  // Bar chart: select + number combo
  const barCharts = useMemo(() => {
    if (selectFields.length === 0 || numberFields.length === 0) return [];
    const selectField = selectFields[0];
    const numField = numberFields[0];

    const grouped: Record<string, number[]> = {};
    records.forEach(r => {
      const cat = r.values.find(rv => rv.field_id === selectField.id)?.value || 'N/A';
      const val = parseFloat(r.values.find(rv => rv.field_id === numField.id)?.value || '0');
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(val);
    });

    const data = Object.entries(grouped).map(([name, vals]) => ({
      name,
      total: vals.reduce((s, v) => s + v, 0),
      average: vals.reduce((s, v) => s + v, 0) / vals.length,
    }));

    return [{ selectField, numField, data }];
  }, [selectFields, numberFields, records]);

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No records yet. Add some records to see dashboard analytics.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{records.length}</div>
          </CardContent>
        </Card>
        {summaries.map(s => (
          <Card key={s.field.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.field.name} (Total / Avg)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {s.field.type === 'currency' ? formatCurrency(s.total) : s.total.toLocaleString()}
              </div>
              <p className="text-sm text-muted-foreground">
                Avg: {s.field.type === 'currency' ? formatCurrency(s.avg) : s.avg.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Line Charts */}
      {lineCharts.map((lc, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{lc.numField.name} over {lc.dateField.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lc.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}

      {/* Bar Charts */}
      {barCharts.map((bc, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-sm font-medium">{bc.numField.name} by {bc.selectField.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bc.data}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ))}

      {/* Pie Charts */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
        {selectCharts.map((sc, i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-sm font-medium">{sc.field.name} Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={sc.data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {sc.data.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
