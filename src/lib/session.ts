import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/enums";

export type SessionUser = { id: string; name?: string | null; email?: string | null; role: Role };

const RANK: Record<Role, number> = { VIEWER: 0, STAFF: 1, ADMIN: 2 };

export function canEdit(role: Role): boolean {
  return RANK[role] >= RANK.STAFF;
}

/** 未ログインならログイン画面へ飛ばす。管理画面のレイアウトで一度だけ呼ぶ */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

export type EditorGuard = { ok: true; user: SessionUser } | { ok: false; message: string };

/**
 * 更新系サーバーアクションの入口で必ず呼ぶ。
 *
 * 画面側でボタンを隠すだけでは、アクションを直接叩かれると素通りする。
 * さらに、権限は JWT ではなく DB の現在値で判定する。JWT は最大8時間有効なので、
 * トークンだけを信じると「無効化・降格された直後のユーザーが残り時間ぶん書き込み続けられる」
 * ことになる。参照系は JWT だけで済ませ、更新系のみこの追加クエリを負担する。
 */
export async function requireEditor(): Promise<EditorGuard> {
  const session = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return { ok: false, message: "アカウントが無効になっています。ログインし直してください。" };
  }
  if (!canEdit(user.role)) {
    return { ok: false, message: "この操作を行う権限がありません（閲覧専用アカウント）。" };
  }

  return { ok: true, user };
}
