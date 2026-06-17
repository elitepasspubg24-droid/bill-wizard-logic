
-- History tables to version daily rates
CREATE TABLE public.factory_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES public.factories(id) ON DELETE CASCADE,
  basic_rate numeric NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.factory_rate_history TO anon, authenticated;
GRANT ALL ON public.factory_rate_history TO service_role;
ALTER TABLE public.factory_rate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.factory_rate_history FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX ON public.factory_rate_history (factory_id, changed_at DESC);

CREATE TABLE public.section_rate_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  adder numeric NOT NULL,
  sauda_basic numeric NOT NULL,
  party_basic numeric NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.section_rate_history TO anon, authenticated;
GRANT ALL ON public.section_rate_history TO service_role;
ALTER TABLE public.section_rate_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open" ON public.section_rate_history FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX ON public.section_rate_history (section_id, changed_at DESC);

-- Triggers: snapshot on insert and on rate change
CREATE OR REPLACE FUNCTION public.log_factory_rate() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.basic_rate IS DISTINCT FROM OLD.basic_rate THEN
    INSERT INTO public.factory_rate_history(factory_id, basic_rate)
    VALUES (NEW.id, NEW.basic_rate);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_factory_rate
AFTER INSERT OR UPDATE ON public.factories
FOR EACH ROW EXECUTE FUNCTION public.log_factory_rate();

CREATE OR REPLACE FUNCTION public.log_section_rate() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR NEW.adder IS DISTINCT FROM OLD.adder
     OR NEW.sauda_basic IS DISTINCT FROM OLD.sauda_basic
     OR NEW.party_basic IS DISTINCT FROM OLD.party_basic THEN
    INSERT INTO public.section_rate_history(section_id, adder, sauda_basic, party_basic)
    VALUES (NEW.id, NEW.adder, NEW.sauda_basic, NEW.party_basic);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_log_section_rate
AFTER INSERT OR UPDATE ON public.sections
FOR EACH ROW EXECUTE FUNCTION public.log_section_rate();

-- Seed initial snapshot for existing rows so history isn't empty
INSERT INTO public.factory_rate_history (factory_id, basic_rate)
SELECT id, basic_rate FROM public.factories;

INSERT INTO public.section_rate_history (section_id, adder, sauda_basic, party_basic)
SELECT id, adder, sauda_basic, party_basic FROM public.sections;
