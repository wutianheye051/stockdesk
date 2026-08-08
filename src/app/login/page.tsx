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
    try {
      await signIn("credentials", {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        redirectTo: "/",
      });
    } catch (error) {
      // signIn は成功時に redirect を throw するので、それは握りつぶさず再送出する
      if (error instanceof AuthError) redirect("/login?error=1");
      throw error;
    }
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
