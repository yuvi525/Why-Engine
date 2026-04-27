import { NextResponse } from 'next/server';
import { logger } from '../observability/logger';

export function handleGlobalError(error: any) {
  // Capture complete stack trace for Datadog
  logger.error({ error: error.message || error, stack: error.stack }, 'Global caught error pipeline');
  
  // Enforce rigid JSON response to prevent proxy client crashes
  return NextResponse.json({
    error: error.message || 'Internal Server Error',
    status: error.status || 500
  }, { status: error.status || 500 });
}
