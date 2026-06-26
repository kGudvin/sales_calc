import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const include = {
  components: { orderBy: { sortOrder: "asc" as const } },
  favorites: true
};

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const templates = await prisma.productTemplate.findMany({
      where: { OR: [{ isGlobal: true }, { ownerId: user.id }] },
      include,
      orderBy: [{ isGlobal: "desc" }, { name: "asc" }]
    });
    return NextResponse.json({ templates: JSON.parse(JSON.stringify(templates)) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const isGlobal = user.role === "ADMIN" ? Boolean(body.isGlobal) : false;
    const template = await prisma.productTemplate.create({
      data: {
        name: String(body.name || "").trim(),
        category: body.category || null,
        ownerId: isGlobal ? null : user.id,
        isGlobal,
        components: {
          create: (body.components || []).map((component: Record<string, unknown>, index: number) => ({
            name: String(component.name || "").trim(),
            characteristics: component.characteristics ? String(component.characteristics) : null,
            quantityPerProduct: new Prisma.Decimal(Number(component.quantityPerProduct || 1)),
            priceRub: component.priceRub === "" || component.priceRub == null ? null : new Prisma.Decimal(Number(component.priceRub)),
            priceUsd: component.priceUsd === "" || component.priceUsd == null ? null : new Prisma.Decimal(Number(component.priceUsd)),
            inputCurrency: component.inputCurrency === "USD" ? "USD" : "RUB",
            sortOrder: Number(component.sortOrder ?? index)
          }))
        }
      },
      include
    });
    return NextResponse.json({ template: JSON.parse(JSON.stringify(template)) });
  } catch (error) {
    return jsonError(error);
  }
}
