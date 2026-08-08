import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvResponse, timestampedFilename, toCsv, type CsvColumn } from "@/lib/csv";
import {
  buildProductOrderBy,
  buildProductWhere,
  parseProductSort,
} from "@/lib/product-query";
import type { RawSearchParams } from "@/lib/query";

// 一度に吐ける上限。これを超える規模になったらストリーミングに切り替える
const MAX_ROWS = 50_000;

type Row = Awaited<ReturnType<typeof fetchRows>>[number];

async function fetchRows(sp: RawSearchParams) {
  return prisma.product.findMany({
    where: buildProductWhere(sp),
    orderBy: buildProductOrderBy(parseProductSort(sp)),
    take: MAX_ROWS,
    include: { category: true, supplier: true },
  });
}

const COLUMNS: CsvColumn<Row>[] = [
  { header: "SKU", value: (p) => p.sku },
  { header: "商品名", value: (p) => p.name },
  { header: "カテゴリ", value: (p) => p.category?.name ?? "" },
  { header: "仕入先", value: (p) => p.supplier?.name ?? "" },
  { header: "仕入単価", value: (p) => p.costPrice },
  { header: "販売単価", value: (p) => p.unitPrice },
  { header: "在庫数", value: (p) => p.stockQty },
  { header: "発注点", value: (p) => p.reorderPoint },
  { header: "要発注", value: (p) => p.stockQty <= p.reorderPoint },
  { header: "在庫金額(原価)", value: (p) => p.stockQty * p.costPrice },
  { header: "状態", value: (p) => (p.isActive ? "取扱中" : "廃番") },
  { header: "更新日時", value: (p) => p.updatedAt },
];

export async function GET(request: Request) {
  // API は画面と別入口なので、ここでも必ず認証する
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(
    new URL(request.url).searchParams.entries(),
  ) as RawSearchParams;

  const rows = await fetchRows(sp);
  return csvResponse(toCsv(rows, COLUMNS), timestampedFilename("商品在庫一覧"));
}
