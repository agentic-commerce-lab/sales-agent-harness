import type { CheckoutResumeConfig } from './http-handler-types.js';

export function checkoutResumeHtml(token: string, config: CheckoutResumeConfig): string {
  const baseUrl = JSON.stringify(config.shopwareBaseUrl);
  const accessKey = JSON.stringify(config.shopwareAccessKey);
  const contextToken = JSON.stringify(token);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkout</title>
  <style>${checkoutPageStyles()}</style>
</head>
<body>
<div class="card">
  <h1>Complete your order</h1>
  <div class="section">
    <h2>Your cart</h2>
    <ul id="line-items" class="line-items">
      <li><span class="skeleton" style="width:60%"></span><span class="skeleton" style="width:20%"></span></li>
      <li><span class="skeleton" style="width:50%"></span><span class="skeleton" style="width:20%"></span></li>
    </ul>
    <div id="totals" class="totals"></div>
  </div>
  <form id="checkout-form" class="section">
    <h2>Shipping address</h2>
    <div class="form-group"><label>Email</label><input type="email" id="email" placeholder="you@example.com" required></div>
    <div class="row-2">
      <div class="form-group"><label>First name</label><input type="text" id="firstName" placeholder="Jane" required></div>
      <div class="form-group"><label>Last name</label><input type="text" id="lastName" placeholder="Smith" required></div>
    </div>
    <div class="form-group"><label>Street</label><input type="text" id="street" placeholder="123 Main St" required></div>
    <div class="row-2">
      <div class="form-group"><label>ZIP</label><input type="text" id="zip" placeholder="10115" required></div>
      <div class="form-group"><label>City</label><input type="text" id="city" placeholder="Berlin" required></div>
    </div>
    <button type="submit" class="btn" id="submit-btn">Place order</button>
    <div id="status" class="status"></div>
  </form>
  <div id="order-result"></div>
</div>
<script>${checkoutPageScript(baseUrl, accessKey, contextToken)}</script>
</body>
</html>`;
}

function checkoutPageStyles(): string {
  return `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; min-height: 100vh; display: flex; align-items: flex-start; justify-content: center; padding: 2rem 1rem; }
    .card { background: #fff; border-radius: 12px; box-shadow: 0 2px 16px rgba(0,0,0,.08); padding: 2rem; width: 100%; max-width: 520px; }
    h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 1.5rem; }
    h2 { font-size: .875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: #666; margin-bottom: .75rem; }
    .line-items { list-style: none; margin-bottom: 1.5rem; }
    .line-items li { display: flex; justify-content: space-between; padding: .5rem 0; border-bottom: 1px solid #f0f0f0; font-size: .9375rem; }
    .line-items li:last-child { border-bottom: none; }
    .qty { color: #666; }
    .totals { margin-bottom: 1.5rem; }
    .totals .row { display: flex; justify-content: space-between; padding: .3rem 0; font-size: .9375rem; }
    .totals .row.total { font-weight: 700; font-size: 1rem; border-top: 2px solid #1a1a1a; margin-top: .5rem; padding-top: .75rem; }
    .form-group { margin-bottom: 1rem; }
    label { display: block; font-size: .8125rem; font-weight: 500; margin-bottom: .3rem; color: #444; }
    input, select { width: 100%; padding: .6rem .75rem; border: 1px solid #d0d0d0; border-radius: 6px; font-size: .9375rem; outline: none; }
    input:focus, select:focus { border-color: #0070f3; box-shadow: 0 0 0 3px rgba(0,112,243,.12); }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .btn { width: 100%; padding: .875rem; background: #0070f3; color: #fff; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600; cursor: pointer; margin-top: .5rem; }
    .btn:hover { background: #005ed4; }
    .btn:disabled { background: #aaa; cursor: not-allowed; }
    .status { margin-top: 1rem; padding: .75rem; border-radius: 6px; font-size: .875rem; display: none; }
    .status.error { background: #fff0f0; border: 1px solid #ffb3b3; color: #c00; display: block; }
    .status.success { background: #f0fff4; border: 1px solid #86efac; color: #166534; display: block; }
    .skeleton { background: #e8e8e8; border-radius: 4px; height: 1em; margin: .4rem 0; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
    .section { margin-bottom: 1.75rem; }
    #order-result { margin-top: 1.5rem; }
    #order-result a { color: #0070f3; text-decoration: none; font-weight: 500; }
  `;
}

function checkoutPageScript(baseUrl: string, accessKey: string, contextToken: string): string {
  return `
(async () => {
  const BASE = ${baseUrl};
  const KEY  = ${accessKey};
  const TOKEN = ${contextToken};
  const headers = (extra = {}) => ({ 'sw-access-key': KEY, 'sw-context-token': TOKEN, 'content-type': 'application/json', ...extra });
  ${cartScriptBody()}
  ${orderScriptBody()}
})();
`;
}

function cartScriptBody(): string {
  return `
  async function loadCart() {
    const res = await fetch(BASE + '/store-api/checkout/cart', { headers: headers() });
    if (!res.ok) throw new Error('Could not load cart (' + res.status + ')');
    return res.json();
  }
  function formatPrice(amount) {
    return Number(amount).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  }
  try {
    const cart = await loadCart();
    const ul = document.getElementById('line-items');
    ul.innerHTML = '';
    (cart.lineItems || []).forEach(item => {
      const li = document.createElement('li');
      const qty = item.quantity || 1;
      const price = item.price?.totalPrice ?? 0;
      li.innerHTML = \`<span><span class="qty">\${qty}×</span> \${item.label || item.id}</span><span>\${formatPrice(price)}</span>\`;
      ul.appendChild(li);
    });
    const p = cart.price || {};
    document.getElementById('totals').innerHTML = \`
      <div class="row"><span>Subtotal</span><span>\${formatPrice(p.netPrice || 0)}</span></div>
      <div class="row"><span>Tax</span><span>\${formatPrice((p.totalPrice || 0) - (p.netPrice || 0))}</span></div>
      <div class="row total"><span>Total</span><span>\${formatPrice(p.totalPrice || 0)}</span></div>
    \`;
  } catch (e) {
    document.getElementById('line-items').innerHTML = '<li style="color:#c00">Could not load cart: ' + e.message + '</li>';
  }`;
}

function orderScriptBody(): string {
  return `
  async function getCountryId(iso) {
    const res = await fetch(BASE + '/store-api/country?filter[iso]=' + iso, { headers: headers() });
    return (await res.json()).elements?.[0]?.id;
  }
  async function getSalutationId() {
    const res = await fetch(BASE + '/store-api/salutation', { headers: headers() });
    return (await res.json()).elements?.[0]?.id;
  }
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    const status = document.getElementById('status');
    btn.disabled = true; btn.textContent = 'Placing order…'; status.className = 'status';
    try {
      const [countryId, salutationId] = await Promise.all([getCountryId('DE'), getSalutationId()]);
      const orderRes = await fetch(BASE + '/store-api/checkout/order', {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ billingAddress: {
          firstName: document.getElementById('firstName').value,
          lastName: document.getElementById('lastName').value,
          email: document.getElementById('email').value,
          street: document.getElementById('street').value,
          zipcode: document.getElementById('zip').value,
          city: document.getElementById('city').value,
          countryId, salutationId,
        }}),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.errors?.[0]?.detail || JSON.stringify(order));
      document.getElementById('checkout-form').style.display = 'none';
      document.getElementById('order-result').innerHTML =
        \`<div class="status success">Order placed! Order number: <strong>\${order.orderNumber || order.id}</strong></div>\`;
    } catch (err) {
      status.textContent = err.message; status.className = 'status error';
      btn.disabled = false; btn.textContent = 'Place order';
    }
  });`;
}
