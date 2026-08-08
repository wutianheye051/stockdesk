import type { z } from "zod";

/**
 * サーバーアクションの戻り値。useActionState でそのまま画面に出す。
 * "use server" のファイルは async 関数しか export できないため、型とヘルパーはここに置く。
 */
export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
};

export const initialFormState: FormState = { ok: false };

/** zod のエラーを「フィールド名 → 最初のメッセージ」に畳む */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(errors: Record<string, string>, message = "入力内容を確認してください。"): FormState {
  return { ok: false, message, errors };
}
