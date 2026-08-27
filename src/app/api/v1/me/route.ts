import { NextResponse } from "next/server";
import { getOrganizationForApiKey } from "@/lib/api-keys";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const key = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!key) {
    return NextResponse.json({ error: "Missing Authorization: Bearer <key> header" }, { status: 401 });
  }

  const organization = await getOrganizationForApiKey(key);
  if (!organization) {
    return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
  }

  return NextResponse.json({
    organization: { id: organization.id, name: organization.name, slug: organization.slug },
  });
}
