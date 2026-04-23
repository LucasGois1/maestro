export const DISCOVERY_PACKAGE_NAME = '@maestro/discovery';

export type {
  ComputationalDiscoveryResult,
  StackDetectionResult,
  StackKind,
  StructuralSummary,
} from './types.js';

export { applyDiscoveryToKb, writeDiscoveryDraft } from './apply-draft.js';
export {
  applyGreenfieldTemplate,
  GREENFIELD_TEMPLATE_IDS,
  isGreenfieldTemplateId,
  listGreenfieldTemplateIds,
  resolveTemplateDirectory,
  type GreenfieldTemplateId,
} from './greenfield.js';
export { detectStack } from './stack-detector.js';
export { analyzeStructure, pathIsDirectory } from './structural-analyzer.js';
export { runComputationalDiscovery } from './computational.js';
export {
  buildCatalogSensorCandidates,
  buildHeuristicSensorCandidates,
  mergeSensorCandidateLayers,
  runSensorCandidateInference,
  type RunSensorCandidateInferenceOptions,
  type RunSensorCandidateInferenceResult,
  type SensorInitCandidate,
  type SensorInitCandidateSource,
} from './sensor-candidates.js';
export {
  runInferentialDiscovery,
  type InferentialDiscoveryProgressStep,
  type RunInferentialDiscoveryOptions,
} from './orchestrator.js';
export {
  sampleRepositoryFiles,
  type FileSample,
  type SampleRepositoryFilesOptions,
} from './sampling.js';
export { runKbRefresh, type RunKbRefreshOptions } from './refresh.js';
export {
  discoveryStatePath,
  loadDiscoveryState,
  saveDiscoveryState,
  type DiscoveryPersistedState,
} from './state.js';
