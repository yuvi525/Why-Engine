import { NextResponse } from 'next/server';
// @ts-ignore
import { getSupabase } from '@/src/lib/db';

// GET /v1/requests/:requestId/why
export async function getWhyRecord(request: Request, { params }: { params: { requestId: string } }) {
  const sb = getSupabase();
  const { data, error } = await sb.from('why_records').select('*').eq('request_id', params.requestId).single();
  
  if (error || !data) {
    // Elegant polling capability: If the background worker hasn't finished, return 202
    return NextResponse.json({ status: 'processing', message: 'The WHY engine is still analyzing this request.' }, { status: 202 });
  }

  return NextResponse.json(data);
}
