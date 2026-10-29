ALTER TABLE public.products
  ADD COLUMN sub_unit_id uuid REFERENCES public.units(id) ON DELETE RESTRICT,
  ADD COLUMN sub_unit_factor numeric NOT NULL DEFAULT 1,
  ADD COLUMN sub_unit_selling_price numeric;

ALTER TABLE public.products
  ADD CONSTRAINT products_sub_unit_factor_check
  CHECK (sub_unit_factor >= 1);

ALTER TABLE public.sale_items
  ADD COLUMN unit_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN unit_label text;

ALTER TABLE public.purchase_items
  ADD COLUMN unit_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN unit_label text;

ALTER TABLE public.sale_return_items
  ADD COLUMN unit_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN unit_label text;

ALTER TABLE public.purchase_return_items
  ADD COLUMN unit_multiplier numeric NOT NULL DEFAULT 1,
  ADD COLUMN unit_label text;

ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_unit_multiplier_check CHECK (unit_multiplier >= 1);

ALTER TABLE public.purchase_items
  ADD CONSTRAINT purchase_items_unit_multiplier_check CHECK (unit_multiplier >= 1);

ALTER TABLE public.sale_return_items
  ADD CONSTRAINT sale_return_items_unit_multiplier_check CHECK (unit_multiplier >= 1);

ALTER TABLE public.purchase_return_items
  ADD CONSTRAINT purchase_return_items_unit_multiplier_check CHECK (unit_multiplier >= 1);
