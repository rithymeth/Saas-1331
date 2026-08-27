import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_ORG_COOKIE } from "@/lib/org";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { organizationId } = await request.json().catch(() => ({ organizationId: undefined }));
  if (typeof organizationId !== "string") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const membership = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: session.user.id, organizationId } },
  });
  if (!membership) {
    return NextResponse.json({ error: "Not a member of that organization" }, { status: 403 });
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return NextResponse.json({ ok: true });
}
