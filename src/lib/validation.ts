import { z } from "zod";

const nullableString = z.string().trim().optional().nullable().transform((value) => value || null);
const nonNegativeNumber = z.coerce.number().min(0);
const optionalNonNegativeNumber = z.union([z.literal(""), z.null(), z.undefined(), z.coerce.number().min(0)]).transform((value) => value === "" || value === null || value === undefined ? null : Number(value));

export const componentSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Укажите комплектующую"),
  characteristics: nullableString,
  comment: nullableString,
  quantityPerProduct: nonNegativeNumber.default(1),
  priceRub: optionalNonNegativeNumber,
  priceUsd: optionalNonNegativeNumber,
  inputCurrency: z.enum(["RUB", "USD"]).default("RUB"),
  isIncluded: z.boolean().default(true),
  sourceType: z.enum(["manual", "template", "price_list"]).default("manual"),
  distributorName: nullableString,
  sortOrder: z.coerce.number().int().default(0)
});

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Укажите изделие"),
  category: nullableString,
  quantity: z.coerce.number().int().min(0),
  registryNumber: nullableString,
  comment: nullableString,
  manualPurchasePriceRub: optionalNonNegativeNumber,
  manualPurchasePriceUsd: optionalNonNegativeNumber,
  useManualPurchasePrice: z.boolean().default(false),
  sortOrder: z.coerce.number().int().default(0),
  components: z.array(componentSchema).default([])
});

export const calculationSchema = z.object({
  type: z.enum(["AUCTION", "COMMERCIAL_OFFER", "DRAFT"]),
  status: z.enum(["DRAFT", "IN_PROGRESS", "READY", "OFFER_SENT", "BID_SUBMITTED", "AUCTION_FINISHED", "WON", "LOST", "ARCHIVED"]).default("DRAFT"),
  title: nullableString,
  customerName: nullableString,
  customerInn: nullableString,
  customerCity: nullableString,
  purchaseNumber: nullableString,
  purchaseLink: nullableString,
  platformName: nullableString,
  nmckRub: optionalNonNegativeNumber,
  applicationDeadline: z.string().optional().nullable().transform((value) => value ? new Date(value) : null),
  deliveryTerms: nullableString,
  warrantyTerms: nullableString,
  currencyRateUsdRub: z.coerce.number().positive("Курс должен быть больше 0"),
  isManualCurrencyRate: z.boolean().default(false),
  deliveryCostRub: nonNegativeNumber.default(0),
  bidSecurityPercent: nonNegativeNumber.default(0),
  contractSecurityPercent: nonNegativeNumber.default(0),
  warrantySecurityPercent: nonNegativeNumber.default(0),
  bankGuaranteePercent: nonNegativeNumber.default(5),
  customMarginPercent: optionalNonNegativeNumber.refine((value) => value === null || value < 100, "Маржа должна быть меньше 100%"),
  customAuctionDiscount: optionalNonNegativeNumber.refine((value) => value === null || value <= 100, "Ставка должна быть от 0 до 100%"),
  notes: nullableString,
  products: z.array(productSchema).default([])
});

export type CalculationInput = z.infer<typeof calculationSchema>;
