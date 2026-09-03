import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { inquiries } from "@/db/schema";

const inquirySchema = z.object({
  firstName: z.string().trim().min(1).max(80), lastName: z.string().trim().min(1).max(80),
  email: z.email().max(180), service: z.enum(["fintech", "ai", "hr", "other"]),
  message: z.string().trim().min(10, "Please share at least a few details.").max(2000), website: z.string().max(0).optional(),
});

export async function POST(request: Request) {
  try {
    const body = inquirySchema.safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Please check the form." }, { status: 400 });
    const data = { firstName: body.data.firstName, lastName: body.data.lastName, email: body.data.email, service: body.data.service, message: body.data.message };
    await getDb().insert(inquiries).values(data);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Inquiry submission failed", error);
    return NextResponse.json({ error: "We couldn’t save your inquiry. Please email hello@ravex.io." }, { status: 500 });
  }
}
