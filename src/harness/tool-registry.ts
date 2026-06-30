import type { AgentHarnessConfig, HarnessCapability } from '../contracts/config.js';

export interface HarnessToolDefinition {
  readonly name: HarnessCapability;
}

export function createToolRegistry(config: AgentHarnessConfig): readonly HarnessToolDefinition[] {
  return config.enabledCapabilities.map((capability) => ({ name: capability }));
}

export { createExecutableToolRegistry } from './executable-tool-registry.js';
