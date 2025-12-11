const bookingService = require('../services/bookingService');
const pool = require('../config/database');

class BookingController {
  async createBooking(req, res, next) {
    try {
      const { slot_id, patient_name, patient_email, patient_phone } = req.body;
      
      const booking = await bookingService.createBooking(
        slot_id,
        patient_name,
        patient_email,
        patient_phone
      );
      
      res.status(201).json({
        success: true,
        data: booking,
        message: 'Booking created successfully'
      });
    } catch (error) {
      if (error.message.includes('not found') || 
          error.message.includes('no longer available') ||
          error.message.includes('past appointments')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }
  
  async getBookingById(req, res, next) {
    try {
      const { id } = req.params;
      
      const booking = await bookingService.getBookingById(id);
      
      if (!booking) {
        return res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
      }
      
      res.json({
        success: true,
        data: booking
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getAllBookings(req, res, next) {
    try {
      const { status, patient_email } = req.query;
      
      let query = `
        SELECT 
          b.*,
          s.slot_date,
          s.slot_time,
          s.duration_minutes,
          d.name as doctor_name,
          d.specialization
        FROM bookings b
        JOIN appointment_slots s ON b.slot_id = s.id
        JOIN doctors d ON s.doctor_id = d.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 0;
      
      if (status) {
        paramCount++;
        query += ` AND b.status = $${paramCount}`;
        params.push(status.toUpperCase());
      }
      
      if (patient_email) {
        paramCount++;
        query += ` AND b.patient_email = $${paramCount}`;
        params.push(patient_email);
      }
      
      query += ' ORDER BY b.created_at DESC';
      
      const result = await pool.query(query, params);
      
      res.json({
        success: true,
        count: result.rows.length,
        data: result.rows
      });
    } catch (error) {
      next(error);
    }
  }
  
  async cancelBooking(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await bookingService.cancelBooking(id);
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('already cancelled')) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }
      next(error);
    }
  }
  
  async getBookingStats(req, res, next) {
    try {
      const stats = await pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'CONFIRMED') as confirmed,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
          COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled,
          COUNT(*) as total
        FROM bookings
      `);
      
      res.json({
        success: true,
        data: stats.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BookingController();