import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/env";
import { clearAdminSession, clearUserSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope");
  if (scope === "admin") {
    await clearAdminSession();
    return NextResponse.redirect(new URL("/admin/login", getBaseUrl(req)));
  }
  await clearUserSession();
  return NextResponse.redirect(new URL("/", getBaseUrl(req)));
}
