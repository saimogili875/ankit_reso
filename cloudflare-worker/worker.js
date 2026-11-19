/**
 * Cloudflare Worker for Private, Secure HLS Video Streaming from Cloudflare R2
 *
 * Capabilities:
 * 1. HMAC-SHA256 Token Verification: Verifies short-lived path-prefix tokens (/{token}/videos/{id}/...).
 * 2. Token-agnostic Edge Caching: Strips the student token from the Cloudflare cache key so .ts segments
 *    are cached once globally at the Cloudflare edge and shared across all students.
 * 3. HTTP Range Request Support: Handles video seeking and partial byte requests (HTTP 206 Partial Content).
 * 4. Strict Private R2 Access: The R2 bucket is never exposed publicly.
 */

// Helper: Hex string from ArrayBuffer
function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper: Verify HMAC-SHA256 token against environment secret
async function verifyToken(token, videoId, secretKey) {
  try {
    const parts = token.split('_');
    if (parts.length !== 3) return false;

    const [expiresAtStr, userId, providedSig] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);

    // Check expiration timestamp (in seconds)
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      return false;
    }

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const payload = `${videoId}:${userId}:${expiresAt}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const expectedSig = bufferToHex(signatureBuffer).slice(0, 32);

    return providedSig === expectedSig;
  } catch (err) {
    return false;
  }
}

// Helper: Parse HTTP Range header (e.g. 'bytes=0-1048575')
function parseRangeHeader(rangeHeader, totalSize) {
  if (!rangeHeader || !rangeHeader.startsWith('bytes=')) return null;

  const parts = rangeHeader.replace('bytes=', '').split('-');
  const start = parts[0] ? parseInt(parts[0], 10) : 0;
  const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

  if (isNaN(start) || isNaN(end) || start > end || start >= totalSize) {
    return null;
  }

  return {
    offset: start,
    length: end - start + 1,
    end: Math.min(end, totalSize - 1),
  };
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Dynamic CORS Headers
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
      'Access-Control-Max-Age': '86400',
    };

    // Preflight OPTIONS handler
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    // Path Pattern: /{token}/videos/{videoId}/{subpath...}
    const match = url.pathname.match(/^\/([^/]+)\/videos\/([^/]+)\/(.+)$/);
    if (!match) {
      return new Response(JSON.stringify({ error: 'Invalid streaming request path format.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = match[1];
    const videoId = match[2];
    const subPath = match[3];
    const r2Key = `videos/${videoId}/${subPath}`;

    // 1. Verify Cryptographic Playback Token
    const secretKey = env.VIDEO_STREAMING_SECRET || 'django-insecure-adepteduverse-dev-secret-key-change-in-prod-!@#$%';
    const isTokenValid = await verifyToken(token, videoId, secretKey);
    if (!isTokenValid) {
      return new Response(JSON.stringify({ error: 'Forbidden: Invalid or expired video streaming token.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Token-agnostic Edge Cache Lookup
    // Segments (.ts/.m4s) use a normalized cache key that excludes the student token
    const isSegment = subPath.endsWith('.ts') || subPath.endsWith('.m4s');
    const isPlaylist = subPath.endsWith('.m3u8');
    const isThumb = subPath.endsWith('.jpg') || subPath.endsWith('.vtt') || subPath.endsWith('.png');

    const cacheKey = new Request(`https://${url.hostname}/videos/${videoId}/${subPath}`, request);
    const cache = caches.default;

    if (isSegment || isThumb) {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        const headers = new Headers(cachedResponse.headers);
        Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
        headers.set('X-Cache-Status', 'HIT');
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          headers,
        });
      }
    }

    // 3. Fetch Object from Cloudflare R2 Bucket Binding
    if (!env.VIDEO_BUCKET) {
      return new Response(JSON.stringify({ error: 'R2 bucket binding (VIDEO_BUCKET) is not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Handle HTTP Range Requests for video seeking
    const rangeHeader = request.headers.get('Range');
    let r2Options = {};
    if (rangeHeader) {
      // Fetch metadata first to get exact size
      const headObj = await env.VIDEO_BUCKET.head(r2Key);
      if (!headObj) {
        return new Response('Not Found', { status: 404, headers: corsHeaders });
      }
      const parsedRange = parseRangeHeader(rangeHeader, headObj.size);
      if (parsedRange) {
        r2Options.range = { offset: parsedRange.offset, length: parsedRange.length };
      }
    }

    const object = await env.VIDEO_BUCKET.get(r2Key, r2Options);
    if (!object) {
      return new Response('Not Found', { status: 404, headers: corsHeaders });
    }

    // 4. Construct Response Headers
    const headers = new Headers(corsHeaders);
    headers.set('Accept-Ranges', 'bytes');
    headers.set('ETag', object.httpEtag || `"${object.version}"`);
    headers.set('X-Cache-Status', 'MISS');

    if (object.range) {
      headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
      headers.set('Content-Length', object.range.length.toString());
    } else {
      headers.set('Content-Length', object.size.toString());
    }

    // MIME Types & Cache-Control policies
    if (isSegment) {
      headers.set('Content-Type', 'video/mp2t');
      // Immutable 1-year cache on video segments
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (isPlaylist) {
      headers.set('Content-Type', 'application/vnd.apple.mpegurl');
      // Short 60s cache for playlists
      headers.set('Cache-Control', 'public, max-age=60');
    } else if (subPath.endsWith('.vtt')) {
      headers.set('Content-Type', 'text/vtt');
      headers.set('Cache-Control', 'public, max-age=86400');
    } else if (subPath.endsWith('.jpg') || subPath.endsWith('.jpeg')) {
      headers.set('Content-Type', 'image/jpeg');
      headers.set('Cache-Control', 'public, max-age=86400');
    } else {
      headers.set('Content-Type', 'application/octet-stream');
    }

    const responseStatus = object.range ? 206 : 200;
    const response = new Response(object.body, {
      status: responseStatus,
      headers,
    });

    // Cache immutable segments in Cloudflare Edge Cache
    if ((isSegment || isThumb) && responseStatus === 200) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
  },
};
