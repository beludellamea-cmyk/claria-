(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const announce = (msg) => { $('liveAnnounce').textContent = ''; window.requestAnimationFrame(() => { $('liveAnnounce').textContent = msg; }); };
  const exampleText = 'El agua es indispensable para la vida. Las personas, los animales y las plantas necesitan agua para vivir. En la naturaleza, el agua cambia de lugar gracias al ciclo del agua. Cuando el sol calienta ríos y lagos, una parte del agua se evapora y sube al aire. Luego, el vapor se enfría y forma nubes. Cuando las gotas se juntan y pesan mucho, caen como lluvia. Finalmente, el agua vuelve al suelo, a los ríos y a los lagos. Cuidar el agua es responsabilidad de todas las personas.';
  let procedures = [];

  // Navegación de una sola página
  function showView(name) {
    if (!['inicio','escribir','lectura','tramites','acerca'].includes(name)) return;
    $$('main .view').forEach((v) => { v.hidden = v.id !== 'view-' + name; });
    $$('button[data-view]').forEach((button) => {
      if (button.classList.contains('nav-link')) {
        const current = button.dataset.view === name;
        button.classList.toggle('active',current);
        if (current) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current');
      }
    });
    history.replaceState(null,'','#'+name);
    const title = $('view-'+name).querySelector('h1');
    if (title) { title.setAttribute('tabindex','-1'); title.focus({preventScroll:true}); }
    window.scrollTo({top:0,behavior:document.body.classList.contains('no-motion')?'instant':'smooth'});
    announce('Sección '+(title?.textContent || name));
  }
  $$('button[data-view]').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.view)));
  $('footerAbout').addEventListener('click',()=>showView('acerca'));

  // Preferencias: solo opciones de visualización persistidas localmente
  const defaults = {size:100,contrast:false,uppercase:false,motion:false};
  let prefs = {...defaults};
  try {prefs={...defaults,...JSON.parse(localStorage.getItem('claria.prefs')||'{}')};} catch (_) {}
  function applyPrefs() {
    prefs.size = Math.max(85,Math.min(180,Number(prefs.size)||100));
    document.body.style.setProperty('--scale',String(prefs.size/100));
    document.body.classList.toggle('high-contrast',Boolean(prefs.contrast));
    document.body.classList.toggle('upper-reader',Boolean(prefs.uppercase));
    document.body.classList.toggle('no-motion',Boolean(prefs.motion));
    $('textSizeValue').textContent=prefs.size+' %';
    [['contrastToggle','contrast','Activado','Desactivado'],['uppercaseToggle','uppercase','Activada','Desactivada'],['motionToggle','motion','Activado','Desactivado']].forEach(([id,key,on,off])=>{
      $(id).textContent=prefs[key]?on:off; $(id).setAttribute('aria-pressed',String(Boolean(prefs[key])));
    });
    try{localStorage.setItem('claria.prefs',JSON.stringify(prefs));}catch(_){}
  }
  applyPrefs();
  function togglePrefs(show) { $('prefs').hidden=!show; $('openPrefs').setAttribute('aria-expanded',String(show)); if(show) $('closePrefs').focus();else $('openPrefs').focus(); }
  $('openPrefs').addEventListener('click',()=>togglePrefs($('prefs').hidden));
  $('closePrefs').addEventListener('click',()=>togglePrefs(false));
  $('largerText').addEventListener('click',()=>{prefs.size=Math.min(180,prefs.size+10);applyPrefs();announce('Texto al '+prefs.size+' por ciento');});
  $('smallerText').addEventListener('click',()=>{prefs.size=Math.max(85,prefs.size-10);applyPrefs();announce('Texto al '+prefs.size+' por ciento');});
  $('contrastToggle').addEventListener('click',()=>{prefs.contrast=!prefs.contrast;applyPrefs();});
  $('uppercaseToggle').addEventListener('click',()=>{prefs.uppercase=!prefs.uppercase;applyPrefs();});
  $('motionToggle').addEventListener('click',()=>{prefs.motion=!prefs.motion;applyPrefs();});
  $('resetPrefs').addEventListener('click',()=>{prefs={...defaults};applyPrefs();announce('Preferencias restablecidas');});

  // Lectura en voz alta: activación voluntaria, no se inicia automáticamente
  function speak(text) {
    if (!('speechSynthesis' in window)) {announce('Este navegador no admite lectura en voz alta.');return false;}
    const clean=String(text||'').trim(); if(!clean) {announce('No hay texto para escuchar.');return false;}
    window.speechSynthesis.cancel();
    const utterance=new SpeechSynthesisUtterance(clean.slice(0,5500));
    utterance.lang='es-AR'; utterance.rate=.92; utterance.pitch=1.02;
    const voices=window.speechSynthesis.getVoices();
    const es=voices.find(v=>v.lang==='es-AR')||voices.find(v=>v.lang?.startsWith('es')); if(es) utterance.voice=es;
    utterance.onstart=()=>document.body.classList.add('speaking');
    utterance.onend=utterance.onerror=()=>document.body.classList.remove('speaking');
    window.speechSynthesis.speak(utterance);return true;
  }
  function stopSpeaking(){if('speechSynthesis' in window)window.speechSynthesis.cancel();document.body.classList.remove('speaking');announce('Lectura detenida');}
  $('listenWelcome').addEventListener('click',()=>speak('¡Hola! Soy CLARIA. Puedo ayudarte a leer y comprender documentos o acompañarte con la orientación de un trámite. Elegí una de las dos opciones para comenzar.'));
  $('stopSpeaking').addEventListener('click',stopSpeaking);

  // Lector por partes
  let readingParts=[],currentReading=0,currentText='',currentSource='typed',lastExtracted={text:'',source:'typed'};
  function chunkText(text,size=60){
    const words=text.trim().split(/\s+/).filter(Boolean);let parts=[];
    for(let i=0;i<words.length;i+=size) parts.push(words.slice(i,i+size).join(' '));
    return parts;
  }
  function quickView(text){
    const sentences=(text.match(/[^.!?\n]+[.!?]?/g)||[]).map(s=>s.trim()).filter(s=>s.length>12);
    return sentences.slice(0,Math.min(3,sentences.length)).join('\n\n')||'El texto es muy breve. Leelo completo en la tarjeta superior.';
  }
  function renderReading(){
    if(!readingParts.length) return;
    $('readerEmpty').hidden=true;$('readerReady').hidden=false;
    $('readingCard').textContent=readingParts[currentReading];
    $('partCounter').textContent=`Parte ${currentReading+1} de ${readingParts.length}`;
    $('wordCount').textContent=`${currentText.trim().split(/\s+/).length} palabras en total`;
    $('progressFill').style.width=(100*(currentReading+1)/readingParts.length)+'%';
    $('prevPart').disabled=currentReading===0; $('nextPart').disabled=currentReading===readingParts.length-1;
    $('quickSummary').textContent=quickView(currentText);
    announce('Parte '+(currentReading+1));
  }
  function loadReading(text,source='typed'){
    const clean=String(text||'').trim();if(clean.length<12){announce('Escribí al menos 12 caracteres para comenzar.');$('inputText').focus();return;}
    currentText=clean;currentSource=source;readingParts=chunkText(clean);currentReading=0;renderReading();
    $('readingCard').focus();
  }
  $('useText').addEventListener('click',()=>{const v=$('inputText').value;loadReading(v,v.trim()===lastExtracted.text.trim()&&lastExtracted.text?lastExtracted.source:'typed');});
  $('loadExample').addEventListener('click',()=>{$('inputText').value=exampleText;loadReading(exampleText);});
  $('prevPart').addEventListener('click',()=>{if(currentReading>0){currentReading--;renderReading();$('readingCard').focus();}});
  $('nextPart').addEventListener('click',()=>{if(currentReading<readingParts.length-1){currentReading++;renderReading();$('readingCard').focus();}});
  $('speakPart').addEventListener('click',()=>speak(readingParts[currentReading]));
  $('copyReading').addEventListener('click',async()=>{
    try {await navigator.clipboard.writeText(currentText);announce('Texto copiado al portapapeles');}
    catch(_){announce('No se pudo copiar automáticamente; seleccioná el texto de la tarjeta.');}
  });
  function loadExternalScript(src){return new Promise((resolve,reject)=>{
    const el=document.createElement('script');el.src=src;el.async=true;el.onload=resolve;el.onerror=()=>reject(new Error('No se pudo descargar una biblioteca externa.'));document.head.append(el);
  });}
  $('fileInput').addEventListener('change',async()=>{
    const file=$('fileInput').files?.[0];if(!file)return;
    if(file.size>15*1024*1024){$('fileStatus').textContent='El archivo supera 15 MB. Elegí uno más pequeño.';return;}
    $('fileStatus').textContent='Procesando '+file.name+'…';
    try{
      let text='',source='file_txt'; const lower=file.name.toLowerCase();
      if(file.type==='text/plain'||lower.endsWith('.txt')){text=await file.text();}
      else if(file.type==='application/pdf'||lower.endsWith('.pdf')){
        if(!window.pdfjsLib) await loadExternalScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
        source='file_pdf';if(pdf.numPages>25)throw new Error('Probá con un PDF de 25 páginas o menos.');
        const pages=[];for(let i=1;i<=pdf.numPages;i++){
          $('fileStatus').textContent=`Leyendo página ${i} de ${pdf.numPages}…`;
          const page=await pdf.getPage(i),content=await page.getTextContent();
          pages.push(content.items.map(x=>x.str).join(' '));
        }
        text=pages.join('\n\n');if(!text.trim())throw new Error('Parece un PDF escaneado sin texto seleccionable. Convertí una página a imagen y usá la opción de foto.');
      }
      else if(file.type.startsWith('image/')){source='file_ocr';
        if(!window.Tesseract) await loadExternalScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
        const worker=await window.Tesseract.createWorker('spa');
        try {const result=await worker.recognize(file);text=result.data.text||'';} finally {await worker.terminate();}
      } else throw new Error('Formato no admitido. Elegí TXT, PDF, PNG, JPG o WEBP.');
      if(!text.trim())throw new Error('No se pudo extraer texto. Probá con una imagen más nítida.');
      $('inputText').value=text;lastExtracted={text,source};$('fileStatus').textContent='Archivo leído. Revisá y corregí el texto si hace falta.';loadReading(text,source);
    }catch(err){$('fileStatus').textContent='No se pudo leer: '+(err?.message||'Error desconocido')+'. Podés pegar el texto manualmente.';announce('Error al procesar el archivo');}
  });

  // ───────────────────────── Modo demo / conectado, consentimiento y cliente de API ─────────────────────────
  const CFG = window.CLARIA_CONFIG || {};
  const API_BASE = String(CFG.apiBase || '').replace(/\/+$/, '');
  const MAX_AI_PER_SESSION = 25;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || 's/d'); };
  const store = { get(k) { try { return sessionStorage.getItem(k); } catch (_) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} } };
  let mode = 'demo';            // 'demo' | 'offline' | 'connected'
  let aiInfo = { provider: null, maxTextChars: 6000 };

  function setMode(next, info) {
    mode = next; if (info) aiInfo = { ...aiInfo, ...info };
    const connected = mode === 'connected';
    const consent = store.get('claria.consent') === 'yes';
    $('modeBanner').dataset.mode = mode;
    $('modeLabel').textContent = connected ? 'IA conectada' : mode === 'offline' ? 'Sin conexión con la IA' : 'Modo demo';
    $('modeText').textContent = connected
      ? `Las explicaciones y el chat los genera ${aiInfo.provider || 'un modelo de IA'}. Pueden tener errores. ${consent ? '' : 'Te pediremos permiso antes de enviar tu primera consulta.'}`
      : mode === 'offline' ? 'No se pudo contactar al servidor de IA. El chat usa textos preparados y las explicaciones con IA no están disponibles.'
      : 'Sin IA conectada: el chat usa textos preparados y las explicaciones con IA no están disponibles.';
    $('modeInfo').textContent = connected && !consent ? 'Activar IA' : 'Privacidad';
    $('chatMode').textContent = connected ? `IA conectada · ${aiInfo.provider || ''}`.trim() : 'Modo demo · respuestas preparadas';
    $('consentProvider').textContent = aiInfo.provider || 'proveedor de IA';
    $('chatFootnote').textContent = connected ? 'Respuestas generadas por IA: pueden tener errores. No ingreses datos personales. Para trámites, confirmá en el sitio oficial.' : 'No ingreses datos personales. El dictado depende del navegador y puede usar servicios externos.';
    $$('.ai-action').forEach((b) => { b.disabled = !connected; });
    $('askInput').disabled = !connected;
    $('aiAvailability').textContent = connected
      ? 'Elegí qué querés que haga CLARIA con el texto cargado. La respuesta se muestra aparte del original.'
      : 'Estos botones están desactivados porque no hay una IA conectada ahora. Podés leer, escuchar y recorrer el texto igual.';
    $('aiPanel').dataset.mode = mode;
  }
  const healthPromise = (async () => {
    if (!API_BASE) return setMode('demo');
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(API_BASE + '/api/health', { signal: ctrl.signal });
      const j = await res.json();
      if (j && j.ok && j.mode === 'connected') setMode('connected', { provider: j.provider, maxTextChars: Math.min(Number(j.maxTextChars) || 6000, 6000) });
      else setMode('demo');
    } catch (_) { setMode('offline'); } finally { clearTimeout(timer); }
  })();

  function ensureConsent() {
    if (store.get('claria.consent') === 'yes') return Promise.resolve(true);
    const dlg = $('consentDialog');
    return new Promise((resolve) => {
      const onClose = () => { dlg.removeEventListener('close', onClose); const ok = dlg.returnValue === 'accept'; store.set('claria.consent', ok ? 'yes' : 'no'); setMode(mode); announce(ok ? 'Permiso aceptado' : 'No se usará la IA'); resolve(ok); };
      dlg.returnValue = ''; dlg.addEventListener('close', onClose);
      if (typeof dlg.showModal === 'function') dlg.showModal(); else { const ok = window.confirm('CLARIA enviará tu consulta a un servicio de IA externo. No guarda tus textos. ¿Aceptás?'); dlg.returnValue = ok ? 'accept' : 'decline'; onClose(); }
    });
  }
  $('modeInfo').addEventListener('click', async () => {
    if (mode === 'connected' && store.get('claria.consent') !== 'yes') await ensureConsent();
    else { showView('acerca'); $('privacyPanel').scrollIntoView({ block: 'center' }); }
  });

  const ERRORS = {
    network: 'No se pudo conectar con el servidor de IA. Revisá tu conexión y probá de nuevo. CLARIA no inventa respuestas cuando falla la conexión.',
    rate_minute: 'Hiciste varias consultas seguidas. Esperá un minuto y probá de nuevo.',
    session_limit: `Llegaste al máximo de ${MAX_AI_PER_SESSION} consultas de IA en esta sesión de demostración. Podés seguir usando el lector, la voz y las guías.`
  };
  function useAiQuota() {
    const n = Number(store.get('claria.aiCount') || 0);
    if (n >= MAX_AI_PER_SESSION) return false;
    store.set('claria.aiCount', String(n + 1)); return true;
  }
  async function callApi(path, payload) {
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 35000);
    let res, data = null;
    try {
      res = await fetch(API_BASE + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: ctrl.signal });
      try { data = await res.json(); } catch (_) {}
    } catch (_) { const e = new Error(ERRORS.network); e.code = 'network'; throw e; } finally { clearTimeout(timer); }
    if (!res.ok || !data || data.ok === false) { const e = new Error((data && data.message) || 'La IA no pudo responder ahora. Probá de nuevo.'); e.code = (data && data.error) || 'http_' + res.status; throw e; }
    return data;
  }

  // ───────────────────────── Explicación con IA sobre el texto cargado ─────────────────────────
  const KIND = { plain: 'Explicación en lenguaje claro (IA)', easy: 'Lectura fácil (IA)', summary: 'Resumen (IA)', ask: 'Respuesta de la IA a tu pregunta' };
  let lastAiText = '', aiBusy = false;
  function renderAi(kind, d, clientNotices) {
    $('aiResultKind').textContent = KIND[kind];
    $('aiResultText').textContent = d.resultado;
    $('aiKeyPoints').innerHTML = (d.puntos_clave || []).map((p) => `<li>${esc(p)}</li>`).join('');
    const notes = [...clientNotices.map((n) => `<li><b>CLARIA:</b> ${esc(n)}</li>`), ...(d.avisos || []).map((n) => `<li><b>La IA señala:</b> ${esc(n)}</li>`)];
    $('aiNoticeList').innerHTML = notes.join(''); $('aiNotices').hidden = notes.length === 0;
    $('aiResult').hidden = false; lastAiText = [d.resultado, ...(d.puntos_clave || [])].join('\n');
    $('aiResult').focus();
  }
  async function runExplain(task, question) {
    if (aiBusy || mode !== 'connected') return;
    if (!currentText) { $('aiStatus').textContent = 'Primero cargá un texto en el paso 1.'; return; }
    if (task === 'ask' && (question || '').trim().length < 3) { $('aiStatus').textContent = 'Escribí tu pregunta sobre el texto.'; $('askInput').focus(); return; }
    if (!(await ensureConsent())) { $('aiStatus').textContent = 'Sin tu permiso no se usa la IA. El lector sigue disponible.'; return; }
    if (!useAiQuota()) { $('aiStatus').textContent = ERRORS.session_limit; return; }
    const notices = []; const max = aiInfo.maxTextChars || 6000;
    let body = currentText;
    if (body.length > max) { body = body.slice(0, max).replace(/\s+\S*$/, ''); notices.push(`Tu texto tiene ${currentText.length} caracteres y se analizaron solo los primeros ${body.length}.`); }
    const t = ClariaPrivacy.redact(body), q = ClariaPrivacy.redact(question || '');
    if (t.count + q.count) notices.push(`Se ocultaron ${t.count + q.count} dato(s) que parecían personales (${[...new Set([...t.kinds, ...q.kinds])].join(', ')}) antes de enviar. Revisá que el resultado no dependa de ellos.`);
    if (currentSource === 'file_ocr') notices.push('El texto viene de una foto (OCR) y puede tener errores de lectura; la IA trabaja sobre ese texto tal como está.');
    if (currentSource === 'file_pdf') notices.push('El texto viene de un PDF y puede tener cortes o columnas mezcladas.');
    aiBusy = true; $$('.ai-action').forEach((b) => { b.disabled = true; }); $('aiStatus').textContent = 'CLARIA está pensando…'; announce('CLARIA está pensando');
    try {
      const d = await callApi('/api/explain', { task, text: t.text, question: q.text, source: currentSource });
      renderAi(task, d, notices); $('aiStatus').textContent = 'Listo. Abajo está la respuesta de la IA, separada del texto original.'; announce('Respuesta de la IA lista');
    } catch (err) { $('aiStatus').textContent = ERRORS[err.code] || err.message; announce('No se pudo obtener la respuesta de la IA'); }
    finally { aiBusy = false; $$('.ai-action').forEach((b) => { b.disabled = mode !== 'connected'; }); }
  }
  $$('.ai-action[data-task]').forEach((b) => b.addEventListener('click', () => runExplain(b.dataset.task)));
  $('askForm').addEventListener('submit', (e) => { e.preventDefault(); runExplain('ask', $('askInput').value); });
  $('aiSpeak').addEventListener('click', () => speak(lastAiText));
  $('aiStop').addEventListener('click', stopSpeaking);
  $('aiCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(lastAiText); announce('Respuesta copiada'); } catch (_) { announce('No se pudo copiar automáticamente'); } });

  // ───────────────────────── Trámites: base curada con fuente y fecha de consulta ─────────────────────────
  let activeProcedure = null, stepIndex = 0, tramitesMeta = null;
  function setProcedure(id) {
    activeProcedure = procedures.find((p) => p.id === id) || procedures[0]; stepIndex = 0; renderProcedure(); $('procedureDetails').hidden = false;
    $$('.proc-item').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.proc === activeProcedure.id)));
    $('procedureTitle').focus();
  }
  function renderProcedure() {
    const p = activeProcedure, f = p.fuente;
    $('procedureTitle').textContent = p.titulo; $('procedureTitle').setAttribute('tabindex', '-1');
    $('procedureDesc').textContent = p.resumen; $('procedureStepCounter').textContent = `Paso ${stepIndex + 1} de ${p.pasos.length}`;
    $('procedureStepNumber').textContent = String(stepIndex + 1); $('procedureStepText').textContent = p.pasos[stepIndex];
    $('procedureProgressFill').style.width = (100 * (stepIndex + 1) / p.pasos.length) + '%';
    $('procedureOfficial').href = f.url; $('procedureOfficial').textContent = 'Abrir fuente oficial ↗';
    $('procedurePrev').disabled = stepIndex === 0; $('procedureNext').disabled = stepIndex === p.pasos.length - 1;
    $('procedureSource').innerHTML = `<h3>Qué dice la fuente oficial</h3>
      <p class="source-date">«${esc(f.titulo)}» · consultada el ${fmtDate(f.consultado)} · la página indica última actualización el ${fmtDate(f.actualizada)}. Puede haber cambiado.</p>
      <h4>Requisitos</h4><ul>${p.requisitos.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      <p><b>Costo:</b> ${esc(p.costo)}</p><p><b>Tiempo:</b> ${esc(p.tiempo)}</p>
      ${p.enlaces.length ? `<h4>Otros enlaces oficiales</h4><ul>${p.enlaces.map((e) => `<li><a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.titulo)} ↗</a></li>`).join('')}</ul>` : ''}`;
    announce(`Trámite: ${p.titulo}, paso ${stepIndex + 1} de ${p.pasos.length}`);
  }
  async function loadProcedures() {
    try {
      const res = await fetch('data/tramites.json', { cache: 'no-cache' }); if (!res.ok) throw new Error('http ' + res.status);
      const db = await res.json(); procedures = db.tramites; tramitesMeta = db;
      $('procedurePicker').innerHTML = procedures.map((p) => `<button type="button" class="proc-item" data-proc="${esc(p.id)}" aria-pressed="false"><span aria-hidden="true">${p.icono}</span><strong>${esc(p.titulo)}</strong><small>${esc(p.resumen)}</small></button>`).join('');
      $$('.proc-item').forEach((b) => b.addEventListener('click', () => setProcedure(b.dataset.proc)));
      const w = document.querySelector('.procedure-warning'); if (w && db.aviso) w.textContent = db.aviso + ' CLARIA no pide claves, fotos del DNI ni datos personales.';
    } catch (_) {
      $('procedurePicker').innerHTML = '<p class="status-note" role="alert">No se pudieron cargar las guías. Si abriste el archivo directamente, usá un servidor local (python -m http.server) o la versión publicada.</p>';
    }
  }
  $('procedurePrev').addEventListener('click', () => { if (stepIndex > 0) { stepIndex--; renderProcedure(); } });
  $('procedureNext').addEventListener('click', () => { if (activeProcedure && stepIndex < activeProcedure.pasos.length - 1) { stepIndex++; renderProcedure(); } });
  $('procedureSpeak').addEventListener('click', () => { if (activeProcedure) speak(activeProcedure.pasos[stepIndex]); });
  loadProcedures();

  // ───────────────────────── Chat: IA conectada (con consentimiento) o respuestas preparadas (demo) ─────────────────────────
  let chatInitialized = false, chatBusy = false; const chatHistory = [];
  function addMessage(role, text, opts = {}) {
    const el = document.createElement('div'); el.className = 'bubble ' + role + (opts.kind ? ' ' + opts.kind : '');
    const p = document.createElement('div'); p.className = 'bubble-text'; p.textContent = text; el.append(p);
    if (opts.tag) { const t = document.createElement('small'); t.className = 'bubble-tag'; t.textContent = opts.tag; el.append(t); }
    (opts.sources || []).forEach((s) => { const a = document.createElement('a'); a.className = 'bubble-source'; a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = `Fuente oficial: ${s.titulo} (consultada el ${fmtDate(s.consultado)}) ↗`; el.append(a); });
    $('chatMessages').append(el); $('chatMessages').scrollTop = $('chatMessages').scrollHeight; return el;
  }
  function openChat(open) {
    $('chatPanel').hidden = !open; $('chatFab').setAttribute('aria-expanded', String(open));
    if (open) {
      if (!chatInitialized) { chatInitialized = true; healthPromise.then(() => addMessage('bot', mode === 'connected'
        ? '¡Hola! Soy CLARIA, una asistente de inteligencia artificial. Puedo orientarte sobre lectura, accesibilidad y los trámites de la sección «Trámites». Puedo equivocarme: para trámites, confirmá siempre en el sitio oficial.'
        : '¡Hola! Soy CLARIA. Ahora estoy en modo demo: no hay IA conectada, así que respondo con textos preparados sobre lectura, DNI, CUD, Mi Argentina y accesibilidad.', { tag: mode === 'connected' ? 'IA · puede tener errores' : 'Modo demo · texto preparado' })); }
      $('chatInput').focus();
    } else { $('chatFab').focus(); }
  }
  $('chatFab').addEventListener('click', () => openChat($('chatPanel').hidden));
  $('closeChat').addEventListener('click', () => openChat(false));
  $('openChatHome').addEventListener('click', () => openChat(true));
  function answerQuestion(q) { // SOLO modo demo: reglas y textos preparados, nunca se presentan como IA
    const s = q.toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (/dni|documento de identidad/.test(s)) return 'Para un nuevo ejemplar de DNI, abrí «Trámites» y elegí «Nuevo ejemplar de DNI»: ahí está el resumen de la fuente oficial y el enlace. No compartas acá tu número de documento.';
    if (/cud|certificado unico|discapacidad/.test(s)) return 'En «Trámites» hay una guía del Certificado Único de Discapacidad, con el resumen de la fuente oficial. Los requisitos exactos se consultan en el sitio oficial según cada situación.';
    if (/turno|mi argentina|app argentina/.test(s)) return 'Entrá a «Trámites» y elegí «Mi Argentina». Desde la fuente oficial podés consultar servicios y turnos.';
    if (/leer|texto|pdf|foto|imagen|documento|comprend|escuch/.test(s)) return 'Entrá a «Leer y comprender». Podés pegar texto o cargar TXT, PDF o imagen, escucharlo y recorrerlo por partes. Con IA conectada también podés pedir una explicación clara.';
    if (/contraste|letra|accesibilidad|mayuscula|animacion/.test(s)) return 'Tocá «Accesibilidad» arriba: tamaño del texto, alto contraste, imprenta mayúscula para la lectura y reducción de animaciones.';
    if (/hola|buenas|buen dia/.test(s)) return '¡Hola! Elegí si querés leer un documento o consultar un trámite.';
    return 'En modo demo no tengo una respuesta preparada para eso. Probá preguntarme por DNI, CUD, Mi Argentina, lectura de documentos o accesibilidad.';
  }
  async function sendQuestion(query) {
    const clean = query.trim(); if (!clean || chatBusy) return;
    await healthPromise;
    const redacted = ClariaPrivacy.redact(clean, { strict: true });
    if (mode !== 'connected') {
      if (redacted.count) { addMessage('bot', 'Parece que escribiste información personal. Para protegerte, evitá compartir números de documento, correos o claves. Podés consultar sin esos datos.'); return; }
      addMessage('user', clean); addMessage('bot', answerQuestion(clean), { tag: 'Modo demo · texto preparado, no es IA' }); return;
    }
    if (!(await ensureConsent())) { addMessage('bot', 'Sin tu permiso no uso la IA. Para esta consulta te dejo una guía preparada (no es IA):', { tag: 'Texto preparado' }); addMessage('bot', answerQuestion(redacted.text), { tag: 'Texto preparado, no es IA' }); return; }
    if (!useAiQuota()) { addMessage('bot', ERRORS.session_limit, { kind: 'error' }); return; }
    addMessage('user', redacted.count ? redacted.text : clean);
    if (redacted.count) addMessage('bot', 'Oculté datos que parecían personales antes de enviar tu consulta. Evitá compartirlos.', { tag: 'Aviso de CLARIA' });
    chatBusy = true; $('chatInput').disabled = true;
    const wait = addMessage('bot', 'CLARIA está pensando…', { kind: 'pending' });
    try {
      const d = await callApi('/api/chat', { message: redacted.text, history: chatHistory.slice(-6) });
      wait.remove();
      addMessage('bot', d.respuesta, { tag: 'Respuesta de IA · puede tener errores', sources: d.fuentes });
      (d.avisos || []).forEach((a) => addMessage('bot', a, { tag: 'Aviso de CLARIA' }));
      chatHistory.push({ role: 'user', content: redacted.text }, { role: 'assistant', content: d.respuesta });
    } catch (err) { wait.remove(); addMessage('bot', ERRORS[err.code] || err.message, { kind: 'error', tag: 'No se pudo responder' }); }
    finally { chatBusy = false; $('chatInput').disabled = false; $('chatInput').focus(); }
  }
  $('chatForm').addEventListener('submit', (e) => { e.preventDefault(); const q = $('chatInput').value; $('chatInput').value = ''; sendQuestion(q); });
  $$('[data-chat-query]').forEach((b) => b.addEventListener('click', () => sendQuestion(b.dataset.chatQuery)));
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SpeechRecognition){$('micButton').title='El dictado no está disponible en este navegador';$('micButton').disabled=true;}
  else{$('micButton').addEventListener('click',()=>{
    const r=new SpeechRecognition();r.lang='es-AR';r.interimResults=false;r.maxAlternatives=1;
    r.onresult=e=>{$('chatInput').value=e.results[0][0].transcript;$('chatInput').focus();announce('Dictado listo para revisar y enviar');};
    r.onerror=()=>announce('El dictado no se completó. Podés escribir tu pregunta.');
    try{r.start();announce('Escuchando. Revisá el texto antes de enviarlo.');}catch(_){announce('No se pudo activar el micrófono.');}
  });}
  document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){if($('consentDialog').open||document.querySelector('dialog[open]'))return;
    if(!$('chatPanel').hidden)openChat(false);else if(!$('prefs').hidden)togglePrefs(false);
  }});
  const hash=location.hash.slice(1);if(['escribir','lectura','tramites','acerca'].includes(hash))showView(hash);
  window.ClariaUI={announce,showView,getPrefs:()=>({...prefs})};
})();
