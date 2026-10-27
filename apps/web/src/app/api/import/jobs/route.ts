import { NextResponse } from "next/server";
import { route } from "@/lib/http";
import { listJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export const GET = route(async () => NextResponse.json(await listJobs()));
