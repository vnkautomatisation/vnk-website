// Resolves every t("key") call against the FR catalogue.
//
// TypeScript never sees these: a missing key only fails at render time, and
// then only on the page that uses it. This walks the source instead.
//
// Binding rules mirror next-intl:
//   useTranslations("ns")                        -> keys resolve under ns
//   getTranslations({ locale, namespace: "ns" }) -> same
//   useTranslations() / getTranslations({ locale }) -> root translator, keys
//                                                     must carry their namespace
// A factory parameter `(t: (k: string) => string)` shadows the declaration
// above it and takes its namespace from the caller, so it is left unchecked.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const CATALOGUE = join("messages", "fr");
const SRC = "src";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

// messages/fr/admin/team.json -> tree.admin.team
function loadCatalogue() {
  const tree = {};
  for (const file of walk(CATALOGUE)) {
    if (!file.endsWith(".json")) continue;
    const parts = relative(CATALOGUE, file).split(sep);
    parts[parts.length - 1] = parts[parts.length - 1].slice(0, -5);
    let node = tree;
    for (const seg of parts.slice(0, -1)) node = (node[seg] ??= {});
    node[parts[parts.length - 1]] = JSON.parse(readFileSync(file, "utf8"));
  }
  return tree;
}

const TREE = loadCatalogue();

function resolve(segments) {
  let node = TREE;
  for (const seg of segments) {
    if (typeof node !== "object" || node === null || !(seg in node)) return undefined;
    node = node[seg];
  }
  return node;
}

const BIND = /\b(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:use|get)Translations\(([^;]*?)\)\s*;/g;
const PARAM = /\(\s*(\w+)\s*:\s*\(k: string\) => string\s*\)/g;
const CALL = /\b(\w+)(?:\.(?:rich|has|markup|raw))?\(\s*"([a-z0-9_][a-z0-9_.]*)"/g;
const NS_STRING = /^\s*"([^"]*)"\s*$/;
const NS_OBJECT = /namespace:\s*"([^"]+)"/;

const problems = [];

for (const file of walk(SRC)) {
  if (!/\.tsx?$/.test(file)) continue;
  const src = readFileSync(file, "utf8");

  const binds = [];
  for (const m of src.matchAll(BIND)) {
    const asString = NS_STRING.exec(m[2]);
    const asObject = NS_OBJECT.exec(m[2]);
    binds.push([m.index, m[1], asString ? asString[1] : asObject ? asObject[1] : ""]);
  }
  for (const m of src.matchAll(PARAM)) binds.push([m.index, m[1], null]);
  if (binds.length === 0) continue;
  binds.sort((a, b) => a[0] - b[0]);

  const boundAt = (name, pos) => {
    let ns;
    for (const [off, v, n] of binds) {
      if (v === name && off < pos) ns = n;
    }
    return ns;
  };

  for (const m of src.matchAll(CALL)) {
    const ns = boundAt(m[1], m.index);
    if (ns === undefined || ns === null) continue;
    const prefix = ns ? ns.split(".") : [];
    const line = src.slice(0, m.index).split("\n").length;
    if (prefix.length > 0 && resolve(prefix) === undefined) {
      problems.push([file, line, m[1], ns, m[2], "unknown namespace"]);
      continue;
    }
    const value = resolve([...prefix, ...m[2].split(".")]);
    if (value === undefined) problems.push([file, line, m[1], ns || "<root>", m[2], "missing key"]);
    else if (typeof value === "object") problems.push([file, line, m[1], ns || "<root>", m[2], "key is a namespace"]);
  }
}

for (const [file, line, v, ns, key, why] of problems) {
  console.log(`${file}:${line}  ${v}[${ns}]("${key}")  ${why}`);
}
console.log(`${problems.length} broken key${problems.length === 1 ? "" : "s"}`);
process.exit(problems.length > 0 ? 1 : 0);
