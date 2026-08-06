import { env } from "../../config/env";

export function resolveAssetUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  return `${env.apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}
