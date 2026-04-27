export const dynamic = 'force-dynamic';

import { executePipeline } from '@/src/pipeline/orchestrator';

export async function POST(req: Request) {
  return executePipeline(req);
}
