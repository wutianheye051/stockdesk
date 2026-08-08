import type { Prisma } from "@/generated/prisma/client";
import { one, toEnum, type RawSearchParams } from "@/lib/query";

export const ORDER_SORTS = [
  "ordered_desc",
  "ordered_asc",
  "amount_desc",
  "amount_asc",
  "orderno_asc",
] as const;
export type OrderSort = (typeof ORDER_SORTS)[number];

export const ORDER_SORT_LABEL: Record<OrderSort, string> = {
  ordered_desc: "受注日（新しい順）",
  ordered_asc: "受注日（古い順）",
  amount_desc: "金額（高い順）",
  amount_asc: "金額（安い順）",
  orderno_asc: "受注番号（昇順）",
};

export const STATUS_FILTERS = ["", "PENDING", "CONFIRMED", "SHIPPED", "CANCELLED"] as const;

/** "YYYY-MM-DD" を Date にする。不正なら undefined */
function parseDate(value: string, endOfDay = false): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** 一覧と CSV 出力で共有する絞り込み条件 */
export function buildOrderWhere(sp: RawSearchParams): Prisma.OrderWhereInput {
  const q = one(sp.q).trim();
  const status = toEnum(sp.status, STATUS_FILTERS, "");
  const from = parseDate(one(sp.from));
  const to = parseDate(one(sp.to), true);

  const where: Prisma.OrderWhereInput = {};

  if (q) {
    where.OR = [
      { orderNo: { contains: q, mode: "insensitive" } },
      { customerName: { contains: q, mode: "insensitive" } },
      { customerEmail: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status) where.status = status;

  if (from || to) {
    where.orderedAt = {};
    if (from) where.orderedAt.gte = from;
    if (to) where.orderedAt.lte = to;
  }

  return where;
}

export function buildOrderOrderBy(sort: OrderSort): Prisma.OrderOrderByWithRelationInput[] {
  switch (sort) {
    case "ordered_asc":
      return [{ orderedAt: "asc" }];
    case "amount_desc":
      return [{ totalAmount: "desc" }];
    case "amount_asc":
      return [{ totalAmount: "asc" }];
    case "orderno_asc":
      return [{ orderNo: "asc" }];
    default:
      return [{ orderedAt: "desc" }];
  }
}

export function parseOrderSort(sp: RawSearchParams): OrderSort {
  return toEnum(sp.sort, ORDER_SORTS, "ordered_desc");
}
