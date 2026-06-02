-- Add fields to shifts
ALTER TABLE public.shifts
  ADD COLUMN IF NOT EXISTS auto_clockout_time time,
  ADD COLUMN IF NOT EXISTS max_overtime_hours numeric;

-- Function to close stale open attendance using each shift's auto_clockout_time
CREATE OR REPLACE FUNCTION public.auto_clockout_stale_attendance(_org_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  closed_count integer := 0;
  v_clock_out timestamptz;
  v_clock_in timestamptz;
  v_hours numeric;
  v_ot numeric;
  v_reg numeric;
  v_ot_start timestamptz;
  v_max_ot numeric;
BEGIN
  -- Permission: caller must belong to org or be super admin
  IF NOT (public.is_same_organization(auth.uid(), _org_id) OR public.is_super_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  FOR r IN
    SELECT a.id, a.clock_in_time, a.attendance_date, a.status,
           s.auto_clockout_time, s.end_time, s.overtime_start_time, s.max_overtime_hours
    FROM public.attendance a
    JOIN public.shifts s ON s.id = a.shift_id
    WHERE a.organization_id = _org_id
      AND a.clock_out_time IS NULL
      AND a.clock_in_time IS NOT NULL
      AND s.auto_clockout_time IS NOT NULL
      AND (a.attendance_date < CURRENT_DATE
           OR (a.attendance_date = CURRENT_DATE
               AND (CURRENT_TIME)::time >= s.auto_clockout_time))
  LOOP
    v_clock_in := r.clock_in_time;
    v_clock_out := (r.attendance_date::text || ' ' || r.auto_clockout_time::text)::timestamptz;
    IF v_clock_out <= v_clock_in THEN
      v_clock_out := v_clock_in + interval '1 minute';
    END IF;

    v_hours := EXTRACT(EPOCH FROM (v_clock_out - v_clock_in)) / 3600.0;
    v_ot := 0;
    IF r.overtime_start_time IS NOT NULL THEN
      v_ot_start := (r.attendance_date::text || ' ' || r.overtime_start_time::text)::timestamptz;
      IF v_clock_out > v_ot_start THEN
        v_ot := EXTRACT(EPOCH FROM (v_clock_out - v_ot_start)) / 3600.0;
      END IF;
    END IF;
    v_max_ot := r.max_overtime_hours;
    IF v_max_ot IS NOT NULL AND v_ot > v_max_ot THEN
      v_ot := v_max_ot;
    END IF;
    v_reg := GREATEST(0, v_hours - v_ot);

    UPDATE public.attendance
      SET clock_out_time = v_clock_out,
          hours_worked = ROUND(v_hours::numeric, 2),
          overtime_hours = ROUND(v_ot::numeric, 2),
          regular_hours = ROUND(v_reg::numeric, 2),
          status = CASE WHEN v_ot > 0 THEN 'overtime' ELSE COALESCE(r.status, 'on_time') END,
          notes = COALESCE(notes || ' | ', '') || 'Auto clock-out'
      WHERE id = r.id;

    closed_count := closed_count + 1;
  END LOOP;

  RETURN closed_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_clockout_stale_attendance(uuid) TO authenticated;
