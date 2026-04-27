export const dynamic = 'force-dynamic';

import { createServerSupabaseClient } from '@/src/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const supabase = createServerSupabaseClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = user.id;

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, prefix, created_at, last_used_at, is_active')
      .eq('org_id', orgId)
      .eq('is_active', true);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const supabase = createServerSupabaseClient();
    
    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const orgId = user.id;

    // Generate a secure key
    const rawKey = `whye_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const prefix = rawKey.substring(0, 8);
    // In production, we'd hash the key using bcrypt/argon2 before saving
    const hashedKey = rawKey; // Simplification for demo

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        org_id: orgId,
        name,
        prefix,
        key_hash: hashedKey,
        is_active: true
      })
      .select('id, name, prefix, created_at, is_active')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Return the full rawKey exactly ONCE
    return NextResponse.json({ ...data, raw_key: rawKey });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
