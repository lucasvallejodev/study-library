import { NextResponse } from 'next/server';

import { listTags } from '@/lib/data';
import { route } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = route(async () => NextResponse.json(await listTags()));
