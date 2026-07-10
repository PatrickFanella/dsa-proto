import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function compareSchema(previous: unknown, current: unknown, path: string, issues: string[]) {
  const before = object(previous);
  const after = object(current);
  for (const key of ['type', 'format', 'ref', 'key', 'const']) {
    if (before[key] !== undefined && before[key] !== after[key]) issues.push(`${path}.${key} changed from ${JSON.stringify(before[key])} to ${JSON.stringify(after[key])}`);
  }
  const beforeRequired = Array.isArray(before.required) ? before.required.map(String).sort() : [];
  const afterRequired = Array.isArray(after.required) ? after.required.map(String).sort() : [];
  if (JSON.stringify(beforeRequired) !== JSON.stringify(afterRequired)) issues.push(`${path}.required changed; temporary v1 only permits new optional fields`);
  const beforeProperties = object(before.properties);
  const afterProperties = object(after.properties);
  for (const [name, schema] of Object.entries(beforeProperties)) {
    if (!(name in afterProperties)) issues.push(`${path}.properties.${name} was removed`);
    else compareSchema(schema, afterProperties[name], `${path}.properties.${name}`, issues);
  }
  const beforeDefs = object(before.defs);
  const afterDefs = object(after.defs);
  for (const [name, schema] of Object.entries(beforeDefs)) {
    if (!(name in afterDefs)) issues.push(`${path}.defs.${name} was removed`);
    else compareSchema(schema, afterDefs[name], `${path}.defs.${name}`, issues);
  }
  if (before.items !== undefined) compareSchema(before.items, after.items, `${path}.items`, issues);
  if (before.record !== undefined) compareSchema(before.record, after.record, `${path}.record`, issues);
  if (before.parameters !== undefined) compareSchema(before.parameters, after.parameters, `${path}.parameters`, issues);
  if (before.input !== undefined) compareSchema(before.input, after.input, `${path}.input`, issues);
  if (before.output !== undefined) compareSchema(before.output, after.output, `${path}.output`, issues);
  if (before.schema !== undefined) compareSchema(before.schema, after.schema, `${path}.schema`, issues);
}

export function compatibilityIssues(previous: unknown, current: unknown) {
  const issues: string[] = [];
  compareSchema(previous, current, 'lexicon', issues);
  return issues;
}

function main() {
  const root = resolve(import.meta.dirname, '../..');
  let base: string;
  try {
    base = execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    base = 'HEAD';
  }
  const files = execFileSync('git', ['ls-tree', '-r', '--name-only', base, 'backend/lexicons'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter((file) => file.endsWith('.json') && file !== 'backend/lexicons.json');
  const issues: string[] = [];
  for (const file of files) {
    const previous = JSON.parse(execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' })) as unknown;
    let current: unknown;
    try {
      current = JSON.parse(readFileSync(resolve(root, file), 'utf8')) as unknown;
    } catch {
      issues.push(`${file} was removed`);
      continue;
    }
    issues.push(...compatibilityIssues(previous, current).map((issue) => `${file}: ${issue}`));
  }
  if (issues.length) throw new Error(`incompatible Lexicon evolution:\n${issues.join('\n')}`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
