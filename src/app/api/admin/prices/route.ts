import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import { jsonError, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const rows = await prisma.priceListItem.groupBy({
      by: ["distributorName"],
      _count: { id: true },
      _max: { uploadedAt: true },
      orderBy: { distributorName: "asc" }
    });
    return NextResponse.json({ distributors: rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);
    const form = await request.formData();
    const distributorName = String(form.get("distributorName") || "").trim();
    const file = form.get("file");
    if (!distributorName || !(file instanceof File)) {
      return NextResponse.json({ error: "Укажите дистрибьютора и файл" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    await prisma.priceListItem.deleteMany({ where: { distributorName } });
    const data = rows.slice(0, 5000).map((row) => ({
      distributorName,
      sku: String(row["sku"] || row["артикул"] || row["Артикул"] || "").trim() || null,
      name: String(row["name"] || row["Наименование"] || row["название"] || Object.values(row)[0] || "").trim(),
      characteristics: String(row["characteristics"] || row["Характеристики"] || "").trim() || null,
      priceRub: row["priceRub"] || row["Цена RUB"] || row["Цена"] ? new Prisma.Decimal(Number(row["priceRub"] || row["Цена RUB"] || row["Цена"])) : null,
      priceUsd: row["priceUsd"] || row["Цена USD"] ? new Prisma.Decimal(Number(row["priceUsd"] || row["Цена USD"])) : null,
      currency: String(row["currency"] || row["Валюта"] || "").trim() || null,
      stock: row["stock"] || row["Остаток"] ? Number(row["stock"] || row["Остаток"]) : null
    })).filter((row) => row.name);
    if (data.length) await prisma.priceListItem.createMany({ data });
    return NextResponse.json({ imported: data.length });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);
    const distributorName = request.nextUrl.searchParams.get("distributorName") || "";
    await prisma.priceListItem.deleteMany({ where: { distributorName } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
