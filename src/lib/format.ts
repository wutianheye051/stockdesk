const yen = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

const number = new Intl.NumberFormat("ja-JP");

export const formatYen = (v: number) => yen.format(v);
export const formatNumber = (v: number) => number.format(v);

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" }).format(d);
}

export function formatDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(d);
}

export const ORDER_STATUS_LABEL = {
  PENDING: "受付済",
  CONFIRMED: "確定",
  SHIPPED: "出荷済",
  CANCELLED: "キャンセル",
} as const;

export const ORDER_STATUS_CLASS = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  CONFIRMED: "bg-sky-50 text-sky-700 ring-sky-600/20",
  SHIPPED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  CANCELLED: "bg-zinc-100 text-zinc-600 ring-zinc-500/20",
} as const;

export const MOVEMENT_LABEL = {
  IN: "入庫",
  OUT: "出庫",
  ADJUST: "調整",
} as const;

export const ROLE_LABEL = {
  ADMIN: "管理者",
  STAFF: "担当者",
  VIEWER: "閲覧のみ",
} as const;
