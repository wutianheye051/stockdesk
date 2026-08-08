"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, btn, Card, Field, input } from "@/components/ui";
import { formatYen } from "@/lib/format";
import { initialFormState, type FormState } from "@/lib/form";

export type ProductOption = {
  id: number;
  sku: string;
  name: string;
  unitPrice: number;
  stockQty: number;
};

type Line = { key: number; productId: string; qty: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btn.primary}>
      {pending ? "登録中..." : "受注を登録"}
    </button>
  );
}

export default function OrderForm({
  action,
  products,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  products: ProductOption[];
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const [lines, setLines] = useState<Line[]>([{ key: 1, productId: "", qty: "1" }]);
  const err = state.errors ?? {};

  const byId = new Map(products.map((p) => [String(p.id), p]));

  const addLine = () =>
    setLines((prev) => [...prev, { key: Math.max(0, ...prev.map((l) => l.key)) + 1, productId: "", qty: "1" }]);

  const removeLine = (key: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));

  const update = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const total = lines.reduce((sum, l) => {
    const p = byId.get(l.productId);
    const qty = Number.parseInt(l.qty, 10);
    return sum + (p && Number.isFinite(qty) && qty > 0 ? p.unitPrice * qty : 0);
  }, 0);

  return (
    <form action={formAction} className="space-y-6">
      {state.message && <Alert tone={state.ok ? "info" : "error"}>{state.message}</Alert>}

      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900">取引先</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="取引先名" error={err.customerName}>
            <input name="customerName" required maxLength={120} className={input} />
          </Field>
          <Field label="メールアドレス" error={err.customerEmail} hint="任意">
            <input type="email" name="customerEmail" maxLength={200} className={input} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="備考" error={err.note} hint="任意。納品時の指示など">
              <input name="note" maxLength={500} className={input} />
            </Field>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-900">明細</h2>
          <button type="button" onClick={addLine} className={btn.secondary}>
            + 行を追加
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line) => {
            const product = byId.get(line.productId);
            const qty = Number.parseInt(line.qty, 10);
            const shortage = product && Number.isFinite(qty) && qty > product.stockQty;

            return (
              <div key={line.key} className="grid gap-2 sm:grid-cols-12 sm:items-end">
                <div className="sm:col-span-6">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">商品</label>
                  <select
                    name="productId"
                    value={line.productId}
                    onChange={(e) => update(line.key, { productId: e.target.value })}
                    className={input}
                  >
                    <option value="">選択してください</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}（{p.sku} / 在庫 {p.stockQty}）
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">数量</label>
                  <input
                    type="number"
                    name="qty"
                    min={1}
                    step={1}
                    value={line.qty}
                    onChange={(e) => update(line.key, { qty: e.target.value })}
                    className={`${input} tabular`}
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="mb-1 block text-xs font-medium text-zinc-600">金額</label>
                  <p className="px-1 py-2 text-sm tabular text-zinc-900">
                    {product && Number.isFinite(qty) && qty > 0
                      ? formatYen(product.unitPrice * qty)
                      : "—"}
                  </p>
                </div>

                <div className="sm:col-span-1">
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length === 1}
                    className="w-full rounded-md border border-zinc-300 px-2 py-2 text-sm text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40"
                    aria-label="この行を削除"
                  >
                    削除
                  </button>
                </div>

                {shortage && (
                  <p className="text-xs text-amber-700 sm:col-span-12">
                    在庫が不足しています（在庫 {product.stockQty}）。登録はできますが、確定時に在庫が足りないと引き当てに失敗します。
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-end gap-3 border-t border-zinc-200 pt-4">
          <span className="text-sm text-zinc-600">合計</span>
          <span className="text-lg font-semibold tabular text-zinc-900">{formatYen(total)}</span>
        </div>
      </Card>

      <div className="flex items-center gap-2">
        <SubmitButton />
        <Link href="/orders" className={btn.secondary}>
          一覧に戻る
        </Link>
      </div>
    </form>
  );
}
