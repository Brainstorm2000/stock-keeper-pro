ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS category_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'assets_category_id_fkey'
      AND conrelid = 'public.assets'::regclass
  ) THEN
    ALTER TABLE public.assets
      ADD CONSTRAINT assets_category_id_fkey
      FOREIGN KEY (category_id)
      REFERENCES public.asset_categories(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS assets_category_id_idx ON public.assets(category_id);