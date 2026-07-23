import type {
  Ap2PaymentMandate,
  CheckoutTerms,
  CommerceAdapter,
  CompleteCheckoutInput,
  CompletedCheckoutResult,
  CreateCartInput,
  ProductDetailsInput,
  SearchProductsInput,
} from '../contracts/commerce.js';
import type { AgentHarnessConfig } from '../contracts/config.js';
import type { HandoffStore } from '../handoff/handoff-store.js';
import { prepareCheckoutHandoff } from '../handoff/prepare-checkout-handoff.js';
import type { AuditLogger } from '../observability/audit-log.js';
import type { SessionStore } from '../session/session-store.js';
import {
  type CheckoutIdempotencyStore,
  InMemoryCheckoutIdempotencyStore,
} from './checkout-idempotency-store.js';
import { maxItemQuantity, withCommerceContext } from './harness-commerce-context.js';
import { createHarnessExecutor, type HarnessExecutor } from './harness-executor.js';
import type { HarnessRequest } from './harness-types.js';

export interface HarnessCoreOptions {
  readonly config: AgentHarnessConfig;
  readonly adapter: CommerceAdapter;
  readonly auditLogger: AuditLogger;
  readonly handoffStore: HandoffStore;
  readonly sessionStore: SessionStore;
  readonly checkoutIdempotencyStore?: CheckoutIdempotencyStore | undefined;
  readonly now?: () => Date;
  readonly checkoutHandoffMode?: 'local' | 'adapter';
}

export type { HarnessRequest, HarnessResponse } from './harness-types.js';

export class HarnessCore {
  readonly #config: AgentHarnessConfig;
  readonly #adapter: CommerceAdapter;
  readonly #executor: HarnessExecutor;
  readonly #handoffStore: HandoffStore;
  readonly #checkoutIdempotencyStore: CheckoutIdempotencyStore;
  readonly #checkoutHandoffMode: 'local' | 'adapter';
  readonly #now: () => Date;
  readonly #completedCheckouts = new Map<string, CompletedCheckoutResult>();
  readonly #pendingAp2Mandates = new Map<string, Ap2PaymentMandate>();
  readonly #pendingCheckoutTerms = new Map<string, CheckoutTerms>();

  constructor(options: HarnessCoreOptions) {
    this.#config = options.config;
    this.#adapter = options.adapter;
    this.#handoffStore = options.handoffStore;
    this.#checkoutIdempotencyStore =
      options.checkoutIdempotencyStore ?? new InMemoryCheckoutIdempotencyStore();
    this.#checkoutHandoffMode = options.checkoutHandoffMode ?? 'local';
    this.#now = options.now ?? (() => new Date());
    this.#executor = createHarnessExecutor({
      config: options.config,
      auditLogger: options.auditLogger,
      sessionStore: options.sessionStore,
      now: this.#now,
    });
  }

  // fallow-ignore-next-line unused-class-member
  async searchProducts(input: HarnessRequest & SearchProductsInput) {
    return this.#executor.execute('searchProducts', input, (session) =>
      this.#adapter.searchProducts(withCommerceContext(input, session)),
    );
  }

  // fallow-ignore-next-line unused-class-member
  async getProductDetails(input: HarnessRequest & ProductDetailsInput) {
    return this.#executor.execute('getProductDetails', input, (session) =>
      this.#adapter.getProductDetails(withCommerceContext(input, session)),
    );
  }

  // fallow-ignore-next-line unused-class-member
  async createCart(input: HarnessRequest & CreateCartInput) {
    return this.#executor.execute(
      'createCart',
      input,
      (session) => this.#adapter.createCart(withCommerceContext(input, session)),
      {
        maxItemQuantity: maxItemQuantity(input.items),
        summaryFromValue: (result) => result.cart,
      },
    );
  }

  // fallow-ignore-next-line unused-class-member
  async updateCart(input: HarnessRequest & { readonly cartId: string } & CreateCartInput) {
    return this.#executor.execute(
      'updateCart',
      input,
      (session) => this.#adapter.updateCart(withCommerceContext(input, session)),
      {
        maxItemQuantity: maxItemQuantity(input.items),
        summaryFromValue: (result) => result.cart,
      },
    );
  }

  // fallow-ignore-next-line unused-class-member
  async getCartSummary(input: HarnessRequest & { readonly cartId: string }) {
    return this.#executor.execute('getCartSummary', input, (session) =>
      this.#adapter.getCartSummary(withCommerceContext(input, session)),
    );
  }

  // fallow-ignore-next-line unused-class-member
  async prepareCheckoutHandoff(input: HarnessRequest & { readonly cartId: string }) {
    return this.#executor.execute(
      'prepareCheckoutHandoff',
      input,
      async (session) => {
        const commerceContext = session.commerceContext;

        if (!commerceContext) {
          throw new Error(`Agent session ${session.agentSessionId} has no commerce context`);
        }

        const adapterInput = withCommerceContext(input, session);

        if (this.#checkoutHandoffMode === 'adapter') {
          const handoff = await this.#adapter.prepareCheckoutHandoff(adapterInput);
          this.#executor.recordAudit(session, 'checkout_handoff', 'prepareCheckoutHandoff', {
            cartId: handoff.summary.cartId,
          });

          if (handoff.checkoutId) {
            this.#pendingCheckoutTerms.set(session.agentSessionId, {
              checkoutId: handoff.checkoutId,
              total: handoff.summary.total,
            });
          }

          return handoff;
        }

        const summary = await this.#adapter.getCartSummary(adapterInput);
        const handoff = prepareCheckoutHandoff({
          store: this.#handoffStore,
          agentSessionId: session.agentSessionId,
          merchantId: session.merchantId,
          shopwareSalesChannelId: commerceContext.shopwareSalesChannelId,
          shopwareContextToken: commerceContext.shopwareContextToken,
          cartSummary: summary.cart,
          storefrontBaseUrl: this.#config.shopware.storefrontBaseUrl,
          ttlMs: 300000,
        });

        this.#executor.recordAudit(session, 'checkout_handoff', 'prepareCheckoutHandoff', {
          cartId: summary.cart.cartId,
          handoffId: handoff.handoffId,
        });

        return handoff;
      },
      {
        maxItemQuantity: 0,
        summaryFromValue: (handoff) => handoff.summary,
      },
    );
  }

  // fallow-ignore-next-line unused-class-member
  async completeCheckout(input: HarnessRequest & CompleteCheckoutInput) {
    return this.#executor.execute('completeCheckout', input, async (session) => {
      const ap2Mandate = this.#takePendingAp2Mandate(session.agentSessionId);

      if (input.idempotencyKey) {
        const stored = this.#checkoutIdempotencyStore.get({
          merchantId: session.merchantId,
          agentSessionId: session.agentSessionId,
          idempotencyKey: input.idempotencyKey,
        });

        if (stored) {
          this.#executor.recordAudit(session, 'checkout_completion', 'completeCheckout', {
            cartId: stored.result.summary.cartId,
          });
          this.#completedCheckouts.set(session.agentSessionId, stored.result);
          this.#pendingCheckoutTerms.delete(session.agentSessionId);
          return stored.result;
        }
      }

      const completed = await this.#adapter.completeCheckout({
        ...withCommerceContext(input, session),
        ...(ap2Mandate ? { ap2Mandate } : {}),
      });
      this.#completedCheckouts.set(session.agentSessionId, completed);
      this.#pendingCheckoutTerms.delete(session.agentSessionId);
      this.#executor.recordAudit(session, 'checkout_completion', 'completeCheckout', {
        cartId: completed.summary.cartId,
      });

      if (input.idempotencyKey) {
        this.#checkoutIdempotencyStore.save({
          merchantId: session.merchantId,
          agentSessionId: session.agentSessionId,
          idempotencyKey: input.idempotencyKey,
          result: completed,
          createdAt: this.#now(),
        });
      }

      return completed;
    });
  }

  /**
   * Returns and clears the checkout completed during the current turn, so the
   * app layer can attach buyer-facing payment instructions (e.g. x402) to the
   * structured response instead of relying on the model to relay them.
   */
  takeCompletedCheckout(agentSessionId: string): CompletedCheckoutResult | undefined {
    const completed = this.#completedCheckouts.get(agentSessionId);
    this.#completedCheckouts.delete(agentSessionId);

    return completed;
  }

  /**
   * Returns the real terms (checkoutId, total) of the checkout the seller
   * has most recently prepared but not yet completed, without consuming it —
   * the buyer needs this on every turn until completion actually happens, to
   * build an AP2 mandate that pins the real transaction instead of a guess.
   */
  peekPendingCheckoutTerms(agentSessionId: string): CheckoutTerms | undefined {
    return this.#pendingCheckoutTerms.get(agentSessionId);
  }

  /**
   * Records an AP2 mandate (CheckoutMandate + PaymentMandate) received from
   * the buyer's platform ahead of a completeCheckout call. Only the buyer's
   * platform can attest buyer consent, so the mandate must arrive from the
   * inbound A2A channel rather than as a model-supplied tool argument — the
   * completeCheckout tool schema deliberately has no field for it.
   */
  recordAp2Mandate(agentSessionId: string, mandate: Ap2PaymentMandate): void {
    this.#pendingAp2Mandates.set(agentSessionId, mandate);
  }

  #takePendingAp2Mandate(agentSessionId: string): Ap2PaymentMandate | undefined {
    const mandate = this.#pendingAp2Mandates.get(agentSessionId);
    this.#pendingAp2Mandates.delete(agentSessionId);

    return mandate;
  }
}
