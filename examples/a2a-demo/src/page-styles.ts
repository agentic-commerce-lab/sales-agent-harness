export const demoPageStyles = `
    :root {
      --bg: #080C14;
      --surface: #0F1520;
      --card: #141C2A;
      --border: #1D2B3E;
      --buyer: #4B9EFF;
      --buyer-bg: rgba(75,158,255,.07);
      --buyer-bd: rgba(75,158,255,.22);
      --seller: #2ED8A0;
      --seller-bg: rgba(46,216,160,.07);
      --seller-bd: rgba(46,216,160,.22);
      --gold: #F5C842;
      --gold-bg: rgba(245,200,66,.06);
      --gold-bd: rgba(245,200,66,.32);
      --text: #DDE6F0;
      --t2: #6B8099;
      --t3: #2E4059;
      --mono: 'SF Mono','Cascadia Code','Fira Code',Consolas,monospace;
      --sans: system-ui,-apple-system,'Segoe UI',sans-serif;
    }
    *,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: var(--sans); line-height: 1.5; min-height: 100vh; }

    /* Header */
    .hdr {
      position: sticky; top: 0; z-index: 10;
      background: rgba(8,12,20,.94); backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--border);
      padding: 14px 28px; display: flex; align-items: center; justify-content: space-between;
    }
    .hdr-eye { font-family: var(--mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t2); margin-bottom: 2px; }
    .hdr-title { font-size: 15px; font-weight: 600; }
    .hdr-badge {
      display: flex; align-items: center; gap: 8px;
      font-family: var(--mono); font-size: 11px; color: var(--t2);
      background: var(--card); border: 1px solid var(--border); padding: 6px 12px; border-radius: 5px;
    }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--seller); animation: blink 2.4s ease-in-out infinite; }
    @keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: .3; } }

    /* Wrap */
    .wrap { max-width: 860px; margin: 0 auto; padding: 24px 20px 60px; }

    /* Goal input */
    .goal-section {
      background: var(--card); border: 1px solid var(--border); border-radius: 8px;
      padding: 16px 18px; margin-bottom: 22px;
    }
    .goal-label { font-family: var(--mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t2); margin-bottom: 8px; display: block; }
    .goal-input {
      width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 6px;
      padding: 10px 13px; color: var(--text); font: inherit; font-size: 14px;
      resize: none; outline: none; transition: border-color .15s;
    }
    .goal-input:focus { border-color: var(--buyer-bd); }
    .goal-input::placeholder { color: var(--t3); }

    /* Agent cards */
    .agents { display: grid; grid-template-columns: 1fr 60px 1fr; align-items: center; margin-bottom: 22px; }
    .acard {
      background: var(--card); border: 1px solid var(--border); border-radius: 8px;
      padding: 15px 17px; position: relative; overflow: hidden;
    }
    .acard::after { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; }
    .acard.buyer::after { background: var(--buyer); }
    .acard.seller::after { background: var(--seller); }
    .ac-role { font-family: var(--mono); font-size: 10px; letter-spacing: .1em; text-transform: uppercase; color: var(--t2); margin-bottom: 4px; }
    .ac-name { font-weight: 600; font-size: 14px; margin-bottom: 1px; }
    .ac-ver { font-family: var(--mono); font-size: 11px; color: var(--t3); margin-bottom: 10px; }
    .ac-row { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--t2); }
    .sdot { width: 6px; height: 6px; border-radius: 50%; background: var(--t3); transition: background .3s; flex-shrink: 0; }
    .sdot.on.b { background: var(--buyer); }
    .sdot.on.s { background: var(--seller); }
    .acard.thinking .sdot { background: var(--gold); animation: blink .8s infinite; }
    .ac-think { display: none; margin-top: 8px; font-family: var(--mono); font-size: 11px; color: var(--gold); align-items: center; gap: 5px; }
    .acard.thinking .ac-think { display: flex; }
    .tdots span {
      display: inline-block; width: 3px; height: 3px; border-radius: 50%; background: var(--gold);
      margin: 0 1.5px; animation: tdot 1.2s infinite;
    }
    .tdots span:nth-child(2) { animation-delay: .2s; }
    .tdots span:nth-child(3) { animation-delay: .4s; }
    @keyframes tdot { 0%,100% { opacity: .3; transform: translateY(0); } 50% { opacity: 1; transform: translateY(-3px); } }

    /* Connector */
    .conn { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 0 6px; }
    .conn-lbl { font-family: var(--mono); font-size: 9px; letter-spacing: .06em; color: var(--t3); text-transform: uppercase; }
    .conn-bar { width: 100%; height: 1px; background: linear-gradient(90deg, var(--buyer-bd), var(--seller-bd)); }

    /* Feed */
    .sec-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 11px; }
    .sec-lbl { font-family: var(--mono); font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: var(--t3); }
    .sec-cnt { font-family: var(--mono); font-size: 11px; color: var(--t3); }
    .feed { display: flex; flex-direction: column; gap: 10px; min-height: 60px; }

    /* Messages */
    .msg { max-width: 76%; opacity: 0; transform: translateY(6px); transition: opacity .28s, transform .28s; }
    .msg.vis { opacity: 1; transform: translateY(0); }
    .msg.fb { align-self: flex-start; }
    .msg.fs { align-self: flex-end; }
    .mhdr { display: flex; align-items: center; gap: 6px; margin-bottom: 5px; flex-wrap: wrap; }
    .msg.fs .mhdr { flex-direction: row-reverse; }
    .mid { font-family: var(--mono); font-size: 10px; color: var(--t3); }
    .mrole { font-family: var(--mono); font-size: 10px; padding: 2px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: .06em; }
    .msg.fb .mrole { background: var(--buyer-bg); color: var(--buyer); border: 1px solid var(--buyer-bd); }
    .msg.fs .mrole { background: var(--seller-bg); color: var(--seller); border: 1px solid var(--seller-bd); }
    .mts { font-family: var(--mono); font-size: 10px; color: var(--t3); }
    .mbody {
      border-radius: 8px; padding: 11px 14px; font-size: 13.5px; line-height: 1.6;
      border: 1px solid; white-space: pre-wrap; word-break: break-word;
    }
    .msg.fb .mbody { background: var(--buyer-bg); border-color: var(--buyer-bd); border-bottom-left-radius: 2px; }
    .msg.fs .mbody { background: var(--seller-bg); border-color: var(--seller-bd); border-bottom-right-radius: 2px; }
    .tools { margin-top: 9px; border-top: 1px solid var(--border); padding-top: 7px; display: flex; flex-direction: column; gap: 3px; }
    .tool { display: flex; align-items: flex-start; gap: 6px; font-family: var(--mono); font-size: 11px; color: var(--t2); }
    .tpip { width: 4px; height: 4px; border-radius: 50%; background: var(--seller); flex-shrink: 0; margin-top: 4px; }
    .tpip.mandate-pip { background: var(--buyer); }

    /* Payment card */
    .pay {
      align-self: center; width: 100%; max-width: 76%;
      border: 1px solid var(--seller-bd); background: var(--seller-bg);
      border-radius: 9px; padding: 13px 16px;
      opacity: 0; transform: translateY(6px); transition: opacity .28s, transform .28s;
    }
    .pay.vis { opacity: 1; transform: translateY(0); }
    .pay.failed { border-color: rgba(239,68,68,.3); background: rgba(239,68,68,.08); }
    .pay-hdr { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
    .pay-badge {
      font-family: var(--mono); font-size: 10px; padding: 2px 6px; border-radius: 3px;
      text-transform: uppercase; letter-spacing: .06em;
      background: rgba(46,216,160,.12); color: var(--seller); border: 1px solid var(--seller-bd);
    }
    .pay.failed .pay-badge { background: rgba(239,68,68,.12); color: #FCA5A5; border-color: rgba(239,68,68,.3); }
    .pay-title { font-weight: 600; font-size: 13.5px; }
    .pay-ts { font-family: var(--mono); font-size: 10px; color: var(--t3); margin-left: auto; }
    .pay-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .pay-cell { background: rgba(0,0,0,.2); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; min-width: 0; }
    .pay-lbl { font-family: var(--mono); font-size: 10px; color: var(--t3); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 3px; }
    .pay-val { font-family: var(--mono); font-size: 12px; color: var(--text); overflow-wrap: anywhere; }
    .pay-val a { color: var(--buyer); text-decoration: none; }
    .pay-val a:hover { text-decoration: underline; }
    .pay-err { font-family: var(--mono); font-size: 12px; color: #FCA5A5; overflow-wrap: anywhere; }

    /* AP2 mandate card (reuses .pay layout with a buyer-blue accent) */
    .pay.ap2 { border-color: var(--buyer-bd); background: var(--buyer-bg); }
    .ap2-badge { background: rgba(75,158,255,.12); color: var(--buyer); border: 1px solid var(--buyer-bd); }

    /* Error banner */
    .err-banner {
      margin-top: 14px; padding: 12px 16px; border-radius: 7px;
      background: rgba(239,68,68,.08); border: 1px solid rgba(239,68,68,.3);
      color: #FCA5A5; font-family: var(--mono); font-size: 12px;
      display: none;
    }
    .err-banner.show { display: block; }

    /* Agreement */
    .agr {
      margin-top: 22px; border: 1px solid var(--gold-bd); background: var(--gold-bg);
      border-radius: 9px; padding: 18px 22px;
      opacity: 0; transform: translateY(10px); transition: opacity .45s, transform .45s;
    }
    .agr.vis { opacity: 1; transform: translateY(0); }
    .agr-hdr { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
    .agr-ico {
      width: 28px; height: 28px; border-radius: 50%; background: var(--gold);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;
    }
    .agr-t { font-weight: 600; font-size: 14px; color: var(--gold); }
    .agr-s { font-family: var(--mono); font-size: 11px; color: var(--t2); margin-top: 2px; }
    .agr-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .astat { background: rgba(0,0,0,.2); border: 1px solid var(--border); border-radius: 6px; padding: 9px 11px; }
    .as-lbl { font-family: var(--mono); font-size: 10px; color: var(--t3); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 3px; }
    .as-val { font-weight: 600; font-size: 13px; color: var(--text); }

    /* Controls */
    .ctrls { margin-top: 22px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .btn {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 9px 18px; border-radius: 5px; border: none;
      font-size: 13px; font-weight: 500; font-family: var(--sans); cursor: pointer; transition: all .15s;
    }
    .btn:focus-visible { outline: 2px solid var(--buyer); outline-offset: 2px; }
    .btn-run { background: var(--buyer); color: #000; }
    .btn-run:hover:not(:disabled) { background: #6FB4FF; }
    .btn-run:disabled { background: var(--card); color: var(--t3); cursor: not-allowed; }
    .btn-rst { background: var(--card); color: var(--t2); border: 1px solid var(--border); display: none; }
    .btn-rst:hover { border-color: var(--t2); color: var(--text); }
    .cst { font-family: var(--mono); font-size: 11px; color: var(--t3); }

    @media (max-width: 560px) {
      .agr-stats { grid-template-columns: 1fr 1fr; }
      .msg { max-width: 92%; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
    }
`;
