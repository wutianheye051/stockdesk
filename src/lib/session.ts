import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
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

/**
 * 更新系サーバーアクションの入口で必ず呼ぶ。
 * 画面側でボタンを隠すだけでは、アクションを直接叩かれると素通りするため。
 */
export async function requireEditor(): Promise<SessionUser> {
  const user = await requireUser();
  if (!canEdit(user.role)) throw new Error("この操作を行う権限がありません（閲覧専用アカウント）");
  return user;
}
