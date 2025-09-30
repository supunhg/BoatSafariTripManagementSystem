const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Generate unique booking reference
function generateBookingReference() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BS';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Create booking
router.post('/', requireAuth, [
    body('tripScheduleId').isInt().withMessage('Valid trip schedule ID is required'),
    body('numberOfPassengers').isInt({ min: 1 }).withMessage('Number of passengers must be at least 1'),
    body('passengers').isArray({ min: 1 }).withMessage('Passenger details are required'),
    body('paymentMethod').isIn(['online', 'cash']).withMessage('Invalid payment method')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { tripScheduleId, numberOfPassengers, passengers, paymentMethod, specialRequirements } = req.body;
        
        // Check if trip schedule exists and has available seats
        const schedules = await executeQuery(`
            SELECT ts.*, t.price, t.title 
            FROM trip_schedules ts 
            JOIN trips t ON ts.trip_id = t.id 
            WHERE ts.id = ? AND ts.status = 'scheduled'
        `, [tripScheduleId]);
        
        if (schedules.length === 0) {
            return res.status(404).json({ error: 'Trip schedule not found or not available' });
        }
        
        const schedule = schedules[0];
        
        if (schedule.available_seats < numberOfPassengers) {
            return res.status(400).json({ error: 'Not enough seats available' });
        }
        
        // Calculate total amount
        const totalAmount = schedule.price * numberOfPassengers;
        
        // Generate booking reference
        const bookingReference = generateBookingReference();
        
        // Create booking
        const bookingResult = await executeQuery(`
            INSERT INTO bookings (customer_id, trip_schedule_id, number_of_passengers, total_amount, 
                                booking_status, payment_status, payment_method, special_requirements, booking_reference)
            VALUES (?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)
        `, [req.session.userId, tripScheduleId, numberOfPassengers, totalAmount, paymentMethod, specialRequirements || null, bookingReference]);
        
        const bookingId = bookingResult.insertId;
        
        // Add passengers
        for (const passenger of passengers) {
            await executeQuery(`
                INSERT INTO passengers (booking_id, first_name, last_name, age, emergency_contact)
                VALUES (?, ?, ?, ?, ?)
            `, [bookingId, passenger.firstName, passenger.lastName, passenger.age || null, passenger.emergencyContact || null]);
        }
        
        // Update available seats
        await executeQuery(`
            UPDATE trip_schedules SET available_seats = available_seats - ? WHERE id = ?
        `, [numberOfPassengers, tripScheduleId]);
        
        // Create payment record
        await executeQuery(`
            INSERT INTO payments (booking_id, amount, payment_method, payment_status)
            VALUES (?, ?, ?, ?)
        `, [bookingId, totalAmount, paymentMethod, paymentMethod === 'cash' ? 'pending' : 'pending']);
        
        // Create notification for customer
        await executeQuery(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, 'Booking Created', 'Your booking ${bookingReference} has been created successfully. ${paymentMethod === 'cash' ? 'Please pay cash on arrival.' : 'Please complete payment to confirm your booking.'}', 'booking')
        `, [req.session.userId]);
        
        res.status(201).json({
            message: 'Booking created successfully',
            bookingId,
            bookingReference,
            totalAmount,
            paymentMethod
        });
        
    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Get user's bookings
router.get('/my-bookings', requireAuth, async (req, res) => {
    try {
        const bookings = await executeQuery(`
            SELECT 
                b.*, t.title, t.departure_location, t.return_location,
                ts.scheduled_date, ts.departure_time, ts.return_time,
                boat.name as boat_name,
                guide.first_name as guide_first_name, guide.last_name as guide_last_name
            FROM bookings b
            JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
            JOIN trips t ON ts.trip_id = t.id
            LEFT JOIN boats boat ON ts.boat_id = boat.id
            LEFT JOIN users guide ON ts.guide_id = guide.id
            WHERE b.customer_id = ?
            ORDER BY b.created_at DESC
        `, [req.session.userId]);
        
        // Get passengers for each booking
        for (let booking of bookings) {
            const passengers = await executeQuery(`
                SELECT first_name, last_name, age, emergency_contact
                FROM passengers WHERE booking_id = ?
            `, [booking.id]);
            booking.passengers = passengers;
        }
        
        res.json(bookings);
        
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Get booking by ID
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        const bookings = await executeQuery(`
            SELECT 
                b.*, t.title, t.description, t.departure_location, t.return_location,
                ts.scheduled_date, ts.departure_time, ts.return_time,
                boat.name as boat_name,
                guide.first_name as guide_first_name, guide.last_name as guide_last_name,
                customer.first_name as customer_first_name, customer.last_name as customer_last_name,
                customer.email as customer_email, customer.phone as customer_phone
            FROM bookings b
            JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
            JOIN trips t ON ts.trip_id = t.id
            JOIN users customer ON b.customer_id = customer.id
            LEFT JOIN boats boat ON ts.boat_id = boat.id
            LEFT JOIN users guide ON ts.guide_id = guide.id
            WHERE b.id = ?
        `, [bookingId]);
        
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const booking = bookings[0];
        
        // Check if user can access this booking
        if (booking.customer_id !== req.user.id && !['admin', 'operations'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Get passengers
        const passengers = await executeQuery(`
            SELECT first_name, last_name, age, emergency_contact
            FROM passengers WHERE booking_id = ?
        `, [bookingId]);
        
        booking.passengers = passengers;
        
        res.json(booking);
        
    } catch (error) {
        console.error('Error fetching booking:', error);
        res.status(500).json({ error: 'Failed to fetch booking' });
    }
});

// Confirm booking (Admin/Operations)
router.put('/:id/confirm', requireAuth, async (req, res) => {
    try {
        if (!['admin', 'operations'].includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const bookingId = req.params.id;
        
        const result = await executeQuery(`
            UPDATE bookings SET booking_status = 'confirmed' WHERE id = ?
        `, [bookingId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        // Get booking details for notification
        const bookings = await executeQuery(`
            SELECT b.customer_id, b.booking_reference, t.title
            FROM bookings b
            JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
            JOIN trips t ON ts.trip_id = t.id
            WHERE b.id = ?
        `, [bookingId]);
        
        if (bookings.length > 0) {
            const booking = bookings[0];
            
            // Create notification for customer
            await executeQuery(`
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Booking Confirmed', 'Your booking ${booking.booking_reference} for "${booking.title}" has been confirmed!', 'booking')
            `, [booking.customer_id]);
        }
        
        res.json({ message: 'Booking confirmed successfully' });
        
    } catch (error) {
        console.error('Error confirming booking:', error);
        res.status(500).json({ error: 'Failed to confirm booking' });
    }
});

// Cancel booking
router.put('/:id/cancel', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        
        // Get booking details
        const bookings = await executeQuery(`
            SELECT b.*, ts.scheduled_date, ts.departure_time
            FROM bookings b
            JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
            WHERE b.id = ?
        `, [bookingId]);
        
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const booking = bookings[0];
        
        // Check if user can cancel this booking
        if (booking.customer_id !== req.session.userId && !['admin', 'operations'].includes(req.session.userRole)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        // Check if booking can be cancelled (not less than 24 hours before departure)
        const departureDateTime = new Date(`${booking.scheduled_date} ${booking.departure_time}`);
        const now = new Date();
        const hoursDifference = (departureDateTime - now) / (1000 * 60 * 60);
        
        if (hoursDifference < 24 && booking.customer_id === req.session.userId) {
            return res.status(400).json({ error: 'Cannot cancel booking less than 24 hours before departure' });
        }
        
        // Cancel booking
        await executeQuery(`
            UPDATE bookings SET booking_status = 'cancelled' WHERE id = ?
        `, [bookingId]);
        
        // Restore available seats
        await executeQuery(`
            UPDATE trip_schedules SET available_seats = available_seats + ? WHERE id = ?
        `, [booking.number_of_passengers, booking.trip_schedule_id]);
        
        // Create notification
        await executeQuery(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, 'Booking Cancelled', 'Booking ${booking.booking_reference} has been cancelled successfully.', 'booking')
        `, [booking.customer_id]);
        
        res.json({ message: 'Booking cancelled successfully' });
        
    } catch (error) {
        console.error('Error cancelling booking:', error);
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

// Process payment (dummy implementation)
router.post('/:id/payment', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { paymentMethod, cardDetails } = req.body;
        
        // Get booking details
        const bookings = await executeQuery(`
            SELECT * FROM bookings WHERE id = ? AND customer_id = ?
        `, [bookingId, req.session.userId]);
        
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const booking = bookings[0];
        
        if (booking.payment_status === 'paid') {
            return res.status(400).json({ error: 'Payment already completed' });
        }
        
        // Simulate payment processing
        const transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9);
        
        // Update payment
        await executeQuery(`
            UPDATE payments 
            SET payment_status = 'completed', transaction_id = ?, payment_date = NOW()
            WHERE booking_id = ?
        `, [transactionId, bookingId]);
        
        // Update booking
        await executeQuery(`
            UPDATE bookings SET payment_status = 'paid', booking_status = 'confirmed' WHERE id = ?
        `, [bookingId]);
        
        // Create notification
        await executeQuery(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, 'Payment Successful', 'Payment for booking ${booking.booking_reference} has been processed successfully. Transaction ID: ${transactionId}', 'payment')
        `, [req.session.userId]);
        
        res.json({
            message: 'Payment processed successfully',
            transactionId,
            amount: booking.total_amount
        });
        
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: 'Payment processing failed' });
    }
});

module.exports = router;