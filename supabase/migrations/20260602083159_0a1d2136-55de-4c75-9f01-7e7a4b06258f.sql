-- Add 'products' to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'products';

-- Add safety net defaults so changed_by/created_by always falls back to the current user
ALTER TABLE public.stock_history ALTER COLUMN changed_by SET DEFAULT auth.uid();
ALTER TABLE public.raw_material_stock_history ALTER COLUMN changed_by SET DEFAULT auth.uid();
ALTER TABLE public.work_orders ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Backfill legacy null actors using the most reliable available source
UPDATE public.stock_history sh
SET changed_by = p.created_by
FROM public.products p
WHERE sh.product_id = p.id
  AND sh.changed_by IS NULL
  AND sh.change_type = 'initial'
  AND p.created_by IS NOT NULL;

UPDATE public.raw_material_stock_history rmsh
SET changed_by = rm.created_by
FROM public.raw_materials rm
WHERE rmsh.raw_material_id = rm.id
  AND rmsh.changed_by IS NULL
  AND rm.created_by IS NOT NULL;