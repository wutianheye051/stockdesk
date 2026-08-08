/**
 * CSV 生成。Excel で開かれる前提の実務仕様に寄せてある。
 *  - UTF-8 BOM を付ける（付けないと Excel が Shift_JIS と誤認して日本語が化ける）
 *  - 改行は CRLF（RFC 4180）
 *  - "=" "+" "-" "@" 始まりのセルは先頭に "'" を足して数式として実行されるのを防ぐ（CSV インジェクション対策）
 */

const RISKY_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";

  let s: string;
  if (value instanceof Date) {
    s = formatDateTime(value);
  } else if (typeof value === "boolean") {
    s = value ? "はい" : "いいえ";
  } else {
    s = String(value);
  }

  if (RISKY_PREFIX.test(s)) s = `'${s}`;

  // 区切り文字・引用符・改行を含むならクォートし、内部の " は "" にする
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;

  return s;
}

/** ローカルタイム（JST 想定）で "YYYY-MM-DD HH:mm" に整形する */
export function formatDateTime(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => unknown;
};

export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines: string[] = [columns.map((c) => escapeCell(c.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(c.value(row))).join(","));
  }
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** ブラウザにダウンロードさせる Response を作る。ファイル名は日本語を含みうるので RFC 5987 で渡す */
export function csvResponse(csv: string, filename: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}

/** 例: 商品一覧_20260808-1432.csv */
export function timestampedFilename(base: string): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${base}_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.csv`;
}
