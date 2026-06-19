const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'lumina_super_secret_key_change_in_prod';

function requireAuth(req, res, next) {
    const token = req.cookies.auth_token;
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }
        req.user = decoded; // { id, email }
        next();
    });
}

module.exports = { requireAuth };
