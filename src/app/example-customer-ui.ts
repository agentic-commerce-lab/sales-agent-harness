export const exampleCustomerUiHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sales Agent Harness Demo</title>
    <style>
      :root {
        color-scheme: light;
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #f7f8fa;
        color: #172033;
      }

      body {
        margin: 0;
      }

      main {
        width: min(960px, calc(100vw - 32px));
        margin: 32px auto;
      }

      h1 {
        margin: 0 0 8px;
        font-size: 32px;
        line-height: 1.15;
      }

      p {
        color: #526070;
      }

      section {
        margin-top: 24px;
        padding: 20px;
        border: 1px solid #dce2ea;
        border-radius: 8px;
        background: #ffffff;
      }

      label {
        display: grid;
        gap: 6px;
        margin-bottom: 14px;
        font-weight: 600;
      }

      input,
      textarea {
        width: 100%;
        box-sizing: border-box;
        border: 1px solid #c7d0dc;
        border-radius: 6px;
        padding: 10px 12px;
        font: inherit;
      }

      textarea {
        min-height: 92px;
        resize: vertical;
      }

      button {
        border: 0;
        border-radius: 6px;
        padding: 10px 14px;
        background: #1155cc;
        color: #ffffff;
        font: inherit;
        font-weight: 700;
        cursor: pointer;
      }

      pre {
        min-height: 120px;
        overflow: auto;
        padding: 14px;
        border-radius: 6px;
        background: #101828;
        color: #e8eef7;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Sales Agent Harness Demo</h1>
      <p>Create a harness session, then send a message through the same /chat endpoint used by the customer UI API.</p>

      <section>
        <h2>Session</h2>
        <label>
          Shopware context token
          <input id="context-token" placeholder="server-side-context-token" />
        </label>
        <label>
          Region
          <input id="region" value="DE" />
        </label>
        <button id="create-session" type="button">Create Session</button>
      </section>

      <section>
        <h2>Chat</h2>
        <label>
          Agent session ID
          <input id="session-id" placeholder="Created session ID" />
        </label>
        <label>
          Message
          <textarea id="message">Find waterproof jackets</textarea>
        </label>
        <button id="send-message" type="button">Send Message</button>
      </section>

      <section>
        <h2>Response</h2>
        <pre id="output">{}</pre>
      </section>
    </main>

    <script type="module">
      const output = document.querySelector('#output');
      const contextToken = document.querySelector('#context-token');
      const region = document.querySelector('#region');
      const sessionId = document.querySelector('#session-id');
      const message = document.querySelector('#message');

      async function postJson(path, body) {
        const response = await fetch(path, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        const payload = await response.json();
        output.textContent = JSON.stringify(payload, null, 2);
        return payload;
      }

      document.querySelector('#create-session').addEventListener('click', async () => {
        const session = await postJson('/sessions', {
          channel: 'customer_ui',
          shopwareContextToken: contextToken.value,
          customerContext: { region: region.value },
        });
        if (session.agentSessionId) {
          sessionId.value = session.agentSessionId;
        }
      });

      document.querySelector('#send-message').addEventListener('click', () => {
        return postJson('/chat', {
          agentSessionId: sessionId.value,
          message: message.value,
        });
      });
    </script>
  </body>
</html>`;
