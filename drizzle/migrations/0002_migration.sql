-- Configurações da loja editáveis pelo admin (ex.: e-mail padrão de notificação)
CREATE TABLE IF NOT EXISTS public.store_settings (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings admin read" ON public.store_settings
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "settings admin write" ON public.store_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.store_settings (key, value)
VALUES ('notification_email', 'contato@elizalingerie.com.br')
ON CONFLICT (key) DO NOTHING;
