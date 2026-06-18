
ALTER TABLE public.saudas ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

CREATE TABLE IF NOT EXISTS public.sauda_uplifts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sauda_id uuid NOT NULL REFERENCES public.saudas(id) ON DELETE CASCADE,
  qty numeric NOT NULL,
  kind text NOT NULL DEFAULT 'manual',
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sauda_uplifts TO anon, authenticated;
GRANT ALL ON public.sauda_uplifts TO service_role;

ALTER TABLE public.sauda_uplifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.sauda_uplifts FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS sauda_uplifts_sauda_id_idx ON public.sauda_uplifts(sauda_id);
