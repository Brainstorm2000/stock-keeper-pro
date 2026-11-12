ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS receipt_paper_size text NOT NULL DEFAULT '80mm'
  CHECK (receipt_paper_size IN ('80mm', '57mm', 'a4'));
