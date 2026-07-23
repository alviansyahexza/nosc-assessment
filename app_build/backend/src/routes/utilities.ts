import { Router } from 'express';
import { getServices, getDoctors, getDoctorSchedule, getTenantInfo } from '../controllers/utilityController';

const router = Router();

/**
 * @swagger
 * /api/tenant:
 *   get:
 *     summary: Retrieve tenant info including timezone
 *     tags: [Utilities]
 *     security:
 *       - TenantIdAuth: []
 *     responses:
 *       200:
 *         description: Tenant details.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 timezone:
 *                   type: string
 *                   example: 'Europe/Berlin'
 */
router.get('/tenant', getTenantInfo);

/**
 * @swagger
 * /api/services:
 *   get:
 *     summary: Retrieve a list of services for the tenant
 *     tags: [Utilities]
 *     security:
 *       - TenantIdAuth: []
 *     responses:
 *       200:
 *         description: A list of services.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 services:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       durationMin:
 *                         type: integer
 */
router.get('/services', getServices);

/**
 * @swagger
 * /api/doctors:
 *   get:
 *     summary: Retrieve a list of doctors for the tenant
 *     tags: [Utilities]
 *     security:
 *       - TenantIdAuth: []
 *     responses:
 *       200:
 *         description: A list of doctors.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 doctors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 */
router.get('/doctors', getDoctors);

/**
 * @swagger
 * /api/doctors/{id}/schedule:
 *   get:
 *     summary: Retrieve a doctor's schedule for a given date range
 *     tags: [Utilities]
 *     security:
 *       - TenantIdAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: from
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: to
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: A list of busy schedule blocks.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 schedule:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       startsAt:
 *                         type: string
 *                         format: date-time
 *                       endsAt:
 *                         type: string
 *                         format: date-time
 *                       status:
 *                         type: string
 *                         example: 'Busy'
 */
router.get('/doctors/:id/schedule', getDoctorSchedule);

export default router;
