import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import env from './config/env';
import { ensureDatabaseReady, pingDatabase } from './config/database';
import { requestIdMiddleware } from './middleware/requestId';
import { loggerMiddleware } from './middleware/logger';
import { errorHandler } from './middleware/errorHandler';
import ingestionRoutes from './modules/ingestion/routes/ingestionRoutes';
import retrievalRoutes from './modules/retrieval/routes/retrievalRoutes';

const app = express();

void ensureDatabaseReady().catch(() => {
  // Database initialization is handled by endpoint-level checks; startup should continue.
});

app.use(cors());
app.use(express.json({ limit: `${env.maxUploadSizeMb ?? 5}mb` }));
app.use(requestIdMiddleware);
app.use(loggerMiddleware);

app.get('/v1/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    app: 'resume-rag-backend',
    version: '1.0.0',
    uptime: Number(process.uptime().toFixed(1)),
  });
});

app.get('/v1/health/db', async (_req: Request, res: Response) => {
  const result = await pingDatabase();

  if (!result.connected) {
    return res.status(503).json({
      status: 'error',
      database: 'mongodb',
      connected: false,
      errorCode: result.errorCode,
    });
  }

  return res.status(200).json({
    status: 'ok',
    database: 'mongodb',
    connected: true,
    latencyMs: result.latencyMs,
  });
});

app.use('/v1', ingestionRoutes);
app.use('/v1', retrievalRoutes);

app.use((_req: Request, res: Response) => {
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
  });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err.name === 'MulterError' || err.message === 'Only PDF files are allowed') {
    return res.status(400).json({
      success: false,
      errorCode: err.name === 'MulterError' ? 'INVALID_FILE_TYPE' : 'INVALID_FILE_TYPE',
      message: err.message,
    });
  }

  return errorHandler(err, _req, res, _next);
});

export default app;
