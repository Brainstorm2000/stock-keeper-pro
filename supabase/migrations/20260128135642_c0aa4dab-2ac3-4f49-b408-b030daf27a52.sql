-- Create branches table
CREATE TABLE public.branches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Add branch_id to products (nullable for migration)
ALTER TABLE public.products ADD COLUMN branch_id UUID REFERENCES public.branches(id);

-- Create user_branch_assignments table
CREATE TABLE public.user_branch_assignments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, branch_id)
);

-- Enable RLS on user_branch_assignments
ALTER TABLE public.user_branch_assignments ENABLE ROW LEVEL SECURITY;

-- Create function to check if user is super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_admin'
  )
$$;

-- Create function to check if user has access to a branch
CREATE OR REPLACE FUNCTION public.has_branch_access(_user_id uuid, _branch_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_super_admin(_user_id) OR
    EXISTS (
      SELECT 1
      FROM public.user_branch_assignments
      WHERE user_id = _user_id
        AND branch_id = _branch_id
    )
$$;

-- RLS policies for branches
CREATE POLICY "Super admins can manage all branches"
ON public.branches
FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view all branches"
ON public.branches
FOR SELECT
USING (true);

-- RLS policies for user_branch_assignments
CREATE POLICY "Super admins can manage all assignments"
ON public.user_branch_assignments
FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own assignments"
ON public.user_branch_assignments
FOR SELECT
USING (user_id = auth.uid());

-- Update products RLS to include branch access
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;

CREATE POLICY "Admins can insert products"
ON public.products
FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  (public.has_role(auth.uid(), 'admin') AND (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id)))
);

CREATE POLICY "Admins can update products"
ON public.products
FOR UPDATE
USING (
  public.is_super_admin(auth.uid()) OR
  (public.has_role(auth.uid(), 'admin') AND (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id)))
);

CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
USING (
  public.is_super_admin(auth.uid()) OR
  (public.has_role(auth.uid(), 'admin') AND (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id)))
);

-- Add trigger for branches updated_at
CREATE TRIGGER update_branches_updated_at
BEFORE UPDATE ON public.branches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();