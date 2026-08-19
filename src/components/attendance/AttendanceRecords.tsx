import { useState } from 'react';
import { useAttendance, type AttendanceFilters } from '@/hooks/useAttendance';
import { useStaff } from '@/hooks/useStaff';
import { useBranches } from '@/hooks/useBranches';
import { useDepartments } from '@/hooks/useDepartments';
import { useShifts } from '@/hooks/useShifts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Loader2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { exportAttendanceToExcel } from '@/lib/csv-utils';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';

const statusColors: Record<string, string> = {
  early: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  on_time: 'bg-green-500/10 text-green-700 dark:text-green-400',
  late: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  overtime: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  absent: 'bg-destructive/10 text-destructive',
};

function getArrivalCategory(record: {
  clock_in_time: string | null;
  status: string;
  shifts?: { start_time: string; grace_period_minutes: number } | null;
}): 'early' | 'late' | 'onTime' | null {
  if (!record.clock_in_time || record.status === 'absent') return null;
  if (!record.shifts) return record.status === 'early' ? 'early' : record.status === 'late' ? 'late' : 'onTime';

  const [hours, minutes, seconds = 0] = record.shifts.start_time.split(':').map(Number);
  const shiftStart = new Date(record.clock_in_time);
  shiftStart.setHours(hours, minutes, seconds, 0);
  const graceEnd = shiftStart.getTime() + record.shifts.grace_period_minutes * 60000;
  const clockIn = new Date(record.clock_in_time).getTime();

  if (clockIn < shiftStart.getTime()) return 'early';
  if (clockIn > graceEnd) return 'late';
  return 'onTime';
}

export function AttendanceRecords() {
  const todayStr = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  })();
  const [filters, setFilters] = useState<AttendanceFilters>({
    dateFrom: todayStr,
    dateTo: todayStr,
  });
  const [search, setSearch] = useState('');
  const { data: allRecords = [], isLoading } = useAttendance(filters);
  const q = search.trim().toLowerCase();
  const records = q
    ? allRecords.filter(r =>
        [
          r.staff?.full_name,
          r.departments?.name,
          r.staff?.department,
          r.branches?.name,
          r.shifts?.shift_name,
          r.attendance_date,
          r.status,
          r.clocked_in_by_name,
          r.clocked_out_by_name,
          r.notes,
        ]
          .filter(Boolean)
          .some(v => String(v).toLowerCase().includes(q)),
      )
    : allRecords;
  const { data: staffList = [] } = useStaff();
  const { data: branches = [] } = useBranches();
  const { data: departments = [] } = useDepartments();
  const { data: shifts = [] } = useShifts();

  const attendanceSummaryByStaff = (() => {
    const map = new Map<string, { worked: Set<string>; late: Set<string>; early: Set<string>; onTime: Set<string> }>();
    for (const r of records) {
      if (!r.staff_id) continue;
      if (!map.has(r.staff_id)) {
        map.set(r.staff_id, { worked: new Set(), late: new Set(), early: new Set(), onTime: new Set() });
      }
      const summary = map.get(r.staff_id)!;
      const worked = !!r.clock_in_time || (r.status && r.status !== 'absent');
      if (worked) summary.worked.add(r.attendance_date);
      const arrivalCategory = getArrivalCategory(r);
      if (arrivalCategory === 'late') summary.late.add(r.attendance_date);
      if (arrivalCategory === 'early') summary.early.add(r.attendance_date);
      if (arrivalCategory === 'onTime') summary.onTime.add(r.attendance_date);
    }
    return Object.fromEntries(Array.from(map, ([staffId, summary]) => [staffId, {
      daysWorked: summary.worked.size,
      daysLate: summary.late.size,
      daysEarly: summary.early.size,
      daysOnTime: summary.onTime.size,
    }]));
  })();

  const {
    paginatedItems: paginatedRecords,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    setCurrentPage,
    setPageSize,
  } = usePagination(records, 10);

  const handleExport = () => {
    exportAttendanceToExcel(records, attendanceSummaryByStaff, `attendance-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="relative w-full sm:w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search records..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Input
          type="date"
          className="w-[160px]"
          value={filters.dateFrom || ''}
          onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value || undefined }))}
          placeholder="From date"
        />
        <Input
          type="date"
          className="w-[160px]"
          value={filters.dateTo || ''}
          onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value || undefined }))}
          placeholder="To date"
        />
        <Select value={filters.staffId || 'all'} onValueChange={v => setFilters(f => ({ ...f, staffId: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Staff" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Staff</SelectItem>
            {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.branchId || 'all'} onValueChange={v => setFilters(f => ({ ...f, branchId: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Branches" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Branches</SelectItem>
            {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.departmentId || 'all'} onValueChange={v => setFilters(f => ({ ...f, departmentId: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Depts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.shiftId || 'all'} onValueChange={v => setFilters(f => ({ ...f, shiftId: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Shifts" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Shifts</SelectItem>
            {shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.shift_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.status || 'all'} onValueChange={v => setFilters(f => ({ ...f, status: v === 'all' ? undefined : v }))}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="early">Early</SelectItem>
            <SelectItem value="on_time">On Time</SelectItem>
            <SelectItem value="late">Late</SelectItem>
            <SelectItem value="overtime">Overtime</SelectItem>
            <SelectItem value="absent">Absent</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={handleExport} disabled={records.length === 0}>
          <Download className="mr-2 h-4 w-4" />Export
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Clock In</TableHead>
                <TableHead>Clock In By</TableHead>
                <TableHead>Clock Out</TableHead>
                <TableHead>Clock Out By</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Overtime</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">No records found</TableCell></TableRow>
              ) : paginatedRecords.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.staff?.full_name || '-'}</TableCell>
                  <TableCell>{r.departments?.name || r.staff?.department || '-'}</TableCell>
                  <TableCell>{r.branches?.name || '-'}</TableCell>
                  <TableCell>{r.shifts?.shift_name || '-'}</TableCell>
                  <TableCell>{r.attendance_date}</TableCell>
                  <TableCell>{r.clock_in_time ? format(new Date(r.clock_in_time), 'HH:mm') : '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.clocked_in_by_name || '-'}</TableCell>
                  <TableCell>{r.clock_out_time ? format(new Date(r.clock_out_time), 'HH:mm') : '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{r.clocked_out_by_name || '-'}</TableCell>
                  <TableCell>{r.hours_worked ? r.hours_worked.toFixed(1) : '-'}</TableCell>
                  <TableCell>{r.overtime_hours ? r.overtime_hours.toFixed(1) : '0'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusColors[r.status] || ''}>
                      {[
                        r.status === 'late' ? 'late' : null,
                        (r.overtime_hours ?? 0) > 0 || r.status === 'overtime' ? 'overtime' : null,
                      ].filter(Boolean).join(' | ') || r.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}
    </div>
  );
}
