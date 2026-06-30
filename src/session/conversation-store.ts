import type { AgentRuntimeMessage } from '../runtime/agent-runtime.js';

export class InMemoryConversationStore {
  readonly #messagesBySessionId = new Map<string, AgentRuntimeMessage[]>();

  // fallow-ignore-next-line unused-class-member
  appendUserMessage(agentSessionId: string, content: string): readonly AgentRuntimeMessage[] {
    const nextMessages: AgentRuntimeMessage[] = [
      ...this.getMessages(agentSessionId),
      { role: 'user', content },
    ];
    this.#messagesBySessionId.set(agentSessionId, nextMessages);

    return nextMessages;
  }

  // fallow-ignore-next-line unused-class-member
  appendAssistantMessage(agentSessionId: string, content: string): readonly AgentRuntimeMessage[] {
    const nextMessages: AgentRuntimeMessage[] = [
      ...this.getMessages(agentSessionId),
      { role: 'assistant', content },
    ];
    this.#messagesBySessionId.set(agentSessionId, nextMessages);

    return nextMessages;
  }

  getMessages(agentSessionId: string): readonly AgentRuntimeMessage[] {
    return [...(this.#messagesBySessionId.get(agentSessionId) ?? [])];
  }
}
