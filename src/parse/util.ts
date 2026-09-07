import fs from "node:fs";

/** Match `"Key":` / `'Key':` / `Key:` after leading comments/whitespace. */
export const ENTRY_KEY_RE =
  /^\s*(?:\/\/[^\n]*\n|\/\*[\s\S]*?\*\/|\s)*(?:"([^"]+)"|'([^']+)'|([A-Za-z_$][\w$]*))\s*:/;

export function readText(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing source file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

export function matchEntryKey(
  entry: string,
): { key: string; rhs: string } | null {
  const m = entry.match(ENTRY_KEY_RE);
  if (!m || m.index === undefined) return null;
  const key = m[1] ?? m[2] ?? m[3];
  if (!key) return null;
  return { key, rhs: entry.slice(m.index + m[0].length).trim() };
}

export function parseObjectKey(entry: string): string | null {
  return matchEntryKey(entry)?.key ?? null;
}

/** Inner body of the first `{ ... }` in `text` (brace-balanced, no string awareness). */
export function extractBalancedObjectBody(text: string): string | null {
  const open = text.indexOf("{");
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return null;
}

/** Extract object literal body after `export const NAME ... = {`. */
export function extractConstObjectBody(
  src: string,
  constName: string,
): string {
  // Word boundary so `FISH` does not match `FISH_COOKABLES`
  const re = new RegExp(`export\\s+const\\s+${constName}\\b`);
  const m = re.exec(src);
  if (!m || m.index === undefined) {
    throw new Error(`Could not find export const ${constName}`);
  }
  const start = m.index;
  let eqIdx = src.indexOf("> =", start);
  if (eqIdx === -1 || eqIdx - start > 400) {
    eqIdx = src.indexOf("=", start);
  }
  const body = extractBalancedObjectBody(src.slice(eqIdx));
  if (body === null) {
    throw new Error(`Could not find object body for ${constName}`);
  }
  return body;
}

/** Split a top-level object body into entry chunks on commas at depth 0. */
export function splitTopLevelEntries(body: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let lineStart = 0;
  let inStr: '"' | "'" | "`" | null = null;
  let escape = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    const next = body[i + 1];

    if (lineComment) {
      if (c === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (c === "*" && next === "/") {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === inStr) inStr = null;
      continue;
    }

    if (c === "/" && next === "/") {
      lineComment = true;
      i++;
      continue;
    }
    if (c === "/" && next === "*") {
      blockComment = true;
      i++;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      inStr = c;
      continue;
    }
    if (c === "{" || c === "[" || c === "(") depth++;
    else if (c === "}" || c === "]" || c === ")") depth--;
    if (depth === 0 && c === ",") {
      entries.push(body.slice(lineStart, i));
      lineStart = i + 1;
    }
  }
  entries.push(body.slice(lineStart));
  return entries;
}

/** Parse `"Name": 123` style numeric map entries. */
export function parseNameNumberMap(
  src: string,
  constName: string,
): Record<string, number> {
  const body = extractConstObjectBody(src, constName);
  const out: Record<string, number> = {};

  for (const entry of splitTopLevelEntries(body)) {
    const matched = matchEntryKey(entry);
    if (!matched) continue;
    const num = Number(matched.rhs.replace(/,$/, "").trim());
    if (!Number.isFinite(num)) continue;
    out[matched.key] = num;
  }
  return out;
}

export function byIdAsc(
  a: readonly [string, number],
  b: readonly [string, number],
): number {
  return a[1] - b[1];
}
