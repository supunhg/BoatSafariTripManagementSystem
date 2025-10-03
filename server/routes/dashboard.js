const express = require('express');
const { executeQuery } = require('../config/database');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const userRole = req.user.role;
        
        let dashboardData = {};
        
        if (userRole === 'customer') {
            const bookings = await executeQuery(`
                SELECT 
                    b.*, t.title, ts.scheduled_date, ts.departure_time,
                    ts.status as schedule_status
                FROM bookings b
                JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
                JOIN trips t ON ts.trip_id = t.id
                WHERE b.customer_id = ?
                ORDER BY ts.scheduled_date DESC
                LIMIT 5
            `, [userId]);
            
            const notifications = await executeQuery(`
                SELECT * FROM notifications 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            `, [userId]);
            
            dashboardData = {
                recentBookings: bookings,
                notifications: notifications,
                totalBookings: bookings.length
            };
            
        } else if (userRole === 'admin') {
            const totalTrips = await executeQuery('SELECT COUNT(*) as count FROM trips WHERE is_active = 1');
            const totalBookings = await executeQuery('SELECT COUNT(*) as count FROM bookings');
            const totalRevenue = await executeQuery('SELECT SUM(total_amount) as revenue FROM bookings WHERE payment_status = "paid"');
            const recentBookings = await executeQuery(`
                SELECT 
                    b.*, t.title, ts.scheduled_date, ts.departure_time,
                    u.first_name, u.last_name
                FROM bookings b
                JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
                JOIN trips t ON ts.trip_id = t.id
                JOIN users u ON b.customer_id = u.id
                ORDER BY b.created_at DESC
                LIMIT 10
            `);
            
            dashboardData = {
                totalTrips: totalTrips[0].count,
                totalBookings: totalBookings[0].count,
                totalRevenue: totalRevenue[0].revenue || 0,
                recentBookings: recentBookings
            };
            
        } else if (userRole === 'operations') {
            const pendingAssignments = await executeQuery(`
                SELECT 
                    ts.*, t.title, t.departure_location,
                    COUNT(b.id) as booking_count
                FROM trip_schedules ts
                JOIN trips t ON ts.trip_id = t.id
                LEFT JOIN bookings b ON ts.id = b.trip_schedule_id AND b.booking_status != 'cancelled'
                WHERE (ts.boat_id IS NULL OR ts.guide_id IS NULL) 
                AND ts.scheduled_date >= CURDATE()
                GROUP BY ts.id
                ORDER BY ts.scheduled_date, ts.departure_time
            `);
            
            const upcomingTrips = await executeQuery(`
                SELECT 
                    ts.*, t.title, t.departure_location,
                    b.name as boat_name,
                    u.first_name as guide_first_name, u.last_name as guide_last_name,
                    COUNT(bk.id) as booking_count
                FROM trip_schedules ts
                JOIN trips t ON ts.trip_id = t.id
                LEFT JOIN boats b ON ts.boat_id = b.id
                LEFT JOIN users u ON ts.guide_id = u.id
                LEFT JOIN bookings bk ON ts.id = bk.trip_schedule_id AND bk.booking_status != 'cancelled'
                WHERE ts.scheduled_date >= CURDATE() AND ts.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
                GROUP BY ts.id
                ORDER BY ts.scheduled_date, ts.departure_time
            `);
            
            dashboardData = {
                pendingAssignments: pendingAssignments,
                upcomingTrips: upcomingTrips
            };
            
        } else if (userRole === 'guide') {
            const myAssignments = await executeQuery(`
                SELECT 
                    ts.*, t.title, t.description, t.departure_location, t.return_location,
                    b.name as boat_name,
                    COUNT(bk.id) as passenger_count
                FROM trip_schedules ts
                JOIN trips t ON ts.trip_id = t.id
                LEFT JOIN boats b ON ts.boat_id = b.id
                LEFT JOIN bookings bk ON ts.id = bk.trip_schedule_id AND bk.booking_status != 'cancelled'
                WHERE ts.guide_id = ? AND ts.scheduled_date >= CURDATE()
                GROUP BY ts.id
                ORDER BY ts.scheduled_date, ts.departure_time
            `, [userId]);
            
            const notifications = await executeQuery(`
                SELECT * FROM notifications 
                WHERE user_id = ? 
                ORDER BY created_at DESC 
                LIMIT 5
            `, [userId]);
            
            dashboardData = {
                myAssignments: myAssignments,
                notifications: notifications
            };
        }
        
        res.json(dashboardData);
        
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

router.get('/boats', requireAuth, authorizeRoles('admin', 'operations'), async (req, res) => {
    try {
        const boats = await executeQuery(`
            SELECT * FROM boats WHERE is_available = 1 ORDER BY name
        `);
        
        res.json(boats);
    } catch (error) {
        console.error('Error fetching boats:', error);
        res.status(500).json({ error: 'Failed to fetch boats' });
    }
});

router.put('/assign/:scheduleId', requireAuth, authorizeRoles('admin', 'operations'), async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        const { boatId, guideId } = req.body;
        
        const result = await executeQuery(`
            UPDATE trip_schedules 
            SET boat_id = ?, guide_id = ?, status = 'confirmed'
            WHERE id = ?
        `, [boatId || null, guideId || null, scheduleId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Trip schedule not found' });
        }
        
        if (guideId) {
            const schedules = await executeQuery(`
                SELECT ts.*, t.title, t.departure_location
                FROM trip_schedules ts
                JOIN trips t ON ts.trip_id = t.id
                WHERE ts.id = ?
            `, [scheduleId]);
            
            if (schedules.length > 0) {
                const schedule = schedules[0];
                await executeQuery(`
                    INSERT INTO notifications (user_id, title, message, type)
                    VALUES (?, 'New Assignment', 'You have been assigned to guide "${schedule.title}" on ${schedule.scheduled_date} at ${schedule.departure_time}', 'assignment')
                `, [guideId]);
            }
        }
        
        res.json({ message: 'Assignment updated successfully' });
        
    } catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).json({ error: 'Failed to update assignment' });
    }
});

router.get('/schedules', requireAuth, authorizeRoles('admin', 'operations'), async (req, res) => {
    try {
        const { date, status } = req.query;
        
        let query = `
            SELECT 
                ts.*, t.title, t.departure_location, t.return_location,
                b.name as boat_name, b.capacity as boat_capacity,
                u.first_name as guide_first_name, u.last_name as guide_last_name,
                COUNT(bk.id) as booking_count,
                SUM(CASE WHEN bk.booking_status != 'cancelled' THEN bk.number_of_passengers ELSE 0 END) as confirmed_passengers
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN users u ON ts.guide_id = u.id
            LEFT JOIN bookings bk ON ts.id = bk.trip_schedule_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (date) {
            query += ' AND ts.scheduled_date = ?';
            params.push(date);
        }
        
        if (status) {
            query += ' AND ts.status = ?';
            params.push(status);
        }
        
        query += ` 
            GROUP BY ts.id 
            ORDER BY ts.scheduled_date, ts.departure_time
        `;
        
        const schedules = await executeQuery(query, params);
        
        res.json(schedules);
        
    } catch (error) {
        console.error('Error fetching schedules:', error);
        res.status(500).json({ error: 'Failed to fetch schedules' });
    }
});

router.get('/schedules/:id', requireAuth, authorizeRoles('admin', 'operations'), async (req, res) => {
    try {
        const scheduleId = req.params.id;
        console.log('Fetching schedule with ID:', scheduleId);
        
        const schedules = await executeQuery(`
            SELECT 
                ts.*, t.title, t.departure_location, t.return_location,
                b.name as boat_name, b.capacity as boat_capacity,
                u.first_name as guide_first_name, u.last_name as guide_last_name
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN users u ON ts.guide_id = u.id
            WHERE ts.id = ?
        `, [scheduleId]);
        
        console.log('Schedule query result:', schedules);
        
        if (schedules.length === 0) {
            console.log('No schedule found with ID:', scheduleId);
            return res.status(404).json({ error: 'Trip schedule not found' });
        }
        
        const schedule = schedules[0];
        if (schedule.scheduled_date) {
            const date = new Date(schedule.scheduled_date);
            schedule.scheduled_date = date.toISOString().split('T')[0];
        }
        
        console.log('Returning schedule:', schedule);
        res.json(schedule);
        
    } catch (error) {
        console.error('Error fetching schedule:', error);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const notifications = await executeQuery(`
            SELECT * FROM notifications 
            WHERE user_id = ? 
            ORDER BY created_at DESC 
            LIMIT 20
        `, [req.user.id]);
        
        res.json(notifications);
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

router.put('/notifications/:id/read', requireAuth, async (req, res) => {
    try {
        const notificationId = req.params.id;
        
        const result = await executeQuery(`
            UPDATE notifications 
            SET is_read = 1 
            WHERE id = ? AND user_id = ?
        `, [notificationId, req.user.id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }
        
        res.json({ message: 'Notification marked as read' });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

router.get('/bookings', requireAuth, authorizeRoles('admin', 'operations'), async (req, res) => {
    try {
        const bookings = await executeQuery(`
            SELECT 
                b.*, t.title, ts.scheduled_date, ts.departure_time,
                u.first_name, u.last_name, u.email, u.phone,
                boat.name as boat_name,
                guide.first_name as guide_first_name, guide.last_name as guide_last_name
            FROM bookings b
            JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
            JOIN trips t ON ts.trip_id = t.id
            JOIN users u ON b.customer_id = u.id
            LEFT JOIN boats boat ON ts.boat_id = boat.id
            LEFT JOIN users guide ON ts.guide_id = guide.id
            ORDER BY b.created_at DESC
        `);
        
        res.json(bookings);
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

router.post('/schedules', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const { tripId, scheduledDate, departureTime, returnTime, availableSeats } = req.body;
        
        const result = await executeQuery(`
            INSERT INTO trip_schedules (trip_id, scheduled_date, departure_time, return_time, available_seats, status)
            VALUES (?, ?, ?, ?, ?, 'scheduled')
        `, [tripId, scheduledDate, departureTime, returnTime, availableSeats]);
        
        res.status(201).json({
            message: 'Trip schedule created successfully',
            scheduleId: result.insertId
        });
    } catch (error) {
        console.error('Error creating trip schedule:', error);
        res.status(500).json({ error: 'Failed to create trip schedule' });
    }
});

router.put('/schedules/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const scheduleId = req.params.id;
        const { scheduledDate, departureTime, returnTime, availableSeats, status } = req.body;
        
        const result = await executeQuery(`
            UPDATE trip_schedules 
            SET scheduled_date = ?, departure_time = ?, return_time = ?, available_seats = ?, status = ?
            WHERE id = ?
        `, [scheduledDate, departureTime, returnTime, availableSeats, status, scheduleId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Trip schedule not found' });
        }
        
        res.json({ message: 'Trip schedule updated successfully' });
    } catch (error) {
        console.error('Error updating trip schedule:', error);
        res.status(500).json({ error: 'Failed to update trip schedule' });
    }
});

router.delete('/schedules/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const scheduleId = req.params.id;
        
        const bookings = await executeQuery(`
            SELECT COUNT(*) as count FROM bookings 
            WHERE trip_schedule_id = ? AND booking_status != 'cancelled'
        `, [scheduleId]);
        
        if (bookings[0].count > 0) {
            return res.status(400).json({ error: 'Cannot delete schedule with active bookings' });
        }
        
        const result = await executeQuery('DELETE FROM trip_schedules WHERE id = ?', [scheduleId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Trip schedule not found' });
        }
        
        res.json({ message: 'Trip schedule deleted successfully' });
    } catch (error) {
        console.error('Error deleting trip schedule:', error);
        res.status(500).json({ error: 'Failed to delete trip schedule' });
    }
});

router.get('/guide/trips', requireAuth, authorizeRoles('guide'), async (req, res) => {
    try {
        const guideId = req.user.id;
        
        const todaysTrips = await executeQuery(`
            SELECT 
                ts.*, t.title, t.description, t.departure_location, t.return_location,
                b.name as boat_name,
                COUNT(bk.id) as booking_count,
                SUM(CASE WHEN bk.booking_status != 'cancelled' THEN bk.number_of_passengers ELSE 0 END) as confirmed_passengers
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN bookings bk ON ts.id = bk.trip_schedule_id
            WHERE ts.guide_id = ? AND ts.scheduled_date = CURDATE()
            GROUP BY ts.id
            ORDER BY ts.departure_time
        `, [guideId]);
        
        const upcomingTrips = await executeQuery(`
            SELECT 
                ts.*, t.title, t.description, t.departure_location, t.return_location,
                b.name as boat_name,
                COUNT(bk.id) as booking_count,
                SUM(CASE WHEN bk.booking_status != 'cancelled' THEN bk.number_of_passengers ELSE 0 END) as confirmed_passengers
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN bookings bk ON ts.id = bk.trip_schedule_id
            WHERE ts.guide_id = ? AND ts.scheduled_date > CURDATE() AND ts.scheduled_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY)
            GROUP BY ts.id
            ORDER BY ts.scheduled_date, ts.departure_time
        `, [guideId]);
        
        const history = await executeQuery(`
            SELECT 
                ts.*, t.title, t.description, t.departure_location, t.return_location,
                b.name as boat_name,
                COUNT(bk.id) as booking_count,
                SUM(CASE WHEN bk.booking_status != 'cancelled' THEN bk.number_of_passengers ELSE 0 END) as confirmed_passengers,
                AVG(bk.rating) as rating
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN bookings bk ON ts.id = bk.trip_schedule_id
            WHERE ts.guide_id = ? AND ts.scheduled_date < CURDATE() AND ts.scheduled_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY ts.id
            ORDER BY ts.scheduled_date DESC, ts.departure_time DESC
        `, [guideId]);
        
        res.json({
            todaysTrips,
            upcomingTrips,
            history
        });
    } catch (error) {
        console.error('Error fetching guide trips:', error);
        res.status(500).json({ error: 'Failed to fetch guide trips' });
    }
});

router.get('/guide/history', requireAuth, authorizeRoles('guide'), async (req, res) => {
    try {
        const guideId = req.user.id;
        const { month } = req.query;
        
        let query = `
            SELECT 
                ts.*, t.title, t.description, t.departure_location, t.return_location,
                b.name as boat_name,
                COUNT(bk.id) as booking_count,
                SUM(CASE WHEN bk.booking_status != 'cancelled' THEN bk.number_of_passengers ELSE 0 END) as confirmed_passengers,
                AVG(bk.rating) as rating
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN bookings bk ON ts.id = bk.trip_schedule_id
            WHERE ts.guide_id = ? AND ts.scheduled_date < CURDATE()
        `;
        
        const params = [guideId];
        
        if (month) {
            query += ` AND DATE_FORMAT(ts.scheduled_date, '%Y-%m') = ?`;
            params.push(month);
        }
        
        query += `
            GROUP BY ts.id
            ORDER BY ts.scheduled_date DESC, ts.departure_time DESC
        `;
        
        const history = await executeQuery(query, params);
        
        res.json(history);
    } catch (error) {
        console.error('Error fetching guide history:', error);
        res.status(500).json({ error: 'Failed to fetch guide history' });
    }
});

router.get('/guide/trip/:scheduleId', requireAuth, authorizeRoles('guide'), async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        const guideId = req.user.id;
        
        const trips = await executeQuery(`
            SELECT 
                ts.*, t.title, t.description, t.departure_location, t.return_location,
                b.name as boat_name
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            WHERE ts.id = ? AND ts.guide_id = ?
        `, [scheduleId, guideId]);
        
        if (trips.length === 0) {
            return res.status(404).json({ error: 'Trip not found or access denied' });
        }
        
        const trip = trips[0];
        
        const passengers = await executeQuery(`
            SELECT 
                b.id as booking_id, b.checked_in,
                u.first_name, u.last_name, u.phone,
                b.number_of_passengers as passenger_count
            FROM bookings b
            JOIN users u ON b.customer_id = u.id
            WHERE b.trip_schedule_id = ? AND b.booking_status != 'cancelled'
            ORDER BY u.first_name, u.last_name
        `, [scheduleId]);
        
        trip.passengers = passengers;
        
        res.json(trip);
    } catch (error) {
        console.error('Error fetching trip details:', error);
        res.status(500).json({ error: 'Failed to fetch trip details' });
    }
});

router.put('/guide/checkin/:scheduleId', requireAuth, authorizeRoles('guide'), async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        const guideId = req.user.id;
        const { checkins } = req.body;
        
        const trips = await executeQuery(`
            SELECT id FROM trip_schedules WHERE id = ? AND guide_id = ?
        `, [scheduleId, guideId]);
        
        if (trips.length === 0) {
            return res.status(404).json({ error: 'Trip not found or access denied' });
        }
        
        for (const checkin of checkins) {
            await executeQuery(`
                UPDATE bookings 
                SET checked_in = ? 
                WHERE id = ? AND trip_schedule_id = ?
            `, [checkin.checkedIn ? 1 : 0, checkin.bookingId, scheduleId]);
        }
        
        res.json({ message: 'Check-in status updated successfully' });
    } catch (error) {
        console.error('Error updating check-in status:', error);
        res.status(500).json({ error: 'Failed to update check-in status' });
    }
});

module.exports = router;