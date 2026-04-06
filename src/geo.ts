export async function lookupGeo(ip: string): Promise<string> {
  try {
    const resp = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,city`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!resp.ok) return '';
    const data = await resp.json() as { status: string; country?: string; city?: string };
    if (data.status !== 'success') return '';
    return [data.city, data.country].filter(Boolean).join(', ');
  } catch {
    return '';
  }
}
