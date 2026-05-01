-- Aquest és l'SQL que has d'executar al SQL Editor de Supabase:

-- Taula per a les puntuacions globals
CREATE TABLE IF NOT EXISTS global_scores (
    player_name TEXT PRIMARY KEY,
    score BIGINT NOT NULL,
    coins BIGINT DEFAULT 0,
    speed_level BIGINT DEFAULT 1,
    has_fire_bike BOOLEAN DEFAULT false,
    max_fire_charges BIGINT DEFAULT 1,
    shield_duration_level BIGINT DEFAULT 1,
    equipped_bike TEXT DEFAULT 'default',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Afegir columnes si no existeixen
ALTER TABLE global_scores ADD COLUMN IF NOT EXISTS coins BIGINT DEFAULT 0;
ALTER TABLE global_scores ADD COLUMN IF NOT EXISTS speed_level BIGINT DEFAULT 1;
ALTER TABLE global_scores ADD COLUMN IF NOT EXISTS has_fire_bike BOOLEAN DEFAULT false;
ALTER TABLE global_scores ADD COLUMN IF NOT EXISTS max_fire_charges BIGINT DEFAULT 1;
ALTER TABLE global_scores ADD COLUMN IF NOT EXISTS shield_duration_level BIGINT DEFAULT 1;
ALTER TABLE global_scores ADD COLUMN IF NOT EXISTS equipped_bike TEXT DEFAULT 'default';

-- Permisos per a la taula de puntuacions (Row Level Security)
ALTER TABLE global_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Activa la lectura per a tothom" ON global_scores FOR SELECT USING (true);
CREATE POLICY "Activa l'escriptura per a tothom" ON global_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "Activa l'actualització per a tothom" ON global_scores FOR UPDATE USING (true);

-- Taula per a les sales multijugador públiques (i privades)
CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    host_name TEXT NOT NULL,
    is_public BOOLEAN DEFAULT true,
    state TEXT DEFAULT 'waiting',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Permisos per a la taula de sales
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Llegir sales" ON rooms FOR SELECT USING (true);
CREATE POLICY "Crear sales" ON rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Actualitzar sales" ON rooms FOR UPDATE USING (true);
CREATE POLICY "Esborrar sales" ON rooms FOR DELETE USING (true);
