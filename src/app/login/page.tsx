import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { auth, signIn } from "@/lib/auth";
import { Alert, btn, Card, Field, input } from "@/components/ui";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // ログイン済みなら素通りさせる
  const session = await auth();
  if (session?.user) redirect("/");

  const params = await searchParams;
  const failed = params.error !== undefined;

  async function login(formData: FormData) {
    "use server";

    // signIn に遷移を任せない（redirect: false）。
    // 任せると失敗時も Auth.js 自身が pages.signIn へリダイレクトしてしまい、
    // こちらでエラー表示に切り替える余地がなくなる（「失敗しても何も出ない」状態になる）。
    //
    // なお この版の signIn は認証失敗を例外で投げず、遷移先URLを文字列で返す。
    // 失敗時のURLには error パラメータが付くので、それで判定する。
    // セッションCookieは redirect の指定に関係なく signIn 内で設定されるため、
    // redirect: false にしてもログイン自体は成立する。
    let ok = false;
    try {
      const result = await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirect: false,
      });
      ok =
        typeof result === "string" &&
        !new URL(result, "http://localhost").searchParams.has("error");
    } catch (error) {
      // AuthError 以外（想定外の不具合）は握りつぶさず、そのまま出す
      if (!(error instanceof AuthError)) throw error;
      ok = false;
    }

    // redirect() は例外を投げるので try の外で呼ぶ
    redirect(ok ? "/" : "/login?error=1");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-100 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">StockDesk</h1>
          <p className="mt-1 text-sm text-zinc-500">受注・在庫管理</p>
        </div>

        <Card className="p-6">
          <form action={login} className="space-y-4">
            {failed && <Alert>メールアドレスまたはパスワードが正しくありません。</Alert>}

            <Field label="メールアドレス">
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                defaultValue="admin@example.com"
                className={input}
              />
            </Field>

            <Field label="パスワード">
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                defaultValue="password123"
                className={input}
              />
            </Field>

            <button type="submit" className={`${btn.primary} w-full`}>
              ログイン
            </button>
          </form>
        </Card>

        <Card className="mt-4 p-4">
          <p className="mb-2 text-xs font-medium text-zinc-700">デモ用アカウント（パスワード共通: password123）</p>
          <ul className="space-y-1 text-xs text-zinc-600">
            <li>
              <code className="rounded bg-zinc-100 px-1">admin@example.com</code> — 管理者（全操作）
            </li>
            <li>
              <code className="rounded bg-zinc-100 px-1">staff@example.com</code> — 担当者（登録・更新）
            </li>
            <li>
              <code className="rounded bg-zinc-100 px-1">viewer@example.com</code> — 閲覧のみ（更新不可）
            </li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
