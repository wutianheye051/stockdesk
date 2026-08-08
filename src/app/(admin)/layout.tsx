import Link from "next/link";
import { signOut } from "@/lib/auth";
import { requireUser } from "@/lib/session";
import { ROLE_LABEL } from "@/lib/format";
import NavLink from "@/components/NavLink";

const NAV = [
  { href: "/", label: "ダッシュボード" },
  { href: "/products", label: "商品・在庫" },
  { href: "/orders", label: "受注" },
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/">) {
  // 管理画面配下の唯一の入口。ここを通らないページを作らないこと。
  const user = await requireUser();

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-base font-semibold tracking-tight text-zinc-900">
            StockDesk
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-zinc-900">{user.name}</p>
              <p className="text-xs text-zinc-500">{ROLE_LABEL[user.role]}</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
