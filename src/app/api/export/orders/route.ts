import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { csvResponse, timestampedFilename, toCsv, type CsvColumn } from "@/lib/csv";
import { buildOrderOrderBy, buildOrderWhere, parseOrderSort } from "@/lib/order-query";
import { ORDER_STATUS_LABEL } from "@/lib/format";
import { one, type RawSearchParams } from "@/lib/query";

const MAX_ROWS = 50_000;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries()) as RawSearchParams;
  // detail=1 で明細行まで展開する。会計・分析にはこちらが要ることが多い
  const detail = one(sp.detail) === "1";

  const orders = await prisma.order.findMany({
    where: buildOrderWhere(sp),
    orderBy: buildOrderOrderBy(parseOrderSort(sp)),
    take: MAX_ROWS,
    include: {
      createdBy: { select: { name: true } },
      items: { include: { product: { select: { sku: true, name: true } } } },
    },
  });

  if (!detail) {
    type Row = (typeof orders)[number];
    const columns: CsvColumn<Row>[] = [
      { header: "受注番号", value: (o) => o.orderNo },
      { header: "受注日時", value: (o) => o.orderedAt },
      { header: "取引先", value: (o) => o.customerName },
      { header: "メールアドレス", value: (o) => o.customerEmail ?? "" },
      { header: "状態", value: (o) => ORDER_STATUS_LABEL[o.status] },
      { header: "明細数", value: (o) => o.items.length },
      { header: "合計金額", value: (o) => o.totalAmount },
      { header: "出荷日時", value: (o) => o.shippedAt },
      { header: "登録者", value: (o) => o.createdBy.name },
      { header: "備考", value: (o) => o.note ?? "" },
    ];
    return csvResponse(toCsv(orders, columns), timestampedFilename("受注一覧"));
  }

  const rows = orders.flatMap((o) =>
    o.items.map((item) => ({ order: o, item })),
  );
  type DetailRow = (typeof rows)[number];

  const columns: CsvColumn<DetailRow>[] = [
    { header: "受注番号", value: (r) => r.order.orderNo },
    { header: "受注日時", value: (r) => r.order.orderedAt },
    { header: "取引先", value: (r) => r.order.customerName },
    { header: "状態", value: (r) => ORDER_STATUS_LABEL[r.order.status] },
    { header: "SKU", value: (r) => r.item.product.sku },
    { header: "商品名", value: (r) => r.item.product.name },
    { header: "数量", value: (r) => r.item.qty },
    { header: "単価", value: (r) => r.item.unitPrice },
    { header: "金額", value: (r) => r.item.qty * r.item.unitPrice },
  ];

  return csvResponse(toCsv(rows, columns), timestampedFilename("受注明細"));
}
