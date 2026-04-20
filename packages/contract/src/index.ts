export const CONTRACT_PACKAGE_NAME = '@maestro/contract';

export {
  CONTRACT_STATUSES,
  MAX_NEGOTIATION_ROUNDS,
  NEGOTIATION_ROLES,
  sprintContractFrontmatterSchema,
  type ContractStatus,
  type NegotiationRole,
  type SprintContract,
  type SprintContractFrontmatter,
  type SprintContractFrontmatterInput,
} from './schema.js';

export {
  ContractParseError,
  ContractValidationError,
  parseSprintContract,
  writeSprintContract,
  type WriteContractOptions,
} from './parser.js';

export {
  NegotiationError,
  negotiateSprintContract,
  type NegotiateSprintContractOptions,
  type NegotiationResult,
  type Negotiator,
  type NegotiatorProposal,
} from './negotiation.js';

export {
  EditorLaunchError,
  editSprintContract,
  resolveEditorCommand,
  type EditContractOptions,
} from './editor.js';

export {
  contractFileName,
  CONTRACTS_DIR,
  resolveContractPath,
  RUNS_DIR,
  type ContractPathOptions,
} from './paths.js';
