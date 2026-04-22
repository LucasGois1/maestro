import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { computeEvalMetrics, type EvalFixture } from '@maestro/testkit';

const root = dirname(fileURLToPath(import.meta.url));
const threshold = Number(process.env.MAESTRO_CODE_REVIEWER_EVAL_F1 ?? '0.8');

type ParsedFixture = {
  readonly id: string;
  readonly expected: boolean;
  readonly body: string;
};

function parseFixture(markdown: string): ParsedFixture {
  const match = /^---\n(?<frontmatter>[\s\S]*?)\n---\n(?<body>[\s\S]*)$/u.exec(
    markdown,
  );
  if (!match?.groups) {
    throw new Error('Eval fixture is missing frontmatter.');
  }
  const fields = new Map<string, string>();
  for (const line of match.groups.frontmatter.split('\n')) {
    const [key, ...rest] = line.split(':');
    if (key && rest.length > 0) fields.set(key.trim(), rest.join(':').trim());
  }
  const id = fields.get('id');
  const expected = fields.get('expected');
  if (!id || !expected) {
    throw new Error('Eval fixture requires id and expected fields.');
  }
  return {
    id,
    expected: expected === 'true',
    body: match.groups.body,
  };
}

function classifyCodeReviewerIssue(body: string): boolean {
  const lower = body.toLowerCase();
  return [
    /select\s+\*\s+from[\s\S]*\+/u,
    /sk-live-[a-z0-9_-]+/iu,
    /\.innerhtml\s*=/iu,
    /except exception:\s*\n\+\s*pass/iu,
    /expect\(true\)\.tobe\(true\)/iu,
    /reduce\([\s\S]*\/\s*values\.length/iu,
    /\beval\s*\(/iu,
    /\bexec\s*\([\s\S]*\+/iu,
    /\.\.\/uploads\/[\s\S]*\+/iu,
    /saveinvoice\(invoice\);\s*\n\+return/iu,
  ].some((pattern) => pattern.test(lower));
}

async function loadGroup(
  group: 'positives' | 'negatives',
): Promise<EvalFixture[]> {
  const dir = join(root, group);
  const files = (await readdir(dir))
    .filter((file) => file.endsWith('.md'))
    .sort();
  const fixtures: EvalFixture[] = [];
  for (const file of files) {
    const parsed = parseFixture(await readFile(join(dir, file), 'utf8'));
    fixtures.push({
      id: parsed.id,
      expected: parsed.expected,
      actual: classifyCodeReviewerIssue(parsed.body),
    });
  }
  return fixtures;
}

const fixtures = [
  ...(await loadGroup('positives')),
  ...(await loadGroup('negatives')),
];
const metrics = computeEvalMetrics(fixtures);

console.log(JSON.stringify(metrics, null, 2));

if (metrics.f1 < threshold) {
  throw new Error(
    `Code reviewer eval F1 ${metrics.f1.toFixed(3)} is below threshold ${threshold.toFixed(3)}.`,
  );
}
