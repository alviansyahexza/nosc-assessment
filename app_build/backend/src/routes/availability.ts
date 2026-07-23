import { Router } from 'express';
import { searchAvailability } from '../controllers/availabilityController';

const router = Router();

/**
 * @swagger
 * /api/availability:
 *   get:
 *     summary: Search for available appointment slots
 *     tags: [Availability]
 *     parameters:
 *       - in: query
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the service to book
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Search start date-time
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Search end date-time
 *       - in: query
 *         name: doctorIds
 *         required: false
 *         schema:
 *           type: string
 *         description: Comma separated list of doctor IDs to restrict search
 *     responses:
 *       200:
 *         description: List of available time slots
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slots:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       doctorId:
 *                         type: integer
 *                       roomId:
 *                         type: integer
 *                       deviceIds:
 *                         type: array
 *                         items:
 *                           type: integer
 *                       start:
 *                         type: string
 *                         format: date-time
 *                       end:
 *                         type: string
 *                         format: date-time
 *                 limit:
 *                   type: integer
 *       400:
 *         description: Validation error
 *       401:
 *         description: Missing or invalid X-Tenant-Id header
 *       500:
 *         description: Internal Server Error
 */
router.get('/', searchAvailability);

export default router;
