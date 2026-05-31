// Cloudflare Stream — live inputs for browser (WHIP) ingest.
// Replaces the Bunny WHIP path, which Bunny does not support.

export const CF_STREAM = {
  get ACCOUNT_ID() { return process.env.CLOUDFLARE_ACCOUNT_ID || ""; },
  get TOKEN() { return process.env.CLOUDFLARE_STREAM_TOKEN || ""; },
  // The subdomain code from your Stream playback URLs (customer-XXXX.cloudflarestream.com)
  get CUSTOMER_CODE() { return process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE || ""; },
};

/**
 * Create a Cloudflare Stream live input and return:
 *  - uid:         the live input id (stored as the stream id)
 *  - whipUrl:     the WebRTC/WHIP ingest URL the creator's browser publishes to
 *                 (per-input credential — only return this to the broadcasting creator)
 *  - playbackUrl: the iframe playback URL the audience watches
 */
export async function createCloudflareLiveInput(
  name: string
): Promise<{ uid: string; whipUrl: string; playbackUrl: string }> {
  if (!CF_STREAM.ACCOUNT_ID || !CF_STREAM.TOKEN) {
    throw new Error(
      "Cloudflare Stream not configured — set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_STREAM_TOKEN."
    );
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_STREAM.ACCOUNT_ID}/stream/live_inputs`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CF_STREAM.TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ meta: { name }, recording: { mode: "automatic" } }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cloudflare Stream error (${res.status}): ${err}`);
  }

  const data = await res.json();
  const r = data.result ?? {};
  const uid: string = r.uid;
  const whipUrl: string = r.webRTC?.url ?? "";

  const playbackUrl = CF_STREAM.CUSTOMER_CODE
    ? `https://customer-${CF_STREAM.CUSTOMER_CODE}.cloudflarestream.com/${uid}/iframe`
    : `https://iframe.cloudflarestream.com/${uid}`;

  return { uid, whipUrl, playbackUrl };
}
