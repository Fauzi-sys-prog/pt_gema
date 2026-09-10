/**
 * Fixes misplaced useEscapeKey imports injected inside multi-line import blocks.
 * Pattern to fix: `import {\nimport { useEscapeKey ... };\n`
 * Fix: move the useEscapeKey import to AFTER the closing `} from '...';` of the block.
 */
import { readFileSync, writeFileSync } from 'fs';
import { globSync } from 'glob';

const files = globSync('src/**/*.tsx', { cwd: process.cwd() });
let fixed = 0;

for (const rel of files) {
  const src = readFileSync(rel, 'utf8');

  // Check if this file has the broken pattern
  if (!src.includes("import {\nimport { useEscapeKey")) continue;

  // Extract the misplaced line
  const escapeLine = src.match(/import \{ useEscapeKey \} from '[^']+';/)?.[0];
  if (!escapeLine) continue;

  // Step 1: Remove the misplaced import line (and the blank line before/after it if present)
  let out = src.replace('\nimport { useEscapeKey' + src.match(/\nimport \{ useEscapeKey [^\n]+/)?.[0]?.slice(1) ?? '', '');
  // More robust: remove the exact line
  out = src.replace(/\nimport \{ useEscapeKey \} from '[^']+';/, '');

  // Step 2: Find the last complete import statement (ends with ;) and insert after it
  // Match complete single-line imports AND the closing line of multi-line imports
  const allImportEnds = [...out.matchAll(/^} from ['"][^'"]+['"];$/gm)];
  const allSingleImports = [...out.matchAll(/^import .+ from ['"][^'"]+['"];$/gm)];

  // Find the last import end position (either single-line or closing brace)
  let lastPos = -1;
  let lastLen = 0;
  for (const m of [...allImportEnds, ...allSingleImports]) {
    if (m.index > lastPos) {
      lastPos = m.index;
      lastLen = m[0].length;
    }
  }

  if (lastPos === -1) continue;

  // Insert after the last import
  out = out.slice(0, lastPos + lastLen) + '\n' + escapeLine + out.slice(lastPos + lastLen);

  writeFileSync(rel, out, 'utf8');
  console.log(`✅ Fixed: ${rel}`);
  fixed++;
}

console.log(`\nFixed ${fixed} files.`);
