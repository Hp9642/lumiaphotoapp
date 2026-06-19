const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeSchema() {
    try {
        await pool.query(
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE,
                password_hash TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        );
        await pool.query(
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                name TEXT,
                host_id INTEGER REFERENCES users(id),
                release_time TIMESTAMP,
                shot_limit INTEGER DEFAULT 25,
                enable_upload INTEGER DEFAULT 1,
                enable_download INTEGER DEFAULT 1,
                custom_message TEXT,
                enable_moderation INTEGER DEFAULT 0,
                monetization_tier TEXT DEFAULT 'free',
                sponsor_link TEXT,
                sponsor_text TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        );
        await pool.query(
            CREATE TABLE IF NOT EXISTS photos (
                id SERIAL PRIMARY KEY,
                event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
                file_name TEXT,
                file_path TEXT,
                uploader_name TEXT,
                is_approved INTEGER DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        );
        console.log('Connected to Postgres and schema initialized.');
    } catch (err) {
        console.error('Error initializing Postgres schema', err.message);
    }
}

initializeSchema();

module.exports = pool;
