import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './prisma/client';
import { fileStorage } from './storage/storage-provider';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(JSON.stringify({
    level: 'info',
    event: 'startup',
    service: 'tazascan-api',
    port: env.PORT,
    trustProxyHops: env.trustProxyHops,
    storageDriver: fileStorage.driver
  }));
});

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
