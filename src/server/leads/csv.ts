import "server-only";

type ParseState = { rows: string[][]; row: string[]; field: string; quoted: boolean };

function endField(state: ParseState) {
  state.row.push(state.field);
  state.field = "";
}

function endRow(state: ParseState) {
  endField(state);
  if (state.row.some((cell) => cell !== "")) state.rows.push(state.row);
  state.row = [];
}

function readQuoted(state: ParseState, char: string, next: string): number {
  if (char !== '"') {
    state.field += char;
    return 1;
  }
  if (next === '"') {
    state.field += '"';
    return 2;
  }
  state.quoted = false;
  return 1;
}

const UNQUOTED: Record<string, (state: ParseState) => void> = {
  '"': (state) => {
    state.quoted = true;
  },
  ",": endField,
  "\n": endRow,
  "\r": () => {},
};

/** RFC 4180 CSV, as Python's csv module writes it: quoted fields, doubled quotes, CRLF or LF rows. */
export function parseCsv(text: string): Record<string, string>[] {
  const state: ParseState = { rows: [], row: [], field: "", quoted: false };
  for (let i = 0; i < text.length; ) {
    const char = text[i];
    if (state.quoted) {
      i += readQuoted(state, char, text[i + 1]);
      continue;
    }
    const handle = UNQUOTED[char];
    if (handle) handle(state);
    else state.field += char;
    i += 1;
  }
  endRow(state);
  const [header = [], ...body] = state.rows;
  const keys = header.map((key) => key.trim().replace(/^﻿/, ""));
  return body.map((cells) => Object.fromEntries(keys.map((key, index) => [key, (cells[index] ?? "").trim()])));
}
