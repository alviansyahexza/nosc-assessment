import { Router } from 'express';
import { createBooking, cancelBooking } from '../controllers/appointmentsController';

const router = Router();

/**
 * @swagger
 * /api/appointments:
 *   post:
 *     summary: Create a new appointment
 *     tags: [Appointments]
 *     security:
 *       - TenantIdAuth: []
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
 *               - startsAt
 *             properties:
 *               patientId:
 *                 type: integer
 *               doctorId:
 *                 type: integer
 *               roomId:
 *                 type: integer
 *               serviceId:
 *                 type: integer
 *               startsAt:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-10-15T08:05:00+02:00"
 *     responses:
 *       201:
 *         description: Appointment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 appointmentId:
 *                   type: integer
 *       400:
 *         description: Validation error
 *       409:
 *         description: Conflict (Double booking)
 */
router.post('/', createBooking);

/**
 * @swagger
 * /api/appointments/{id}:
 *   delete:
 *     summary: Cancel an appointment by ID
 *     tags: [Appointments]
 *     security:
 *       - TenantIdAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Appointment ID to cancel
 *     responses:
 *       204:
 *         description: Appointment cancelled successfully
 *       404:
 *         description: Appointment not found
 */
router.delete('/:id', cancelBooking);

export default router;
