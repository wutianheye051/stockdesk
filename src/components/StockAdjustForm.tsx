"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Alert, btn, Field, input } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${btn.primary} w-full`}>
      {pending ? "更新中..." : "在庫を更新"}
    </button>
  );
}

export default function StockAdjustForm({
  action,
  productId,
  currentQty,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  productId: number;
  currentQty: number;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="productId" value={productId} />

      {state.message && <Alert tone={state.ok ? "info" : "error"}>{state.message}</Alert>}

      <Field label="区分">
        <select name="type" defaultValue="IN" className={input}>
          <option value="IN">入庫（現在庫に加算）</option>
          <option value="OUT">出庫（現在庫から減算）</option>
          <option value="ADJUST">棚卸調整（実数で置き換え）</option>
        </select>
      </Field>

      <Field
        label="数量"
        error={state.errors?.qty}
        hint={`現在庫は ${currentQty.toLocaleString("ja-JP")} 個です`}
      >
        <input
          type="number"
          name="qty"
          min={1}
          step={1}
          required
          defaultValue={1}
          className={`${input} tabular`}
        />
      </Field>

      <Field label="理由" hint="任意。棚卸・破損・返品など、後から追える言葉で残します">
        <input name="reason" maxLength={200} className={input} placeholder="例: 棚卸差異の修正" />
      </Field>

      <SubmitButton />
    </form>
  );
}
