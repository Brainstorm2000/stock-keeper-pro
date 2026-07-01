import { Card, CardContent } from '@/components/ui/card';
import { Users, UserCheck, Clock, Timer } from 'lucide-react';
import { useStaff } from '@/hooks/useStaff';
import { useAttendance } from '@/hooks/useAttendance';

function todayLocal() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function AttendanceDashboard() {
  const today = todayLocal();
  const { data: staffList = [] } = useStaff();
  const { data: todayRecords = [] } = useAttendance({ dateFrom: today, dateTo: today });

  const totalStaff = staffList.filter((s: any) => s.is_active !== false).length;
  const uniquePresent = new Set(
    todayRecords.filter((r) => !!r.clock_in_time).map((r) => r.staff_id),
  ).size;
  const lateCount = new Set(
    todayRecords.filter((r) => r.status === 'late').map((r) => r.staff_id),
  ).size;
  const overtimeCount = new Set(
    todayRecords
      .filter((r) => (r.overtime_hours ?? 0) > 0 || r.status === 'overtime')
      .map((r) => r.staff_id),
  ).size;

  const cards = [
    {
      label: 'Total Staff',
      value: totalStaff,
      icon: Users,
      iconClass: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300',
    },
    {
      label: 'Present Today',
      value: uniquePresent,
      icon: UserCheck,
      iconClass: 'text-green-600 bg-green-100 dark:bg-green-500/10 dark:text-green-400',
    },
    {
      label: 'Late Arrivals',
      value: lateCount,
      icon: Clock,
      iconClass: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-500/10 dark:text-yellow-400',
    },
    {
      label: 'On Overtime',
      value: overtimeCount,
      icon: Timer,
      iconClass: 'text-purple-600 bg-purple-100 dark:bg-purple-500/10 dark:text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon, iconClass }) => (
        <Card key={label}>
          <CardContent className="p-4 flex items-center gap-4">
            <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${iconClass}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                {label}
              </div>
              <div className="text-2xl font-bold text-foreground">{value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}