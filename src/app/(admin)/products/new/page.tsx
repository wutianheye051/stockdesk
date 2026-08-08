import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { canEdit, requireUser } from "@/lib/session";
import { Card, PageHeader } from "@/components/ui";
import ProductForm from "@/components/ProductForm";
import { createProduct } from "../actions";

export const metadata: Metadata = { title: "商品を新規登録" };

export default async function NewProductPage() {
  const user = await requireUser();
  // 閲覧専用アカウントには登録画面自体を見せない（アクション側でも requireEditor で二重に止める）
  if (!canEdit(user.role)) redirect("/products");

  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.supplier.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="商品を新規登録"
        description="登録直後の在庫は 0 です。入庫は登録後の商品詳細から行います。"
      />
      <Card className="max-w-3xl p-6">
        <ProductForm
          action={createProduct}
          categories={categories}
          suppliers={suppliers}
          submitLabel="登録する"
        />
      </Card>
    </>
  );
}
