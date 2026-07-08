/* ============================================================
   SVEJARKA AI — chat logic
   Talks to /api/chat (Vercel serverless function), which calls
   Gemini 2.5 Flash server-side so the API key never reaches the client.
============================================================ */
(function(){
  const chatEl = document.getElementById('svejarkaChat');
  const form = document.getElementById('svejarkaForm');
  const input = document.getElementById('svejarkaInput');
  const sendBtn = document.getElementById('svejarkaSend');
  if (!chatEl || !form || !input || !sendBtn) return;

  const MAX_HISTORY_SENT = 8; // keep upload payload small as the chat grows
  let history = []; // {role:'user'|'model', text:string}
  let busy = false;

  function scrollToLatest(){
    requestAnimationFrame(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }

  function addMessage(role, text){
    const wrap = document.createElement('div');
    wrap.className = 'svejarka-msg ' + (role === 'user' ? 'user' : 'bot');
    const bubble = document.createElement('div');
    bubble.className = 'svejarka-bubble';
    bubble.textContent = text;
    wrap.appendChild(bubble);
    chatEl.appendChild(wrap);
    scrollToLatest();
    return bubble;
  }

  function addTyping(){
    const wrap = document.createElement('div');
    wrap.className = 'svejarka-msg bot';
    wrap.id = 'svejarkaTyping';
    wrap.innerHTML = '<div class="svejarka-bubble svejarka-typing"><span></span><span></span><span></span></div>';
    chatEl.appendChild(wrap);
    scrollToLatest();
  }

  function removeTyping(){
    const t = document.getElementById('svejarkaTyping');
    if (t) t.remove();
  }

  function setBusy(state){
    busy = state;
    sendBtn.disabled = state;
    input.disabled = state;
  }

  async function sendMessage(rawText){
    const text = (rawText || '').trim();
    if (busy || !text) return;

    setBusy(true);
    addMessage('user', text);
    addTyping();
    input.value = '';

    try{
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(-MAX_HISTORY_SENT),
        }),
      });
      const data = await res.json().catch(() => ({}));
      removeTyping();

      if (!res.ok || data.error){
        addMessage('bot', data.error || 'Възникна грешка. Опитай отново след малко.');
      } else {
        addMessage('bot', data.reply);
        history.push({ role: 'user', text });
        history.push({ role: 'model', text: data.reply });
        history = history.slice(-MAX_HISTORY_SENT);
      }
    } catch (err){
      removeTyping();
      addMessage('bot', 'Няма връзка със сървъра. Провери интернета и опитай пак.');
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  form.addEventListener('submit', (e)=>{
    e.preventDefault();
    sendMessage(input.value);
  });
})();
