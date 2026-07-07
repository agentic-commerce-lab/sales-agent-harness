import type { AgentRun } from './agent-runtime.js';

export interface AgentRunStore {
  get(runId: string): AgentRun | undefined;
  save(run: AgentRun): void;
}
