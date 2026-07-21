import { Router } from 'express';
import { createBooking, cancelBooking } from '../controllers/appointmentsController';

const router = Router();

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - patientId
 *               - doctorId
 *               - roomId
 *               - serviceId
 *               - requestedStartTime
 *             properties:
 *               patientId:
 *                 type: integer
 *               doctorId:
 *                 type: integer
 *               roomId:
 *                 type: integer
 *               serviceId:
 *                 type: integer
 *               requestedStartTime:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Conflict (Double booking)
 */
router.post('/', createBooking);
router.delete('/:id', cancelBooking);

export default router;
