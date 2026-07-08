# A2A Buyer Agent Demo

This example runs a standalone buyer agent that talks to the seller agent through the
A2A-compatible `message:send` endpoint. It is meant for local demos and protocol experiments, not
production checkout automation.

The demo starts a small browser UI on port `3001`. A buyer agent LLM turns a purchase goal into
buyer messages, sends them to the seller agent, and streams the buyer-agent/seller-agent exchange back to the
browser.

## Prerequisites

- The seller agent from the repository root is running and reachable through `SELLER_URL`.
- The seller agent is configured with a real commerce adapter and visible products.
- Node.js with `--env-file` support is available.
- Dependencies for this example are installed with `npm install`.
- `OPENAI_API_KEY` is available for the buyer agent model.

## Configure

Copy the example environment file:

```bash
cd examples/a2a-demo
cp .env.example .env
```

Set at least these values in `.env`:

```bash
OPENAI_API_KEY=sk-...
BUYER_MODEL=gpt-5-mini
SELLER_URL=http://localhost:3000
PORT=3001
```

Optional buyer identity fields are used when the buyer agent asks the seller agent to complete the
checkout flow:

```bash
BUYER_EMAIL=buyer@example.com
BUYER_FIRST_NAME=Alex
BUYER_LAST_NAME=Demo
BUYER_STREET=Ebbinghoff 10
BUYER_ZIPCODE=48624
BUYER_CITY=Schoppingen
BUYER_COUNTRY=DE
```

Use test buyer data only. The completion path can create a real order when the seller agent is
connected to a completion-capable adapter and merchant policy enables checkout completion.

## Run

Start the seller agent from the repository root in one terminal:

```bash
bun run dev
```

Start the buyer demo in another terminal:

```bash
cd examples/a2a-demo
npm install
npm run dev
```

Open the buyer UI:

```text
http://localhost:3001
```

Enter a purchase goal, such as:

```text
I need waterproof jackets for two people and want to check out if the total stays under 300 EUR.
```

The UI streams:

- buyer messages generated from the goal
- seller agent responses returned by the harness
- harness tool calls reported by the seller agent response metadata
- the final completion state when the buyer agent decides the goal is done

## HTTP Endpoints

The example server exposes:

- `GET /`: browser UI
- `POST /run`: streams a full buyer/seller negotiation as Server-Sent Events
- `POST /turn`: runs one buyer turn and returns JSON

`POST /run` expects:

```json
{
  "goal": "Find and prepare checkout for two jackets under 300 EUR."
}
```

`POST /turn` expects:

```json
{
  "goal": "Find and prepare checkout for two jackets under 300 EUR.",
  "history": [],
  "contextId": "optional-existing-a2a-context-id"
}
```

## Troubleshooting

- `OPENAI_API_KEY is not set`: add the key to `examples/a2a-demo/.env`.
- `Seller A2A error`: confirm the seller agent is running and `SELLER_URL` points to it.
- Empty or irrelevant product results: confirm the seller agent commerce adapter has visible
  products and the goal matches catalog data.
- Checkout does not complete: confirm the seller agent has checkout completion enabled in both
  capabilities and policy, and that the selected adapter supports completion.
