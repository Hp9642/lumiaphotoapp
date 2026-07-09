require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const os = require('os');

const PORT = process.env.PORT || 3000;
const NO_CACHE = 'no-cache, no-store, must-revalidate';

const app = express();
app.use(cors());
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

// Static Files
app.use('/css', express.static(path.join(__dirname, 'public/css')));
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/fonts', express.static(path.join(__dirname, 'public/fonts')));

/* Load API Methods */
const authAPI = require('./api/auth.js');
const eventsAPI = require('./api/events.js');
const photosAPI = require('./api/photos.js');
const downloadPhotosAPI = require('./api/downloadPhotos.js');
const pool = require('./db/database');

app.use('/api/auth', authAPI);
app.use('/api/events', eventsAPI);

/* Helper to get LAN IP */
function getLanIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

/* Static routes */
app.get('/', (req, res) => res.sendFile(__dirname + '/public/index.html'));
app.get('/pricing', (req, res) => res.sendFile(__dirname + '/public/pricing.html'));
app.get('/portal', (req, res) => res.sendFile(__dirname + '/src/pages/portal.html'));
app.get('/manage', (req, res) => res.redirect('/portal'));

app.get('/:eventId/upload', async (req, res) => {
    const eventId = req.params.eventId.toUpperCase();
    try {
        const result = await pool.query('SELECT id, enable_upload FROM events WHERE id = $1', [eventId]);
        const event = result.rows[0];
        if (!event) return res.redirect('/?error=invalid_event');
        res.setHeader('Cache-Control', NO_CACHE);
        res.sendFile(__dirname + '/src/pages/upload.html');
    } catch (e) {
        res.redirect('/?error=server_error');
    }
});

app.get('/:eventId/download', (req, res) => {
    res.setHeader('Cache-Control', NO_CACHE);
    res.sendFile(__dirname + '/src/pages/download.html');
});

app.get('/:eventId/view', (req, res) => {
    res.setHeader('Cache-Control', NO_CACHE);
    res.sendFile(__dirname + '/src/pages/view.html');
});

app.get('/:eventId/slideshow', (req, res) => {
    res.setHeader('Cache-Control', NO_CACHE);
    res.sendFile(__dirname + '/src/pages/slideshow.html');
});

app.get('/:eventId/manage', (req, res) => {
    res.setHeader('Cache-Control', NO_CACHE);
    res.sendFile(__dirname + '/src/pages/manage.html');
});

app.get('/:eventId/thankyou', (req, res) => {
    res.setHeader('Cache-Control', NO_CACHE);
    res.sendFile(__dirname + '/src/pages/thankyou.html');
});

/* Simple API to verify server is up */
app.get('/api', (req, res) => {
    res.status(200).json({ status: 200, message: 'OK', details: 'API available' });
});

app.get('/api/server-info', (req, res) => {
    const lanIp = getLanIp();
    res.json({
        ip: lanIp,
        url: `http://${lanIp}:${PORT}`
    });
});

/* Config API - GET event settings */
app.get('/api/config', async (req, res) => {
    const eventId = (req.query.eventId || '').toUpperCase();
    if (!eventId) return res.status(400).json({ error: 'Event ID is required' });

    try {
        const result = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
        const event = result.rows[0];
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.status(200).json({
            eventName: event.name,
            countdownTarget: event.release_time || "",
            shotLimit: event.shot_limit,
            enableUpload: event.enable_upload,
            enableDownload: event.enable_download,
            customMessage: event.custom_message || "",
            enableModeration: event.enable_moderation || 0,
            monetizationTier: event.monetization_tier || 'free',
            sponsorLink: event.sponsor_link || "",
            sponsorText: event.sponsor_text || ""
        });
    } catch(e) {
        res.status(500).json({ error: 'Database error' });
    }
});

/* Config API - POST save event settings (host only) */
app.post('/api/config/save', async (req, res) => {
    const eventId = (req.query.eventId || '').toUpperCase();
    if (!eventId) return res.status(400).json({ error: 'Event ID is required' });

    const { eventName, countdownTarget, shotLimit, enableUpload, enableDownload, customMessage, enableModeration, monetizationTier, sponsorLink, sponsorText } = req.body;
    
    try {
        await pool.query(
            'UPDATE events SET name = $1, release_time = $2, shot_limit = $3, enable_upload = $4, enable_download = $5, custom_message = $6, enable_moderation = $7, monetization_tier = $8, sponsor_link = $9, sponsor_text = $10 WHERE id = $11',
            [eventName || 'My Event', countdownTarget || null, parseInt(shotLimit) || 25, parseInt(enableUpload), parseInt(enableDownload), customMessage || null, parseInt(enableModeration) || 0, monetizationTier || 'free', sponsorLink || null, sponsorText || null, eventId]
        );
        res.status(200).json({ status: 200, message: 'Configuration saved successfully.' });
    } catch(e) {
        res.status(500).json({ error: 'Database error' });
    }
});

/* Event stats API - per-guest breakdown */
app.get('/api/events/:eventId/stats', async (req, res) => {
    const eventId = req.params.eventId.toUpperCase();
    try {
        const rowsRes = await pool.query(
            `SELECT uploader_name, COUNT(*) as photo_count 
            FROM photos WHERE event_id = $1 
            GROUP BY uploader_name 
            ORDER BY photo_count DESC`
        , [eventId]);
        const countRes = await pool.query('SELECT COUNT(*) as total FROM photos WHERE event_id = $1', [eventId]);
        
        res.json({
            total: countRes.rows[0] ? parseInt(countRes.rows[0].total) : 0,
            guests: rowsRes.rows
        });
    } catch(e) {
        res.status(500).json({ error: 'Database error' });
    }
});

/* Event delete */
app.delete('/api/events/:eventId', require('./middleware/authMiddleware').requireAuth, async (req, res) => {
    const eventId = req.params.eventId.toUpperCase();
    try {
        await pool.query('DELETE FROM photos WHERE event_id = $1', [eventId]);
        await pool.query('DELETE FROM events WHERE id = $1', [eventId]);
        // Also delete cloudinary folder in the future if we track assets by folder
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Database error' });
    }
});

/* Photos API endpoints */
app.get('/api/photos', (req, res) => {
    photosAPI.getPhotos(req, res);
});

app.use('/api/photos/download/:eventId', (req, res, next) => {
    // Legacy local path
    next();
});

app.post('/api/photos', (req, res) => {
    photosAPI.createPhotos(req, res);
});

app.patch('/api/photos', (req, res) => {
    photosAPI.patchPhotos(req, res);
});

app.delete('/api/photos', (req, res) => {
    photosAPI.deletePhotos(req, res);
});

app.post('/api/photos/download', (req, res) => {
    downloadPhotosAPI.downloadPhotos(req, res);
});

/* Catch-all redirects */
app.get('/:eventId/', (req, res) => res.redirect('/' + req.params.eventId + '/upload'));
app.get('/:eventId/manage/', (req, res) => res.redirect('/' + req.params.eventId + '/manage'));

app.listen(PORT, '0.0.0.0', () => {
    console.log('Lumina Server running on port ' + PORT);
});
