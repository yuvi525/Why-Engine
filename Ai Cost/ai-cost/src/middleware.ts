import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Redis } from '@upstash/redis';

// Note: Upstash Redis over REST works edge natively
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export async function middleware(request: NextRequest) {
  // Only rate limit API routes
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Get IP address for rate limiting
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  
  try {
    const key = `ratelimit:${ip}`;
    // Simple fixed window rate limit: 100 req per minute
    const windowSeconds = 60;
    const limit = 100;
    
    // Check current count
    const [response] = await redis.pipeline()
      .incr(key)
      .expire(key, windowSeconds, 'NX') // Set TTL only if not exists
      .exec();
      
    // The result from incr is the first element of the pipeline response
    const currentCount = Number(response);
    
    if (currentCount > limit) {
      return NextResponse.json(
        { error: 'Too Many Requests', message: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(windowSeconds) } }
      );
    }
  } catch (error) {
    // If Redis fails, we should fail open to not block production traffic,
    // but we log the error.
    console.error('Rate limiting error:', error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
