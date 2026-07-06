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

  function appendMsg(side, text, toolCalls) {
    msgCount++;
    var cls  = side === 'buyer' ? 'fb' : 'fs';
    var role = side === 'buyer' ? 'USER' : 'AGENT';
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

    var html = '<div class="msg ' + cls + '" id="' + id + '">'
      + '<div class="mhdr">'
      + '<span class="mid">' + id + '</span>'
      + '<span class="mrole">' + role + '</span>'
      + '<span class="mts">' + time + '</span>'
      + '</div>'
      + '<div class="mbody">' + escHtml(text) + toolsHtml + '</div>'
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
      }
    } else if (type === 'buyer') {
      appendMsg('buyer', data.message, []);
    } else if (type === 'seller') {
      appendMsg('seller', data.message, data.toolCalls || []);
      if (data.contextId) contextId = data.contextId;
    } else if (type === 'done') {
      setCard('buyer', 'done');
      setCard('seller', 'done');
      document.getElementById('cst').textContent = 'Complete';
      if (data.contextId) contextId = data.contextId;

      var ctx = contextId || '?';
      document.getElementById('agr-sub').textContent = 'contextId: ' + ctx + ' · ' + msgCount + ' messages exchanged';
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
