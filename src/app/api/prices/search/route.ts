import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireUser(request);
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (!query) return NextResponse.json({ items: [] });
    const items = await prisma.priceListItem.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: "insensitive" } },
          { sku: { contains: query, mode: "insensitive" } },
          { characteristics: { contains: query, mode: "insensitive" } }
        ]
      },
      orderBy: { uploadedAt: "desc" },
      take: 30
    });
    return NextResponse.json({ items: JSON.parse(JSON.stringify(items)) });
  } catch (error) {
    return jsonError(error);
  }
}
