import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include tenantId and logger (from pino-http)
declare global {
  namespace Express {
    interface Request {
      tenantId: number;
    }
  }
}

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const tenantIdHeader = req.headers['x-tenant-id'];
  
  if (!tenantIdHeader || typeof tenantIdHeader !== 'string') {
    res.status(401).json({ error: 'Missing or invalid X-Tenant-Id header' });
    return;
  }

  const tenantId = parseInt(tenantIdHeader, 10);
  
  if (isNaN(tenantId)) {
    res.status(401).json({ error: 'X-Tenant-Id must be a number' });
    return;
  }

  req.tenantId = tenantId;
  next();
};
