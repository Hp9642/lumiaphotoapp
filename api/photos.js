const fs = require('fs');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const pool = require('../db/database');

// We expect CLOUDINARY_URL in the environment
// e.g. cloudinary://296536915129264:jkb_xixaf5cIcV3zy4FB-FZSMrw@root
// Or configured manually:

async function getPhotos(req, res) {
    const eventId = req.query.eventId || req.headers['x-event-id'];
    if (!eventId) return res.status(400).json({ error: 'Event ID is required' });

    try {
        let moderatedOnly = req.query.moderatedOnly === 'true';
        let sql = 'SELECT * FROM photos WHERE event_id = $1';
        if (moderatedOnly) {
            sql += ' AND is_approved = 1';
        }
        sql += ' ORDER BY created_at DESC';

        const result = await pool.query(sql, [eventId]);
        
        // Format for frontend
        const files = result.rows.map(row => ({
            name: row.file_name,
            url: row.file_path,
            thumbnailUrl: row.file_path.replace('/upload/', '/upload/c_thumb,w_400,h_400/'),
            properties: { contentType: 'image/jpeg' }, // Cloudinary transcodes automatically
            metadata: {
                uploader: row.uploader_name,
                is_approved: row.is_approved
            }
        }));

        res.json({ files, hasMore: false, pageMarker: null });
    } catch(err) {
        res.status(500).json({ error: 'Database error' });
    }
}

async function createPhotos(req, res) {
    const eventId = req.headers['x-event-id'] || req.query.eventId;
    if (!eventId) return res.status(400).json({ error: 'Event ID required' });

    try {
        const uploader = req.headers["x-meta-uploader"] || "Guest";
        
        // Use a promise to handle the cloudinary upload stream
        const uploadResult = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'lumina/' + eventId },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            req.pipe(uploadStream);
        });

        // Save to postgres
        await pool.query(
            'INSERT INTO photos (event_id, file_name, file_path, uploader_name) VALUES ($1, $2, $3, $4)',
            [eventId, uploadResult.public_id, uploadResult.secure_url, uploader]
        );

        res.status(201).send({ message: 'OK', details: 'Files uploaded successfully!' });
    } catch(error) {
        console.error('Upload Error:', error);
        res.status(500).send({ message: 'Internal Server Error', details: 'Could not upload photos.' });
    }
}

async function patchPhotos(req, res) {
    // For moderation (approving/rejecting)
    if(!req.body.files) return res.status(400).send({ message: 'Bad Request', details: 'No files supplied.' });
    res.status(200).send({ message: 'OK', details: 'Patching not implemented for Cloudinary yet', outcomes: { completed: [], failed: [] }});
}

async function deletePhotos(req, res) {
    // For deleting
    if(!req.body.files) return res.status(400).send({ message: 'Bad Request', details: 'No files supplied.' });
    res.status(200).send({ message: 'OK', details: 'Deleting not implemented for Cloudinary yet', outcomes: { completed: [], failed: [] }});
}

module.exports = { 
    getPhotos,
    createPhotos,
    patchPhotos,
    deletePhotos
};
