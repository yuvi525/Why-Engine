import { createServerSupabaseClient } from './supabase/server';

export function getSupabase() {
  try {
    return createServerSupabaseClient();
  } catch (e) {
    return null;
  }
}

// Dummy export for db if it's imported in older files
export const db = {
  select: () => ({ from: () => ({ where: () => [] }) }),
  insert: () => ({ values: () => ({ returning: () => [] }) }),
  update: () => ({ set: () => ({ where: () => [] }) }),
  delete: () => ({ where: () => [] }),
};
