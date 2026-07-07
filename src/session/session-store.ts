import type { AgentSession, CommerceContext, PublicAgentSession } from '../contracts/session.js';

export interface SessionStore {
  createSession(session: AgentSession): AgentSession;
  setCommerceContext(agentSessionId: string, commerceContext: CommerceContext): AgentSession;
  getSession(agentSessionId: string, merchantId: string): AgentSession | undefined;
  getPublicSession(agentSessionId: string, merchantId: string): PublicAgentSession | undefined;
}

interface SessionStoreClock {
  now(): Date;
}

export interface InMemorySessionStoreOptions {
  readonly now?: () => Date;
}

export class InMemorySessionStore implements SessionStore {
  readonly #sessions = new Map<string, AgentSession>();
  readonly #clock: SessionStoreClock;

  constructor(options: InMemorySessionStoreOptions = {}) {
    this.#clock = {
      now: options.now ?? (() => new Date()),
    };
  }

  createSession(session: AgentSession): AgentSession {
    this.#sessions.set(session.agentSessionId, session);

    return session;
  }

  setCommerceContext(agentSessionId: string, commerceContext: CommerceContext): AgentSession {
    const session = this.#sessions.get(agentSessionId);

    if (!session) {
      throw new Error(`Agent session ${agentSessionId} was not found`);
    }

    const updatedSession: AgentSession = {
      ...session,
      commerceContext,
    };

    this.#sessions.set(agentSessionId, updatedSession);

    return updatedSession;
  }

  getSession(agentSessionId: string, merchantId: string): AgentSession | undefined {
    const session = this.#sessions.get(agentSessionId);

    if (!this.isAvailableSession(session, merchantId)) {
      return undefined;
    }

    return session;
  }

  getPublicSession(agentSessionId: string, merchantId: string): PublicAgentSession | undefined {
    const session = this.getSession(agentSessionId, merchantId);

    if (!session) {
      return undefined;
    }

    return toPublicSession(session);
  }

  private isAvailableSession(
    session: AgentSession | undefined,
    merchantId: string,
  ): session is AgentSession {
    if (!session) {
      return false;
    }

    if (session.merchantId !== merchantId) {
      return false;
    }

    if (!session.expiresAt) {
      return true;
    }

    return session.expiresAt > this.#clock.now();
  }
}

function toPublicSession(session: AgentSession): PublicAgentSession {
  const publicSession: PublicAgentSession = {
    agentSessionId: session.agentSessionId,
    merchantId: session.merchantId,
    agentId: session.agentId,
    channel: session.channel,
    customerContext: session.customerContext,
    createdAt: session.createdAt,
  };

  if (session.expiresAt) {
    return {
      ...publicSession,
      expiresAt: session.expiresAt,
    };
  }

  return publicSession;
}
