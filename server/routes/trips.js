const express = require('express');
const { executeQuery } = require('../config/database');
const { requireAuth, authorizeRoles } = require('../middleware/auth');

const router = express.Router();

// Get all trips with schedules
router.get('/', async (req, res) => {
    try {
        const { date, available } = req.query;
        
        let query = `
            SELECT 
                t.id, t.title, t.description, t.price, t.duration_hours, 
                t.max_capacity, t.departure_location, t.return_location,
                ts.id as schedule_id, ts.scheduled_date, ts.departure_time, 
                ts.return_time, ts.available_seats, ts.status,
                b.name as boat_name, b.capacity as boat_capacity,
                u.first_name as guide_first_name, u.last_name as guide_last_name
            FROM trips t
            LEFT JOIN trip_schedules ts ON t.id = ts.trip_id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN users u ON ts.guide_id = u.id
            WHERE t.is_active = 1
        `;
        
        const params = [];
        
        if (date) {
            query += ' AND ts.scheduled_date = ?';
            params.push(date);
        }
        
        if (available === 'true') {
            query += ' AND ts.available_seats > 0 AND ts.status = "scheduled"';
        }
        
        query += ' ORDER BY ts.scheduled_date, ts.departure_time';
        
        const trips = await executeQuery(query, params);
        
        // Group trips by trip id
        const groupedTrips = trips.reduce((acc, trip) => {
            const tripId = trip.id;
            
            if (!acc[tripId]) {
                acc[tripId] = {
                    id: trip.id,
                    title: trip.title,
                    description: trip.description,
                    price: trip.price,
                    duration_hours: trip.duration_hours,
                    max_capacity: trip.max_capacity,
                    departure_location: trip.departure_location,
                    return_location: trip.return_location,
                    schedules: []
                };
            }
            
            if (trip.schedule_id) {
                acc[tripId].schedules.push({
                    id: trip.schedule_id,
                    scheduled_date: trip.scheduled_date,
                    departure_time: trip.departure_time,
                    return_time: trip.return_time,
                    available_seats: trip.available_seats,
                    status: trip.status,
                    boat_name: trip.boat_name,
                    boat_capacity: trip.boat_capacity,
                    guide_name: trip.guide_first_name && trip.guide_last_name 
                        ? `${trip.guide_first_name} ${trip.guide_last_name}` 
                        : null
                });
            }
            
            return acc;
        }, {});
        
        res.json(Object.values(groupedTrips));
        
    } catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: 'Failed to fetch trips' });
    }
});

// Get single trip with schedules
router.get('/:id', async (req, res) => {
    try {
        const tripId = req.params.id;
        
        const trips = await executeQuery(`
            SELECT 
                t.id, t.title, t.description, t.price, t.duration_hours, 
                t.max_capacity, t.departure_location, t.return_location,
                ts.id as schedule_id, ts.scheduled_date, ts.departure_time, 
                ts.return_time, ts.available_seats, ts.status,
                b.name as boat_name, b.capacity as boat_capacity,
                u.first_name as guide_first_name, u.last_name as guide_last_name
            FROM trips t
            LEFT JOIN trip_schedules ts ON t.id = ts.trip_id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN users u ON ts.guide_id = u.id
            WHERE t.id = ? AND t.is_active = 1
            ORDER BY ts.scheduled_date, ts.departure_time
        `, [tripId]);
        
        if (trips.length === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        
        const trip = {
            id: trips[0].id,
            title: trips[0].title,
            description: trips[0].description,
            price: trips[0].price,
            duration_hours: trips[0].duration_hours,
            max_capacity: trips[0].max_capacity,
            departure_location: trips[0].departure_location,
            return_location: trips[0].return_location,
            schedules: trips.filter(t => t.schedule_id).map(t => ({
                id: t.schedule_id,
                scheduled_date: t.scheduled_date,
                departure_time: t.departure_time,
                return_time: t.return_time,
                available_seats: t.available_seats,
                status: t.status,
                boat_name: t.boat_name,
                boat_capacity: t.boat_capacity,
                guide_name: t.guide_first_name && t.guide_last_name 
                    ? `${t.guide_first_name} ${t.guide_last_name}` 
                    : null
            }))
        };
        
        res.json(trip);
        
    } catch (error) {
        console.error('Error fetching trip:', error);
        res.status(500).json({ error: 'Failed to fetch trip' });
    }
});

// Create new trip (Admin only)
router.post('/', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const { title, description, price, duration_hours, max_capacity, departure_location, return_location } = req.body;
        
        const result = await executeQuery(`
            INSERT INTO trips (title, description, price, duration_hours, max_capacity, departure_location, return_location, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [title, description, price, duration_hours, max_capacity, departure_location, return_location, req.session.userId]);
        
        res.status(201).json({
            message: 'Trip created successfully',
            tripId: result.insertId
        });
        
    } catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ error: 'Failed to create trip' });
    }
});

// Update trip (Admin only)
router.put('/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const tripId = req.params.id;
        const { title, description, price, duration_hours, max_capacity, departure_location, return_location } = req.body;
        
        const result = await executeQuery(`
            UPDATE trips 
            SET title = ?, description = ?, price = ?, duration_hours = ?, max_capacity = ?, 
                departure_location = ?, return_location = ?
            WHERE id = ?
        `, [title, description, price, duration_hours, max_capacity, departure_location, return_location, tripId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        
        res.json({ message: 'Trip updated successfully' });
        
    } catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({ error: 'Failed to update trip' });
    }
});

// Delete trip (Admin only)
router.delete('/:id', requireAuth, authorizeRoles('admin'), async (req, res) => {
    try {
        const tripId = req.params.id;
        
        const result = await executeQuery('UPDATE trips SET is_active = 0 WHERE id = ?', [tripId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        
        res.json({ message: 'Trip deleted successfully' });
        
    } catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ error: 'Failed to delete trip' });
    }
});

// Get trip schedule by ID
router.get('/schedule/:scheduleId', async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        
        const schedules = await executeQuery(`
            SELECT 
                ts.*, t.title, t.description, t.price, t.departure_location, t.return_location,
                b.name as boat_name, b.capacity as boat_capacity,
                u.first_name as guide_first_name, u.last_name as guide_last_name
            FROM trip_schedules ts
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats b ON ts.boat_id = b.id
            LEFT JOIN users u ON ts.guide_id = u.id
            WHERE ts.id = ?
        `, [scheduleId]);
        
        if (schedules.length === 0) {
            return res.status(404).json({ error: 'Trip schedule not found' });
        }
        
        const schedule = schedules[0];
        res.json({
            id: schedule.id,
            trip_id: schedule.trip_id,
            title: schedule.title,
            description: schedule.description,
            price: schedule.price,
            scheduled_date: schedule.scheduled_date,
            departure_time: schedule.departure_time,
            return_time: schedule.return_time,
            departure_location: schedule.departure_location,
            return_location: schedule.return_location,
            available_seats: schedule.available_seats,
            status: schedule.status,
            boat_name: schedule.boat_name,
            boat_capacity: schedule.boat_capacity,
            guide_name: schedule.guide_first_name && schedule.guide_last_name 
                ? `${schedule.guide_first_name} ${schedule.guide_last_name}` 
                : null
        });
        
    } catch (error) {
        console.error('Error fetching trip schedule:', error);
        res.status(500).json({ error: 'Failed to fetch trip schedule' });
    }
});

module.exports = router;