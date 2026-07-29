import { demoPageScript } from './page-script.js';
import { demoPageStyles } from './page-styles.js';

const demoPageBody = `
<body>

<header class="hdr">
  <div>
    <div class="hdr-eye">Agent-to-Agent Protocol</div>
    <div class="hdr-title">Buyer Agent &times; Seller Agent</div>
  </div>
  <div class="hdr-badge">
    <div class="live-dot"></div>
    A2A&nbsp;/&nbsp;1.0.0 &middot; Live
  </div>
</header>

<div class="wrap">

  <div class="goal-section">
    <label class="goal-label" for="goal">Purchase Goal</label>
    <textarea
      id="goal"
      class="goal-input"
      rows="2"
      placeholder="e.g. I need to buy a t-shirt for a team of 3 people under &euro;50 each"
    ></textarea>
  </div>

  <div class="agents">
    <div class="acard buyer" id="bc">
      <div class="ac-role">Buyer Agent</div>
      <div class="ac-name">Buyer Agent</div>
      <div class="ac-ver">__BUYER_MODEL__ &middot; autonomous</div>
      <div class="ac-row">
        <div class="sdot b" id="bdot"></div>
        <span id="bst">Idle</span>
      </div>
      <div class="ac-think">
        <div class="tdots"><span></span><span></span><span></span></div>
        Deciding next message&hellip;
      </div>
    </div>

    <div class="conn">
      <div class="conn-lbl">A2A</div>
      <div class="conn-bar"></div>
      <div class="conn-lbl">v1.0</div>
    </div>

    <div class="acard seller" id="sc">
      <div class="ac-role">Seller Agent</div>
      <div class="ac-name">Seller Agent</div>
      <div class="ac-ver">v0.1.0 &middot; Shopware</div>
      <div class="ac-row">
        <div class="sdot s on" id="sdot"></div>
        <span id="sst">Ready</span>
      </div>
      <div class="ac-think">
        <div class="tdots"><span></span><span></span><span></span></div>
        Processing request&hellip;
      </div>
    </div>
  </div>

  <div class="sec-row">
    <div class="sec-lbl">Message Exchange</div>
    <div class="sec-cnt" id="cnt">0 messages</div>
  </div>

  <div class="feed" id="feed"></div>

  <div class="err-banner" id="err"></div>

  <div class="agr" id="agr">
    <div class="agr-hdr">
      <div class="agr-ico">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="#080C14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <div>
        <div class="agr-t" id="agr-title">Order Created</div>
        <div class="agr-s" id="agr-sub">A2A task completed</div>
      </div>
    </div>
    <div class="agr-stats">
      <div class="astat"><div class="as-lbl">Goal</div><div class="as-val" id="agr-goal">&mdash;</div></div>
      <div class="astat"><div class="as-lbl">Messages</div><div class="as-val" id="agr-msgs">0</div></div>
      <div class="astat"><div class="as-lbl">Status</div><div class="as-val" id="agr-status" style="color:var(--seller)">Order Placed</div></div>
    </div>
  </div>

  <div class="ctrls">
    <button class="btn btn-run" id="runBtn" onclick="startNegotiation()">
      <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true"><path d="M2 1.5l7 4-7 4V1.5z" fill="currentColor"/></svg>
      Start Negotiation
    </button>
    <button class="btn btn-rst" id="rstBtn" onclick="resetDemo()">Reset</button>
    <span class="cst" id="cst"></span>
  </div>

</div>

`;

export function demoPageHtml(buyerModelName: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>A2A Demo — Buyer Agent</title>
  <style>${demoPageStyles}</style>
</head>
${demoPageBody.replace('__BUYER_MODEL__', buyerModelName)}
<script>${demoPageScript}</script>

</body>
</html>`;
}
