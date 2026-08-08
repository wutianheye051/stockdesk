import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { canEdit, requireUser } from "@/lib/session";
import { buildQuery, one, PER_PAGE, toPage } from "@/lib/query";
import {
  buildOrderOrderBy,
  buildOrderWhere,
  ORDER_SORT_LABEL,
  ORDER_SORTS,
  parseOrderSort,
} from "@/lib/order-query";
import { formatDate, formatYen, ORDER_STATUS_CLASS, ORDER_STATUS_LABEL } from "@/lib/format";
import { Badge, btn, Card, EmptyState, input, PageHeader, Pagination } from "@/components/ui";

export const metadata: Metadata = { title: "受注" };

export default async function OrdersPage({ searchParams }: PageProps<"/orders">) {
  const sp = await searchParams;
  const user = await requireUser();
  const page = toPage(sp.page);
  const sort = parseOrderSort(sp);
  const where = buildOrderWhere(sp);

  const [orders, total, sum] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: buildOrderOrderBy(sort),
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: {
        createdBy: { select: { name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
    // 絞り込み後の合計金額。業務画面では「今の条件で合計いくらか」がすぐ要る
    prisma.order.aggregate({ where, _sum: { totalAmount: true } }),
  ]);

  const csvHref = `/api/export/orders${buildQuery(sp, { page: undefined })}`;

  return (
    <>
      <PageHeader
        title="受注"
        description="受注の一覧。確定すると在庫が引き当てられます。"
        actions={
          <>
            <a href={csvHref} className={btn.secondary}>
              CSV出力
            </a>
            <a href={`${csvHref}${csvHref.includes("?") ? "&" : "?"}detail=1`} className={btn.secondary}>
              CSV出力（明細）
            </a>
            {canEdit(user.role) && (
              <Link href="/orders/new" className={btn.primary}>
                新規登録
              </Link>
            )}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-600">受注番号 / 取引先</label>
            <input
              type="search"
              name="q"
              defaultValue={one(sp.q)}
              placeholder="部分一致で検索"
              className={input}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">状態</label>
            <select name="status" defaultValue={one(sp.status)} className={input}>
              <option value="">すべて</option>
              <option value="PENDING">受付済</option>
              <option value="CONFIRMED">確定</option>
              <option value="SHIPPED">出荷済</option>
              <option value="CANCELLED">キャンセル</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">受注日（から）</label>
            <input type="date" name="from" defaultValue={one(sp.from)} className={input} />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">受注日（まで）</label>
            <input type="date" name="to" defaultValue={one(sp.to)} className={input} />
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-600">並び順</label>
            <select name="sort" defaultValue={sort} className={input}>
              {ORDER_SORTS.map((s) => (
                <option key={s} value={s}>
                  {ORDER_SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 lg:col-span-3">
            <button type="submit" className={btn.primary}>
              絞り込む
            </button>
            <Link href="/orders" className={btn.secondary}>
              条件をクリア
            </Link>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2">
          <span className="text-xs text-zinc-500">絞り込み結果の合計</span>
          <span className="text-sm font-semibold tabular text-zinc-900">
            {formatYen(sum._sum.totalAmount ?? 0)}
          </span>
        </div>

        {orders.length === 0 ? (
          <EmptyState message="条件に一致する受注がありません。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-2 font-medium">受注番号</th>
                  <th className="px-4 py-2 font-medium">受注日</th>
                  <th className="px-4 py-2 font-medium">取引先</th>
                  <th className="px-4 py-2 font-medium">状態</th>
                  <th className="px-4 py-2 text-right font-medium">明細数</th>
                  <th className="px-4 py-2 text-right font-medium">金額</th>
                  <th className="px-4 py-2 font-medium">登録者</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-zinc-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/orders/${o.id}`}
                        className="font-mono text-xs font-medium text-zinc-900 hover:underline"
                      >
                        {o.orderNo}
                      </Link>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-zinc-600 tabular">
                      {formatDate(o.orderedAt)}
                    </td>
                    <td className="px-4 py-2 text-zinc-900">{o.customerName}</td>
                    <td className="px-4 py-2">
                      <Badge className={ORDER_STATUS_CLASS[o.status]}>
                        {ORDER_STATUS_LABEL[o.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-right tabular text-zinc-600">{o._count.items}</td>
                    <td className="px-4 py-2 text-right tabular font-medium">
                      {formatYen(o.totalAmount)}
                    </td>
                    <td className="px-4 py-2 text-zinc-600">{o.createdBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} perPage={PER_PAGE} total={total} searchParams={sp} />
      </Card>
    </>
  );
}
