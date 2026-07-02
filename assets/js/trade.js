(function(){
  const DATA = window.__MINEWIND_DATA__;
  const I18N = window.__I18N__;
  const essences = DATA.essences;

  // ---- i18n (mirrors codex.js, kept in sync via the 'codexlang' event) ----
  const LANG_KEY = 'minewind-lang';
  function detectLang(){
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && I18N.strings[saved]) return saved;
    const nav = (navigator.language || 'en').slice(0,2).toLowerCase();
    return I18N.strings[nav] ? nav : 'en';
  }
  let lang = detectLang();
  let S = I18N.strings[lang];
  function tr(key){
    const dig = (o) => key.split('.').reduce((a,k) => (a && a[k] != null) ? a[k] : undefined, o);
    const v = dig(S); if (v != null) return v;
    const f = dig(I18N.strings.fr); return f != null ? f : key;
  }
  function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function norm(s){ return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }

  const ROMAN = ['I','II','III','IV','V'];
  const essByNorm = {};
  essences.forEach(e => { essByNorm[norm(e.name)] = e; });
  const SOULS = [
    {key:'fire',label:'Fire',color:'#ff7a45'},{key:'ice',label:'Ice',color:'#5fc7ff'},
    {key:'shadow',label:'Shadow',color:'#9b8cff'},{key:'dragon',label:'Dragon',color:'#7ed957'},
    {key:'orc',label:'Orc',color:'#b5c25a'},{key:'nature',label:'Nature',color:'#54c98b'},
    {key:'dimensional',label:'Dimensional',color:'#c879ff'},{key:'blood',label:'Blood',color:'#e0454a'},
    {key:'undead',label:'Undead',color:'#9fb3a6'}
  ];
  const soulByKey = {}; SOULS.forEach(s => { soulByKey[s.key] = s; });

  const FB = window.__FB__;
  const SELLER_KEY = 'minewind-seller';

  // ---- DOM ----
  const tradeView = document.getElementById('trade-view');
  if (!tradeView) return;
  const tradeInner = document.getElementById('trade-inner');

  // ---- draft state for the form ----
  const draft = { kind:'essence', item:{ essences:[], soul:null } };
  let uid = null, connected = false, staticBuilt = false, unsub = null;

  function levelOptions(sel){
    return ROMAN.map((r,i) => `<option value="${i+1}"${(i+1)===sel?' selected':''}>${r}</option>`).join('');
  }

  function buildStaticUI(){
    if (staticBuilt) return;
    staticBuilt = true;
    tradeInner.innerHTML = `
      <datalist id="trade-ess-list">${essences.map(e => `<option value="${escapeHtml(e.name)}"></option>`).join('')}</datalist>
      <div class="trade-head">
        <h2 class="trade-title">${escapeHtml(tr('trade.heading'))}</h2>
        <p class="trade-intro">${escapeHtml(tr('trade.intro'))}</p>
      </div>
      <div class="trade-form" id="trade-form">
        <div class="trade-row">
          <input id="t-seller" class="trade-input" type="text" maxlength="32" placeholder="${escapeHtml(tr('trade.seller'))}" value="${escapeHtml(localStorage.getItem(SELLER_KEY) || '')}" autocomplete="off">
          <input id="t-price" class="trade-input" type="text" maxlength="40" placeholder="${escapeHtml(tr('trade.price'))}" autocomplete="off">
        </div>
        <div class="trade-kind" id="trade-kind">
          <button class="kind-btn${draft.kind==='essence'?' active':''}" type="button" data-kind="essence">${escapeHtml(tr('trade.kindEssence'))}</button>
          <button class="kind-btn${draft.kind==='item'?' active':''}" type="button" data-kind="item">${escapeHtml(tr('trade.kindItem'))}</button>
        </div>
        <div id="trade-kind-body"></div>
        <input id="t-note" class="trade-input" type="text" maxlength="120" placeholder="${escapeHtml(tr('trade.note'))}" autocomplete="off">
        <button id="t-publish" class="trade-publish" type="button">${escapeHtml(tr('trade.publish'))}</button>
        <div id="t-status" class="trade-status"></div>
      </div>
      <h3 class="trade-listings-title">${escapeHtml(tr('trade.listings'))}</h3>
      <div id="trade-listings" class="trade-listings"></div>
    `;
    renderKindBody();
  }

  function renderKindBody(){
    const body = document.getElementById('trade-kind-body');
    if (!body) return;
    if (draft.kind === 'essence'){
      body.innerHTML = `
        <div class="trade-row">
          <input id="t-ess" class="trade-input" type="text" list="trade-ess-list" placeholder="${escapeHtml(tr('trade.pickEssence'))}" autocomplete="off">
          <select id="t-ess-lvl" class="trade-select">${levelOptions(1)}</select>
        </div>`;
    } else {
      const chips = draft.item.essences.map((en,i) => `
        <div class="ess-chip">
          <span class="ess-chip-name">${escapeHtml(en.name)}</span>
          <select class="trade-select" data-item-lvl="${i}">${levelOptions(en.level)}</select>
          <button class="chip-x" type="button" data-item-rm="${i}" aria-label="×">×</button>
        </div>`).join('');
      const addBtn = draft.item.essences.length < 3
        ? `<input id="t-item-ess" class="trade-input" type="text" list="trade-ess-list" placeholder="${escapeHtml(tr('trade.addItemEss'))}" autocomplete="off">` : '';
      let soul;
      if (draft.item.soul){
        const s = soulByKey[draft.item.soul.type];
        soul = `<div class="soul-chip" style="--soul:${s.color}"><span class="soul-dot"></span><span class="soul-chip-name">${escapeHtml(s.label)}</span>
          <select class="trade-select" id="t-soul-count">${[1,2,3,4].map(n=>`<option value="${n}"${n===draft.item.soul.count?' selected':''}>×${n}</option>`).join('')}</select>
          <button class="chip-x" type="button" data-soul-rm aria-label="×">×</button></div>`;
      } else {
        soul = `<div class="soul-picker">${SOULS.map(s=>`<button class="soul-opt" type="button" data-soul-pick="${s.key}" style="--soul:${s.color}"><span class="soul-dot"></span>${escapeHtml(s.label)}</button>`).join('')}</div>`;
      }
      body.innerHTML = `
        <div class="trade-sub">${escapeHtml(tr('build.essences'))}</div>
        <div class="ess-list">${chips}${addBtn}</div>
        <div class="trade-sub">${escapeHtml(tr('trade.soul'))}</div>
        ${soul}`;
    }
  }

  // ---- listings ----
  function timeAgo(ts){
    if (!ts || !ts.toDate) return '';
    try { return ts.toDate().toLocaleDateString(lang, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
    catch(e){ return ''; }
  }
  function whatMarkup(d){
    if (d.kind === 'essence'){
      return `<span class="listing-what">${escapeHtml(tr('trade.sellsEssence'))} <strong>${escapeHtml(d.essence||'?')}</strong> ${ROMAN[(d.level||1)-1]||''}</span>`;
    }
    const it = d.item || {};
    const es = (it.essences||[]).map(en => `${escapeHtml(en.name)} ${ROMAN[(en.level||1)-1]||''}`).join(', ');
    let soul = '';
    if (it.soul && soulByKey[it.soul.type]){
      const s = soulByKey[it.soul.type];
      soul = ` <span class="listing-soul" style="--soul:${s.color}"><span class="soul-dot"></span>${escapeHtml(s.label)} ×${it.soul.count}</span>`;
    }
    return `<span class="listing-what">${escapeHtml(tr('trade.sellsItem'))}: <strong>${es || '—'}</strong>${soul}</span>`;
  }
  function renderListings(docs){
    const el = document.getElementById('trade-listings');
    if (!el) return;
    if (!docs.length){ el.innerHTML = `<p class="trade-empty">${escapeHtml(tr('trade.empty'))}</p>`; return; }
    el.innerHTML = docs.map(doc => {
      const d = doc.data();
      const mine = uid && d.owner === uid;
      return `<div class="listing">
        <div class="listing-main">
          <div class="listing-top"><span class="listing-seller">${escapeHtml(d.seller||'?')}</span><span class="listing-price">${escapeHtml(d.price||'')}</span></div>
          ${whatMarkup(d)}
          ${d.note ? `<div class="listing-note">${escapeHtml(d.note)}</div>` : ''}
        </div>
        <div class="listing-side">
          <span class="listing-time">${timeAgo(d.createdAt)}</span>
          ${mine ? `<button class="listing-del" type="button" data-del="${escapeHtml(doc.id)}">${escapeHtml(tr('trade.delete'))}</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  function status(msg, ok){
    const el = document.getElementById('t-status');
    if (el){ el.textContent = msg; el.className = 'trade-status' + (ok ? ' ok' : msg ? ' err' : ''); }
  }

  function connect(){
    buildStaticUI();
    if (connected) return;
    if (!FB){ status(tr('trade.offline'), false); return; }
    connected = true;
    renderListings([]); // show the empty-state placeholder until the first snapshot arrives
    FB.ready.then(u => { uid = u; }).catch(() => { status(tr('trade.errAuth'), false); });
    unsub = FB.db.collection('listings').orderBy('createdAt','desc').limit(100)
      .onSnapshot(snap => renderListings(snap.docs), () => status(tr('trade.errAuth'), false));
  }

  function publish(){
    if (!FB){ status(tr('trade.offline'), false); return; }
    const seller = (document.getElementById('t-seller').value || '').trim().slice(0,32);
    const price = (document.getElementById('t-price').value || '').trim().slice(0,40);
    const note = (document.getElementById('t-note').value || '').trim().slice(0,120);
    if (!seller || !price){ status(tr('trade.errFields'), false); return; }

    const doc = { seller, price, kind: draft.kind, owner: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    if (note) doc.note = note;

    if (draft.kind === 'essence'){
      const e = essByNorm[norm(document.getElementById('t-ess').value || '')];
      if (!e){ status(tr('trade.errFields'), false); return; }
      doc.essence = e.name;
      doc.level = +document.getElementById('t-ess-lvl').value || 1;
    } else {
      if (!draft.item.essences.length && !draft.item.soul){ status(tr('trade.errFields'), false); return; }
      doc.item = { essences: draft.item.essences.map(en => ({ name:en.name, level:en.level })), soul: draft.item.soul || null };
    }

    if (!uid){ status(tr('trade.errAuth'), false); return; }
    localStorage.setItem(SELLER_KEY, seller);
    const btn = document.getElementById('t-publish');
    btn.disabled = true;
    FB.db.collection('listings').add(doc).then(() => {
      status(tr('trade.published'), true);
      // reset the "what" part, keep seller
      document.getElementById('t-price').value = '';
      document.getElementById('t-note').value = '';
      draft.item = { essences:[], soul:null };
      renderKindBody();
      if (draft.kind === 'essence'){ const ei = document.getElementById('t-ess'); if (ei) ei.value = ''; }
      btn.disabled = false;
    }).catch(err => { status((err && err.message) || tr('trade.errAuth'), false); btn.disabled = false; });
  }

  // ---- events ----
  tradeView.addEventListener('click', (ev) => {
    const t = ev.target;
    const kind = t.closest('[data-kind]');
    if (kind){ draft.kind = kind.getAttribute('data-kind');
      document.querySelectorAll('#trade-kind .kind-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-kind') === draft.kind));
      renderKindBody(); status('', true); return; }
    const rm = t.closest('[data-item-rm]');
    if (rm){ draft.item.essences.splice(+rm.getAttribute('data-item-rm'), 1); renderKindBody(); return; }
    const sp = t.closest('[data-soul-pick]');
    if (sp){ draft.item.soul = { type: sp.getAttribute('data-soul-pick'), count: 1 }; renderKindBody(); return; }
    if (t.closest('[data-soul-rm]')){ draft.item.soul = null; renderKindBody(); return; }
    if (t.closest('#t-publish')){ publish(); return; }
    const del = t.closest('[data-del]');
    if (del){
      if (confirm(tr('trade.confirmDelete'))) FB.db.collection('listings').doc(del.getAttribute('data-del')).delete();
      return;
    }
  });

  tradeView.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 't-item-ess'){
      const e = essByNorm[norm(t.value)];
      if (e && draft.item.essences.length < 3){ draft.item.essences.push({ name:e.name, level:1 }); renderKindBody(); }
      return;
    }
    const il = t.closest('[data-item-lvl]');
    if (il){ draft.item.essences[+il.getAttribute('data-item-lvl')].level = +t.value; return; }
    if (t.id === 't-soul-count'){ if (draft.item.soul) draft.item.soul.count = +t.value; return; }
  });

  // ---- lazy connect when the trade tab is shown ----
  document.addEventListener('tabchange', (ev) => { if (ev.detail === 'trade') connect(); });
  if (!tradeView.hidden) connect(); else buildStaticUI();

  document.addEventListener('codexlang', (ev) => {
    const code = ev.detail;
    if (I18N.strings[code]){ lang = code; S = I18N.strings[code]; }
    staticBuilt = false; buildStaticUI();
  });
})();
