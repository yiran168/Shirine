import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "client/package.json"));
const ts = require("typescript");
const svelte = require("svelte/compiler");
const { default: svelteConfig } = await import(pathToFileURL(path.join(root, "client/svelte.config.js")).href);
const astroRequire = createRequire(require.resolve("astro/package.json"));
const { parse: parseAstro } = astroRequire("@astrojs/compiler-rs");
const extensions = new Set([".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".cjs", ".svelte", ".astro", ".html", ".css", ".styl", ".sql", ".json", ".jsonc", ".yml", ".toml"]);
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(target) : extensions.has(path.extname(target)) ? [target] : [];
  });
}
const paths = ["client/src", "client/public", "server/src", "docs/theme", "docs/docs", "scripts", "test", ".github"].flatMap(p => walk(path.join(root, p)));
for (const dir of ["", "client", "server", "docs"]) {
  paths.push(...fs.readdirSync(path.join(root, dir), { withFileTypes: true }).filter(e => e.isFile() && extensions.has(path.extname(e.name))).map(e => path.join(root, dir, e.name)));
}
const results = [];
for (const file of [...new Set(paths)].sort()) {
  if (path.relative(root, file).replaceAll("\\", "/") === "server/wrangler.json") continue; // generated deployment output
  const source = fs.readFileSync(file, "utf8");
  const ext = path.extname(file);
  const entry = { path: path.relative(root, file).replaceAll("\\", "/"), sha256: createHash("sha256").update(source).digest("hex"), lines: source.split(/\r?\n/).length, checks: ["inventory", "sensitive-operation scan"], errors: [], operations: [] };
  try {
    if ([".ts", ".tsx", ".mts", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
      const kind = ext === ".tsx" ? ts.ScriptKind.TSX : ext === ".jsx" ? ts.ScriptKind.JSX : [".js", ".mjs", ".cjs"].includes(ext) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
      entry.checks.push("TypeScript/JavaScript syntax");
      entry.errors.push(...ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, " ")));
    } else if (ext === ".svelte") {
      const processed = await svelte.preprocess(source, svelteConfig.preprocess, { filename: file });
      svelte.parse(processed.code, { modern: true });
      entry.checks.push("Svelte syntax");
    } else if (ext === ".astro") {
      await parseAstro(source);
      entry.checks.push("Astro syntax");
    } else if (ext === ".json") {
      JSON.parse(source); entry.checks.push("JSON syntax");
    } else if (ext === ".html") {
      for (const match of source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
        const ast = ts.createSourceFile(file, match[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
        entry.errors.push(...ast.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, " ")));
      }
      entry.checks.push("HTML inline JavaScript syntax");
    }
  } catch (error) { entry.errors.push(String(error.message)); }
  const patterns = { html: /(?:set:html|\{@html|innerHTML\s*=|insertAdjacentHTML)/, execution: /(?:\beval\(|new Function\(|execSync\(|Bun\.spawn)/, network: /\bfetch\(/, sql: /(?:\.prepare\(|sql\.raw\()/, mutation: /Router\.(?:post|put|patch|delete)\(/, sharedState: /^(?:let|const) (?:cached|inFlight|activeRuntime)/ };
  source.split(/\r?\n/).forEach((line, i) => {
    for (const [kind, pattern] of Object.entries(patterns)) if (pattern.test(line)) entry.operations.push({ kind, line: i + 1 });
  });
  results.push(entry);
}
fs.mkdirSync(path.join(root, ".cache"), { recursive: true });
fs.writeFileSync(path.join(root, ".cache/source-audit.json"), JSON.stringify(results, null, 2));
const errors = results.filter(f => f.errors.length);
console.log(JSON.stringify({ files: results.length, lines: results.reduce((n, f) => n + f.lines, 0), syntaxChecked: results.filter(f => f.checks.some(c => c.endsWith("syntax"))).length, errors: errors.map(f => ({ path: f.path, errors: f.errors })), operationFiles: results.filter(f => f.operations.length).length }, null, 2));
if (errors.length) process.exitCode = 1;
