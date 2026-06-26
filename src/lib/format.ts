export const calculationTypeLabels = {
  AUCTION: "Аукцион",
  COMMERCIAL_OFFER: "КП",
  DRAFT: "Черновик"
} as const;

export const calculationStatusLabels = {
  DRAFT: "Черновик",
  IN_PROGRESS: "В работе",
  READY: "Готов",
  OFFER_SENT: "Отправлено КП",
  BID_SUBMITTED: "Подана заявка",
  AUCTION_FINISHED: "Торги прошли",
  WON: "Выиграли",
  LOST: "Проиграли",
  ARCHIVED: "Архив"
} as const;

export function money(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

export function usd(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

export function percent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : "0.00"}%`;
}
