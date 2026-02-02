-- Drop the existing constraint and add new one with purchase types
ALTER TABLE public.stock_history DROP CONSTRAINT IF EXISTS stock_history_change_type_check;

ALTER TABLE public.stock_history ADD CONSTRAINT stock_history_change_type_check 
CHECK (change_type = ANY (ARRAY['increase'::text, 'decrease'::text, 'adjustment'::text, 'initial'::text, 'purchase'::text, 'purchase_reversal'::text, 'sale'::text, 'sale_reversal'::text]));