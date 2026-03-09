import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface Attendance {
  id: string;
  organization_id: string;
  staff_id: string;
  shift_id: string;
  branch_id: string | null;
  department_id: string | null;
  attendance_date: string;
  clock_in_time: string | null;
  clock_out_time: string | null;
  hours_worked: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  status: string;
  notes: string | null;
  created_at: string;
  staff?: { id: string; full_name: string; staff_id: string | null; department: string | null } | null;
  shifts?: { id: string; shift_name: string; start_time: string; end_time: string; overtime_start_time: string | null; grace_period_minutes: number; clockin_start_time: string } | null;
  branches?: { id: string; name: string } | null;
  departments?: { id: string; name: string } | null;
}

export interface AttendanceFilters {
  dateFrom?: string;
  dateTo?: string;
  staffId?: string;
  branchId?: string;
  departmentId?: string;
  shiftId?: string;
  status?: string;
}

export function useAttendance(filters: AttendanceFilters = {}) {
  return useQuery({
    queryKey: ['attendance', filters],
    queryFn: async () => {
      let query = supabase
        .from('attendance')
        .select('*, staff(id, full_name, staff_id, department), shifts(id, shift_name, start_time, end_time, overtime_start_time, grace_period_minutes, clockin_start_time), branches(id, name), departments(id, name)')
        .order('attendance_date', { ascending: false });

      if (filters.dateFrom) query = query.gte('attendance_date', filters.dateFrom);
      if (filters.dateTo) query = query.lte('attendance_date', filters.dateTo);
      if (filters.staffId) query = query.eq('staff_id', filters.staffId);
      if (filters.branchId) query = query.eq('branch_id', filters.branchId);
      if (filters.departmentId) query = query.eq('department_id', filters.departmentId);
      if (filters.shiftId) query = query.eq('shift_id', filters.shiftId);
      if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status);

      const { data, error } = await query;
      if (error) throw error;
      return data as Attendance[];
    },
  });
}

export function useStaffAttendanceSummary(staffId: string | undefined) {
  return useQuery({
    queryKey: ['attendance-summary', staffId],
    queryFn: async () => {
      if (!staffId) return null;
      const { data, error } = await supabase
        .from('attendance')
        .select('status, hours_worked, overtime_hours')
        .eq('staff_id', staffId);
      if (error) throw error;

      return {
        totalHours: data.reduce((sum, r) => sum + (r.hours_worked || 0), 0),
        totalOvertime: data.reduce((sum, r) => sum + (r.overtime_hours || 0), 0),
        lateCount: data.filter(r => r.status === 'late').length,
        absentCount: data.filter(r => r.status === 'absent').length,
        earlyCount: data.filter(r => r.status === 'early').length,
        onTimeCount: data.filter(r => r.status === 'on_time').length,
        total: data.length,
      };
    },
    enabled: !!staffId,
  });
}

function computeStatus(clockInTime: Date, shiftStartTime: string, graceMinutes: number, attendanceDate: string): string {
  const [h, m, s] = shiftStartTime.split(':').map(Number);
  const shiftStart = new Date(attendanceDate + 'T00:00:00');
  shiftStart.setHours(h, m, s || 0);
  const graceEnd = new Date(shiftStart.getTime() + graceMinutes * 60000);

  if (clockInTime < shiftStart) return 'early';
  if (clockInTime <= graceEnd) return 'on_time';
  return 'late';
}

function computeHours(clockIn: Date, clockOut: Date, shiftEndTime: string, overtimeStartTime: string | null, attendanceDate: string) {
  const hoursWorked = (clockOut.getTime() - clockIn.getTime()) / 3600000;

  let overtimeHours = 0;
  if (overtimeStartTime) {
    const [oh, om] = overtimeStartTime.split(':').map(Number);
    const otStart = new Date(attendanceDate + 'T00:00:00');
    otStart.setHours(oh, om, 0);
    if (clockOut > otStart) {
      overtimeHours = (clockOut.getTime() - otStart.getTime()) / 3600000;
    }
  }

  const [eh, em] = shiftEndTime.split(':').map(Number);
  const shiftEnd = new Date(attendanceDate + 'T00:00:00');
  shiftEnd.setHours(eh, em, 0);
  const [sh] = shiftEndTime.split(':').map(Number);
  // regular hours is based on shift duration
  const regularHours = Math.max(0, hoursWorked - overtimeHours);

  return { hoursWorked: Math.round(hoursWorked * 100) / 100, overtimeHours: Math.round(overtimeHours * 100) / 100, regularHours: Math.round(regularHours * 100) / 100 };
}

export function useClockIn() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ staffId, shiftId, branchId, departmentId }: { staffId: string; shiftId: string; branchId?: string | null; departmentId?: string | null }) => {
      if (!organizationId) throw new Error('No organization');

      // Get shift info
      const { data: shift, error: shiftErr } = await supabase
        .from('shifts')
        .select('*')
        .eq('id', shiftId)
        .single();
      if (shiftErr || !shift) throw new Error('Shift not found');

      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Check clock-in window
      const [cih, cim] = shift.clockin_start_time.split(':').map(Number);
      const clockinStart = new Date(today + 'T00:00:00');
      clockinStart.setHours(cih, cim, 0);
      if (now < clockinStart) {
        throw new Error(`Clock-in not allowed before ${shift.clockin_start_time.slice(0, 5)}`);
      }

      // Check existing
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('staff_id', staffId)
        .eq('attendance_date', today)
        .eq('shift_id', shiftId)
        .maybeSingle();

      if (existing) throw new Error('Already clocked in for today');

      const status = computeStatus(now, shift.start_time, shift.grace_period_minutes, today);

      const { data, error } = await supabase
        .from('attendance')
        .insert({
          organization_id: organizationId,
          staff_id: staffId,
          shift_id: shiftId,
          branch_id: branchId || null,
          department_id: departmentId || null,
          attendance_date: today,
          clock_in_time: now.toISOString(),
          status,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Clock-in successful' });
    },
    onError: (error: Error) => {
      const userFacingMessages = [
        'No organization',
        'Shift not found',
        'Already clocked in for today',
        'Clock-in not allowed before',
      ];

      if (userFacingMessages.some((msg) => error.message?.includes(msg))) {
        toast({ title: 'Failed to clock in', description: error.message, variant: 'destructive' });
        return;
      }

      const { title, description } = parseDbError(error, 'clock in');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useClockOut() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ staffId, shiftId }: { staffId: string; shiftId: string }) => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      const { data: record, error: recErr } = await supabase
        .from('attendance')
        .select('*, shifts(start_time, end_time, overtime_start_time)')
        .eq('staff_id', staffId)
        .eq('attendance_date', today)
        .eq('shift_id', shiftId)
        .is('clock_out_time', null)
        .maybeSingle();

      if (recErr || !record) throw new Error('No active clock-in found for today');

      const clockIn = new Date(record.clock_in_time!);
      const shift = record.shifts as any;
      const { hoursWorked, overtimeHours, regularHours } = computeHours(
        clockIn, now, shift.end_time, shift.overtime_start_time, today
      );

      let status = record.status;
      if (overtimeHours > 0) status = 'overtime';

      const { data, error } = await supabase
        .from('attendance')
        .update({
          clock_out_time: now.toISOString(),
          hours_worked: hoursWorked,
          overtime_hours: overtimeHours,
          regular_hours: regularHours,
          status,
        })
        .eq('id', record.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Clock-out successful' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'clock out');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
