
CREATE TABLE public.candles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  multiplicador FLOAT NOT NULL,
  cor TEXT NOT NULL CHECK (cor IN ('blue','purple','pink')),
  rodada_id TEXT,
  fonte TEXT DEFAULT 'manual' CHECK (fonte IN ('auto','manual','csv')),
  session_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.candles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_candles" ON public.candles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_candles" ON public.candles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_candles" ON public.candles FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  label TEXT,
  total_candles INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_sessions" ON public.sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_sessions" ON public.sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_sessions" ON public.sessions FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  rules JSONB,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_strategies" ON public.strategies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_strategies" ON public.strategies FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_strategies" ON public.strategies FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_strategies" ON public.strategies FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE public.strategy_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy_id UUID REFERENCES public.strategies NOT NULL,
  user_id UUID REFERENCES auth.users NOT NULL,
  resultado TEXT CHECK (resultado IN ('win','loss','skip')),
  multiplicador_entrada FLOAT,
  banca_antes FLOAT,
  banca_depois FLOAT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.strategy_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own_results" ON public.strategy_results FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_results" ON public.strategy_results FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_delete_own_results" ON public.strategy_results FOR DELETE USING (auth.uid() = user_id);
