-- Inicialización de base de datos para VOD Platform
-- Este script se ejecuta automáticamente cuando se crea el contenedor PostgreSQL

-- Crear extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    profile_picture_url VARCHAR(500),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true
);

-- Tabla de perfiles de usuario (para múltiples perfiles por cuenta)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    profile_name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    is_kids_profile BOOLEAN DEFAULT false,
    parental_controls JSONB DEFAULT '{}',
    language_preference VARCHAR(10) DEFAULT 'es',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de contenido multimedia
CREATE TABLE IF NOT EXISTS content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_seconds INTEGER NOT NULL,
    content_type VARCHAR(50) NOT NULL, -- 'movie', 'series', 'episode', 'documentary'
    genre VARCHAR(100)[] DEFAULT '{}',
    rating VARCHAR(10),
    release_date DATE,
    director VARCHAR(255),
    cast_members TEXT[],
    language VARCHAR(10) DEFAULT 'es',
    subtitles VARCHAR(10)[] DEFAULT '{}',
    thumbnail_url VARCHAR(500),
    video_url VARCHAR(500) NOT NULL,
    quality_levels VARCHAR(10)[] DEFAULT '{"720p"}',
    file_size_mb INTEGER,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de series (para contenido episódico)
CREATE TABLE IF NOT EXISTS series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_seasons INTEGER DEFAULT 1,
    total_episodes INTEGER DEFAULT 0,
    poster_url VARCHAR(500),
    trailer_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de episodios
CREATE TABLE IF NOT EXISTS episodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    series_id UUID REFERENCES series(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    season_number INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    episode_title VARCHAR(255),
    air_date DATE,
    UNIQUE(series_id, season_number, episode_number)
);

-- Tabla de visualizaciones/watch history
CREATE TABLE IF NOT EXISTS watch_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    watched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    progress_seconds INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT false,
    device_type VARCHAR(50), -- 'web', 'mobile', 'tv', 'tablet'
    ip_address INET,
    user_agent TEXT
);

-- Tabla de valoraciones y reviews
CREATE TABLE IF NOT EXISTS content_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, content_id)
);

-- Tabla de listas personalizadas (watchlist, favorites, etc.)
CREATE TABLE IF NOT EXISTS user_lists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de contenido en listas
CREATE TABLE IF NOT EXISTS list_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    list_id UUID REFERENCES user_lists(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(list_id, content_id)
);

-- Tabla de sesiones de usuario (para JWT tracking)
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    device_info JSONB DEFAULT '{}',
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_tier);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_content_genre ON content USING GIN(genre);
CREATE INDEX IF NOT EXISTS idx_content_rating ON content(rating);
CREATE INDEX IF NOT EXISTS idx_content_featured ON content(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_content_active ON content(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_content ON watch_history(content_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_date ON watch_history(watched_at);
CREATE INDEX IF NOT EXISTS idx_content_title_search ON content USING GIN(to_tsvector('spanish', title));
CREATE INDEX IF NOT EXISTS idx_content_description_search ON content USING GIN(to_tsvector('spanish', description));

-- Triggers para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insertar datos de ejemplo
INSERT INTO users (email, password_hash, full_name, subscription_tier) VALUES
('admin@vodplatform.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/jjHdMuVGS', 'Administrador', 'premium'),
('demo@vodplatform.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/jjHdMuVGS', 'Usuario Demo', 'basic'),
('test@vodplatform.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/jjHdMuVGS', 'Usuario Prueba', 'premium')
ON CONFLICT (email) DO NOTHING;

-- Insertar contenido de ejemplo en la base de datos
INSERT INTO content (title, description, duration_seconds, content_type, genre, rating, release_date, director, video_url, thumbnail_url, quality_levels, views_count, likes_count) VALUES
('The Future of Cloud Computing', 'Un documental fascinante sobre la evolución de la computación en la nube', 7200, 'documentary', '{"Documentary", "Technology"}', 'PG', '2024-01-15', 'Tech Films Studio', 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4', 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&h=600&fit=crop', '{"720p", "1080p", "4K"}', 15420, 1240),
('Microservices Architecture', 'Serie educativa sobre arquitecturas de microservicios', 3600, 'educational', '{"Educational", "Technology", "Programming"}', 'G', '2024-02-01', 'DevOps Academy', 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4', 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=600&fit=crop', '{"720p", "1080p"}', 8730, 890),
('Kubernetes in Action', 'Guía práctica para implementar y gestionar aplicaciones en Kubernetes', 5400, 'educational', '{"Educational", "DevOps"}', 'PG-13', '2024-01-30', 'Cloud Native Studios', 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4', 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=600&fit=crop', '{"720p", "1080p", "4K"}', 12350, 1120)
ON CONFLICT (title) DO NOTHING;

-- Crear vistas útiles
CREATE OR REPLACE VIEW popular_content AS
SELECT 
    c.*,
    ROUND(AVG(cr.rating), 2) as avg_rating,
    COUNT(cr.rating) as rating_count
FROM content c
LEFT JOIN content_ratings cr ON c.id = cr.content_id
WHERE c.is_active = true
GROUP BY c.id
ORDER BY c.views_count DESC, avg_rating DESC;

CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    u.id,
    u.email,
    u.full_name,
    COUNT(wh.id) as total_watches,
    COUNT(DISTINCT wh.content_id) as unique_content_watched,
    SUM(wh.progress_seconds) as total_watch_time_seconds,
    MAX(wh.watched_at) as last_activity
FROM users u
LEFT JOIN watch_history wh ON u.id = wh.user_id
GROUP BY u.id, u.email, u.full_name;

-- Comentarios de documentación
COMMENT ON TABLE users IS 'Tabla principal de usuarios del sistema';
COMMENT ON TABLE content IS 'Catálogo de contenido multimedia disponible';
COMMENT ON TABLE watch_history IS 'Historial de visualizaciones de usuarios';
COMMENT ON TABLE content_ratings IS 'Valoraciones y reseñas de contenido por usuarios';

-- Mensajes de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Base de datos VOD Platform inicializada correctamente';
    RAISE NOTICE 'Tablas creadas: users, user_profiles, content, series, episodes, watch_history, content_ratings, user_lists, list_content, user_sessions';
    RAISE NOTICE 'Índices y triggers configurados';
    RAISE NOTICE 'Datos de ejemplo insertados';
END $$;