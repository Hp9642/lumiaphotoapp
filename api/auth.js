const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lumina_super_secret_key_change_in_prod';

// Register Host
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query('INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id', [email, hash]);
        const newId = result.rows[0].id;
        
        // Log them in immediately
        const token = jwt.sign({ id: newId, email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(201).json({ message: 'Registration successful', userId: newId });
    } catch (error) {
        if (error.code === '23505') { // Postgres unique violation
            return res.status(400).json({ error: 'Email already exists' });
        }
        res.status(500).json({ error: 'Server error' });
    }
});

// Login Host
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
        res.cookie('auth_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.json({ message: 'Login successful', userId: user.id });
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Logout Host
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ message: 'Logout successful' });
});

// Get Current User (Me)
router.get('/me', (req, res) => {
    const token = req.cookies.auth_token;
    if (!token) return res.status(401).json({ user: null });

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ user: null });
        res.json({ user: { id: decoded.id, email: decoded.email } });
    });
});

module.exports = router;
