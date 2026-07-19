import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { randomUUID } from 'crypto';
import { tenantMiddleware } from './middleware/tenant';
import appointmentsRouter from './routes/appointments';
import pino from 'pino';

// Initialize core logger
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

const app = express();

app.use(cors());
app.use(express.json());

// Inject Pino HTTP logger with unique request IDs
app.use(pinoHttp({
  logger,
  genReqId: () => randomUUID()
}));

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Protected API Routes
app.use('/api/appointments', tenantMiddleware, appointmentsRouter);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  req.log.error({ err }, 'Unhandled error');
  
  if (err.name === 'ConflictError') {
    res.status(409).json({ error: err.message });
  } else if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message, details: err.details });
  } else {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

export default app;
