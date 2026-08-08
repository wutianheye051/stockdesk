"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { MovementType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { requireEditor } from "@/lib/session";
import { failed, fieldErrors, formValues, invalid, type FormState } from "@/lib/form";

/** 失敗時に画面へ返して再表示する項目 */
const PRODUCT_FIELDS = [
  "sku",
  "name",
  "categoryId",
  "supplierId",
  "costPrice",
  "unitPrice",
  "reorderPoint",
  "isActive",
] as const;

/** select の未選択（""）は null に、数値入力は number にする */
const optionalId = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
  z.number().int().positive().nullable(),
);

const productSchema = z.object({
  sku: z
    .string()
    .trim()
    .min(1, "SKU は必須です")
    .max(32, "SKU は32文字以内で入力してください")
    .regex(/^[A-Za-z0-9._-]+$/, "SKU に使えるのは半角英数字と . _ - のみです"),
  name: z.string().trim().min(1, "商品名は必須です").max(120, "商品名は120文字以内で入力してください"),
  categoryId: optionalId,
  supplierId: optionalId,
  costPrice: z.coerce.number().int("仕入単価は整数で入力してください").min(0, "仕入単価は0以上で入力してください"),
  unitPrice: z.coerce.number().int("販売単価は整数で入力してください").min(0, "販売単価は0以上で入力してください"),
  reorderPoint: z.coerce.number().int().min(0, "発注点は0以上で入力してください"),
  isActive: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});

function parse(formData: FormData) {
  return productSchema.safeParse({
    sku: formData.get("sku"),
    name: formData.get("name"),
    categoryId: formData.get("categoryId"),
    supplierId: formData.get("supplierId"),
    costPrice: formData.get("costPrice"),
    unitPrice: formData.get("unitPrice"),
    reorderPoint: formData.get("reorderPoint"),
    isActive: formData.get("isActive"),
  });
}

function isDuplicateSku(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function createProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireEditor();
  if (!guard.ok) return { ok: false, message: guard.message };

  const parsed = parse(formData);
  if (!parsed.success) {
    return invalid(fieldErrors(parsed.error), formValues(formData, PRODUCT_FIELDS));
  }

  let newId: number;
  try {
    const created = await prisma.product.create({ data: parsed.data });
    newId = created.id;
  } catch (e) {
    if (isDuplicateSku(e)) {
      return invalid(
        { sku: "この SKU は既に登録されています" },
        formValues(formData, PRODUCT_FIELDS),
      );
    }
    throw e;
  }

  revalidatePath("/products");
  // redirect は内部で例外を投げるので try の外で呼ぶ
  redirect(`/products/${newId}`);
}

export async function updateProduct(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireEditor();
  if (!guard.ok) return { ok: false, message: guard.message };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id)) return { ok: false, message: "商品が特定できませんでした。" };

  const parsed = parse(formData);
  if (!parsed.success) {
    return invalid(fieldErrors(parsed.error), formValues(formData, PRODUCT_FIELDS));
  }

  try {
    // stockQty はここでは触らない。在庫は必ず adjustStock 経由で履歴とともに動かす
    await prisma.product.update({ where: { id }, data: parsed.data });
  } catch (e) {
    if (isDuplicateSku(e)) {
      return invalid(
        { sku: "この SKU は既に登録されています" },
        formValues(formData, PRODUCT_FIELDS),
      );
    }
    throw e;
  }

  revalidatePath("/products");
  revalidatePath(`/products/${id}`);
  return { ok: true, message: "保存しました。" };
}

const STOCK_FIELDS = ["type", "qty", "reason"] as const;

const stockSchema = z.object({
  productId: z.coerce.number().int().positive(),
  type: z.enum(["IN", "OUT", "ADJUST"]),
  qty: z.coerce.number().int().positive("数量は1以上で入力してください"),
  reason: z.string().trim().max(200).optional(),
});

/**
 * 在庫の増減。Product.stockQty の更新と StockMovement の記録は必ず同一トランザクションで行う。
 * 片方だけ成功すると「履歴を積み上げても現在庫に一致しない」状態になり、原因追跡が不可能になる。
 */
export async function adjustStock(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await requireEditor();
  if (!guard.ok) return { ok: false, message: guard.message };
  const user = guard.user;

  const parsed = stockSchema.safeParse({
    productId: formData.get("productId"),
    type: formData.get("type"),
    qty: formData.get("qty"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return invalid(fieldErrors(parsed.error), formValues(formData, STOCK_FIELDS));
  }

  const { productId, type, qty, reason } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: { stockQty: true },
      });
      if (!product) throw new Error("商品が見つかりません");

      const next =
        type === "IN"
          ? product.stockQty + qty
          : type === "OUT"
            ? product.stockQty - qty
            : qty; // ADJUST は棚卸なので実数で置き換える

      if (next < 0) {
        throw new Error(`在庫が不足しています（現在庫 ${product.stockQty} に対して ${qty} の出庫）`);
      }

      await tx.stockMovement.create({
        data: {
          productId,
          type: type as MovementType,
          qty,
          reason: reason || null,
          createdById: user.id,
        },
      });
      await tx.product.update({ where: { id: productId }, data: { stockQty: next } });
    });
  } catch (e) {
    return failed(
      e instanceof Error ? e.message : "在庫の更新に失敗しました。",
      formValues(formData, STOCK_FIELDS),
    );
  }

  revalidatePath("/products");
  revalidatePath(`/products/${productId}`);
  return { ok: true, message: "在庫を更新しました。" };
}
