import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canEdit, requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui";
import OrderForm from "@/components/OrderForm";
import { createOrder } from "../actions";

export const metadata: Metadata = { title: "受注を新規登録" };

export default async function NewOrderPage() {
  const user = await requireUser();
  if (!canEdit(user.role)) redirect("/orders");

  // 廃番の商品は受注できないので選択肢に出さない
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, sku: true, name: true, unitPrice: true, stockQty: true },
  });

  return (
    <>
      <PageHeader
        title="受注を新規登録"
        description="登録時点では在庫は引き当てられません。詳細画面で「確定」した時点で引き当てます。"
      />
      <div className="max-w-4xl">
        <OrderForm action={createOrder} products={products} />
      </div>
    </>
  );
}
