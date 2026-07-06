import { a2aProtocolVersion } from './a2a-constants.js';

export function createA2aAgentCard(origin: string): unknown {
  return {
    name: 'Sales Agent Harness',
    description:
      'Merchant-controlled seller agent for safe product search, cart preparation, and checkout handoff.',
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
        name: 'Seller Agent Commerce',
        description:
          'Search products, answer commerce questions, prepare carts, and create non-binding checkout handoffs.',
        tags: ['commerce', 'shopware', 'cart', 'checkout-handoff'],
        examples: ['Find waterproof jackets', 'Prepare a cart with two of product product-1'],
        inputModes: ['text/plain'],
        outputModes: ['text/plain'],
      },
    ],
  };
}
