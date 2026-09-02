DROP FUNCTION IF EXISTS public.stock_sales_performance_summary(
  uuid,
  timestamptz,
  timestamptz,
  uuid,
  text,
  uuid,
  text,
  text,
  numeric
);

DROP FUNCTION IF EXISTS public.stock_sales_performance_base(
  uuid,
  timestamptz,
  timestamptz,
  uuid,
  text,
  uuid,
  text,
  text,
  numeric
);

CREATE OR REPLACE FUNCTION public.stock_sales_performance_base(
  _org_id uuid,
  _from timestamptz,
  _to timestamptz,
  _branch_id uuid DEFAULT NULL,
  _category text DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL,
  _stock_status text DEFAULT 'all',
  _search text DEFAULT NULL,
  _fast_threshold numeric DEFAULT 1
)
RETURNS TABLE(
  product_id uuid,
  product_name text,
  sku text,
  category text,
  supplier_name text,
  branch_name text,
  opening_stock numeric,
  received numeric,
  units_sold numeric,
  current_stock numeric,
  low_threshold numeric,
  out_threshold numeric,
  cost_price numeric,
  selling_price numeric,
  inventory_value numeric,
  retail_value numeric,
  revenue numeric,
  cogs numeric,
  gross_profit numeric,
  margin numeric,
  stock_status text,
  velocity text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH guard AS (
    SELECT CASE
      WHEN public.is_same_organization(auth.uid(), _org_id) OR public.is_super_super_admin(auth.uid())
        THEN true
      ELSE (SELECT false WHERE false)
    END AS ok
  ),
  prod AS (
    SELECT p.*
    FROM public.products p, guard g
    WHERE g.ok
      AND p.organization_id = _org_id
      AND COALESCE(p.is_archived, false) = false
      AND p.item_type::text <> 'service'
      AND (_branch_id IS NULL OR p.branch_id = _branch_id)
      AND (_category IS NULL OR _category = 'all' OR p.category::text = _category)
      AND (_supplier_id IS NULL OR p.supplier_id = _supplier_id)
      AND (
        _search IS NULL OR btrim(_search) = ''
        OR p.name ILIKE '%' || btrim(_search) || '%'
        OR COALESCE(p.sku, '') ILIKE '%' || btrim(_search) || '%'
      )
  ),
  sold AS (
    SELECT si.product_id,
           SUM(si.quantity) AS qty,
           SUM(si.total_price) AS rev,
           SUM(si.quantity * COALESCE(si.cost_price, 0)) AS cogs
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    WHERE s.organization_id = _org_id
      AND s.status = 'completed'
      AND s.created_at >= _from AND s.created_at <= _to
      AND (_branch_id IS NULL OR s.branch_id = _branch_id)
    GROUP BY si.product_id
  ),
  sreturn AS (
    SELECT ri.product_id,
           SUM(ri.quantity) AS qty,
           SUM(ri.total_price) AS rev
    FROM public.sale_return_items ri
    JOIN public.sale_returns r ON r.id = ri.return_id
    WHERE r.organization_id = _org_id
      AND r.created_at >= _from AND r.created_at <= _to
      AND (_branch_id IS NULL OR r.branch_id = _branch_id)
    GROUP BY ri.product_id
  ),
  purch AS (
    SELECT pi.product_id, SUM(pi.quantity) AS qty
    FROM public.purchase_items pi
    JOIN public.purchases pu ON pu.id = pi.purchase_id
    WHERE pu.organization_id = _org_id
      AND pu.purchase_date >= (_from AT TIME ZONE 'UTC')::date
      AND pu.purchase_date <= (_to AT TIME ZONE 'UTC')::date
      AND (_branch_id IS NULL OR pu.branch_id = _branch_id)
    GROUP BY pi.product_id
  ),
  preturn AS (
    SELECT pri.product_id, SUM(pri.quantity) AS qty
    FROM public.purchase_return_items pri
    JOIN public.purchase_returns pr ON pr.id = pri.return_id
    WHERE pr.organization_id = _org_id
      AND pr.created_at >= _from AND pr.created_at <= _to
      AND (_branch_id IS NULL OR pr.branch_id = _branch_id)
    GROUP BY pri.product_id
  ),
  hist AS (
    SELECT sh.product_id,
           COALESCE(SUM(sh.change_amount) FILTER (WHERE sh.created_at > _to), 0) AS after_to,
           COALESCE(SUM(sh.change_amount) FILTER (WHERE sh.created_at >= _from AND sh.created_at <= _to), 0) AS within
    FROM public.stock_history sh
    JOIN prod p ON p.id = sh.product_id
    WHERE sh.created_at >= _from
    GROUP BY sh.product_id
  ),
  calc AS (
    SELECT
      p.id,
      p.name,
      p.sku,
      p.category::text AS category,
      sup.name AS supplier_name,
      b.name AS branch_name,
      ROUND((COALESCE(p.current_stock, 0) - COALESCE(h.after_to, 0) - COALESCE(h.within, 0))::numeric, 2) AS opening_stock,
      COALESCE(pu.qty, 0) - COALESCE(pr.qty, 0) AS received,
      GREATEST(COALESCE(sd.qty, 0) - COALESCE(sr.qty, 0), 0) AS units_sold,
      ROUND((COALESCE(p.current_stock, 0) - COALESCE(h.after_to, 0))::numeric, 2) AS closing_stock,
      COALESCE(p.low_stock_threshold, 0) AS low_threshold,
      COALESCE(p.out_of_stock_threshold, 0) AS out_threshold,
      COALESCE(p.cost_price, 0) AS cost_price,
      COALESCE(p.selling_price, 0) AS selling_price,
      GREATEST(COALESCE(sd.rev, 0) - COALESCE(sr.rev, 0), 0) AS revenue,
      GREATEST(COALESCE(sd.cogs, 0) - COALESCE(sr.qty, 0) * COALESCE(p.cost_price, 0), 0) AS cogs,
      p.expiration_date
    FROM prod p
    LEFT JOIN public.suppliers sup ON sup.id = p.supplier_id
    LEFT JOIN public.branches b ON b.id = p.branch_id
    LEFT JOIN sold sd ON sd.product_id = p.id
    LEFT JOIN sreturn sr ON sr.product_id = p.id
    LEFT JOIN purch pu ON pu.product_id = p.id
    LEFT JOIN preturn pr ON pr.product_id = p.id
    LEFT JOIN hist h ON h.product_id = p.id
  ),
  final AS (
    SELECT
      c.id AS product_id,
      c.name AS product_name,
      c.sku,
      c.category,
      c.supplier_name,
      c.branch_name,
      c.opening_stock,
      c.received,
      c.units_sold,
      c.closing_stock AS current_stock,
      c.low_threshold,
      c.out_threshold,
      c.cost_price,
      c.selling_price,
      ROUND(c.closing_stock * c.cost_price, 2) AS inventory_value,
      ROUND(c.closing_stock * c.selling_price, 2) AS retail_value,
      ROUND(c.revenue, 2) AS revenue,
      ROUND(c.cogs, 2) AS cogs,
      ROUND(c.revenue - c.cogs, 2) AS gross_profit,
      CASE WHEN c.revenue > 0 THEN ROUND(((c.revenue - c.cogs) / c.revenue) * 100, 2) ELSE 0 END AS margin,
      CASE
        WHEN c.expiration_date IS NOT NULL AND c.expiration_date < CURRENT_DATE THEN 'expired'
        WHEN c.expiration_date IS NOT NULL AND c.expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'almost_expired'
        WHEN c.closing_stock <= c.out_threshold THEN 'out'
        WHEN c.closing_stock <= c.low_threshold THEN 'low'
        ELSE 'normal'
      END AS stock_status,
      CASE WHEN c.units_sold >= GREATEST(COALESCE(_fast_threshold, 1), 0.0001) THEN 'fast' ELSE 'slow' END AS velocity
    FROM calc c
  )
  SELECT * FROM final f
  WHERE _stock_status IS NULL OR _stock_status = 'all'
     OR (_stock_status = 'low' AND f.stock_status = 'low')
     OR (_stock_status = 'out' AND f.stock_status = 'out')
     OR (_stock_status = 'expired' AND f.stock_status = 'expired')
     OR (_stock_status = 'almost_expired' AND f.stock_status = 'almost_expired')
     OR (_stock_status = 'fast' AND f.velocity = 'fast')
     OR (_stock_status = 'slow' AND f.velocity = 'slow')
$$;

GRANT EXECUTE ON FUNCTION public.stock_sales_performance_base(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric) TO authenticated;

DROP FUNCTION IF EXISTS public.stock_sales_performance_summary(
  uuid,
  timestamptz,
  timestamptz,
  uuid,
  text,
  uuid,
  text,
  text,
  numeric
);

CREATE OR REPLACE FUNCTION public.stock_sales_performance_summary(
  _org_id uuid,
  _from timestamptz,
  _to timestamptz,
  _branch_id uuid DEFAULT NULL,
  _category text DEFAULT NULL,
  _supplier_id uuid DEFAULT NULL,
  _stock_status text DEFAULT 'all',
  _search text DEFAULT NULL,
  _fast_threshold numeric DEFAULT 1
)
RETURNS TABLE(
  inventory_cost_value numeric,
  potential_retail_value numeric,
  potential_gross_value numeric,
  units_sold numeric,
  gross_revenue numeric,
  total_cogs numeric,
  gross_profit numeric,
  avg_margin numeric,
  transactions bigint,
  active_skus bigint,
  low_stock_items bigint,
  out_of_stock_items bigint,
  expired_items bigint,
  almost_expired_items bigint,
  fast_movers bigint,
  slow_movers bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH b AS (
    SELECT * FROM public.stock_sales_performance_base(
      _org_id, _from, _to, _branch_id, _category, _supplier_id, _stock_status, _search, _fast_threshold)
  ),
  agg AS (
    SELECT
      COALESCE(SUM(inventory_value), 0) AS inv_cost,
      COALESCE(SUM(retail_value), 0) AS inv_retail,
      COALESCE(SUM(units_sold), 0) AS units,
      COALESCE(SUM(revenue), 0) AS rev,
      COALESCE(SUM(cogs), 0) AS cogs,
      COUNT(*) AS skus,
      COUNT(*) FILTER (WHERE stock_status = 'low') AS low_items,
      COUNT(*) FILTER (WHERE stock_status = 'out') AS out_items,
      COUNT(*) FILTER (WHERE stock_status = 'expired') AS expired_items,
      COUNT(*) FILTER (WHERE stock_status = 'almost_expired') AS almost_expired_items,
      COUNT(*) FILTER (WHERE velocity = 'fast') AS fast_items,
      COUNT(*) FILTER (WHERE velocity = 'slow') AS slow_items
    FROM b
  ),
  tx AS (
    SELECT COUNT(DISTINCT s.id) AS c
    FROM public.sales s
    WHERE s.organization_id = _org_id
      AND s.status = 'completed'
      AND s.created_at >= _from AND s.created_at <= _to
      AND (_branch_id IS NULL OR s.branch_id = _branch_id)
      AND (public.is_same_organization(auth.uid(), _org_id) OR public.is_super_super_admin(auth.uid()))
  )
  SELECT
    ROUND(a.inv_cost, 2),
    ROUND(a.inv_retail, 2),
    ROUND(a.inv_retail - a.inv_cost, 2),
    a.units,
    ROUND(a.rev, 2),
    ROUND(a.cogs, 2),
    ROUND(a.rev - a.cogs, 2),
    CASE WHEN a.rev > 0 THEN ROUND(((a.rev - a.cogs) / a.rev) * 100, 2) ELSE 0 END,
    tx.c,
    a.skus,
    a.low_items,
    a.out_items,
    a.expired_items,
    a.almost_expired_items,
    a.fast_items,
    a.slow_items
  FROM agg a CROSS JOIN tx
$$;

GRANT EXECUTE ON FUNCTION public.stock_sales_performance_summary(uuid, timestamptz, timestamptz, uuid, text, uuid, text, text, numeric) TO authenticated;
