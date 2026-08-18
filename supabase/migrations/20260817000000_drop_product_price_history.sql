-- Drop product price history feature
DROP TRIGGER IF EXISTS trg_log_product_price_change ON public.products;

DROP FUNCTION IF EXISTS public.log_product_price_change();

DROP TABLE IF EXISTS public.product_price_history;
