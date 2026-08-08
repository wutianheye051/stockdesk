"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, btn, Field, input } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form";

type Option = { id: number; name: string };

type ProductValues = {
  id?: number;
  sku: string;
  name: string;
  categoryId: number | null;
  supplierId: number | null;
  costPrice: number;
  unitPrice: number;
  reorderPoint: number;
  isActive: boolean;
};

function SubmitButton({ label }: { label: string }) {
  // 二重送信を防ぐ。業務画面では「保存を2回押して重複登録」が実際によく起きる
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={btn.primary}>
      {pending ? "保存中..." : label}
    </button>
  );
}

export default function ProductForm({
  action,
  initial,
  categories,
  suppliers,
  submitLabel,
  readOnly = false,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ProductValues;
  categories: Option[];
  suppliers: Option[];
  submitLabel: string;
  readOnly?: boolean;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const err = state.errors ?? {};

  // 失敗して戻ってきたときは送信値を、それ以外は既存データを初期値にする。
  // 非制御コンポーネントは再レンダーだけでは値が変わらないので、下の grid を nonce で再マウントさせる。
  const sent = state.values;
  const def = (key: string, fallback: string | number | null | undefined) =>
    sent ? (sent[key] ?? "") : (fallback ?? "");

  return (
    <form action={formAction} className="space-y-5">
      {initial?.id !== undefined && <input type="hidden" name="id" value={initial.id} />}

      {state.message && <Alert tone={state.ok ? "info" : "error"}>{state.message}</Alert>}

      <div key={state.nonce ?? 0} className="grid gap-4 sm:grid-cols-2">
        <Field label="SKU" error={err.sku} hint="半角英数字と . _ - のみ。登録後の変更は履歴に影響します">
          <input
            name="sku"
            required
            disabled={readOnly}
            defaultValue={def("sku", initial?.sku)}
            className={input}
            placeholder="SKU-0001"
          />
        </Field>

        <Field label="商品名" error={err.name}>
          <input
            name="name"
            required
            disabled={readOnly}
            defaultValue={def("name", initial?.name)}
            className={input}
          />
        </Field>

        <Field label="カテゴリ" error={err.categoryId}>
          <select
            name="categoryId"
            disabled={readOnly}
            defaultValue={def("categoryId", initial?.categoryId)}
            className={input}
          >
            <option value="">未設定</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="仕入先" error={err.supplierId}>
          <select
            name="supplierId"
            disabled={readOnly}
            defaultValue={def("supplierId", initial?.supplierId)}
            className={input}
          >
            <option value="">未設定</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="仕入単価（円）" error={err.costPrice}>
          <input
            type="number"
            name="costPrice"
            min={0}
            step={1}
            required
            disabled={readOnly}
            defaultValue={def("costPrice", initial?.costPrice ?? 0)}
            className={`${input} tabular`}
          />
        </Field>

        <Field label="販売単価（円）" error={err.unitPrice}>
          <input
            type="number"
            name="unitPrice"
            min={0}
            step={1}
            required
            disabled={readOnly}
            defaultValue={def("unitPrice", initial?.unitPrice ?? 0)}
            className={`${input} tabular`}
          />
        </Field>

        <Field
          label="発注点"
          error={err.reorderPoint}
          hint="在庫数がこの値以下になると要発注として表示されます"
        >
          <input
            type="number"
            name="reorderPoint"
            min={0}
            step={1}
            required
            disabled={readOnly}
            defaultValue={def("reorderPoint", initial?.reorderPoint ?? 0)}
            className={`${input} tabular`}
          />
        </Field>

        <div className="flex items-end">
          <label className="flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              name="isActive"
              disabled={readOnly}
              defaultChecked={sent ? sent.isActive === "on" : (initial?.isActive ?? true)}
              className="size-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
            />
            <span className="text-sm text-zinc-700">取扱中（外すと廃番として扱う）</span>
          </label>
        </div>
      </div>

      {!readOnly && (
        <div className="flex items-center gap-2 border-t border-zinc-200 pt-4">
          <SubmitButton label={submitLabel} />
          <Link href="/products" className={btn.secondary}>
            一覧に戻る
          </Link>
        </div>
      )}
    </form>
  );
}
