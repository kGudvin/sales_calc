import type { Calculation, Product, ProductComponent } from "@prisma/client";

export const DEFAULT_MARGIN_SCENARIOS = [10, 15, 20, 25, 30];
export const DEFAULT_AUCTION_DISCOUNTS = [10, 15, 20, 25, 30];

export type CalculationFull = Calculation & {
  products: Array<Product & { components: ProductComponent[] }>;
  owner?: { login: string };
};

const n = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

const roundRub = (value: number) => Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;

export function createPurchaseLink(purchaseNumber?: string | null) {
  const clean = (purchaseNumber || "").trim();
  if (!clean) return "";
  return `https://zakupki.gov.ru/epz/order/notice/ea20/view/common-info.html?regNumber=${encodeURIComponent(clean)}`;
}

export function autoTitle(input: {
  title?: string | null;
  products?: Array<{ name?: string | null; quantity?: number | null }>;
  customerName?: string | null;
  purchaseNumber?: string | null;
  createdAt?: Date | string | null;
}) {
  if (input.title?.trim()) return input.title.trim();
  const firstProduct = input.products?.[0];
  const parts = [
    firstProduct?.name ? `${firstProduct.name}${firstProduct.quantity ? ` ${firstProduct.quantity} шт` : ""}` : "",
    input.customerName || "",
    input.purchaseNumber || ""
  ].filter(Boolean);
  if (parts.length) return parts.join(" — ");
  const date = input.createdAt ? new Date(input.createdAt) : new Date();
  return `Расчёт от ${date.toLocaleDateString("ru-RU")}`;
}

export function normalizeComponentPrices(priceRub: number | null | undefined, priceUsd: number | null | undefined, currency: "RUB" | "USD", rate: number) {
  if (rate <= 0) return { priceRub: n(priceRub), priceUsd: n(priceUsd) };
  if (currency === "USD") {
    const usdValue = n(priceUsd);
    return { priceUsd: usdValue, priceRub: roundRub(usdValue * rate) };
  }
  const rubValue = n(priceRub);
  return { priceRub: rubValue, priceUsd: roundRub(rubValue / rate) };
}

export function calculate(calculation: CalculationFull) {
  const rate = Math.max(n(calculation.currencyRateUsdRub), 0.0001);
  const productRows = calculation.products
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((product) => {
      const activeComponents = product.components.filter((component) => component.isIncluded);
      const componentsTotal = activeComponents.reduce((sum, component) => {
        const rub = n(component.priceRub);
        return sum + n(component.quantityPerProduct) * rub;
      }, 0);
      const manualRub = n(product.manualPurchasePriceRub) || n(product.manualPurchasePriceUsd) * rate;
      const productUnitCostRub = activeComponents.length > 0 ? componentsTotal : manualRub;
      const quantity = Math.max(0, n(product.quantity));
      return {
        product,
        activeComponents,
        quantity,
        productUnitCostRub: roundRub(productUnitCostRub),
        productTotalCostRub: roundRub(productUnitCostRub * quantity),
        inputUnitCostRub: 0,
        inputTotalCostRub: 0
      };
    });

  const pureProductsCostRub = roundRub(productRows.reduce((sum, row) => sum + row.productTotalCostRub, 0));
  const totalProductQuantity = productRows.reduce((sum, row) => sum + row.quantity, 0);
  const nmckRub = n(calculation.nmckRub);
  const bidSecurityAmountRub = roundRub((nmckRub * n(calculation.bidSecurityPercent)) / 100);
  const contractSecurityAmountRub = roundRub((nmckRub * n(calculation.contractSecurityPercent)) / 100);
  const warrantySecurityAmountRub = roundRub((nmckRub * n(calculation.warrantySecurityPercent)) / 100);
  const totalSecurityAmountRub = roundRub(bidSecurityAmountRub + contractSecurityAmountRub + warrantySecurityAmountRub);
  const bankGuaranteeCostRub = roundRub((totalSecurityAmountRub * n(calculation.bankGuaranteePercent)) / 100);
  const deliveryCostRub = roundRub(n(calculation.deliveryCostRub));
  const inputCostRub = roundRub(pureProductsCostRub + deliveryCostRub + bankGuaranteeCostRub);
  const sharedExtraCostPerUnit = totalProductQuantity > 0 ? roundRub((deliveryCostRub + bankGuaranteeCostRub) / totalProductQuantity) : 0;

  for (const row of productRows) {
    row.inputUnitCostRub = roundRub(row.productUnitCostRub + sharedExtraCostPerUnit);
    row.inputTotalCostRub = roundRub(row.inputUnitCostRub * row.quantity);
  }

  const margins = [...DEFAULT_MARGIN_SCENARIOS, n(calculation.customMarginPercent)].filter((value, index, arr) => value > 0 && value < 100 && arr.indexOf(value) === index);
  const marginScenarios = margins.map((marginPercent) => {
    const products = productRows.map((row) => {
      const productSaleUnitPriceRub = roundRub(row.inputUnitCostRub / (1 - marginPercent / 100));
      return {
        productId: row.product.id,
        name: row.product.name,
        quantity: row.quantity,
        productSaleUnitPriceRub,
        productSaleTotalPriceRub: roundRub(productSaleUnitPriceRub * row.quantity)
      };
    });
    const totalSalePriceRub = roundRub(products.reduce((sum, product) => sum + product.productSaleTotalPriceRub, 0));
    const profitRub = roundRub(totalSalePriceRub - inputCostRub);
    const actualMarginPercent = totalSalePriceRub > 0 ? roundRub((profitRub / totalSalePriceRub) * 100) : 0;
    return { marginPercent, inputCostRub, totalSalePriceRub, profitRub, actualMarginPercent, products };
  });

  const auctionDiscounts = [...DEFAULT_AUCTION_DISCOUNTS, n(calculation.customAuctionDiscount)].filter((value, index, arr) => value >= 0 && value <= 100 && arr.indexOf(value) === index);
  const auctionScenarios = auctionDiscounts.map((discountPercent) => {
    const auctionPriceRub = roundRub(nmckRub * (1 - discountPercent / 100));
    const auctionProfitRub = roundRub(auctionPriceRub - inputCostRub);
    const auctionMarginPercent = auctionPriceRub > 0 ? roundRub((auctionProfitRub / auctionPriceRub) * 100) : 0;
    return {
      discountPercent,
      auctionPriceRub,
      inputCostRub,
      auctionProfitRub,
      auctionMarginPercent,
      isAboveInput: auctionPriceRub >= inputCostRub
    };
  });

  return {
    rate,
    productRows,
    pureProductsCostRub,
    deliveryCostRub,
    bidSecurityAmountRub,
    contractSecurityAmountRub,
    warrantySecurityAmountRub,
    totalSecurityAmountRub,
    bankGuaranteeCostRub,
    inputCostRub,
    sharedExtraCostPerUnit,
    totalProductQuantity,
    marginScenarios,
    auctionScenarios
  };
}
