const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;

async function test() {
    console.log('Testing Supabase...');
    const pool = new Pool({
        connectionString: 'postgres://postgres:Root@db.xybqiazphkqwmztkiaxz.supabase.co:5432/postgres',
        ssl: { rejectUnauthorized: false } // Required for Supabase external connections
    });
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('? Supabase connected:', res.rows[0].now);
    } catch(e) {
        console.error('? Supabase error:', e.message);
    }

    console.log('Testing Cloudinary...');
    cloudinary.config({ 
      cloud_name: 'Root', 
      api_key: '296536915129264', 
      api_secret: 'jkb_xixaf5cIcV3zy4FB-FZSMrw' 
    });
    try {
        const result = await cloudinary.api.ping();
        console.log('? Cloudinary connected:', result);
    } catch(e) {
        console.error('? Cloudinary error:', e.message || e);
    }
    
    process.exit(0);
}
test();
