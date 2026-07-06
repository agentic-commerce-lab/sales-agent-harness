import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { z } from 'zod';

import {
  type AgentHarnessConfig,
  agentChannels,
  disabledCommerceCapabilities,
  harnessCapabilities,
} from '../contracts/config.js';

const moneyLimitSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(3),
});

const agentPolicyConfigSchema = z.object({
  allowedChannels: z.array(z.enum(agentChannels)).min(1),
  blockedCategories: z.array(z.string().min(1)),
  blockedProducts: z.array(z.string().min(1)),
  maxCartValue: moneyLimitSchema,
  maxItemQuantity: z.number().int().positive(),
  allowCheckoutHandoff: z.boolean(),
  allowCheckoutCompletion: z.boolean().default(false),
  requireHumanApprovalForCheckout: z.boolean(),
  unsupportedRegions: z.array(z.string().min(1)),
  confidentialFields: z.array(z.string().min(1)),
});

const shopwareAgentConfigSchema = z.object({
  salesChannelId: z.string().min(1),
  storefrontBaseUrl: z.url(),
});

const agentHarnessConfigSchema = z.object({
  agentId: z.string().min(1),
  merchantId: z.string().min(1),
  systemPrompt: z.string().optional(),
  enabledCapabilities: z.array(z.enum(harnessCapabilities)).min(1),
  disabledCapabilities: z.array(z.enum(disabledCommerceCapabilities)),
  policies: agentPolicyConfigSchema,
  shopware: shopwareAgentConfigSchema,
});

export function parseAgentHarnessConfig(input: unknown): AgentHarnessConfig {
  const result = agentHarnessConfigSchema.safeParse(input);

  if (!result.success) {
    throw new Error('Invalid agent harness config', { cause: result.error });
  }

  return result.data;
}

export async function loadAgentHarnessConfig(configPath: string): Promise<AgentHarnessConfig> {
  const rawConfig = await readFile(configPath, 'utf8');

  try {
    const parsedConfig: unknown = JSON.parse(rawConfig);
    const config = parseAgentHarnessConfig(parsedConfig);

    const promptFile = extractSystemPromptFile(parsedConfig);
    if (!promptFile) return config;

    const promptPath = resolve(dirname(configPath), promptFile);
    const systemPrompt = (await readFile(promptPath, 'utf8')).trim();
    return { ...config, systemPrompt };
  } catch (error) {
    throw new Error(`Failed to load agent harness config from ${configPath}`, { cause: error });
  }
}

function extractSystemPromptFile(config: unknown): string | undefined {
  const result = z.object({ systemPromptFile: z.string().optional() }).safeParse(config);
  return result.success ? result.data.systemPromptFile : undefined;
}
