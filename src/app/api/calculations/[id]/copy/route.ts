import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { jsonError, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewCalculation, calculationInclude, serializeCalculation } from "@/lib/api";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser(request);
    const source = await canViewCalculation(user, params.id);
    const copy = await prisma.calculation.create({
      data: {
        ownerId: user.id,
        type: source.type,
        status: "DRAFT",
        title: `Копия — ${source.title || "Расчёт"}`,
        customerName: source.customerName,
        customerInn: source.customerInn,
        customerCity: source.customerCity,
        purchaseNumber: source.purchaseNumber,
        purchaseLink: source.purchaseLink,
        platformName: source.platformName,
        nmckRub: source.nmckRub as Prisma.Decimal | null,
        applicationDeadline: source.applicationDeadline,
        deliveryTerms: source.deliveryTerms,
        warrantyTerms: source.warrantyTerms,
        currencyRateUsdRub: source.currencyRateUsdRub as Prisma.Decimal,
        isManualCurrencyRate: source.isManualCurrencyRate,
        deliveryCostRub: source.deliveryCostRub as Prisma.Decimal,
        bidSecurityPercent: source.bidSecurityPercent as Prisma.Decimal,
        contractSecurityPercent: source.contractSecurityPercent as Prisma.Decimal,
        warrantySecurityPercent: source.warrantySecurityPercent as Prisma.Decimal,
        bankGuaranteePercent: source.bankGuaranteePercent as Prisma.Decimal,
        customMarginPercent: source.customMarginPercent as Prisma.Decimal | null,
        customAuctionDiscount: source.customAuctionDiscount as Prisma.Decimal | null,
        notes: source.notes,
        products: {
          create: source.products.map((product) => ({
            name: product.name,
            category: product.category,
            quantity: product.quantity,
            registryNumber: product.registryNumber,
            comment: product.comment,
            manualPurchasePriceRub: product.manualPurchasePriceRub as Prisma.Decimal | null,
            manualPurchasePriceUsd: product.manualPurchasePriceUsd as Prisma.Decimal | null,
            useManualPurchasePrice: product.useManualPurchasePrice,
            sortOrder: product.sortOrder,
            components: {
              create: product.components.map((component) => ({
                name: component.name,
                characteristics: component.characteristics,
                comment: component.comment,
                quantityPerProduct: component.quantityPerProduct as Prisma.Decimal,
                priceRub: component.priceRub as Prisma.Decimal | null,
                priceUsd: component.priceUsd as Prisma.Decimal | null,
                inputCurrency: component.inputCurrency,
                isIncluded: component.isIncluded,
                sourceType: component.sourceType,
                distributorName: component.distributorName,
                sortOrder: component.sortOrder
              }))
            }
          }))
        }
      },
      include: calculationInclude
    });
    return NextResponse.json({ calculation: serializeCalculation(copy) });
  } catch (error) {
    return jsonError(error);
  }
}
