import Link from "next/link";
import type { ReactNode } from "react";
import { buildQuery, type RawSearchParams } from "@/lib/query";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-zinc-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  );
}

export const btn = {
  primary:
    "inline-flex items-center justify-center rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex items-center justify-center rounded-md border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50",
};

export const input =
  "block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100";

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-zinc-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-4 py-16 text-center text-sm text-zinc-500">
      {message}
    </div>
  );
}

export function Alert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "info" }) {
  const cls =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-sky-200 bg-sky-50 text-sky-800";
  return <div className={`rounded-md border px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

/**
 * ページ送り。検索条件を落とさないよう、既存の searchParams を引き継いだ URL を作る。
 * 総件数が分かっているので「N件中 x〜y件」まで出す（業務画面では件数が分からないと困る）。
 */
export function Pagination({
  page,
  perPage,
  total,
  searchParams,
}: {
  page: number;
  perPage: number;
  total: number;
  searchParams: RawSearchParams;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-4 py-3">
      <p className="text-sm text-zinc-600 tabular">
        {total.toLocaleString("ja-JP")} 件中 {from.toLocaleString("ja-JP")}–
        {to.toLocaleString("ja-JP")} 件を表示
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={buildQuery(searchParams, { page: page - 1 })} className={btn.secondary}>
            前へ
          </Link>
        ) : (
          <span className={`${btn.secondary} pointer-events-none opacity-40`}>前へ</span>
        )}
        <span className="text-sm text-zinc-600 tabular">
          {page} / {lastPage}
        </span>
        {page < lastPage ? (
          <Link href={buildQuery(searchParams, { page: page + 1 })} className={btn.secondary}>
            次へ
          </Link>
        ) : (
          <span className={`${btn.secondary} pointer-events-none opacity-40`}>次へ</span>
        )}
      </div>
    </div>
  );
}
