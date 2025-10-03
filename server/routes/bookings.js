const express = require('express');
const { body, validationResult } = require('express-validator');
const { executeQuery } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function generateBookingReference() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'BS';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

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
        
        const totalAmount = schedule.price * numberOfPassengers;
        
        const bookingReference = generateBookingReference();
        
        const bookingResult = await executeQuery(`
            INSERT INTO bookings (customer_id, trip_schedule_id, number_of_passengers, total_amount, 
                                booking_status, payment_status, payment_method, special_requirements, booking_reference)
            VALUES (?, ?, ?, ?, 'pending', 'pending', ?, ?, ?)
        `, [req.user.id, tripScheduleId, numberOfPassengers, totalAmount, paymentMethod, specialRequirements || null, bookingReference]);
        
        const bookingId = bookingResult.insertId;
        
        for (const passenger of passengers) {
            await executeQuery(`
                INSERT INTO passengers (booking_id, first_name, last_name, age, emergency_contact)
                VALUES (?, ?, ?, ?, ?)
            `, [bookingId, passenger.firstName, passenger.lastName, passenger.age || null, passenger.emergencyContact || null]);
        }
        
        await executeQuery(`
            UPDATE trip_schedules SET available_seats = available_seats - ? WHERE id = ?
        `, [numberOfPassengers, tripScheduleId]);
        
        await executeQuery(`
            INSERT INTO payments (booking_id, amount, payment_method, payment_status)
            VALUES (?, ?, ?, ?)
        `, [bookingId, totalAmount, paymentMethod, paymentMethod === 'cash' ? 'pending' : 'pending']);
        
        await executeQuery(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, 'Booking Created', 'Your booking ${bookingReference} has been created successfully. ${paymentMethod === 'cash' ? 'Please pay cash on arrival.' : 'Please complete payment to confirm your booking.'}', 'booking')
        `, [req.user.id]);
        
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
        `, [req.user.id]);
        
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
        
        if (booking.customer_id !== req.user.id && !['admin', 'operations'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
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

router.put('/:id/status', requireAuth, async (req, res) => {
    try {
        if (!['admin', 'operations'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const bookingId = req.params.id;
        const { booking_status, payment_status } = req.body;
        
        const validBookingStatus = ['pending', 'confirmed', 'completed', 'cancelled'];
        const validPaymentStatus = ['pending', 'paid', 'refunded', 'failed'];
        
        if (!validBookingStatus.includes(booking_status)) {
            return res.status(400).json({ error: 'Invalid booking status' });
        }
        
        if (!validPaymentStatus.includes(payment_status)) {
            return res.status(400).json({ error: 'Invalid payment status' });
        }
        
        const bookings = await executeQuery(`
            SELECT b.*, ts.id as schedule_id, ts.scheduled_date, ts.departure_time, t.title
            FROM bookings b
            JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
            JOIN trips t ON ts.trip_id = t.id
            WHERE b.id = ?
        `, [bookingId]);
        
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const booking = bookings[0];
        
        const result = await executeQuery(`
            UPDATE bookings 
            SET booking_status = ?, payment_status = ?
            WHERE id = ?
        `, [booking_status, payment_status, bookingId]);
        
        if (booking_status === 'cancelled' && booking.booking_status !== 'cancelled') {
            await executeQuery(`
                UPDATE trip_schedules 
                SET available_seats = available_seats + ? 
                WHERE id = ?
            `, [booking.number_of_passengers, booking.trip_schedule_id]);
        }
        
        if (booking_status !== 'cancelled' && booking.booking_status === 'cancelled') {
            await executeQuery(`
                UPDATE trip_schedules 
                SET available_seats = available_seats - ? 
                WHERE id = ?
            `, [booking.number_of_passengers, booking.trip_schedule_id]);
        }
        
        const statusMessages = {
            'confirmed': `Your booking ${booking.booking_reference} for "${booking.title}" has been confirmed!`,
            'completed': `Your trip ${booking.booking_reference} for "${booking.title}" has been completed. Thank you for choosing us!`,
            'cancelled': `Your booking ${booking.booking_reference} for "${booking.title}" has been cancelled.`,
            'pending': `Your booking ${booking.booking_reference} status has been updated to pending.`
        };
        
        if (statusMessages[booking_status]) {
            await executeQuery(`
                INSERT INTO notifications (user_id, title, message, type)
                VALUES (?, 'Booking Status Updated', ?, 'booking')
            `, [booking.customer_id, statusMessages[booking_status]]);
        }
        
        res.json({ message: 'Booking status updated successfully' });
        
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
});

router.put('/:id/confirm', requireAuth, async (req, res) => {
    try {
        if (!['admin', 'operations'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const bookingId = req.params.id;
        
        const result = await executeQuery(`
            UPDATE bookings SET booking_status = 'confirmed' WHERE id = ?
        `, [bookingId]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const bookings = await executeQuery(`
            SELECT b.customer_id, b.booking_reference, t.title
            FROM bookings b
            JOIN trip_schedules ts ON b.trip_schedule_id = ts.id
            JOIN trips t ON ts.trip_id = t.id
            WHERE b.id = ?
        `, [bookingId]);
        
        if (bookings.length > 0) {
            const booking = bookings[0];
            
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

router.put('/:id/cancel', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        
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
        
        if (booking.customer_id !== req.user.id && !['admin', 'operations'].includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        const departureDateTime = new Date(`${booking.scheduled_date} ${booking.departure_time}`);
        const now = new Date();
        const hoursDifference = (departureDateTime - now) / (1000 * 60 * 60);
        
        if (hoursDifference < 24 && booking.customer_id === req.user.id) {
            return res.status(400).json({ error: 'Cannot cancel booking less than 24 hours before departure' });
        }
        
        await executeQuery(`
            UPDATE bookings SET booking_status = 'cancelled' WHERE id = ?
        `, [bookingId]);
        
        await executeQuery(`
            UPDATE trip_schedules SET available_seats = available_seats + ? WHERE id = ?
        `, [booking.number_of_passengers, booking.trip_schedule_id]);
        
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

router.post('/:id/payment', requireAuth, async (req, res) => {
    try {
        const bookingId = req.params.id;
        const { paymentMethod, cardDetails } = req.body;
        
        const bookings = await executeQuery(`
            SELECT * FROM bookings WHERE id = ? AND customer_id = ?
        `, [bookingId, req.user.id]);
        
        if (bookings.length === 0) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        
        const booking = bookings[0];
        
        if (booking.payment_status === 'paid') {
            return res.status(400).json({ error: 'Payment already completed' });
        }
        
        const transactionId = 'TXN' + Date.now() + Math.random().toString(36).substr(2, 9);
        
        await executeQuery(`
            UPDATE payments 
            SET payment_status = 'completed', transaction_id = ?, payment_date = NOW()
            WHERE booking_id = ?
        `, [transactionId, bookingId]);
        
        await executeQuery(`
            UPDATE bookings SET payment_status = 'paid', booking_status = 'confirmed' WHERE id = ?
        `, [bookingId]);
        
        await executeQuery(`
            INSERT INTO notifications (user_id, title, message, type)
            VALUES (?, 'Payment Successful', 'Payment for booking ${booking.booking_reference} has been processed successfully. Transaction ID: ${transactionId}', 'payment')
        `, [req.user.id]);
        
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