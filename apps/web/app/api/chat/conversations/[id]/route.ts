import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getAllMessages, getConversationForUser } from "@/lib/conversations";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to view this chat." }, { status: 401 });

  const { id } = await params;
  const conversation = await getConversationForUser(id, session.user.id);
  if (!conversation) return NextResponse.json({ error: "Chat not found." }, { status: 404 });

  const messages = await getAllMessages(conversation.id);
  return NextResponse.json({ conversation, messages });
}
