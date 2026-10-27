import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { route } from "@/lib/http";

export const GET = route(async () => {
  await getDb().execute(sql`select 1`);
  return NextResponse.json({ ok: true });
});
