import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const requestIdMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.headers['x-request-id'] = Array.isArray(requestId) ? requestId[0] : requestId;
  next();
};
