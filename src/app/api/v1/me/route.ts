import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const key = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  if (!key) {
    return NextResponse.json({ error: "Missing Authorization: Bearer <key> header" }, { status: 401 });
  }

  const auth = await authenticateApiKey(key, { requiredScope: "read" });
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  return NextResponse.json({ organization: auth.organization });
}
