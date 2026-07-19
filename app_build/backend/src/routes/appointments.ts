import { Router } from 'express';
import { createBooking, cancelBooking } from '../controllers/appointmentsController';

const router = Router();

router.post('/', createBooking);
router.delete('/:id', cancelBooking);

export default router;
