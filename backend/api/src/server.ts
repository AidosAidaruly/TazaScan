import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './prisma/client';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(`Project API is running on port ${env.PORT}`);
});

async function shutdown(signal: string) {
  console.info(`${signal} received. Shutting down API.`);

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
