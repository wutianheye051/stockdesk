import { describe, expect, it } from "vitest";
import { OrderStatus } from "@/generated/prisma/enums";
import { ALLOWED_TRANSITIONS, canTransition, isAllocated } from "./order-status";

const ALL = Object.values(OrderStatus);

describe("canTransition", () => {
  it("受付済からは確定とキャンセルにだけ進める", () => {
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CONFIRMED)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.PENDING, OrderStatus.SHIPPED)).toBe(false);
  });

  it("確定からは出荷済とキャンセルにだけ進める", () => {
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.SHIPPED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.CANCELLED)).toBe(true);
    expect(canTransition(OrderStatus.CONFIRMED, OrderStatus.PENDING)).toBe(false);
  });

  it.each([OrderStatus.SHIPPED, OrderStatus.CANCELLED])("%s は終端で、どこへも進めない", (from) => {
    for (const to of ALL) expect(canTransition(from, to)).toBe(false);
  });

  it("自分自身への遷移は許さない（二重確定で在庫が二重に引かれるのを防ぐ）", () => {
    for (const s of ALL) expect(canTransition(s, s)).toBe(false);
  });

  it("定義に無い遷移はすべて false", () => {
    for (const from of ALL) {
      for (const to of ALL) {
        expect(canTransition(from, to)).toBe(ALLOWED_TRANSITIONS[from].includes(to));
      }
    }
  });
});

describe("isAllocated", () => {
  it("確定と出荷済は在庫を引き当てている", () => {
    expect(isAllocated(OrderStatus.CONFIRMED)).toBe(true);
    expect(isAllocated(OrderStatus.SHIPPED)).toBe(true);
  });

  it("受付済とキャンセルは引き当てていない", () => {
    expect(isAllocated(OrderStatus.PENDING)).toBe(false);
    expect(isAllocated(OrderStatus.CANCELLED)).toBe(false);
  });

  // 引当あり↔なしの境界をまたぐ遷移だけが在庫を動かす。
  // 確定→出荷済で在庫が二重に引かれないことの根拠になる。
  it("確定から出荷済は引当状態が変わらない＝在庫は動かない", () => {
    expect(isAllocated(OrderStatus.CONFIRMED)).toBe(isAllocated(OrderStatus.SHIPPED));
  });
});
