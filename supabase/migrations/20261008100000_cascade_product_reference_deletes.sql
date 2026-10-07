ALTER TABLE public.bill_of_materials
  DROP CONSTRAINT IF EXISTS bill_of_materials_product_id_fkey,
  ADD CONSTRAINT bill_of_materials_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_items
  DROP CONSTRAINT IF EXISTS purchase_items_product_id_fkey,
  ADD CONSTRAINT purchase_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.purchase_return_items
  DROP CONSTRAINT IF EXISTS purchase_return_items_product_id_fkey,
  ADD CONSTRAINT purchase_return_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.sale_items
  DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey,
  ADD CONSTRAINT sale_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.sale_return_items
  DROP CONSTRAINT IF EXISTS sale_return_items_product_id_fkey,
  ADD CONSTRAINT sale_return_items_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.stock_history
  DROP CONSTRAINT IF EXISTS stock_history_product_id_fkey,
  ADD CONSTRAINT stock_history_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_product_id_fkey,
  ADD CONSTRAINT work_orders_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE,
  DROP CONSTRAINT IF EXISTS work_orders_bom_id_fkey,
  ADD CONSTRAINT work_orders_bom_id_fkey
    FOREIGN KEY (bom_id) REFERENCES public.bill_of_materials(id) ON DELETE CASCADE;

ALTER TABLE public.bom_items
  DROP CONSTRAINT IF EXISTS bom_items_bom_id_fkey,
  ADD CONSTRAINT bom_items_bom_id_fkey
    FOREIGN KEY (bom_id) REFERENCES public.bill_of_materials(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Users with product delete permission can delete accessible products" ON public.products;
CREATE POLICY "Users with product delete permission can delete accessible products"
  ON public.products
  FOR DELETE TO authenticated
  USING (
    public.is_same_organization(auth.uid(), organization_id)
    AND public.has_module_permission(auth.uid(), 'products'::app_module, 'delete')
    AND (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id))
  );