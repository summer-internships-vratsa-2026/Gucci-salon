/* ============================================================
   SVEJARKA AI — chat logic
   Talks to /api/chat (Vercel serverless function), which calls
   Gemini 2.5 Flash server-side so the API key never reaches the client.

   IMAGE UPLOADS — bandwidth notes (Vercel Hobby plan):
   - Hobby has a hard 100GB/month bandwidth cap and every function
     request/response body is capped at 4.5MB, so photos are always
     compressed client-side, on-device, BEFORE anything is sent.
   - Resized to max 1024px on the long edge (a hairstyle/face photo
     doesn't need to be bigger than that for the AI to read it well,
     and it roughly matches how vision models tile images internally
     anyway — sending more pixels just burns bandwidth for no benefit).
   - Re-encoded as JPEG with an adaptive quality/size loop until the
     payload is comfortably small (target ~350KB before base64, which
     becomes ~470KB on the wire — a fraction of the 4.5MB hard limit).
   - The photo is only ever sent ONCE, on the turn it's attached. Chat
     history sent on later turns keeps a short text marker instead of
     the image bytes, so a conversation with several photos doesn't
     make every subsequent request bigger and bigger.
============================================================ */
(function(){
  const chatEl = document.getElementById('svejarkaChat');
  const form = document.getElementById('svejarkaForm');
  const input = document.getElementById('svejarkaInput');
  const sendBtn = document.getElementById('svejarkaSend');
  const attachBtn = document.getElementById('svejarkaAttachBtn');
  const cameraBtn = document.getElementById('svejarkaCameraBtn');
  const fileInput = document.getElementById('svejarkaFile');
  const cameraInput = document.getElementById('svejarkaFileCamera');
  const previewWrap = document.getElementById('svejarkaPreview');
  const previewImg = document.getElementById('svejarkaPreviewImg');
  const previewRemove = document.getElementById('svejarkaPreviewRemove');
  const composerEl = document.querySelector('.svejarka-composer');
  if (!chatEl || !form || !input || !sendBtn) return;

  // The composer grows taller when a photo preview appears above the input
  // row. Rather than guessing a fixed pixel value for how much space to
  // reserve at the bottom of the chat feed, measure the composer's real
  // rendered height live and expose it as a CSS variable that the chat
  // section's padding-bottom reads from (see styles.css --composer-h).
  if (composerEl && typeof ResizeObserver === 'function'){
    const reportComposerHeight = () => {
      document.documentElement.style.setProperty('--composer-h', composerEl.offsetHeight + 'px');
    };
    new ResizeObserver(reportComposerHeight).observe(composerEl);
    reportComposerHeight();
  }

  const MAX_HISTORY_SENT = 8;          // keep upload payload small as the chat grows
  const MAX_SOURCE_MB = 20;            // reject absurdly large source files before we even try to decode them
  const MAX_DIM = 1024;                // long-edge cap after resize
  const MIN_DIM = 640;                 // don't shrink below this even if still over target
  const TARGET_BYTES = 350 * 1024;     // ~350KB before base64 overhead — the compression target

  let history = []; // {role:'user'|'model', text:string}
  let pendingImage = null; // { dataUrl, base64, mimeType } | null
  let busy = false;

  function scrollToLatest(){
    requestAnimationFrame(() => {
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
    });
  }

  function addMessage(role, text, imageSrc){
    const wrap = document.createElement('div');
    wrap.className = 'svejarka-msg ' + (role === 'user' ? 'user' : 'bot');
    const bubble = document.createElement('div');
    bubble.className = 'svejarka-bubble';
    if (imageSrc){
      const img = document.createElement('img');
      img.className = 'svejarka-msg-img';
      img.src = imageSrc;
      img.alt = 'Прикачена снимка';
      bubble.appendChild(img);
    }
    if (text){
      const textEl = document.createElement('div');
      textEl.textContent = text;
      bubble.appendChild(textEl);
    }
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
    if (attachBtn) attachBtn.disabled = state;
    if (cameraBtn) cameraBtn.disabled = state;
  }

  function setPendingImage(dataUrl){
    const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!match) return;
    pendingImage = { dataUrl, mimeType: match[1], base64: match[2] };
    if (previewImg) previewImg.src = dataUrl;
    if (previewWrap) previewWrap.hidden = false;
    if (attachBtn) attachBtn.classList.add('has-image');
    if (cameraBtn) cameraBtn.classList.add('has-image');
  }

  function clearPendingImage(){
    pendingImage = null;
    if (previewImg) previewImg.removeAttribute('src');
    if (previewWrap) previewWrap.hidden = true;
    if (attachBtn) attachBtn.classList.remove('has-image');
    if (cameraBtn) cameraBtn.classList.remove('has-image');
  }

  function loadImageElement(file){
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')); };
      img.src = url;
    });
  }

  // Resize to MAX_DIM on the long edge, then squeeze quality down (and, if that's
  // still not enough, shrink dimensions once more) until we're under TARGET_BYTES.
  async function compressImage(file){
    const img = await loadImageElement(file);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    function drawAt(maxDim){
      const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }

    function byteSize(dataUrl){
      return Math.round(dataUrl.length * 0.75); // approx decoded size from base64 length
    }

    drawAt(MAX_DIM);
    let quality = 0.8;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);

    while (byteSize(dataUrl) > TARGET_BYTES && quality > 0.35){
      quality -= 0.15;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    if (byteSize(dataUrl) > TARGET_BYTES && canvas.width > MIN_DIM){
      drawAt(MIN_DIM);
      quality = 0.7;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }

    return dataUrl;
  }

  // Shared by both the gallery picker and the direct-camera capture — same
  // validation and client-side compression either way, only the source input differs.
  async function handleSelectedFile(file, triggerBtn){
    if (!file) return;

    if (!file.type.startsWith('image/')){
      addMessage('bot', 'Може да прикачиш само снимка (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > MAX_SOURCE_MB * 1024 * 1024){
      addMessage('bot', `Снимката е твърде голяма (макс. ${MAX_SOURCE_MB}MB).`);
      return;
    }

    if (triggerBtn) triggerBtn.disabled = true;
    try{
      const dataUrl = await compressImage(file);
      setPendingImage(dataUrl);
    } catch (err){
      addMessage('bot', 'Не успях да обработя снимката. Опитай с друга.');
    } finally {
      if (triggerBtn) triggerBtn.disabled = false;
    }
  }

  if (attachBtn && fileInput){
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = ''; // allow re-selecting the same file later
      handleSelectedFile(file, attachBtn);
    });
  }

  if (cameraBtn && cameraInput){
    cameraBtn.addEventListener('click', () => cameraInput.click());
    cameraInput.addEventListener('change', () => {
      const file = cameraInput.files && cameraInput.files[0];
      cameraInput.value = ''; // allow capturing another photo later
      handleSelectedFile(file, cameraBtn);
    });
  }

  if (previewRemove){
    previewRemove.addEventListener('click', clearPendingImage);
  }

  async function sendMessage(rawText){
    const text = (rawText || '').trim();
    const image = pendingImage;
    if (busy || (!text && !image)) return;

    setBusy(true);
    addMessage('user', text, image ? image.dataUrl : null);
    addTyping();
    input.value = '';
    clearPendingImage();

    try{
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: history.slice(-MAX_HISTORY_SENT),
          image: image ? { mimeType: image.mimeType, data: image.base64 } : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      removeTyping();

      if (!res.ok || data.error){
        addMessage('bot', data.error || 'Възникна грешка. Опитай отново след малко.');
      } else {
        addMessage('bot', data.reply);
        // Never resend image bytes in later turns — a short marker is enough
        // context, and it keeps every future request small regardless of how
        // many photos were shared earlier in the conversation.
        history.push({ role: 'user', text: text || '[Клиентът сподели снимка]' });
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
