import { NextRequest, NextResponse } from "next/server";
import { currentUserFromRequest } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const user = await currentUserFromRequest(request);
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { id: user.id, login: user.login, email: user.login, role: user.role } });
}
