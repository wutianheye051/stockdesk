import { OrderStatus } from "@/generated/prisma/enums";
import { ORDER_STATUS_LABEL } from "@/lib/format";

/**
 * 許可する状態遷移。ここに無い組み合わせは弾く。
 * 画面のボタンを制御するだけだと、リクエストを直接投げられて不正な状態に落ちる。
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [], // 出荷後は変更不可。返品は別の業務として扱う
  CANCELLED: [],
};

/** 在庫が引き当てられている状態かどうか */
export const isAllocated = (s: OrderStatus): boolean =>
  s === OrderStatus.CONFIRMED || s === OrderStatus.SHIPPED;

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** 遷移ボタンの見た目と確認文。画面とアクションで同じ定義を使う */
export const TRANSITION_UI: Record<OrderStatus, { label: string; tone: "primary" | "danger" }> = {
  PENDING: { label: "受付済に戻す", tone: "primary" },
  CONFIRMED: { label: "受注を確定する（在庫を引き当て）", tone: "primary" },
  SHIPPED: { label: "出荷済にする", tone: "primary" },
  CANCELLED: { label: "キャンセルする", tone: "danger" },
};

export const statusLabel = (s: OrderStatus): string => ORDER_STATUS_LABEL[s];
