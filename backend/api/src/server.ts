import type { Server } from 'node:http';
import { env } from './config/env';
import { prisma } from './prisma/client';
import { closeDefaultOcrPool } from './services/ocr.service';
import { createShutdownHandler } from './shutdown';
import { handleStartupFailure, startServer } from './startup';
import { fileStorage } from './storage/storage-provider';

startServer({ port: env.PORT }).then(onListening, (error) => handleStartupFailure(error));

function onListening(server: Server) {
  console.info(JSON.stringify({
    level: 'info',
    event: 'startup',
    service: 'tazascan-api',
    port: env.PORT,
    trustProxyHops: env.trustProxyHops,
    storageDriver: fileStorage.driver
  }));

  const shutdown = createShutdownHandler({
    server,
    closeOcr: closeDefaultOcrPool,
    disconnectDatabase: () => prisma.$disconnect()
  });

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}
