import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const testFiles = readdirSync(testsDir).filter((name) => name.endsWith(".test.js")).sort();

let passed = 0;
let failed = 0;

for (const file of testFiles) {
  const mod = await import(`./${file}`);
  for (const [name, fn] of mod.tests || []) {
    try {
      await fn();
      passed += 1;
      console.log(`ok - ${file} > ${name}`);
    } catch (err) {
      failed += 1;
      console.error(`FAIL - ${file} > ${name}`);
      console.error(err);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
