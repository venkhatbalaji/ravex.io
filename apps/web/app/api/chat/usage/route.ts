import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getUsageSummary } from "@/lib/usage";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to view usage." }, { status: 401 });

  const usage = await getUsageSummary(session.user.id);
  return NextResponse.json(usage);
}
