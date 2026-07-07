import type { AgentHarnessConfig } from '../contracts/config.js';
import { a2aProtocolVersion } from './a2a-constants.js';

export function createA2aAgentCard(origin: string, config?: AgentHarnessConfig): unknown {
  const profile = config?.agentProfile;

  return {
    name: readDisplayName(config),
    description: readDescription(config),
    version: '0.1.0',
    protocolVersion: a2aProtocolVersion,
    url: origin,
    capabilities: {
      streaming: false,
      pushNotifications: false,
    },
    defaultInputModes: ['text/plain'],
    defaultOutputModes: ['text/plain'],
    supportedInterfaces: [
      {
        url: origin,
        transport: 'JSONRPC',
        protocolVersion: a2aProtocolVersion,
      },
    ],
    securitySchemes: {},
    security: [],
    skills: [
      {
        id: 'seller-agent-commerce',
        name: profile?.displayName ?? defaultSkillName,
        description: readSkillDescription(config),
        tags: ['commerce', 'shopware', 'cart', 'checkout'],
        examples: readExamples(config),
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
      },
    ],
    ...metadataFromConfig(config),
  };
}

const defaultName = 'Sales Agent Harness';
const defaultSkillName = 'Seller Agent Commerce';
const defaultDescription =
  'Merchant-controlled seller agent for safe product search, cart preparation, checkout handoff, and policy-gated checkout completion.';
const defaultSkillDescription =
  'Search products, answer commerce questions, prepare carts, create checkout handoffs, and complete checkout when merchant policy allows it.';
const defaultExamples = [
  'Find waterproof jackets',
  'Prepare a cart with two of product product-1',
] as const;

function readDisplayName(config: AgentHarnessConfig | undefined): string {
  return config?.agentProfile?.displayName ?? defaultName;
}

function readDescription(config: AgentHarnessConfig | undefined): string {
  return config?.agentProfile?.description ?? defaultDescription;
}

function readSkillDescription(config: AgentHarnessConfig | undefined): string {
  return config?.agentProfile?.serviceSummary ?? defaultSkillDescription;
}

function readExamples(config: AgentHarnessConfig | undefined): readonly string[] {
  return config?.agentProfile?.examples ?? defaultExamples;
}

function metadataFromConfig(config: AgentHarnessConfig | undefined): object {
  if (!config) {
    return {};
  }

  return {
    metadata: {
      merchantId: config.merchantId,
      agentId: config.agentId,
      ...optionalProfileMetadata(config),
    },
  };
}

function optionalProfileMetadata(config: AgentHarnessConfig): object {
  const { agentProfile } = config;

  return {
    ...(agentProfile?.supportedLanguages
      ? { supportedLanguages: agentProfile.supportedLanguages }
      : {}),
    ...(agentProfile?.contactUrl ? { contactUrl: agentProfile.contactUrl } : {}),
  };
}
