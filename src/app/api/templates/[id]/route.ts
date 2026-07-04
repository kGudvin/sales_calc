import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const include = {
  components: { orderBy: { sortOrder: "asc" as const } },
  favorites: true
};

function templateComponents(body: Record<string, unknown>) {
  return (Array.isArray(body.components) ? body.components : [])
    .map((component: Record<string, unknown>, index: number) => ({
      name: String(component.name || "").trim(),
      characteristics: component.characteristics ? String(component.characteristics) : null,
      quantityPerProduct: new Prisma.Decimal(Number(component.quantityPerProduct || 1)),
      priceRub: component.priceRub === "" || component.priceRub == null ? null : new Prisma.Decimal(Number(component.priceRub)),
      priceUsd: component.priceUsd === "" || component.priceUsd == null ? null : new Prisma.Decimal(Number(component.priceUsd)),
      inputCurrency: component.inputCurrency === "USD" ? "USD" as const : "RUB" as const,
      sortOrder: Number(component.sortOrder ?? index)
    }))
    .filter((component) => component.name);
}

async function editableTemplate(id: string, userId: string, isAdmin: boolean) {
  const template = await prisma.productTemplate.findUnique({ where: { id } });
  if (!template) throw Object.assign(new Error("Шаблон не найден"), { status: 404 });
  if (!isAdmin && template.ownerId !== userId) {
    throw Object.assign(new Error("Недостаточно прав для изменения шаблона"), { status: 403 });
  }
  return template;
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const body = await request.json();
    const existing = await editableTemplate(params.id, user.id, user.role === "ADMIN");
    const isGlobal = user.role === "ADMIN" ? Boolean(body.isGlobal ?? existing.isGlobal) : false;

    const template = await prisma.$transaction(async (tx) => {
      await tx.productTemplateComponent.deleteMany({ where: { templateId: params.id } });
      return tx.productTemplate.update({
        where: { id: params.id },
        data: {
          name: String(body.name || "").trim(),
          category: body.category || null,
          ownerId: isGlobal ? null : user.id,
          isGlobal,
          components: {
            create: templateComponents(body)
          }
        },
        include
      });
    });

    return NextResponse.json({ template: JSON.parse(JSON.stringify(template)) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    await editableTemplate(params.id, user.id, user.role === "ADMIN");
    await prisma.productTemplate.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
