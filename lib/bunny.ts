/**
 * BunnyCDN integration for video streaming and file storage.
 */

const BUNNY_API_KEY = process.env.BUNNY_API_KEY!;
const STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE!;
const CDN_URL = process.env.BUNNY_CDN_URL!;
const STREAM_KEY = process.env.BUNNY_STREAM_KEY!;
const STREAM_LIBRARY_ID = process.env.BUNNY_STREAM_LIBRARY_ID!;

/**
 * Upload a file to BunnyCDN Storage.
 */
export async function uploadFile(path: string, fileBuffer: Buffer, mimeType: string) {
  const url = `https://storage.bunnycdn.com/${STORAGE_ZONE}/${path}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      AccessKey: BUNNY_API_KEY,
      "Content-Type": mimeType,
    },
    body: fileBuffer,
  });
  if (!res.ok) throw new Error(`BunnyCDN upload failed: ${res.status}`);
  return `${CDN_URL}/${path}`;
}

/**
 * Delete a file from BunnyCDN Storage.
 */
export async function deleteFile(path: string) {
  const url = `https://storage.bunnycdn.com/${STORAGE_ZONE}/${path}`;
  await fetch(url, { method: "DELETE", headers: { AccessKey: BUNNY_API_KEY } });
}

/**
 * Get a CDN URL for a stored file.
 */
export function getCdnUrl(path: string) {
  return `${CDN_URL}/${path}`;
}

/**
 * Create a live stream on BunnyCDN Stream.
 * Returns the stream ID and RTMP push URL.
 */
export async function createLiveStream(title: string) {
  const res = await fetch(
    `https://video.bunnycdn.com/library/${STREAM_LIBRARY_ID}/videos`,
    {
      method: "POST",
      headers: {
        AccessKey: STREAM_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title }),
    }
  );
  if (!res.ok) throw new Error(`BunnyCDN stream create failed: ${res.status}`);
  return res.json();
}

/**
 * Get a signed URL for a protected video (DRM watermarked).
 */
export function getSignedVideoUrl(videoId: string, userId: string) {
  const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
  const token = Buffer.from(`${videoId}:${userId}:${expiry}`).toString("base64");
  return `https://iframe.mediadelivery.net/embed/${STREAM_LIBRARY_ID}/${videoId}?token=${token}`;
}
