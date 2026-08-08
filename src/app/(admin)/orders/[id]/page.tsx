import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canEdit, requireUser } from "@/lib/session";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import {
  formatDateTime,
  formatNumber,
  formatYen,
  MOVEMENT_LABEL,
  ORDER_STATUS_CLASS,
  ORDER_STATUS_LABEL,
} from "@/lib/format";
import { ALLOWED_TRANSITIONS } from "@/lib/order-status";
import StatusActions from "@/components/StatusActions";
import { changeOrderStatus } from "../actions";

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id: Number(id) },
    select: { orderNo: true },
  });
  return { title: order?.orderNo ?? "受注" };
}

export default async function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  const orderId = Number(id);
  if (!Number.isInteger(orderId)) notFound();

  const user = await requireUser();
  const editable = canEdit(user.role);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      createdBy: { select: { name: true } },
      items: {
        include: { product: { select: { id: true, sku: true, name: true, stockQty: true } } },
        orderBy: { id: "asc" },
      },
      stockMoves: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) notFound();

  const meta = [
    { label: "受注日時", value: formatDateTime(order.orderedAt) },
    { label: "出荷日時", value: formatDateTime(order.shippedAt) },
    { label: "取引先", value: order.customerName },
    { label: "メールアドレス", value: order.customerEmail ?? "—" },
    { label: "登録者", value: order.createdBy.name },
    { label: "備考", value: order.note ?? "—" },
  ];

  return (
    <>
      <PageHeader
        title={order.orderNo}
        description={order.customerName}
        actions={
          <Link href="/orders" className="text-sm text-zinc-600 hover:text-zinc-900">
            ← 受注一覧
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900">
              明細
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr className="border-b border-zinc-200">
                    <th className="px-4 py-2 font-medium">SKU</th>
                    <th className="px-4 py-2 font-medium">商品名</th>
                    <th className="px-4 py-2 text-right font-medium">数量</th>
                    <th className="px-4 py-2 text-right font-medium">単価</th>
                    <th className="px-4 py-2 text-right font-medium">金額</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {order.items.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                        {item.product.sku}
                      </td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/products/${item.product.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {item.product.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-right tabular">{formatNumber(item.qty)}</td>
                      <td className="px-4 py-2 text-right tabular text-zinc-600">
                        {formatYen(item.unitPrice)}
                      </td>
                      <td className="px-4 py-2 text-right tabular font-medium">
                        {formatYen(item.qty * item.unitPrice)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50">
                    <td colSpan={4} className="px-4 py-3 text-right text-sm font-medium text-zinc-600">
                      合計
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold tabular text-zinc-900">
                      {formatYen(order.totalAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <Card>
            <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900">
              この受注による在庫の動き
            </h2>
            {order.stockMoves.length === 0 ? (
              <EmptyState message="まだ在庫は引き当てられていません。「確定」すると引き当てられます。" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                    <tr className="border-b border-zinc-200">
                      <th className="px-4 py-2 font-medium">日時</th>
                      <th className="px-4 py-2 font-medium">区分</th>
                      <th className="px-4 py-2 text-right font-medium">数量</th>
                      <th className="px-4 py-2 font-medium">理由</th>
                      <th className="px-4 py-2 font-medium">担当</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {order.stockMoves.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2 whitespace-nowrap text-zinc-600 tabular">
                          {formatDateTime(m.createdAt)}
                        </td>
                        <td className="px-4 py-2">
                          <Badge
                            className={
                              m.type === "IN"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                                : "bg-orange-50 text-orange-700 ring-orange-600/20"
                            }
                          >
                            {MOVEMENT_LABEL[m.type]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-right tabular">{formatNumber(m.qty)}</td>
                        <td className="px-4 py-2 text-zinc-600">{m.reason ?? "—"}</td>
                        <td className="px-4 py-2 text-zinc-600">{m.createdBy.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm text-zinc-500">状態</p>
            <div className="mt-2">
              <Badge className={`${ORDER_STATUS_CLASS[order.status]} text-sm`}>
                {ORDER_STATUS_LABEL[order.status]}
              </Badge>
            </div>
            <p className="mt-4 text-sm text-zinc-500">合計金額</p>
            <p className="mt-1 text-2xl font-semibold tabular text-zinc-900">
              {formatYen(order.totalAmount)}
            </p>
          </Card>

          {editable && (
            <Card className="p-6">
              <h2 className="mb-4 text-sm font-semibold text-zinc-900">ステータスを変更</h2>
              <StatusActions
                action={changeOrderStatus}
                orderId={order.id}
                allowed={ALLOWED_TRANSITIONS[order.status]}
              />
            </Card>
          )}

          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">受注情報</h2>
            <dl className="space-y-3">
              {meta.map((m) => (
                <div key={m.label}>
                  <dt className="text-xs text-zinc-500">{m.label}</dt>
                  <dd className="text-sm text-zinc-900">{m.value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </>
  );
}
