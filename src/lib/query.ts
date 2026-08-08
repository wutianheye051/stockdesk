export const PER_PAGE = 20;

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** searchParams は string | string[] | undefined で来るので必ず1本の string に潰す */
export function one(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

export function toPage(v: string | string[] | undefined): number {
  const n = Number.parseInt(one(v), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/**
 * 許可した値以外は既定値に落とす。
 * ソートキーをそのまま Prisma の orderBy に渡すと任意フィールドで並べ替えられてしまうため、
 * 一覧ごとにホワイトリストを持たせる。
 */
export function toEnum<T extends string>(
  v: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const s = one(v);
  return (allowed as readonly string[]).includes(s) ? (s as T) : fallback;
}

/** 現在の検索条件を保ったままページ番号などを差し替えた querystring を作る */
export function buildQuery(
  current: RawSearchParams,
  overrides: Record<string, string | number | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    const s = one(value);
    if (s) params.set(key, s);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
