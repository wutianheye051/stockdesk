"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { MovementType, OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { fieldErrors, invalid, type FormState } from "@/lib/form";
import { canTransition, isAllocated, statusLabel } from "@/lib/order-status";

// ---------------------------------------------------------------- 受注登録

const orderSchema = z.object({
  customerName: z.string().trim().min(1, "取引先名は必須です").max(120),
  customerEmail: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "メールアドレスの形式が正しくありません"),
  note: z.string().trim().max(500).optional(),
});

const itemSchema = z
  .array(
    z.object({
      productId: z.number().int().positive(),
      qty: z.number().int().positive(),
    }),
  )
  .min(1, "明細を1行以上入力してください");

/** 同じ商品が複数行に分かれていたら1行にまとめる（@@unique([orderId, productId]) 対策） */
function mergeItems(raw: { productId: number; qty: number }[]) {
  const merged = new Map<number, number>();
  for (const it of raw) merged.set(it.productId, (merged.get(it.productId) ?? 0) + it.qty);
  return [...merged.entries()].map(([productId, qty]) => ({ productId, qty }));
}

/** SO-2026-0001 形式。同一年内の最大値 + 1 */
async function nextOrderNo(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const latest = await tx.order.findFirst({
    where: { orderNo: { startsWith: prefix } },
    orderBy: { orderNo: "desc" },
    select: { orderNo: true },
  });
  const seq = latest ? Number.parseInt(latest.orderNo.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export async function createOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor();

  const parsed = orderSchema.safeParse({
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail") ?? "",
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const productIds = formData.getAll("productId").map((v) => Number(v));
  const quantities = formData.getAll("qty").map((v) => Number(v));
  const rawItems = productIds
    .map((productId, i) => ({ productId, qty: quantities[i] ?? 0 }))
    // 空行（商品未選択）は無視する
    .filter((it) => Number.isInteger(it.productId) && it.productId > 0 && it.qty > 0);

  const itemsParsed = itemSchema.safeParse(rawItems);
  if (!itemsParsed.success) {
    return { ok: false, message: itemsParsed.error.issues[0]?.message ?? "明細が不正です。" };
  }
  const items = mergeItems(itemsParsed.data);

  let newId: number;
  try {
    newId = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map((i) => i.productId) } },
        select: { id: true, unitPrice: true, isActive: true, name: true },
      });
      if (products.length !== items.length) throw new Error("存在しない商品が含まれています");

      const inactive = products.find((p) => !p.isActive);
      if (inactive) throw new Error(`廃番の商品は受注できません: ${inactive.name}`);

      const priceOf = new Map(products.map((p) => [p.id, p.unitPrice]));
      const lines = items.map((it) => ({
        productId: it.productId,
        qty: it.qty,
        // 受注時点の単価を焼き込む。後でマスタが値上げされても過去の受注額は動かない
        unitPrice: priceOf.get(it.productId)!,
      }));

      const order = await tx.order.create({
        data: {
          orderNo: await nextOrderNo(tx),
          customerName: parsed.data.customerName,
          customerEmail: parsed.data.customerEmail || null,
          note: parsed.data.note || null,
          // 登録直後は必ず「受付済」。在庫は確定操作で初めて引き当てる
          status: OrderStatus.PENDING,
          totalAmount: lines.reduce((sum, l) => sum + l.qty * l.unitPrice, 0),
          createdById: user.id,
          items: { create: lines },
        },
        select: { id: true },
      });
      return order.id;
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "受注の登録に失敗しました。" };
  }

  revalidatePath("/orders");
  redirect(`/orders/${newId}`);
}

// ------------------------------------------------------- ステータス変更

const statusSchema = z.object({
  orderId: z.coerce.number().int().positive(),
  to: z.enum(["PENDING", "CONFIRMED", "SHIPPED", "CANCELLED"]),
});

/**
 * 受注のステータスを変える。在庫の引当／引当戻しを同一トランザクションで行う。
 *   PENDING   → CONFIRMED : 在庫を引く（不足していれば失敗させる）
 *   CONFIRMED → SHIPPED   : 在庫は動かさない（引当済のため）
 *   CONFIRMED → CANCELLED : 引当を戻す
 *   PENDING   → CANCELLED : 在庫は動かさない
 */
export async function changeOrderStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireEditor();

  const parsed = statusSchema.safeParse({
    orderId: formData.get("orderId"),
    to: formData.get("to"),
  });
  if (!parsed.success) return invalid(fieldErrors(parsed.error));

  const { orderId, to } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: { include: { product: { select: { name: true, stockQty: true } } } } },
      });
      if (!order) throw new Error("受注が見つかりません");

      if (!canTransition(order.status, to)) {
        throw new Error(`「${statusLabel(order.status)}」から「${statusLabel(to)}」へは変更できません`);
      }

      const wasAllocated = isAllocated(order.status);
      const willBeAllocated = isAllocated(to);

      if (!wasAllocated && willBeAllocated) {
        // 引当: 先に全明細の在庫を確認してから引く（途中で落ちて半端に減るのを防ぐ）
        const short = order.items.find((it) => it.product.stockQty < it.qty);
        if (short) {
          throw new Error(
            `在庫が不足しています: ${short.product.name}（必要 ${short.qty} / 在庫 ${short.product.stockQty}）`,
          );
        }
        for (const it of order.items) {
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              type: MovementType.OUT,
              qty: it.qty,
              reason: `受注確定 ${order.orderNo}`,
              orderId: order.id,
              createdById: user.id,
            },
          });
          await tx.product.update({
            where: { id: it.productId },
            data: { stockQty: { decrement: it.qty } },
          });
        }
      } else if (wasAllocated && !willBeAllocated) {
        // 引当戻し
        for (const it of order.items) {
          await tx.stockMovement.create({
            data: {
              productId: it.productId,
              type: MovementType.IN,
              qty: it.qty,
              reason: `受注キャンセル ${order.orderNo}`,
              orderId: order.id,
              createdById: user.id,
            },
          });
          await tx.product.update({
            where: { id: it.productId },
            data: { stockQty: { increment: it.qty } },
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: to,
          shippedAt: to === OrderStatus.SHIPPED ? new Date() : order.shippedAt,
        },
      });
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "ステータスの変更に失敗しました。" };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/products");
  return { ok: true, message: "ステータスを変更しました。" };
}
