import type { RequestHandler } from 'express';

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'tazascan-api',
    timestamp: new Date().toISOString()
  });
};

export const getReadiness: RequestHandler = (_request, response) => {
  response.status(200).json({
    status: 'ready',
    service: 'tazascan-api',
    timestamp: new Date().toISOString()
  });
};
