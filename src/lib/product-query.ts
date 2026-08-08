import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { one, toEnum, type RawSearchParams } from "@/lib/query";

export const PRODUCT_SORTS = [
  "name_asc",
  "sku_asc",
  "stock_asc",
  "stock_desc",
  "price_asc",
  "price_desc",
  "updated_desc",
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const PRODUCT_SORT_LABEL: Record<ProductSort, string> = {
  name_asc: "商品名（昇順）",
  sku_asc: "SKU（昇順）",
  stock_asc: "在庫数（少ない順）",
  stock_desc: "在庫数（多い順）",
  price_asc: "販売単価（安い順）",
  price_desc: "販売単価（高い順）",
  updated_desc: "更新日時（新しい順）",
};

export const STOCK_FILTERS = ["", "low", "zero"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export const ACTIVE_FILTERS = ["", "1", "0"] as const;

/**
 * 一覧画面と CSV 出力の両方から呼ぶ。
 * ここを一箇所にしておかないと「画面では 12 件なのに CSV は 30 件出る」という
 * 業務画面で最も多い事故が起きる。
 */
export function buildProductWhere(sp: RawSearchParams): Prisma.ProductWhereInput {
  const q = one(sp.q).trim();
  const categoryId = Number.parseInt(one(sp.category), 10);
  const stock = toEnum(sp.stock, STOCK_FILTERS, "");
  const active = toEnum(sp.active, ACTIVE_FILTERS, "");

  const where: Prisma.ProductWhereInput = {};

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
    ];
  }

  if (Number.isInteger(categoryId)) where.categoryId = categoryId;
  if (active) where.isActive = active === "1";

  if (stock === "zero") {
    where.stockQty = { lte: 0 };
  } else if (stock === "low") {
    // 別カラムとの比較。Prisma のフィールド参照を使えば raw SQL に落とさずに書ける
    where.stockQty = { lte: prisma.product.fields.reorderPoint };
  }

  return where;
}

export function buildProductOrderBy(sort: ProductSort): Prisma.ProductOrderByWithRelationInput[] {
  switch (sort) {
    case "sku_asc":
      return [{ sku: "asc" }];
    case "stock_asc":
      return [{ stockQty: "asc" }, { name: "asc" }];
    case "stock_desc":
      return [{ stockQty: "desc" }, { name: "asc" }];
    case "price_asc":
      return [{ unitPrice: "asc" }, { name: "asc" }];
    case "price_desc":
      return [{ unitPrice: "desc" }, { name: "asc" }];
    case "updated_desc":
      return [{ updatedAt: "desc" }];
    default:
      return [{ name: "asc" }];
  }
}

export function parseProductSort(sp: RawSearchParams): ProductSort {
  return toEnum(sp.sort, PRODUCT_SORTS, "name_asc");
}
