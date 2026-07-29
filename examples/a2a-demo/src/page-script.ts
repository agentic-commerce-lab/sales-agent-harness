export const demoPageScript = `
  var running = false;
  var msgCount = 0;
  var contextId = null;
  var currentGoal = '';

  function ts() {
    return new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function setCard(who, state) {
    var card = document.getElementById(who === 'buyer' ? 'bc' : 'sc');
    var dot  = document.getElementById(who === 'buyer' ? 'bdot' : 'sdot');
    var st   = document.getElementById(who === 'buyer' ? 'bst' : 'sst');
    card.classList.remove('thinking');
    dot.classList.remove('on');
    if (state === 'thinking') {
      card.classList.add('thinking');
      st.textContent = 'Processing…';
    } else if (state === 'active') {
      dot.classList.add('on');
      st.textContent = 'Active';
    } else if (state === 'done') {
      dot.classList.add('on');
      st.textContent = 'Completed';
    } else {
      st.textContent = 'Idle';
    }
  }

  function appendMsg(side, text, toolCalls, ap2Mandate) {
    msgCount++;
    var cls  = side === 'buyer' ? 'fb' : 'fs';
    var role = side === 'buyer' ? 'BUYER AGENT' : 'SELLER AGENT';
    var id   = 'msg-' + side[0] + String(msgCount).padStart(3, '0');
    var time = ts();

    var toolsHtml = '';
    if (toolCalls && toolCalls.length) {
      toolsHtml = '<div class="tools">';
      for (var i = 0; i < toolCalls.length; i++) {
        toolsHtml += '<div class="tool"><div class="tpip"></div><span>' + escHtml(toolCalls[i]) + '</span></div>';
      }
      toolsHtml += '</div>';
    }

    var mandateHtml = '';
    if (ap2Mandate) {
      var pinLabel = (ap2Mandate.pinned && ap2Mandate.checkoutTerms)
        ? 'pinned to ' + escHtml(ap2Mandate.checkoutTerms.checkoutId) + ' \\u00b7 ' + escHtml(String(ap2Mandate.checkoutTerms.totalAmount)) + ' ' + escHtml(ap2Mandate.checkoutTerms.currency)
        : 'not yet pinned to a checkout';
      mandateHtml = '<div class="tools"><div class="tool"><div class="tpip mandate-pip"></div><span>AP2 mandate '
        + escHtml(shortHash(ap2Mandate.checkoutMandate)) + ' \\u2014 ' + pinLabel + '</span></div></div>';
    }

    var html = '<div class="msg ' + cls + '" id="' + id + '">'
      + '<div class="mhdr">'
      + '<span class="mid">' + id + '</span>'
      + '<span class="mrole">' + role + '</span>'
      + '<span class="mts">' + time + '</span>'
      + '</div>'
      + '<div class="mbody">' + escHtml(text) + toolsHtml + mandateHtml + '</div>'
      + '</div>';

    document.getElementById('feed').insertAdjacentHTML('beforeend', html);
    document.getElementById('cnt').textContent = msgCount + (msgCount === 1 ? ' message' : ' messages');

    setTimeout(function() {
      var el = document.getElementById(id);
      if (el) el.classList.add('vis');
      scrollToLatest();
    }, 40);
  }

  function scrollToLatest() {
    requestAnimationFrame(function() {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
  }

  function payCell(label, valueHtml) {
    return '<div class="pay-cell"><div class="pay-lbl">' + label + '</div>'
      + '<div class="pay-val">' + valueHtml + '</div></div>';
  }

  function shortHash(hash) {
    return hash.length > 18 ? hash.slice(0, 10) + '…' + hash.slice(-6) : hash;
  }

  function appendPayment(data) {
    msgCount++;
    var id = 'pay-' + String(msgCount).padStart(3, '0');
    var failed = !data.paid;

    var cells = '';
    if (failed) {
      cells = '<div class="pay-err">' + escHtml(data.error || 'Unknown payment error') + '</div>';
    } else {
      if (data.orderNumber) cells += payCell('Order', escHtml(data.orderNumber));
      if (data.amountAtomic) cells += payCell('Amount (atomic units)', escHtml(data.amountAtomic));
      if (data.transactionHash) {
        var txHtml = escHtml(shortHash(data.transactionHash));
        if (data.explorerUrl && String(data.explorerUrl).indexOf('https://') === 0) {
          txHtml = '<a href="' + escHtml(data.explorerUrl) + '" target="_blank" rel="noopener noreferrer">' + txHtml + ' ↗</a>';
        }
        cells += payCell('Settlement TX', txHtml);
      }
      cells = '<div class="pay-grid">' + cells + '</div>';
    }

    var html = '<div class="pay' + (failed ? ' failed' : '') + '" id="' + id + '">'
      + '<div class="pay-hdr">'
      + '<span class="pay-badge">x402 payment</span>'
      + '<span class="pay-title">' + (failed ? 'Payment failed' : 'Payment settled on-chain') + '</span>'
      + '<span class="pay-ts">' + ts() + '</span>'
      + '</div>'
      + cells
      + '</div>';

    document.getElementById('feed').insertAdjacentHTML('beforeend', html);
    document.getElementById('cnt').textContent = msgCount + (msgCount === 1 ? ' message' : ' messages');

    setTimeout(function() {
      var el = document.getElementById(id);
      if (el) el.classList.add('vis');
      scrollToLatest();
    }, 40);
  }

  function appendHandoff(data) {
    msgCount++;
    var id = 'hof-' + String(msgCount).padStart(3, '0');
    var url = String(data.continueUrl || '');
    var safe = url.indexOf('https://') === 0 || url.indexOf('http://') === 0;
    var link = safe
      ? '<a href="' + escHtml(url) + '" target="_blank" rel="noopener noreferrer">Continue checkout in browser ↗</a>'
      : escHtml(url);

    var html = '<div class="pay" id="' + id + '">'
      + '<div class="pay-hdr">'
      + '<span class="pay-badge">handoff</span>'
      + '<span class="pay-title">x402 unavailable — finish in browser</span>'
      + '<span class="pay-ts">' + ts() + '</span>'
      + '</div>'
      + '<div class="pay-grid">' + payCell('Checkout link', link) + '</div>'
      + '</div>';

    document.getElementById('feed').insertAdjacentHTML('beforeend', html);
    document.getElementById('cnt').textContent = msgCount + (msgCount === 1 ? ' message' : ' messages');

    setTimeout(function() {
      var el = document.getElementById(id);
      if (el) el.classList.add('vis');
      scrollToLatest();
    }, 40);
  }

  function appendAp2(data) {
    msgCount++;
    var id = 'ap2-' + String(msgCount).padStart(3, '0');

    var cells = '';
    if (data.mandate) {
      cells += payCell('Checkout mandate', escHtml(shortHash(data.mandate.checkoutMandate)));
    }
    if (data.merchantAuthorization) {
      cells += payCell('Shop verification', escHtml(shortHash(data.merchantAuthorization)));
    }

    var html = '<div class="pay ap2" id="' + id + '">'
      + '<div class="pay-hdr">'
      + '<span class="pay-badge ap2-badge">AP2 mandate</span>'
      + '<span class="pay-title">Checkout verified against buyer mandate</span>'
      + '<span class="pay-ts">' + ts() + '</span>'
      + '</div>'
      + '<div class="pay-grid">' + cells + '</div>'
      + '</div>';

    document.getElementById('feed').insertAdjacentHTML('beforeend', html);
    document.getElementById('cnt').textContent = msgCount + (msgCount === 1 ? ' message' : ' messages');

    setTimeout(function() {
      var el = document.getElementById(id);
      if (el) el.classList.add('vis');
      scrollToLatest();
    }, 40);
  }

  function showError(msg) {
    var el = document.getElementById('err');
    el.textContent = 'Error: ' + msg;
    el.classList.add('show');
    scrollToLatest();
  }

  function handleSseEvent(type, data) {
    if (type === 'status') {
      if (data.phase === 'buyer-thinking') {
        setCard('buyer', 'thinking');
        setCard('seller', 'active');
        document.getElementById('cst').textContent = 'Buyer deciding…';
      } else if (data.phase === 'seller-thinking') {
        setCard('buyer', 'active');
        setCard('seller', 'thinking');
        document.getElementById('cst').textContent = 'Seller responding…';
      } else if (data.phase === 'buyer-paying') {
        setCard('buyer', 'thinking');
        setCard('seller', 'active');
        document.getElementById('bst').textContent = 'Signing payment…';
        document.getElementById('cst').textContent = 'Buyer paying via x402…';
      }
    } else if (type === 'buyer') {
      appendMsg('buyer', data.message, [], data.ap2Mandate);
    } else if (type === 'seller') {
      appendMsg('seller', data.message, data.toolCalls || []);
      if (data.contextId) contextId = data.contextId;
    } else if (type === 'ap2') {
      appendAp2(data);
    } else if (type === 'payment') {
      appendPayment(data);
    } else if (type === 'handoff') {
      appendHandoff(data);
    } else if (type === 'done') {
      setCard('buyer', 'done');
      setCard('seller', 'done');
      var handoff = data.outcome === 'handoff';
      document.getElementById('cst').textContent = handoff ? 'Handed off' : 'Complete';
      if (data.contextId) contextId = data.contextId;

      // No order is placed on a handoff — say so instead of claiming an order.
      document.getElementById('agr-title').textContent = handoff ? 'Checkout handed off' : 'Order Created';
      document.getElementById('agr-status').textContent = handoff ? 'Awaiting browser checkout' : 'Order Placed';

      var ctx = contextId || '?';
      document.getElementById('agr-sub').textContent = handoff
        ? 'No order placed — buyer finishes in a browser'
        : 'contextId: ' + ctx + ' · ' + msgCount + ' messages exchanged';
      document.getElementById('agr-goal').textContent = currentGoal.length > 40 ? currentGoal.slice(0, 38) + '…' : currentGoal;
      document.getElementById('agr-msgs').textContent = String(msgCount);

      setTimeout(function() {
        document.getElementById('agr').classList.add('vis');
        scrollToLatest();
      }, 300);
    } else if (type === 'error') {
      showError(data.message || 'Unknown error');
      document.getElementById('cst').textContent = 'Failed';
      setCard('buyer', 'idle');
      setCard('seller', 'idle');
    }
  }

  async function startNegotiation() {
    if (running) return;

    var goal = document.getElementById('goal').value.trim();
    if (!goal) { document.getElementById('goal').focus(); return; }

    running = true;
    currentGoal = goal;
    msgCount = 0;
    contextId = null;

    document.getElementById('runBtn').disabled = true;
    document.getElementById('rstBtn').style.display = 'none';
    document.getElementById('feed').innerHTML = '';
    document.getElementById('agr').classList.remove('vis');
    document.getElementById('err').classList.remove('show');
    document.getElementById('cnt').textContent = '0 messages';
    document.getElementById('cst').textContent = 'Connecting…';
    document.getElementById('goal').disabled = true;
    setCard('buyer', 'active');
    setCard('seller', 'active');

    try {
      var response = await fetch('/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ goal: goal })
      });

      if (!response.ok) {
        var errData = await response.json();
        throw new Error(errData.error || 'Server error ' + response.status);
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var sseBuffer = '';

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;

        sseBuffer += decoder.decode(chunk.value, { stream: true });

        var parts = sseBuffer.split('\\n\\n');
        sseBuffer = parts.pop() || '';

        for (var i = 0; i < parts.length; i++) {
          var part = parts[i].trim();
          if (!part) continue;
          var eventType = 'message';
          var dataLine = '';
          var lines = part.split('\\n');
          for (var j = 0; j < lines.length; j++) {
            if (lines[j].startsWith('event: ')) eventType = lines[j].slice(7);
            else if (lines[j].startsWith('data: ')) dataLine = lines[j].slice(6);
          }
          if (!dataLine) continue;
          try { handleSseEvent(eventType, JSON.parse(dataLine)); } catch(e) {}
        }
      }
    } catch (err) {
      if (document.getElementById('err').textContent === '') {
        showError(err.message || String(err));
        document.getElementById('cst').textContent = 'Failed';
        setCard('buyer', 'idle');
        setCard('seller', 'idle');
      }
    } finally {
      running = false;
      document.getElementById('runBtn').disabled = false;
      document.getElementById('rstBtn').style.display = 'inline-flex';
      document.getElementById('goal').disabled = false;
    }
  }

  function resetDemo() {
    if (running) return;
    document.getElementById('feed').innerHTML = '';
    document.getElementById('agr').classList.remove('vis');
    document.getElementById('err').classList.remove('show');
    document.getElementById('rstBtn').style.display = 'none';
    document.getElementById('cst').textContent = '';
    document.getElementById('cnt').textContent = '0 messages';
    setCard('buyer', 'idle');
    setCard('seller', 'idle');
    document.getElementById('sdot').classList.add('on');
    document.getElementById('sst').textContent = 'Ready';
    document.getElementById('goal').disabled = false;
    contextId = null;
    msgCount = 0;
  }
`;
