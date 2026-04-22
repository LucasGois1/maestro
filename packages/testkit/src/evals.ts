export type EvalFixture = {
  readonly id: string;
  readonly expected: boolean;
  readonly actual: boolean;
};

export type EvalMetrics = {
  readonly total: number;
  readonly truePositive: number;
  readonly trueNegative: number;
  readonly falsePositive: number;
  readonly falseNegative: number;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
};

function safeRatio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeEvalMetrics(
  fixtures: readonly EvalFixture[],
): EvalMetrics {
  let truePositive = 0;
  let trueNegative = 0;
  let falsePositive = 0;
  let falseNegative = 0;

  for (const fixture of fixtures) {
    if (fixture.expected && fixture.actual) truePositive += 1;
    else if (!fixture.expected && !fixture.actual) trueNegative += 1;
    else if (!fixture.expected && fixture.actual) falsePositive += 1;
    else falseNegative += 1;
  }

  const precision = safeRatio(truePositive, truePositive + falsePositive);
  const recall = safeRatio(truePositive, truePositive + falseNegative);
  const f1 = safeRatio(2 * precision * recall, precision + recall);

  return {
    total: fixtures.length,
    truePositive,
    trueNegative,
    falsePositive,
    falseNegative,
    precision,
    recall,
    f1,
  };
}
