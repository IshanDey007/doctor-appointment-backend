const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Doctor Appointment Booking API',
      version: '1.0.0',
      description: 'Healthcare appointment booking system with advanced concurrency handling',
      contact: {
        name: 'Ishan Dey',
        email: 'irock9431@gmail.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server'
      },
      {
        url: process.env.API_URL || 'https://your-api-url.com',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Doctors',
        description: 'Doctor management endpoints'
      },
      {
        name: 'Slots',
        description: 'Appointment slot management'
      },
      {
        name: 'Bookings',
        description: 'Booking management with concurrency control'
      }
    ]
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;