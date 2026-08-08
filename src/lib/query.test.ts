import { describe, expect, it } from "vitest";
import { buildQuery, one, toEnum, toPage } from "./query";

describe("one", () => {
  it("配列で来たら先頭を採る", () => {
    expect(one(["a", "b"])).toBe("a");
  });

  it("undefined を空文字にする", () => {
    expect(one(undefined)).toBe("");
  });
});

describe("toPage", () => {
  it("正の整数はそのまま使う", () => {
    expect(toPage("3")).toBe(3);
  });

  it.each(["0", "-1", "abc", "", undefined])("不正な値 %s は 1 に落とす", (v) => {
    expect(toPage(v)).toBe(1);
  });
});

describe("toEnum", () => {
  const allowed = ["name_asc", "price_desc"] as const;

  it("許可された値は通す", () => {
    expect(toEnum("price_desc", allowed, "name_asc")).toBe("price_desc");
  });

  // ソートキーをそのまま Prisma の orderBy に渡すと任意フィールドで並べ替えられてしまう。
  // ホワイトリスト外は必ず既定値に落ちること。
  it("許可されていない値は既定値に落とす", () => {
    expect(toEnum("passwordHash", allowed, "name_asc")).toBe("name_asc");
  });
});

describe("buildQuery", () => {
  it("既存の条件を保ったままページ番号だけ差し替える", () => {
    const q = buildQuery({ q: "ペン", status: "PENDING", page: "2" }, { page: 3 });
    const params = new URLSearchParams(q.slice(1));
    expect(params.get("q")).toBe("ペン");
    expect(params.get("status")).toBe("PENDING");
    expect(params.get("page")).toBe("3");
  });

  it("undefined を渡したキーは URL から取り除く（CSV 出力で page を落とすため）", () => {
    const q = buildQuery({ q: "ペン", page: "2" }, { page: undefined });
    expect(q).toBe("?q=%E3%83%9A%E3%83%B3");
  });

  it("空の値は最初から載せない", () => {
    expect(buildQuery({ q: "", status: "" }, {})).toBe("");
  });

  it("配列で来た値も 1 本に潰す", () => {
    const q = buildQuery({ q: ["ペン", "鉛筆"] }, {});
    expect(new URLSearchParams(q.slice(1)).get("q")).toBe("ペン");
  });
});
