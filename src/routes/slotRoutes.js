const express = require('express');
const router = express.Router();
const slotController = require('../controllers/slotController');
const { slotValidation, idValidation } = require('../middleware/validators');
const { body } = require('express-validator');

/**
 * @swagger
 * /api/slots:
 *   post:
 *     summary: Create a new appointment slot
 *     tags: [Slots]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctor_id
 *               - slot_date
 *               - slot_time
 *             properties:
 *               doctor_id:
 *                 type: integer
 *               slot_date:
 *                 type: string
 *                 format: date
 *               slot_time:
 *                 type: string
 *               duration_minutes:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Slot created successfully
 */
router.post('/', slotValidation, slotController.createSlot);

/**
 * @swagger
 * /api/slots/bulk:
 *   post:
 *     summary: Create multiple slots for a doctor
 *     tags: [Slots]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - doctor_id
 *               - slot_date
 *               - start_time
 *               - end_time
 *             properties:
 *               doctor_id:
 *                 type: integer
 *               slot_date:
 *                 type: string
 *                 format: date
 *               start_time:
 *                 type: string
 *               end_time:
 *                 type: string
 *               duration_minutes:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Slots created successfully
 */
router.post('/bulk', [
  body('doctor_id').isInt({ min: 1 }),
  body('slot_date').isDate(),
  body('start_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('end_time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('duration_minutes').optional().isInt({ min: 15, max: 120 })
], slotController.createBulkSlots);

/**
 * @swagger
 * /api/slots:
 *   get:
 *     summary: Get available slots
 *     tags: [Slots]
 *     parameters:
 *       - in: query
 *         name: doctor_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of available slots
 */
router.get('/', slotController.getAvailableSlots);

/**
 * @swagger
 * /api/slots/{id}:
 *   get:
 *     summary: Get slot by ID
 *     tags: [Slots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Slot details
 */
router.get('/:id', idValidation, slotController.getSlotById);

/**
 * @swagger
 * /api/slots/{id}:
 *   delete:
 *     summary: Delete slot
 *     tags: [Slots]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Slot deleted
 */
router.delete('/:id', idValidation, slotController.deleteSlot);

module.exports = router;