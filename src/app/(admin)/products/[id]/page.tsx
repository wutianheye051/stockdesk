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
import ProductForm from "@/components/ProductForm";
import StockAdjustForm from "@/components/StockAdjustForm";
import { adjustStock, updateProduct } from "../actions";

export async function generateMetadata({ params }: PageProps<"/products/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id: Number(id) },
    select: { name: true },
  });
  return { title: product?.name ?? "商品" };
}

export default async function ProductDetailPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const user = await requireUser();
  const editable = canEdit(user.role);

  const [product, categories, suppliers, movements, recentOrders] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId } }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.stockMovement.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { createdBy: { select: { name: true } } },
    }),
    prisma.orderItem.findMany({
      where: { productId },
      orderBy: { order: { orderedAt: "desc" } },
      take: 10,
      include: { order: { select: { id: true, orderNo: true, status: true, orderedAt: true, customerName: true } } },
    }),
  ]);

  if (!product) notFound();

  const low = product.stockQty <= product.reorderPoint;

  return (
    <>
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku}`}
        actions={
          <Link href="/products" className="text-sm text-zinc-600 hover:text-zinc-900">
            ← 商品一覧
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-zinc-900">
              商品情報{!editable && <span className="ml-2 font-normal text-zinc-500">（閲覧のみ）</span>}
            </h2>
            <ProductForm
              action={updateProduct}
              initial={{
                id: product.id,
                sku: product.sku,
                name: product.name,
                categoryId: product.categoryId,
                supplierId: product.supplierId,
                costPrice: product.costPrice,
                unitPrice: product.unitPrice,
                reorderPoint: product.reorderPoint,
                isActive: product.isActive,
              }}
              categories={categories}
              suppliers={suppliers}
              submitLabel="保存する"
              readOnly={!editable}
            />
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <p className="text-sm text-zinc-500">現在庫</p>
            <p className={`mt-1 text-3xl font-semibold tabular ${low ? "text-red-600" : "text-zinc-900"}`}>
              {formatNumber(product.stockQty)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              発注点 {formatNumber(product.reorderPoint)} / 在庫金額{" "}
              {formatYen(product.stockQty * product.costPrice)}
            </p>
            {low && (
              <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                発注点を下回っています。補充を検討してください。
              </p>
            )}
          </Card>

          {editable && (
            <Card className="p-6">
              <h2 className="mb-4 text-sm font-semibold text-zinc-900">在庫を動かす</h2>
              <StockAdjustForm
                action={adjustStock}
                productId={product.id}
                currentQty={product.stockQty}
              />
            </Card>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900">
            在庫履歴（直近20件）
          </h2>
          {movements.length === 0 ? (
            <EmptyState message="在庫の増減はまだありません。" />
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
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 whitespace-nowrap text-zinc-600 tabular">
                        {formatDateTime(m.createdAt)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          className={
                            m.type === "IN"
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                              : m.type === "OUT"
                                ? "bg-orange-50 text-orange-700 ring-orange-600/20"
                                : "bg-zinc-100 text-zinc-600 ring-zinc-500/20"
                          }
                        >
                          {MOVEMENT_LABEL[m.type]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right tabular font-medium">
                        {m.type === "OUT" ? "−" : m.type === "IN" ? "+" : "="}
                        {formatNumber(m.qty)}
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{m.reason ?? "—"}</td>
                      <td className="px-4 py-2 text-zinc-600">{m.createdBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="border-b border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900">
            この商品を含む受注
          </h2>
          {recentOrders.length === 0 ? (
            <EmptyState message="受注実績はまだありません。" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                  <tr className="border-b border-zinc-200">
                    <th className="px-4 py-2 font-medium">受注番号</th>
                    <th className="px-4 py-2 font-medium">取引先</th>
                    <th className="px-4 py-2 font-medium">状態</th>
                    <th className="px-4 py-2 text-right font-medium">数量</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {recentOrders.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2">
                        <Link
                          href={`/orders/${item.order.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {item.order.orderNo}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{item.order.customerName}</td>
                      <td className="px-4 py-2">
                        <Badge className={ORDER_STATUS_CLASS[item.order.status]}>
                          {ORDER_STATUS_LABEL[item.order.status]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right tabular">{formatNumber(item.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
