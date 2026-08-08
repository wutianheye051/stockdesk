import type { z } from "zod";

/**
 * サーバーアクションの戻り値。useActionState でそのまま画面に出す。
 * "use server" のファイルは async 関数しか export できないため、型とヘルパーはここに置く。
 */
export type FormState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
  /**
   * 失敗時に送信された入力値。画面はこれを defaultValue に使って再表示する。
   * これが無いと、SKU 重複などで弾かれるたびに全項目を入力し直させることになる。
   */
  values?: Record<string, string>;
  /**
   * 送信ごとに変わる値。フォーム側はこれを key に使って再マウントし、
   * 更新後の defaultValue を反映させる（非制御コンポーネントは再レンダーだけでは値が変わらない）。
   */
  nonce?: number;
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

/** FormData から指定キーを文字列として抜き出す（再表示用） */
export function formValues(formData: FormData, keys: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const v = formData.get(key);
    out[key] = typeof v === "string" ? v : "";
  }
  return out;
}

// nonce は values がある時だけ付ける。
// 値を返さないのに再マウントさせると、フォームが初期値まで戻って逆効果になる。
export function invalid(
  errors: Record<string, string>,
  values?: Record<string, string>,
  message = "入力内容を確認してください。",
): FormState {
  return values
    ? { ok: false, message, errors, values, nonce: Date.now() }
    : { ok: false, message, errors };
}

/** バリデーション以外の失敗（在庫不足・権限など）。入力値は保持する */
export function failed(message: string, values?: Record<string, string>): FormState {
  return values ? { ok: false, message, values, nonce: Date.now() } : { ok: false, message };
}
