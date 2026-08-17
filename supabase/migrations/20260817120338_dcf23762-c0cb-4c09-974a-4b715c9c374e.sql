REVOKE EXECUTE ON FUNCTION public.stock_sales_performance_base(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.stock_sales_performance_rows(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric, text, text, integer, integer) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.stock_sales_performance_summary(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.stock_sales_performance_base(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_sales_performance_rows(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stock_sales_performance_summary(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric) TO authenticated;