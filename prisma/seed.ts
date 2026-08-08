import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { MovementType, OrderStatus, Role } from "../src/generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

// 毎回同じデータが出るよう、乱数は固定シードの LCG で回す（デモの再現性のため）
let seedState = 20260808;
function rand(): number {
  seedState = (seedState * 1103515245 + 12345) % 2147483648;
  return seedState / 2147483648;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const range = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

const CATEGORIES = ["文具", "オフィス家具", "電子機器", "梱包資材", "衛生用品"];
const SUPPLIERS = [
  ["丸和商事", "sales@example.com"],
  ["東京サプライ", "info@example.com"],
  ["ニシムラ物産", "order@example.com"],
  ["ケイズ・トレーディング", "cs@example.com"],
] as const;

const PRODUCT_NAMES: Record<string, string[]> = {
  文具: ["油性ボールペン 0.7mm 黒", "蛍光マーカー 5色セット", "クリアファイル A4 100枚", "強力ホッチキス", "付箋 75×75mm 10冊"],
  オフィス家具: ["昇降デスク 120cm", "メッシュチェア 肘付", "書庫 A4 3段", "パーテーション 90cm", "モニターアーム 2軸"],
  電子機器: ["USB-C ケーブル 2m", "電源タップ 6口 雷ガード", "外付SSD 1TB", "ワイヤレスマウス", "USBハブ 4ポート"],
  梱包資材: ["段ボール 160サイズ 20枚", "OPPテープ 48mm 10巻", "気泡緩衝材 600mm×42m", "宅配袋 A4 100枚", "PPバンド 15mm"],
  衛生用品: ["アルコール除菌液 5L", "ペーパータオル 200組 30個", "ゴミ袋 45L 100枚", "不織布マスク 50枚", "ハンドソープ 詰替 1L"],
};

const CUSTOMERS = [
  "株式会社アオイ電機", "有限会社ミドリ工業", "セントラル物流株式会社", "医療法人 かえで会",
  "株式会社ハヤブサ商会", "つばき製菓株式会社", "北斗システムズ株式会社", "合同会社スミレ企画",
  "株式会社ヤマト包装", "みらい建設株式会社",
];

async function main() {
  console.log("既存データを削除中...");
  await prisma.stockMovement.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  console.log("ユーザーを作成中...");
  const passwordHash = bcrypt.hashSync("password123", 10);
  const [admin, staff] = await Promise.all([
    prisma.user.create({
      data: { email: "admin@example.com", name: "管理 太郎", passwordHash, role: Role.ADMIN },
    }),
    prisma.user.create({
      data: { email: "staff@example.com", name: "担当 花子", passwordHash, role: Role.STAFF },
    }),
    prisma.user.create({
      data: { email: "viewer@example.com", name: "閲覧 次郎", passwordHash, role: Role.VIEWER },
    }),
  ]);
  const operators = [admin, staff];

  console.log("マスタを作成中...");
  const categories = await Promise.all(
    CATEGORIES.map((name) => prisma.category.create({ data: { name } })),
  );
  const suppliers = await Promise.all(
    SUPPLIERS.map(([name, contact]) => prisma.supplier.create({ data: { name, contact } })),
  );

  console.log("商品を作成中...");
  const products = [];
  let skuSeq = 1;
  for (const category of categories) {
    for (const name of PRODUCT_NAMES[category.name]) {
      const costPrice = range(1, 60) * 100;
      const product = await prisma.product.create({
        data: {
          sku: `SKU-${String(skuSeq++).padStart(4, "0")}`,
          name,
          categoryId: category.id,
          supplierId: pick(suppliers).id,
          costPrice,
          unitPrice: Math.round((costPrice * (1.25 + rand() * 0.5)) / 10) * 10,
          reorderPoint: range(5, 30),
          // 1割ほどは廃番にして「有効/無効の絞り込み」が意味を持つようにする
          isActive: rand() > 0.1,
        },
      });
      products.push(product);
    }
  }

  console.log("初期入庫を登録中...");
  // 受注を作る際に在庫を割り込ませないよう、現在庫をメモリ上で追いかける
  const stockMap = new Map<number, number>();
  for (const product of products) {
    const qty = range(0, 120);
    stockMap.set(product.id, qty);
    if (qty === 0) continue; // 一部は在庫ゼロ＝要発注として残す
    await prisma.$transaction([
      prisma.stockMovement.create({
        data: {
          productId: product.id,
          type: MovementType.IN,
          qty,
          reason: "期首棚卸",
          createdById: admin.id,
        },
      }),
      prisma.product.update({ where: { id: product.id }, data: { stockQty: qty } }),
    ]);
  }

  console.log("受注を作成中...");
  const statuses = [
    OrderStatus.PENDING, OrderStatus.PENDING,
    OrderStatus.CONFIRMED, OrderStatus.CONFIRMED, OrderStatus.CONFIRMED,
    OrderStatus.SHIPPED, OrderStatus.SHIPPED, OrderStatus.SHIPPED, OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
  ];
  const sellable = products.filter((p) => p.isActive);

  for (let i = 1; i <= 60; i++) {
    const status = pick(statuses);
    // 直近120日にばらす
    const orderedAt = new Date(Date.now() - range(0, 120) * 86_400_000 - range(0, 23) * 3_600_000);
    const operator = pick(operators);

    // 同一商品が重複しないよう Set で選ぶ（@@unique([orderId, productId]) 制約があるため）
    const chosen = new Map<number, number>();
    for (let n = range(1, 4); n > 0; n--) {
      const p = pick(sellable);
      if (!chosen.has(p.id)) chosen.set(p.id, range(1, 12));
    }

    let items = [...chosen.entries()].map(([productId, qty]) => ({
      productId,
      qty,
      unitPrice: sellable.find((p) => p.id === productId)!.unitPrice,
    }));

    // 引当が発生する状態なら、在庫を超えないよう数量を丸める。
    // アプリ側（adjustStock）が在庫マイナスを禁止しているので、シードもその不変条件を守る。
    let effectiveStatus = status;
    if (status === OrderStatus.CONFIRMED || status === OrderStatus.SHIPPED) {
      items = items
        .map((it) => ({ ...it, qty: Math.min(it.qty, stockMap.get(it.productId) ?? 0) }))
        .filter((it) => it.qty > 0);

      // 在庫がまったく足りない受注は「受付済（未引当）」として残す。実務でも起きる状態
      if (items.length === 0) {
        effectiveStatus = OrderStatus.PENDING;
        items = [...chosen.entries()].map(([productId, qty]) => ({
          productId,
          qty,
          unitPrice: sellable.find((p) => p.id === productId)!.unitPrice,
        }));
      }
    }

    const totalAmount = items.reduce((sum, it) => sum + it.qty * it.unitPrice, 0);

    const order = await prisma.order.create({
      data: {
        orderNo: `SO-2026-${String(i).padStart(4, "0")}`,
        customerName: pick(CUSTOMERS),
        customerEmail: `order${i}@example.com`,
        status: effectiveStatus,
        totalAmount,
        orderedAt,
        shippedAt:
          effectiveStatus === OrderStatus.SHIPPED
            ? new Date(orderedAt.getTime() + range(1, 5) * 86_400_000)
            : null,
        note: rand() > 0.8 ? "納品書を同梱してください" : null,
        createdById: operator.id,
        items: { create: items },
      },
    });

    // 引当済（CONFIRMED / SHIPPED）だけ在庫を引く
    if (effectiveStatus === OrderStatus.CONFIRMED || effectiveStatus === OrderStatus.SHIPPED) {
      for (const item of items) {
        stockMap.set(item.productId, (stockMap.get(item.productId) ?? 0) - item.qty);
        await prisma.$transaction([
          prisma.stockMovement.create({
            data: {
              productId: item.productId,
              type: MovementType.OUT,
              qty: item.qty,
              reason: `受注 ${order.orderNo}`,
              orderId: order.id,
              createdById: operator.id,
            },
          }),
          prisma.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.qty } },
          }),
        ]);
      }
    }
  }

  const counts = {
    ユーザー: await prisma.user.count(),
    商品: await prisma.product.count(),
    受注: await prisma.order.count(),
    在庫履歴: await prisma.stockMovement.count(),
  };
  console.log("完了:", counts);
  console.log("ログイン: admin@example.com / staff@example.com / viewer@example.com  パスワードはすべて password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
