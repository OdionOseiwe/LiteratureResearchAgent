import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as controller from '../controllers/researchController.js';

const router = Router();

// Generous but bounded: research kickoff is expensive
const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many research requests. Please wait before starting another.' },
});

const readLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests' },
});

router.get('/health', controller.health);
router.post('/research', createLimiter, controller.createResearch);
router.get('/research/history', readLimiter, controller.getHistory);
router.get('/research/:id', readLimiter, controller.getResearch);
router.get('/research/:id/progress', readLimiter, controller.streamProgress);
router.get('/research/:id/report', readLimiter, controller.getReport);
router.get('/research/:id/sources', readLimiter, controller.getSources);
router.get('/research/:id/pdf', readLimiter, controller.downloadPdf);
router.delete('/research/:id', readLimiter, controller.deleteResearch);

export default router;
