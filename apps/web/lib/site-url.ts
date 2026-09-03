const fallbackSiteUrl = "https://ravex.io";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredUrl) return fallbackSiteUrl;

  try {
    return new URL(configuredUrl).origin;
  } catch {
    console.warn(
      `Ignoring invalid NEXT_PUBLIC_SITE_URL. Expected an absolute URL such as ${fallbackSiteUrl}.`,
    );
    return fallbackSiteUrl;
  }
}

