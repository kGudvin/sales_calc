import { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { autoTitle, createPurchaseLink, normalizeComponentPrices } from "@/lib/calculations";
import { CalculationInput } from "@/lib/validation";

export const calculationInclude = {
  owner: { select: { login: true } },
  products: {
    include: { components: true },
    orderBy: { sortOrder: "asc" as const }
  }
};

export async function canViewCalculation(user: User, id: string) {
  const calculation = await prisma.calculation.findUnique({
    where: { id },
    include: calculationInclude
  });
  if (!calculation) throw Object.assign(new Error("Расчёт не найден"), { status: 404 });
  if (user.role !== "ADMIN" && calculation.ownerId !== user.id) {
    throw Object.assign(new Error("Нет доступа к расчёту"), { status: 403 });
  }
  return calculation;
}

export async function canEditCalculation(user: User, id: string) {
  const calculation = await canViewCalculation(user, id);
  if (calculation.ownerId !== user.id) {
    throw Object.assign(new Error("Можно редактировать только свои расчёты"), { status: 403 });
  }
  return calculation;
}

export function serializeCalculation(calculation: unknown) {
  return JSON.parse(JSON.stringify(calculation));
}

function decimalOrNull(value: number | null | undefined) {
  return value === null || value === undefined ? null : new Prisma.Decimal(value);
}

function decimal(value: number | null | undefined, fallback = 0) {
  return new Prisma.Decimal(value === null || value === undefined ? fallback : value);
}

export async function upsertCalculation(user: User, data: CalculationInput, id?: string) {
  const existing = id ? await canEditCalculation(user, id) : null;
  const rate = Number(data.currencyRateUsdRub);
  const title = autoTitle({ ...data, createdAt: existing?.createdAt || new Date() });
  const purchaseLink = data.purchaseLink || createPurchaseLink(data.purchaseNumber);

  const calculationData = {
    ownerId: user.id,
    type: data.type,
    status: data.status,
    title,
    customerName: data.customerName,
    customerInn: data.customerInn,
    customerCity: data.customerCity,
    purchaseNumber: data.purchaseNumber,
    purchaseLink,
    platformName: data.platformName,
    nmckRub: decimalOrNull(data.nmckRub),
    applicationDeadline: data.applicationDeadline,
    deliveryTerms: data.deliveryTerms,
    warrantyTerms: data.warrantyTerms,
    currencyRateUsdRub: decimal(data.currencyRateUsdRub, 1),
    isManualCurrencyRate: data.isManualCurrencyRate,
    deliveryCostRub: decimal(data.deliveryCostRub),
    bidSecurityPercent: decimal(data.bidSecurityPercent),
    contractSecurityPercent: decimal(data.contractSecurityPercent),
    warrantySecurityPercent: decimal(data.warrantySecurityPercent),
    bankGuaranteePercent: decimal(data.bankGuaranteePercent, 5),
    customMarginPercent: decimalOrNull(data.customMarginPercent),
    customAuctionDiscount: decimalOrNull(data.customAuctionDiscount),
    notes: data.notes
  };

  const saved = await prisma.$transaction(async (tx) => {
    const calculation = id
      ? await tx.calculation.update({ where: { id }, data: calculationData })
      : await tx.calculation.create({ data: calculationData });

    await tx.product.deleteMany({ where: { calculationId: calculation.id } });
    for (const [productIndex, product] of data.products.entries()) {
      const manual = normalizeComponentPrices(product.manualPurchasePriceRub, product.manualPurchasePriceUsd, "RUB", rate);
      const createdProduct = await tx.product.create({
        data: {
          calculationId: calculation.id,
          name: product.name,
          category: product.category,
          quantity: product.quantity,
          registryNumber: product.registryNumber,
          comment: product.comment,
          manualPurchasePriceRub: decimalOrNull(product.manualPurchasePriceRub ?? manual.priceRub),
          manualPurchasePriceUsd: decimalOrNull(product.manualPurchasePriceUsd ?? manual.priceUsd),
          useManualPurchasePrice: product.useManualPurchasePrice,
          sortOrder: product.sortOrder ?? productIndex
        }
      });
      for (const [componentIndex, component] of product.components.entries()) {
        const prices = normalizeComponentPrices(component.priceRub, component.priceUsd, component.inputCurrency, rate);
        await tx.productComponent.create({
          data: {
            productId: createdProduct.id,
            name: component.name,
            characteristics: component.characteristics,
            comment: component.comment,
            quantityPerProduct: decimal(component.quantityPerProduct, 1),
            priceRub: component.priceRub === null && component.priceUsd === null ? null : decimalOrNull(prices.priceRub),
            priceUsd: component.priceRub === null && component.priceUsd === null ? null : decimalOrNull(prices.priceUsd),
            inputCurrency: component.inputCurrency,
            isIncluded: component.isIncluded,
            sourceType: component.sourceType,
            distributorName: component.distributorName,
            sortOrder: component.sortOrder ?? componentIndex
          }
        });
      }
    }
    return tx.calculation.findUniqueOrThrow({ where: { id: calculation.id }, include: calculationInclude });
  });

  return saved;
}

export async function getSettings() {
  const rows = await prisma.appSetting.findMany();
  const map = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return {
    margins: (map.marginScenarios || "10,15,20,25,30").split(",").map(Number).filter(Boolean),
    defaultBankGuaranteePercent: Number(map.defaultBankGuaranteePercent || 5)
  };
}
