const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctorController');
const { doctorValidation, idValidation } = require('../middleware/validators');

/**
 * @swagger
 * /api/doctors:
 *   post:
 *     summary: Create a new doctor
 *     tags: [Doctors]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - specialization
 *               - email
 *             properties:
 *               name:
 *                 type: string
 *               specialization:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Doctor created successfully
 */
router.post('/', doctorValidation, doctorController.createDoctor);

/**
 * @swagger
 * /api/doctors:
 *   get:
 *     summary: Get all doctors
 *     tags: [Doctors]
 *     parameters:
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *         description: Filter by specialization
 *     responses:
 *       200:
 *         description: List of doctors
 */
router.get('/', doctorController.getAllDoctors);

/**
 * @swagger
 * /api/doctors/{id}:
 *   get:
 *     summary: Get doctor by ID
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor details
 */
router.get('/:id', idValidation, doctorController.getDoctorById);

/**
 * @swagger
 * /api/doctors/{id}:
 *   put:
 *     summary: Update doctor
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor updated
 */
router.put('/:id', idValidation, doctorController.updateDoctor);

/**
 * @swagger
 * /api/doctors/{id}:
 *   delete:
 *     summary: Delete doctor
 *     tags: [Doctors]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Doctor deleted
 */
router.delete('/:id', idValidation, doctorController.deleteDoctor);

module.exports = router;