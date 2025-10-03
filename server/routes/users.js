const express = require('express');
const { executeQuery } = require('../config/database');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const users = await executeQuery(`
            SELECT id, username, email, first_name, last_name, role, phone, is_active, created_at
            FROM users
            ORDER BY created_at DESC
        `);
        
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/guides', requireAuth, authorizeRoles('admin', 'operations'), async (req, res) => {
    try {
        const guides = await executeQuery(`
            SELECT id, username, first_name, last_name, email, phone
            FROM users
            WHERE role = 'guide' AND is_active = 1
            ORDER BY first_name, last_name
        `);
        
        res.json(guides);
    } catch (error) {
        console.error('Error fetching guides:', error);
        res.status(500).json({ error: 'Failed to fetch guides' });
    }
});

router.put('/:id/role', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const userId = req.params.id;
        const { role } = req.body;
        
        if (!['customer', 'admin', 'operations', 'guide'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        
        const result = await executeQuery(`
            UPDATE users SET role = ? WHERE id = ?
        `, [role, userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'User role updated successfully' });
    } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Failed to update user role' });
    }
});

router.put('/:id/status', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const userId = req.params.id;
        const { isActive } = req.body;
        
        const result = await executeQuery(`
            UPDATE users SET is_active = ? WHERE id = ?
        `, [isActive ? 1 : 0, userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: `User ${isActive ? 'activated' : 'deactivated'} successfully` });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Failed to update user status' });
    }
});

router.get('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        
        if (userId != req.user.id && !['admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const users = await executeQuery(`
            SELECT id, username, email, first_name, last_name, role, phone, is_active, created_at
            FROM users WHERE id = ?
        `, [userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(users[0]);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.params.id;
        const { firstName, lastName, email, phone } = req.body;
        
        if (userId != req.user.id && !['admin'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const result = await executeQuery(`
            UPDATE users 
            SET first_name = ?, last_name = ?, email = ?, phone = ?
            WHERE id = ?
        `, [firstName, lastName, email, phone, userId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

module.exports = router;