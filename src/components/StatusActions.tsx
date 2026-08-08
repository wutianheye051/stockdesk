"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { OrderStatus } from "@/generated/prisma/enums";
import { Alert, btn } from "@/components/ui";
import { initialFormState, type FormState } from "@/lib/form";
import { TRANSITION_UI } from "@/lib/order-status";

function TransitionButton({ to }: { to: OrderStatus }) {
  const { pending } = useFormStatus();
  const ui = TRANSITION_UI[to];
  return (
    <button
      type="submit"
      name="to"
      value={to}
      disabled={pending}
      className={ui.tone === "danger" ? btn.danger : btn.primary}
    >
      {ui.label}
    </button>
  );
}

/**
 * 遷移可能な状態のぶんだけボタンを出す。
 * どれを押したかは submit ボタンの name/value で FormData に載る。
 */
export default function StatusActions({
  action,
  orderId,
  allowed,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  orderId: number;
  allowed: OrderStatus[];
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  if (allowed.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        この状態からは変更できません。
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      {state.message && <Alert tone={state.ok ? "info" : "error"}>{state.message}</Alert>}
      <div className="flex flex-wrap gap-2">
        {allowed.map((to) => (
          <TransitionButton key={to} to={to} />
        ))}
      </div>
    </form>
  );
}
