export type StackKind =
  | 'python'
  | 'node'
  | 'node-ts'
  | 'go'
  | 'rust'
  | 'java'
  | 'ruby'
  | 'unknown';

export type StackDetectionResult = {
  readonly kind: StackKind;
  readonly markers: readonly string[];
  readonly hints: {
    readonly framework?: string;
    readonly packageManager?: string;
    readonly inferredTestCommand?: string;
    readonly inferredLintCommand?: string;
  };
};

export type StructuralSummary = {
  readonly topLevelNames: readonly string[];
  readonly extensionCounts: Readonly<Record<string, number>>;
  readonly testDirectoryHints: readonly string[];
  readonly approxFileCount: number;
};

export type ComputationalDiscoveryResult = {
  readonly repoRoot: string;
  readonly stack: StackDetectionResult;
  readonly structure: StructuralSummary;
};
