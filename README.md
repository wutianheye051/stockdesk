# StockDesk — 受注・在庫管理の管理画面

中小規模の卸・小売を想定した社内向け管理画面です。商品マスタ、在庫、受注を1画面群で扱い、
**在庫は必ず履歴（StockMovement）と一緒に動く**という制約を軸に設計しています。

Excel と手作業の運用を置き換える、いわゆる「社内ツール」の典型形を一通り含みます。

---

## 何ができるか

| 機能 | 内容 |
|---|---|
| 認証 | メール + パスワード（Auth.js v5 / JWT セッション） |
| 権限 | 管理者 / 担当者 / 閲覧のみ の3ロール。閲覧のみは更新系を一切実行できない |
| 商品マスタ | 登録・編集・廃番。SKU 一意制約、発注点の設定 |
| 在庫 | 入庫 / 出庫 / 棚卸調整。**すべて履歴に残る**。在庫マイナスは発生しない |
| 受注 | 明細を複数行持つ受注の登録。受注時点の単価を焼き込む |
| 受注ステータス | 受付済 → 確定 → 出荷済 / キャンセル。**確定で在庫を引き当て、キャンセルで戻す** |
| 一覧 / 検索 | 部分一致検索、カテゴリ・状態・在庫状況・期間での絞り込み、ソート、ページング |
| CSV 出力 | 画面の絞り込み条件をそのまま引き継ぐ。受注は明細行に展開した形式も出力可 |
| ダッシュボード | 今月の受注金額、未出荷件数、要発注リスト、在庫金額 |

### デモ用アカウント

| メールアドレス | 権限 | できること |
|---|---|---|
| `admin@example.com` | 管理者 | 全操作 |
| `staff@example.com` | 担当者 | 商品・受注・在庫の登録／更新 |
| `viewer@example.com` | 閲覧のみ | 閲覧と CSV 出力のみ |

パスワードは共通で `password123` です。

---

## 技術スタック

- **Next.js 16**（App Router / Server Components / Server Actions）
- **TypeScript**（strict）
- **Prisma 7** + **PostgreSQL 17**（driver adapter は `@prisma/adapter-pg`）
- **Auth.js v5**（Credentials プロバイダ、JWT セッション）
- **Tailwind CSS v4**
- **Zod**（サーバー側の入力検証）
- **Vitest**（ロジックの単体テスト）

クライアント JS はナビゲーションのハイライトとフォームの動的行追加のみで、
データ取得と更新はすべてサーバー側で完結させています。

---

## 設計上の判断

実装で迷いやすい箇所について、何を選んだかと理由を残しています。

### 金額を `Decimal` ではなく `Int`（円）で持つ

JPY に小数は存在しません。`Decimal` を使うと Prisma が `Decimal` オブジェクトを返すため、
Server Component から Client Component へ渡すときにシリアライズの問題が発生します。
円を整数で持てばこの問題自体が消え、丸め誤差も原理的に起きません。

### 在庫は「現在値」と「履歴」の二重管理にする

`Product.stockQty` は `StockMovement` の積み上げ結果です。冗長ですが、
一覧で全商品の在庫を出すたびに履歴を集計するのは現実的ではありません。

そのかわり **`stockQty` の更新と `StockMovement` の作成は必ず同一トランザクション内で行う**
という制約を置いています。片方だけ成功すると「履歴を積んでも現在庫に一致しない」状態になり、
原因追跡が不可能になるためです。在庫を直接書き換えるコードはリポジトリ内に存在しません。

### 受注ステータスの遷移をテーブルで定義する

`src/lib/order-status.ts` の `ALLOWED_TRANSITIONS` に許可された遷移だけを定義し、
サーバーアクション側で必ず検証します。

画面のボタンを出し分けるだけでは、リクエストを直接投げられたときに
「確定済みの受注をもう一度確定して在庫が二重に引かれる」といった不正な状態に落ちます。
判定ロジックは単体テストで全組み合わせを網羅しています。

### 一覧と CSV 出力で絞り込み条件を共有する

`buildProductWhere` / `buildOrderWhere` を一覧画面と CSV エクスポート API の両方から呼びます。
別々に書くと「画面では 12 件なのに CSV は 30 件出る」という、業務画面で最も多い事故が起きます。

### ソートキーはホワイトリストで受ける

`sort` パラメータをそのまま Prisma の `orderBy` に渡すと、任意のフィールドで並べ替えができてしまいます。
`toEnum()` で許可された値以外は既定値に落としています。

### CSV は Excel で開かれる前提で作る

- **UTF-8 BOM を付ける** — 付けないと Excel が Shift_JIS と誤認して日本語が化けます
- **改行は CRLF**（RFC 4180）
- **`=` `+` `-` `@` で始まるセルを無害化する** — Excel はこれらを数式として実行します。
  取引先名などユーザー入力がそのまま入る列があるため、CSV インジェクションの対策が必要です

### 権限チェックを画面とアクションの両方で行い、更新系は DB の現在値で判定する

画面側では閲覧専用ユーザーにボタンを出さず、サーバーアクションの入口では `requireEditor()` で再度検証します。
画面の出し分けは UX のためのもので、認可の実装ではありません。

さらに、**更新系の権限判定は JWT ではなく DB の現在値**で行います。
JWT セッションは最大8時間有効なので、トークンだけを信じると
「退職・降格の処理をした直後のユーザーが、残り時間ぶん書き込みを続けられる」ことになります。
参照系は JWT のみで完結させ、この追加クエリは更新系だけが負担します。

### フォームは失敗しても入力値を捨てない

バリデーションエラーや SKU 重複で弾かれたとき、送信値を `FormState.values` に載せて返し、
画面側はそれを初期値として再表示します。非制御コンポーネントは再レンダーだけでは値が変わらないため、
`nonce` を `key` にしてフィールド群を再マウントさせています。

10 項目を入力し終えてから「その SKU は登録済みです」と言われて全部消えるのは、
業務画面としては使いものになりません。

---

## セットアップ

前提: Node.js 20 以上、Docker（ローカル DB 用）

```bash
# 1. 依存パッケージ
npm install

# 2. 環境変数
cp .env.example .env
#    AUTH_SECRET を生成して .env に設定する
npx auth secret

# 3. PostgreSQL を起動（ホスト側 5433 番）
npm run db:up

# 4. スキーマ適用 + デモデータ投入
npx prisma migrate dev
npm run db:seed

# 5. 起動
npm run dev
```

`http://localhost:3000` を開き、上のデモ用アカウントでログインします。

### npm スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（型チェックを含む） |
| `npm test` | 単体テスト |
| `npm run db:up` | ローカル PostgreSQL を起動 |
| `npm run db:down` | ローカル PostgreSQL を停止 |
| `npm run db:deploy` | 既存のマイグレーションを適用（本番向け） |
| `npm run db:seed` | デモデータを投入 |
| `npm run db:reset` | DB を作り直してシードまで実行 |

---

## デプロイ（Vercel + Neon）

`src/generated/prisma` はリポジトリに含めていないため、`build` スクリプトで `prisma generate` を実行しています。
Vercel 側は追加設定なしでビルドできます。

必要な環境変数は2つだけです。

| 変数 | 値 |
|---|---|
| `DATABASE_URL` | Neon の **Pooled connection** 文字列（ホスト名に `-pooler` が入っている方） |
| `AUTH_SECRET` | `npx auth secret` で生成した値。**ローカルとは別の値にする** |

サーバーレス環境では実行単位ごとに接続プールができるため、
`src/lib/prisma.ts` で `max: 10` / `idleTimeoutMillis: 1000` を指定し、
プーラー側が先に接続を切って `Connection terminated unexpectedly` になるのを避けています。

マイグレーションとデモデータの投入は、ローカルから本番 DB を指して一度だけ実行します。

```bash
# 一時的に本番 DB を指す（Direct connection 文字列を使う）
DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" npx prisma migrate deploy
DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" npm run db:seed
```

---

## テスト

```bash
npm test
```

DB を必要としないロジックを対象にしています。

- `src/lib/csv.test.ts` — エスケープ、BOM、改行コード、CSV インジェクション対策
- `src/lib/query.test.ts` — ページ番号・ソートキーの正規化、検索条件を保った URL 生成
- `src/lib/order-status.test.ts` — 受注ステータス遷移の全組み合わせ

---

## ディレクトリ構成

```
prisma/
  schema.prisma          データモデル
  seed.ts                デモデータ生成（乱数は固定シードで再現可能）
src/
  app/
    (admin)/             認証必須の管理画面。layout.tsx が唯一の入口
      products/          商品・在庫
      orders/            受注
    api/export/          CSV 出力
    login/               ログイン
  components/            画面部品
  lib/
    prisma.ts            PrismaClient（接続プール設定込み）
    auth.ts              Auth.js 設定
    session.ts           認証・認可ヘルパー
    csv.ts               CSV 生成
    query.ts             searchParams の正規化
    product-query.ts     商品の絞り込み条件（一覧と CSV で共有）
    order-query.ts       受注の絞り込み条件（一覧と CSV で共有）
    order-status.ts      受注ステータスの遷移定義
```

---

## 今後の拡張余地

実案件で最初に足りなくなる部分を挙げておきます。

- 受注明細の編集（現状は登録後の明細変更に未対応）
- 仕入・発注業務（発注点を割った商品からの発注書作成）
- 監査ログ（誰がいつ何を変更したか。在庫は履歴があるが、マスタ変更は未記録）
- ユーザー管理画面（現状はシードでのみ作成）
- 楽観ロック（同一商品を同時編集した場合の上書き防止）
