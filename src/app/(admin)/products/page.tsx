import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser, canEdit } from "@/lib/session";
import { buildQuery, one, PER_PAGE, toPage } from "@/lib/query";
import {
  buildProductOrderBy,
  buildProductWhere,
  parseProductSort,
  PRODUCT_SORT_LABEL,
  PRODUCT_SORTS,
} from "@/lib/product-query";
import { formatNumber, formatYen } from "@/lib/format";
import { Badge, btn, Card, EmptyState, input, PageHeader, Pagination } from "@/components/ui";

export const metadata: Metadata = { title: "商品・在庫" };

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const sp = await searchParams;
  const user = await requireUser();
  const page = toPage(sp.page);
  const sort = parseProductSort(sp);
  const where = buildProductWhere(sp);

  const [products, total, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: buildProductOrderBy(sort),
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { category: true, supplier: true },
    }),
    prisma.product.count({ where }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  // CSV は今の絞り込み条件をそのまま引き継ぐ（page だけ落とす）
  const csvHref = `/api/export/products${buildQuery(sp, { page: undefined })}`;

  return (
    <>
      <PageHeader
        title="商品・在庫"
        description="商品マスタと現在庫。発注点を下回った商品は赤字で表示されます。"
        actions={
          <>
            <a href={csvHref} className={btn.secondary}>
              CSV出力
            </a>
            {canEdit(user.role) && (
              <Link href="/products/new" className={btn.primary}>
                新規登録
              </Link>
            )}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-600">
              商品名 / SKU
            </label>
            <input
              type="search"
              name="q"
              defaultValue={one(sp.q)}
              placeholder="部分一致で検索"
              className={input}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">カテゴリ</label>
            <select name="category" defaultValue={one(sp.category)} className={input}>
              <option value="">すべて</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">在庫状況</label>
            <select name="stock" defaultValue={one(sp.stock)} className={input}>
              <option value="">すべて</option>
              <option value="low">発注点以下</option>
              <option value="zero">在庫なし</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600">状態</label>
            <select name="active" defaultValue={one(sp.active)} className={input}>
              <option value="">すべて</option>
              <option value="1">取扱中</option>
              <option value="0">廃番</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-medium text-zinc-600">並び順</label>
            <select name="sort" defaultValue={sort} className={input}>
              {PRODUCT_SORTS.map((s) => (
                <option key={s} value={s}>
                  {PRODUCT_SORT_LABEL[s]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end gap-2 lg:col-span-3">
            <button type="submit" className={btn.primary}>
              絞り込む
            </button>
            <Link href="/products" className={btn.secondary}>
              条件をクリア
            </Link>
          </div>
        </form>
      </Card>

      <Card>
        {products.length === 0 ? (
          <EmptyState message="条件に一致する商品がありません。検索条件を変えてお試しください。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs text-zinc-500">
                <tr className="border-b border-zinc-200">
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">商品名</th>
                  <th className="px-4 py-2 font-medium">カテゴリ</th>
                  <th className="px-4 py-2 font-medium">仕入先</th>
                  <th className="px-4 py-2 text-right font-medium">販売単価</th>
                  <th className="px-4 py-2 text-right font-medium">在庫</th>
                  <th className="px-4 py-2 text-right font-medium">発注点</th>
                  <th className="px-4 py-2 font-medium">状態</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {products.map((p) => {
                  const low = p.stockQty <= p.reorderPoint;
                  return (
                    <tr key={p.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2 font-mono text-xs text-zinc-500">{p.sku}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/products/${p.id}`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {p.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 text-zinc-600">{p.category?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-zinc-600">{p.supplier?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular">{formatYen(p.unitPrice)}</td>
                      <td
                        className={`px-4 py-2 text-right tabular font-semibold ${
                          low ? "text-red-600" : "text-zinc-900"
                        }`}
                      >
                        {formatNumber(p.stockQty)}
                      </td>
                      <td className="px-4 py-2 text-right tabular text-zinc-500">
                        {formatNumber(p.reorderPoint)}
                      </td>
                      <td className="px-4 py-2">
                        {p.isActive ? (
                          <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
                            取扱中
                          </Badge>
                        ) : (
                          <Badge className="bg-zinc-100 text-zinc-600 ring-zinc-500/20">廃番</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} perPage={PER_PAGE} total={total} searchParams={sp} />
      </Card>
    </>
  );
}
