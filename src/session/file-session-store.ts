import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AgentSession, CommerceContext, PublicAgentSession } from '../contracts/session.js';
import { isSessionAvailable, type SessionStore, toPublicSession } from './session-store.js';

export interface FileSessionStoreOptions {
  readonly path: string;
  readonly now?: () => Date;
}

interface StoredAgentSession extends Omit<AgentSession, 'createdAt' | 'expiresAt'> {
  readonly createdAt: string;
  readonly expiresAt?: string;
}

export class FileSessionStore implements SessionStore {
  readonly #path: string;
  readonly #now: () => Date;

  constructor(options: FileSessionStoreOptions) {
    this.#path = options.path;
    this.#now = options.now ?? (() => new Date());
    ensureParentDirectory(this.#path);
    if (!existsSync(this.#path)) {
      writeFileSync(this.#path, '[]');
    }
  }

  // fallow-ignore-next-line unused-class-member
  createSession(session: AgentSession): AgentSession {
    const sessions = this.#readSessions().filter(
      (candidate) => candidate.agentSessionId !== session.agentSessionId,
    );
    sessions.push(session);
    this.#writeSessions(sessions);

    return session;
  }

  // fallow-ignore-next-line unused-class-member
  setCommerceContext(agentSessionId: string, commerceContext: CommerceContext): AgentSession {
    const sessions = this.#readSessions();
    const index = sessions.findIndex((session) => session.agentSessionId === agentSessionId);

    if (index < 0) {
      throw new Error(`Agent session ${agentSessionId} was not found`);
    }

    const session = sessions[index];
    if (!session) {
      throw new Error(`Agent session ${agentSessionId} was not found`);
    }

    const updatedSession: AgentSession = {
      ...session,
      commerceContext,
    };
    sessions[index] = updatedSession;
    this.#writeSessions(sessions);

    return updatedSession;
  }

  getSession(agentSessionId: string, merchantId: string): AgentSession | undefined {
    const session = this.#readSessions().find(
      (candidate) => candidate.agentSessionId === agentSessionId,
    );

    if (!isSessionAvailable(session, merchantId, this.#now())) {
      return undefined;
    }

    return session;
  }

  // fallow-ignore-next-line unused-class-member
  getPublicSession(agentSessionId: string, merchantId: string): PublicAgentSession | undefined {
    const session = this.getSession(agentSessionId, merchantId);

    if (!session) {
      return undefined;
    }

    return toPublicSession(session);
  }

  #readSessions(): AgentSession[] {
    const parsed: unknown = JSON.parse(readFileSync(this.#path, 'utf8'));

    if (!Array.isArray(parsed)) {
      throw new Error(`Session store file ${this.#path} must contain an array`);
    }

    return parsed.map(readSession);
  }

  #writeSessions(sessions: readonly AgentSession[]): void {
    writeFileSync(this.#path, JSON.stringify(sessions.map(writeSession), null, 2));
  }
}

function readSession(value: unknown): AgentSession {
  if (!isStoredSession(value)) {
    throw new Error('Session store file contains an invalid session record');
  }

  return {
    agentSessionId: value.agentSessionId,
    merchantId: value.merchantId,
    agentId: value.agentId,
    channel: value.channel,
    customerContext: value.customerContext,
    ...(value.commerceContext ? { commerceContext: value.commerceContext } : {}),
    createdAt: new Date(value.createdAt),
    ...(value.expiresAt ? { expiresAt: new Date(value.expiresAt) } : {}),
  };
}

function writeSession(session: AgentSession): StoredAgentSession {
  return {
    agentSessionId: session.agentSessionId,
    merchantId: session.merchantId,
    agentId: session.agentId,
    channel: session.channel,
    customerContext: session.customerContext,
    ...(session.commerceContext ? { commerceContext: session.commerceContext } : {}),
    createdAt: session.createdAt.toISOString(),
    ...(session.expiresAt ? { expiresAt: session.expiresAt.toISOString() } : {}),
  };
}

function isStoredSession(value: unknown): value is StoredAgentSession {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.agentSessionId === 'string' &&
    typeof value.merchantId === 'string' &&
    typeof value.agentId === 'string' &&
    typeof value.channel === 'string' &&
    isRecord(value.customerContext) &&
    typeof value.createdAt === 'string'
  );
}

function ensureParentDirectory(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
