import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { getDb } from '@/lib/db';
import { route } from '@/lib/http';

export const GET = route(async () => {
  await getDb().execute(sql`select 1`);

  return NextResponse.json({ ok: true });
});
