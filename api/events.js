const express = require('express');
const crypto = require('crypto');
const pool = require('../db/database');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

function generateEventCode() {
    return crypto.randomBytes(3).toString('hex').toUpperCase().substring(0, 5);
}

router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM events WHERE host_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json({ events: result.rows });
    } catch(err) {
        res.status(500).json({ error: 'Database error' });
    }
});

router.post('/', requireAuth, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Event name is required' });

    const eventId = generateEventCode();
    try {
        await pool.query(
            'INSERT INTO events (id, host_id, name) VALUES ($1, $2, $3)',
            [eventId, req.user.id, name]
        );
        res.status(201).json({ 
            message: 'Event created successfully', 
            event: { id: eventId, name, host_id: req.user.id }
        });
    } catch(err) {
        if (err.code === '23505') {
            return res.status(500).json({ error: 'ID collision, please try again' });
        }
        res.status(500).json({ error: 'Database error' });
    }
});

router.get('/:id', async (req, res) => {
    const eventId = req.params.id.toUpperCase();
    try {
        const result = await pool.query('SELECT id, name, shot_limit, enable_upload, enable_download, release_time FROM events WHERE id = $1', [eventId]);
        const event = result.rows[0];
        if (!event) return res.status(404).json({ error: 'Event not found' });
        res.json({ event });
    } catch(err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;
