-- 1. Habilitar a extensão para gerar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Criar os ENUMs (Tipos personalizados) para garantir a integridade dos dados
CREATE TYPE player_position AS ENUM ('Goleiro', 'Defensor', 'Meio-campo', 'Atacante');
CREATE TYPE play_style_type AS ENUM (
  'Muralha', 'Goleiro Linha', 'Defensor Fixo', 'Coringa', 
  'Pivô', 'Driblador', 'Pace Certeiro', 'Suporte', 
  'Finalizador', 'Caça-Gols'
);
CREATE TYPE match_type AS ENUM ('Quadrangular', 'Triangular');
CREATE TYPE match_status AS ENUM ('DRAFT', 'OPEN', 'FINISHED');
CREATE TYPE game_status AS ENUM ('WAITING', 'LIVE', 'FINISHED');
CREATE TYPE stat_type AS ENUM ('Gol', 'Assistência', 'Gol_Sofrido', 'Clean_Sheet');

-- 3. Tabela de Jogadores
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    position player_position NOT NULL,
    play_style play_style_type, -- Novo campo de Estilo de Jogo!
    shirt_number INT,
    initial_ovr INT DEFAULT 60, -- OVR calculado base (média dos atributos)
    ovr_current INT DEFAULT 60, -- OVR Oficial (mensal)
    monthly_delta DECIMAL(4,1) DEFAULT 0.0, -- Acumulador da "setinha" de forma
    photo_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE
);

-- 4. Tabela de Atributos (1 para 1 com Players)
CREATE TABLE player_attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    pace INT DEFAULT 60,
    shooting INT DEFAULT 60,
    passing INT DEFAULT 60,
    dribbling INT DEFAULT 60,
    defending INT DEFAULT 60,
    physical INT DEFAULT 60
);

-- 5. Tabela de Eventos Semanais (O Torneio)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    location TEXT,
    type match_type NOT NULL,
    status match_status DEFAULT 'DRAFT' -- Começa como Rascunho
);

-- 6. Tabela de Inscrições/Times (Quem está em qual time no evento)
CREATE TABLE match_squads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL, -- Ex: 'Time Preto', 'Time Azul'
    final_position INT -- 1, 2, 3 ou 4 (Preenchido no fim do evento)
);

-- 7. Tabela de Jogos Individuais (As partidas dentro do torneio)
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_score INT DEFAULT 0,
    away_score INT DEFAULT 0,
    status game_status DEFAULT 'WAITING',
    phase TEXT, -- 'Fase 1', 'Final', 'Disputa 3º'
    sequence_number INT -- Para ordenar os jogos (1, 2, 3...)
);

-- 8. Tabela de Estatísticas do Jogo (Gols, Assists, etc.)
CREATE TABLE game_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    stat_type stat_type NOT NULL,
    quantity INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- (Opcional) Tabela de Histórico de OVR para o Gráfico
CREATE TABLE ovr_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    ovr_value INT NOT NULL,
    recorded_at DATE DEFAULT CURRENT_DATE
);