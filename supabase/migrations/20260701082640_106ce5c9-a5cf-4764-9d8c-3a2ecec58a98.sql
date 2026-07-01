
ALTER TABLE public.attendance ALTER COLUMN shift_id DROP NOT NULL;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_shift_id_fkey;
ALTER TABLE public.attendance ADD CONSTRAINT attendance_shift_id_fkey
  FOREIGN KEY (shift_id) REFERENCES public.shifts(id) ON DELETE SET NULL;
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS clocked_out_by uuid;
