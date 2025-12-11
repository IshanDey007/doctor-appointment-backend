const pool = require('../config/database');

class SlotController {
  async createSlot(req, res, next) {
    try {
      const { doctor_id, slot_date, slot_time, duration_minutes = 30 } = req.body;
      
      // Validate slot is in the future
      const slotDateTime = new Date(`${slot_date}T${slot_time}`);
      if (slotDateTime < new Date()) {
        return res.status(400).json({
          success: false,
          error: 'Cannot create slots in the past'
        });
      }
      
      const result = await pool.query(
        `INSERT INTO appointment_slots (doctor_id, slot_date, slot_time, duration_minutes)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [doctor_id, slot_date, slot_time, duration_minutes]
      );
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
  
  async createBulkSlots(req, res, next) {
    try {
      const { doctor_id, slot_date, start_time, end_time, duration_minutes = 30 } = req.body;
      
      const slots = [];
      let currentTime = start_time;
      
      while (currentTime < end_time) {
        slots.push([doctor_id, slot_date, currentTime, duration_minutes]);
        
        // Increment time
        const [hours, minutes] = currentTime.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes + duration_minutes;
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        currentTime = `${String(newHours).padStart(2, '0')}:${String(newMinutes).padStart(2, '0')}`;
      }
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        const insertedSlots = [];
        for (const slot of slots) {
          const result = await client.query(
            `INSERT INTO appointment_slots (doctor_id, slot_date, slot_time, duration_minutes)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (doctor_id, slot_date, slot_time) DO NOTHING
             RETURNING *`,
            slot
          );
          if (result.rows.length > 0) {
            insertedSlots.push(result.rows[0]);
          }
        }
        
        await client.query('COMMIT');
        
        res.status(201).json({
          success: true,
          count: insertedSlots.length,
          data: insertedSlots
        });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      next(error);
    }
  }
  
  async getAvailableSlots(req, res, next) {
    try {
      const { doctor_id, date, specialization } = req.query;
      
      let query = `
        SELECT s.*, d.name as doctor_name, d.specialization
        FROM appointment_slots s
        JOIN doctors d ON s.doctor_id = d.id
        WHERE s.is_available = TRUE
        AND s.slot_date >= CURRENT_DATE
      `;
      const params = [];
      let paramCount = 0;
      
      if (doctor_id) {
        paramCount++;
        query += ` AND s.doctor_id = $${paramCount}`;
        params.push(doctor_id);
      }
      
      if (date) {
        paramCount++;
        query += ` AND s.slot_date = $${paramCount}`;
        params.push(date);
      }
      
      if (specialization) {
        paramCount++;
        query += ` AND LOWER(d.specialization) = LOWER($${paramCount})`;
        params.push(specialization);
      }
      
      query += ' ORDER BY s.slot_date, s.slot_time';
      
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
  
  async getSlotById(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        `SELECT s.*, d.name as doctor_name, d.specialization
         FROM appointment_slots s
         JOIN doctors d ON s.doctor_id = d.id
         WHERE s.id = $1`,
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Slot not found'
        });
      }
      
      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteSlot(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if slot has bookings
      const bookingCheck = await pool.query(
        'SELECT COUNT(*) FROM bookings WHERE slot_id = $1 AND status IN ($2, $3)',
        [id, 'PENDING', 'CONFIRMED']
      );
      
      if (parseInt(bookingCheck.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete slot with active bookings'
        });
      }
      
      const result = await pool.query(
        'DELETE FROM appointment_slots WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Slot not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Slot deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SlotController();