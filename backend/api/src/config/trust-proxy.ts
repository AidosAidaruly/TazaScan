import type { Express } from 'express';
import { env } from './env';

/**
 * Configures how Express derives `request.ip`, which the IP-based rate limits key on.
 *
 * A hop count trusts only the right-most `hops` entries of X-Forwarded-For, i.e. the
 * addresses appended by our own proxies. Client-supplied entries further left are
 * ignored, so they cannot be used to spoof an IP. Never use `true` here: it trusts the
 * left-most (client-controlled) entry.
 */
export function configureTrustProxy(app: Express, hops: number = env.trustProxyHops) {
  if (!Number.isInteger(hops) || hops < 0) {
    throw new Error(`Invalid trust proxy hop count: ${hops}`);
  }

  app.set('trust proxy', hops);
}
