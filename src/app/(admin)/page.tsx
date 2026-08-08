import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import {
  formatDate,
  formatNumber,
  formatYen,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
} from "@/lib/format";

export default async function DashboardPage() {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [monthly, unshipped, lowStock, recentOrders, stockValue] = await Promise.all([
    // 今月の売上（キャンセルは除く）
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      _count: true,
      where: { orderedAt: { gte: monthStart }, status: { not: "CANCELLED" } },
    }),
    prisma.order.count({ where: { status: { in: ["PENDING", "CONFIRMED"] } } }),
    // 発注点を割った有効商品。raw を使わずに済むよう、フィールド比較は $queryRaw ではなく
    // 全件取得ではなく「発注点の最大値以下」で粗く絞ってからアプリ側で判定する
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, sku: true, name: true, stockQty: true, reorderPoint: true },
      orderBy: { stockQty: "asc" },
      take: 200,
    }),
    prisma.order.findMany({
      orderBy: { orderedAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNo: true,
        customerName: true,
        status: true,
        totalAmount: true,
        orderedAt: true,
      },
    }),
    prisma.product.findMany({ select: { stockQty: true, costPrice: true } }),
  ]);

  const needsReorder = lowStock.filter((p) => p.stockQty <= p.reorderPoint);
  const totalStockValue = stockValue.reduce((sum, p) => sum + p.stockQty * p.costPrice, 0);

  const stats = [
    { label: "今月の受注金額", value: formatYen(monthly._sum.totalAmount ?? 0), sub: `${monthly._count} 件` },
    { label: "未出荷の受注", value: `${formatNumber(unshipped)} 件`, sub: "受付済・確定" },
    {
      label: "要発注の商品",
      value: `${formatNumber(needsReorder.length)} 件`,
      sub: "在庫が発注点以下",
      alert: needsReorder.length > 0,
    },
    { label: "在庫金額（原価）", value: formatYen(totalStockValue), sub: "全商品の合計" },
  ];

  return (
    <>
      <PageHeader title="ダッシュボード" description="今月の状況と、対応が必要な項目" />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-sm text-zinc-500">{s.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold tabular ${
                s.alert ? "text-red-600" : "text-zinc-900"
              }`}
            >
              {s.value}
            </p>
            <p className="mt-1 text-xs text-zinc-500">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">要発注リスト</h2>
            <Link href="/products?stock=low" className="text-sm text-zinc-600 hover:text-zinc-900">
              すべて見る →
            </Link>
          </div>
          {needsReorder.length === 0 ? (
            <EmptyState message="発注点を下回っている商品はありません。" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-2 font-medium">商品</th>
                  <th className="px-4 py-2 text-right font-medium">在庫</th>
                  <th className="px-4 py-2 text-right font-medium">発注点</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {needsReorder.slice(0, 8).map((p) => (
                  <tr key={p.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link href={`/products/${p.id}`} className="font-medium text-zinc-900 hover:underline">
                        {p.name}
                      </Link>
                      <span className="ml-2 text-xs text-zinc-400">{p.sku}</span>
                    </td>
                    <td className="px-4 py-2 text-right tabular font-semibold text-red-600">
                      {formatNumber(p.stockQty)}
                    </td>
                    <td className="px-4 py-2 text-right tabular text-zinc-500">
                      {formatNumber(p.reorderPoint)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">直近の受注</h2>
            <Link href="/orders" className="text-sm text-zinc-600 hover:text-zinc-900">
              すべて見る →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr className="border-b border-zinc-200">
                <th className="px-4 py-2 font-medium">受注番号</th>
                <th className="px-4 py-2 font-medium">取引先</th>
                <th className="px-4 py-2 font-medium">状態</th>
                <th className="px-4 py-2 text-right font-medium">金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-zinc-50">
                  <td className="px-4 py-2">
                    <Link href={`/orders/${o.id}`} className="font-medium text-zinc-900 hover:underline">
                      {o.orderNo}
                    </Link>
                    <span className="ml-2 text-xs text-zinc-400">{formatDate(o.orderedAt)}</span>
                  </td>
                  <td className="px-4 py-2 text-zinc-700">{o.customerName}</td>
                  <td className="px-4 py-2">
                    <Badge className={ORDER_STATUS_CLASS[o.status]}>
                      {ORDER_STATUS_LABEL[o.status]}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right tabular">{formatYen(o.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
