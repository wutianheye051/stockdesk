import { describe, expect, it } from "vitest";
import { toCsv, type CsvColumn } from "./csv";

type Row = { name: string; qty: number; note: string | null };

const columns: CsvColumn<Row>[] = [
  { header: "商品名", value: (r) => r.name },
  { header: "数量", value: (r) => r.qty },
  { header: "備考", value: (r) => r.note },
];

/** BOM とヘッダー行を落として、データ行だけを配列で返す */
function dataLines(csv: string): string[] {
  return csv.replace(/^﻿/, "").trimEnd().split("\r\n").slice(1);
}

describe("toCsv", () => {
  it("Excel が UTF-8 と判定できるよう BOM を先頭に付ける", () => {
    const csv = toCsv([], columns);
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("RFC 4180 どおり CRLF で改行する", () => {
    const csv = toCsv([{ name: "ペン", qty: 1, note: null }], columns);
    expect(csv).toContain("\r\n");
    expect(csv.replace(/\r\n/g, "")).not.toContain("\n");
  });

  it("カンマを含む値をクォートする", () => {
    const csv = toCsv([{ name: "ペン, 黒", qty: 1, note: null }], columns);
    expect(dataLines(csv)[0]).toBe('"ペン, 黒",1,');
  });

  it("値の中の二重引用符を 2 個に増やす", () => {
    const csv = toCsv([{ name: 'ペン"特価"', qty: 1, note: null }], columns);
    expect(dataLines(csv)[0]).toBe('"ペン""特価""",1,');
  });

  it("改行を含む値をクォートして 1 セルに収める", () => {
    const csv = toCsv([{ name: "ペン", qty: 1, note: "1行目\n2行目" }], columns);
    expect(dataLines(csv)[0]).toBe('ペン,1,"1行目\n2行目"');
  });

  it("null と undefined を空欄にする", () => {
    const csv = toCsv([{ name: "ペン", qty: 0, note: null }], columns);
    expect(dataLines(csv)[0]).toBe("ペン,0,");
  });

  it("真偽値を日本語にする", () => {
    const csv = toCsv([{ name: "ペン", qty: 1, note: null }], [
      { header: "要発注", value: () => true },
      { header: "廃番", value: () => false },
    ]);
    expect(dataLines(csv)[0]).toBe("はい,いいえ");
  });

  // CSV インジェクション: Excel は = で始まるセルを数式として実行する。
  // 取引先名などユーザー入力がそのまま入る列があるので、ここは必ず潰しておく。
  it.each(["=1+1", "+1", "-1", "@SUM(A1)"])("数式として実行され得る %s を無害化する", (payload) => {
    const csv = toCsv([{ name: payload, qty: 1, note: null }], columns);
    expect(dataLines(csv)[0].startsWith("'")).toBe(true);
  });

  it("無害化した値がカンマも含む場合、クォートの内側に ' が入る", () => {
    const csv = toCsv([{ name: "=1,2", qty: 1, note: null }], columns);
    expect(dataLines(csv)[0]).toBe(`"'=1,2",1,`);
  });

  it("行が無くてもヘッダー行は出す", () => {
    const csv = toCsv([], columns);
    expect(csv.replace(/^﻿/, "").trimEnd()).toBe("商品名,数量,備考");
  });
});
