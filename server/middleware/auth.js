const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        const user = await executeQuery(
            'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
            [decoded.userId]
        );

        if (!user.length || !user[0].is_active) {
            return res.status(403).json({ error: 'User not found or inactive' });
        }

        req.user = user[0];
        next();
    } catch (error) {
        return res.status(403).json({ error: 'Invalid token' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }

        next();
    };
};

const requireAuth = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = await executeQuery(
            'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
            [req.session.userId]
        );

        if (!user.length || !user[0].is_active) {
            req.session.destroy();
            return res.status(401).json({ error: 'User not found or inactive' });
        }

        req.user = user[0];
        next();
    } catch (error) {
        console.error('Error in requireAuth middleware:', error);
        return res.status(500).json({ error: 'Authentication check failed' });
    }
};

const checkAuth = async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await executeQuery(
                'SELECT id, username, email, first_name, last_name, role, is_active FROM users WHERE id = ?',
                [req.session.userId]
            );

            if (user.length && user[0].is_active) {
                req.user = user[0];
            }
        } catch (error) {
            console.error('Error checking auth:', error);
        }
    }
    next();
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    requireAuth,
    checkAuth
};