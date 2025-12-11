const cron = require('node-cron');
const bookingService = require('../services/bookingService');

/**
 * Cron job to expire pending bookings
 * Runs every minute to check for bookings that have been pending for more than 2 minutes
 */
function startBookingExpiryJob() {
  const timeoutMinutes = parseInt(process.env.BOOKING_TIMEOUT_MINUTES) || 2;
  
  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const result = await bookingService.expirePendingBookings(timeoutMinutes);
      if (result.expired > 0) {
        console.log(`[${new Date().toISOString()}] ${result.message}`);
      }
    } catch (error) {
      console.error('Error in booking expiry job:', error);
    }
  });
  
  console.log(`✓ Booking expiry job started (timeout: ${timeoutMinutes} minutes)`);
}

module.exports = { startBookingExpiryJob };