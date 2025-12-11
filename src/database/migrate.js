const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function migrate() {
  const client = await pool.connect();
  
  try {
    console.log('Starting database migration...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    await client.query(schema);
    
    console.log('✓ Database schema created successfully');
    
    // Insert sample doctors
    const sampleDoctors = [
      { name: 'Dr. Sarah Johnson', specialization: 'Cardiologist', email: 'sarah.johnson@hospital.com', phone: '+1-555-0101' },
      { name: 'Dr. Michael Chen', specialization: 'Neurologist', email: 'michael.chen@hospital.com', phone: '+1-555-0102' },
      { name: 'Dr. Emily Rodriguez', specialization: 'Pediatrician', email: 'emily.rodriguez@hospital.com', phone: '+1-555-0103' },
      { name: 'Dr. James Wilson', specialization: 'Orthopedic Surgeon', email: 'james.wilson@hospital.com', phone: '+1-555-0104' },
      { name: 'Dr. Priya Sharma', specialization: 'Dermatologist', email: 'priya.sharma@hospital.com', phone: '+1-555-0105' }
    ];
    
    for (const doctor of sampleDoctors) {
      await client.query(
        'INSERT INTO doctors (name, specialization, email, phone) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING',
        [doctor.name, doctor.specialization, doctor.email, doctor.phone]
      );
    }
    
    console.log('✓ Sample doctors inserted');
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);