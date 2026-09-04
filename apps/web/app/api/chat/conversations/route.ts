import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createConversation, listConversations } from "@/lib/conversations";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to view chats." }, { status: 401 });

  const conversations = await listConversations(session.user.id);
  return NextResponse.json({ conversations });
}

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to start a chat." }, { status: 401 });

  const conversation = await createConversation(session.user.id);
  return NextResponse.json({ conversation }, { status: 201 });
}
