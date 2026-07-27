# Checkout And UCP

Checkout handoff is preparation. Checkout completion is allowed only through the typed
`completeCheckout` harness capability when enabled by merchant configuration, permitted by policy,
explicitly confirmed by the buyer, and supported by the selected adapter.

## Checkout Handoff

With the default `shopware` adapter, checkout is handoff-only. The harness creates a short-lived
opaque handoff token and returns a `continueUrl` like:

```text
https://shop.example.test/agent-checkout?h=handoff_...
```

Raw Shopware context tokens stay server-side in session and handoff stores.

With `COMMERCE_ADAPTER_PROVIDER=ucp_shopware`, the harness delegates handoff creation to the UCP
adapter. That adapter reads the UCP cart, creates a UCP checkout session through the Agentic
Commerce plugin, and returns the plugin's `continueUrl`, for example an embedded UCP checkout URL.

## Automated UCP Checkout

Automated selling is opt-in and only supported through the Shopware UCP adapter. To let the agent
place a real order, configure all of the following:

- `COMMERCE_ADAPTER_PROVIDER=ucp_shopware` or `COMMERCE_ADAPTER_PROVIDER=shopware-ucp`
- include `completeCheckout` in the agent `enabledCapabilities`
- set `policies.allowCheckoutCompletion` to `true`
- keep `policies.requireHumanApprovalForCheckout` set to `false` for the demo flow

The `completeCheckout` tool requires `explicitBuyerConfirmation: true`, buyer details, and a
complete shipping address. Callers should include an `idempotencyKey`; reusing the same key for the
same merchant/session returns the stored checkout result instead of creating a duplicate order.

The harness first updates the UCP checkout session with:

```json
{
  "idempotencyKey": "checkout-session-123-confirmation-1",
  "buyer": {
    "email": "buyer@example.test",
    "firstName": "Ada",
    "lastName": "Buyer",
    "phoneNumber": "+49123456789"
  },
  "fulfillment": {
    "type": "shipping",
    "shippingAddress": {
      "street": "Test Street 1",
      "zipcode": "12345",
      "city": "Berlin",
      "countryCode": "DE"
    }
  }
}
```

Then it calls:

```http
POST /ucp/v1/checkout-sessions/{checkoutId}/complete
```

This creates a real Shopware order through the Agentic Commerce plugin. Treat it as a
research-preview path only. Do not use it for production selling without a separate production
design for buyer authorization, payment handling, order limits, idempotency, audit review, risk
controls, and operational ownership.

## AP2 Payment Mandates And x402 Settlement

`completeCheckout` accepts an AP2 checkout mandate, but only when the inbound A2A message carries
one in `message.metadata.ap2Mandate.checkoutMandate` (see `ap2MandateMetadataSchema` in
`src/app/a2a-schemas.ts`). The `completeCheckout` tool schema has no field for it: the harness never
asks the model to supply a mandate, since only the buyer's platform can attest buyer consent. A
request without a mandate completes checkout exactly as before this capability existed.

With `ucp_shopware`, a supplied mandate rides through as the UCP checkout's `ap2` extension. The
harness surfaces two things back from a successful completion when the shop returns them:

- `ap2MerchantAuthorization`: a JWS Detached Content signature proving the shop verified the
  mandate.
- `x402`: buyer-executed payment instructions (pay URL, deep-link code, network/asset details) when
  the shop's payment method requires an on-chain settlement step. The harness only passes these
  through — payment execution stays a buyer-side action.

If a mandate is supplied but the shop's UCP profile doesn't advertise
`dev.ucp.shopping.ap2_mandate` support, `completeCheckout` rejects the request rather than
completing checkout against a mandate the shop cannot verify. The `shopware` adapter ignores
`ap2Mandate` entirely — mandates only take effect with `ucp_shopware`.

Before a mandate-bearing completion, the buyer also needs the checkout's real terms (id and total)
to pin the mandate to the actual transaction instead of guessing at it. The harness exposes these
as `pendingCheckoutTerms` on the chat/A2A response once `prepareCheckoutHandoff` has run, cleared
again once completion happens.

See `examples/a2a-demo` for an end-to-end demonstration — a buyer agent that signs and attaches a
mandate on every message, and a wallet that settles x402 instructions when a completed checkout
returns them. Set `AP2_MANDATES_ENABLED=false` in that demo's `.env` to run the negotiation without
AP2 at all.

## Non-Prod Full-Checkout Happy Path

Use this flow for a local or demo environment where real order creation is acceptable:

1. Install and enable the Shopware Agentic Commerce UCP plugin for the target sales channel.
2. Set `COMMERCE_ADAPTER_PROVIDER=ucp_shopware`.
3. Include `completeCheckout` in `enabledCapabilities`.
4. Set `policies.allowCheckoutCompletion` to `true`.
5. Keep `policies.requireHumanApprovalForCheckout` set to `false` for the automated demo path.
6. Use `STORAGE_PROVIDER=sqlite` so checkout idempotency records and LangGraph checkpoints survive
   app recreation.
7. Create or obtain a UCP checkout session through `prepareCheckoutHandoff`.
8. Call the `completeCheckout` tool/API with `explicitBuyerConfirmation: true`, buyer details,
   shipping address, and an `idempotencyKey`.

Example direct commerce request:

```bash
curl -X POST http://127.0.0.1:3000/commerce/customer \
  -H 'content-type: application/json' \
  -d '{
    "capability": "completeCheckout",
    "agentSessionId": "session-id-from-create-session",
    "checkoutId": "checkout-1",
    "idempotencyKey": "checkout-1-confirmation-1",
    "explicitBuyerConfirmation": true,
    "buyer": {
      "email": "buyer@example.test",
      "firstName": "Ada",
      "lastName": "Buyer"
    },
    "fulfillment": {
      "type": "shipping",
      "shippingAddress": {
        "street": "Test Street 1",
        "zipcode": "12345",
        "city": "Berlin",
        "countryCode": "DE"
      }
    }
  }'
```

Expected response shape:

```json
{
  "status": "ok",
  "value": {
    "status": "completed",
    "orderId": "order-id-from-shopware",
    "summary": {
      "cartId": "checkout-1",
      "items": [],
      "subtotal": { "amount": 0, "currency": "EUR" },
      "total": { "amount": 0, "currency": "EUR" },
      "currency": "EUR"
    }
  }
}
```

If the same merchant/session/idempotency key is submitted again, the harness returns the stored
checkout result instead of attempting a duplicate completion.
