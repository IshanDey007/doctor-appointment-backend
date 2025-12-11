const pool = require('../config/database');

class DoctorController {
  async createDoctor(req, res, next) {
    try {
      const { name, specialization, email, phone } = req.body;
      
      const result = await pool.query(
        `INSERT INTO doctors (name, specialization, email, phone)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [name, specialization, email, phone]
      );
      
      res.status(201).json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getAllDoctors(req, res, next) {
    try {
      const { specialization } = req.query;
      
      let query = 'SELECT * FROM doctors';
      const params = [];
      
      if (specialization) {
        query += ' WHERE LOWER(specialization) = LOWER($1)';
        params.push(specialization);
      }
      
      query += ' ORDER BY name';
      
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
  
  async getDoctorById(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'SELECT * FROM doctors WHERE id = $1',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Doctor not found'
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
  
  async updateDoctor(req, res, next) {
    try {
      const { id } = req.params;
      const { name, specialization, phone } = req.body;
      
      const result = await pool.query(
        `UPDATE doctors 
         SET name = COALESCE($1, name),
             specialization = COALESCE($2, specialization),
             phone = COALESCE($3, phone)
         WHERE id = $4
         RETURNING *`,
        [name, specialization, phone, id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Doctor not found'
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
  
  async deleteDoctor(req, res, next) {
    try {
      const { id } = req.params;
      
      const result = await pool.query(
        'DELETE FROM doctors WHERE id = $1 RETURNING *',
        [id]
      );
      
      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Doctor not found'
        });
      }
      
      res.json({
        success: true,
        message: 'Doctor deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DoctorController();