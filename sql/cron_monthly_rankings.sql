-- ==============================================================
-- ATUALIZAÇÃO AUTOMÁTICA DOS RANKINGS NO DIA 1 DO MÊS
-- Hall da Fama (monthly_champions) & Resete de Deltas Mensais
-- (O OVR dos jogadores NÃO é alterado na virada do mês, sendo manual)
-- ==============================================================

-- 1. Garante que a tabela monthly_champions exista com a estrutura esperada
CREATE TABLE IF NOT EXISTS monthly_champions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    month_key TEXT NOT NULL,
    category TEXT NOT NULL, -- 'wins' (MVP), 'goals' (Artilheiro), 'assists' (Garçom), 'clean_sheets' (Muralha)
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    stat_value INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para consulta rápida no Hall da Fama
CREATE INDEX IF NOT EXISTS idx_monthly_champions_month_key ON monthly_champions(month_key);
CREATE INDEX IF NOT EXISTS idx_monthly_champions_player_id ON monthly_champions(player_id);

-- 2. (Opcional - caso use a extensão pg_cron no Supabase)
-- Agendamento para todo dia 1 do mês à meia-noite (00:00 UTC)
-- Nota: A aplicação web já realiza essa consolidação automaticamente no frontend
-- em rankingService.autoConsolidateMonthlyRankings ao iniciar a aplicação no dia 1.
-- Se desejar agendar também no banco:
--
-- SELECT cron.schedule(
--   'consolidar-rankings-mensal',
--   '0 0 1 * *', -- Minuto 0, Hora 0, Dia 1 de todo mês
--   $$
--     -- Reseta os deltas mensais mantendo intactos os OVRs dos jogadores:
--     UPDATE players
--     SET monthly_delta = 0.0,
--         pace_acc = 0,
--         shooting_acc = 0,
--         passing_acc = 0,
--         defending_acc = 0;
--   $$
-- );
