const pool = require('../config/database');

class BookingService {
  /**
   * Create a booking with optimistic locking and transaction isolation
   * Prevents race conditions and overbooking
   */
  async createBooking(slotId, patientName, patientEmail, patientPhone) {
    const client = await pool.connect();
    
    try {
      // Start transaction with SERIALIZABLE isolation level for maximum consistency
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      
      // Lock the slot row for update (pessimistic locking)
      const slotCheck = await client.query(
        `SELECT id, is_available, doctor_id, slot_date, slot_time 
         FROM appointment_slots 
         WHERE id = $1 
         FOR UPDATE`,
        [slotId]
      );
      
      if (slotCheck.rows.length === 0) {
        throw new Error('Slot not found');
      }
      
      const slot = slotCheck.rows[0];
      
      if (!slot.is_available) {
        throw new Error('Slot is no longer available');
      }
      
      // Check if slot is in the past
      const slotDateTime = new Date(`${slot.slot_date.toISOString().split('T')[0]}T${slot.slot_time}`);
      if (slotDateTime < new Date()) {
        throw new Error('Cannot book past appointments');
      }
      
      // Create booking with PENDING status
      const bookingResult = await client.query(
        `INSERT INTO bookings (slot_id, patient_name, patient_email, patient_phone, status)
         VALUES ($1, $2, $3, $4, 'PENDING')
         RETURNING *`,
        [slotId, patientName, patientEmail, patientPhone]
      );
      
      const booking = bookingResult.rows[0];
      
      // Mark slot as unavailable
      await client.query(
        'UPDATE appointment_slots SET is_available = FALSE WHERE id = $1',
        [slotId]
      );
      
      // Immediately confirm the booking (in production, this could be async)
      await client.query(
        `UPDATE bookings 
         SET status = 'CONFIRMED', confirmed_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [booking.id]
      );
      
      await client.query('COMMIT');
      
      // Fetch complete booking details
      const finalBooking = await this.getBookingById(booking.id);
      
      return finalBooking;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Handle serialization failures (concurrent access)
      if (error.code === '40001') {
        throw new Error('Booking conflict - please try again');
      }
      
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Get booking by ID with full details
   */
  async getBookingById(bookingId) {
    const result = await pool.query(
      `SELECT 
        b.*,
        s.slot_date,
        s.slot_time,
        s.duration_minutes,
        d.name as doctor_name,
        d.specialization
       FROM bookings b
       JOIN appointment_slots s ON b.slot_id = s.id
       JOIN doctors d ON s.doctor_id = d.id
       WHERE b.id = $1`,
      [bookingId]
    );
    
    return result.rows[0];
  }
  
  /**
   * Cancel a booking and release the slot
   */
  async cancelBooking(bookingId) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const booking = await client.query(
        'SELECT * FROM bookings WHERE id = $1 FOR UPDATE',
        [bookingId]
      );
      
      if (booking.rows.length === 0) {
        throw new Error('Booking not found');
      }
      
      if (booking.rows[0].status === 'CANCELLED') {
        throw new Error('Booking already cancelled');
      }
      
      // Update booking status
      await client.query(
        `UPDATE bookings 
         SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1`,
        [bookingId]
      );
      
      // Release the slot
      await client.query(
        'UPDATE appointment_slots SET is_available = TRUE WHERE id = $1',
        [booking.rows[0].slot_id]
      );
      
      await client.query('COMMIT');
      
      return { success: true, message: 'Booking cancelled successfully' };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  /**
   * Expire pending bookings older than timeout
   */
  async expirePendingBookings(timeoutMinutes = 2) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const expiredBookings = await client.query(
        `UPDATE bookings 
         SET status = 'FAILED', 
             failed_at = CURRENT_TIMESTAMP,
             failure_reason = 'Booking timeout - not confirmed within ${timeoutMinutes} minutes'
         WHERE status = 'PENDING' 
         AND booking_time < NOW() - INTERVAL '${timeoutMinutes} minutes'
         RETURNING slot_id`,
      );
      
      // Release slots for expired bookings
      if (expiredBookings.rows.length > 0) {
        const slotIds = expiredBookings.rows.map(row => row.slot_id);
        await client.query(
          'UPDATE appointment_slots SET is_available = TRUE WHERE id = ANY($1)',
          [slotIds]
        );
      }
      
      await client.query('COMMIT');
      
      return {
        expired: expiredBookings.rows.length,
        message: `Expired ${expiredBookings.rows.length} pending bookings`
      };
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = new BookingService();