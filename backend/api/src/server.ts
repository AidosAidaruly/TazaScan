import type { Server } from 'node:http';
import { env } from './config/env';
import { prisma } from './prisma/client';
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

  async function shutdown(signal: string) {
    console.info(JSON.stringify({ level: 'info', event: 'shutdown', signal }));

    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}
