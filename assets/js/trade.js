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

  // item = a piece of gear (or a tool/weapon) of a given material — game terms kept in English
  const PIECES = ['helmet','chestplate','leggings','boots','tool'];
  const MATERIALS = ['Leather','Chainmail','Iron','Gold','Diamond','Netherite','Turtle','Wood','Stone'];
  // when the piece is a tool/weapon, the seller also picks which kind it is
  const TOOL_TYPES = ['sword','axe','pickaxe','shovel','hoe','bow','crossbow','trident','shield'];
  function pieceLabel(p){ return p === 'tool' ? tr('trade.pieceTool') : tr('build.slots.' + p); }
  function toolLabel(t){ return tr('trade.tools.' + t); }

  const FB = window.__FB__;

  // Listings expire automatically after this many days (each seller deletes their
  // own expired listings on load; moderators sweep the rest — see trade-mod.js).
  // The client also hides expired listings immediately.
  const LISTING_TTL_DAYS = 14;
  const LISTING_TTL_MS = LISTING_TTL_DAYS * 24 * 60 * 60 * 1000;

  // Structured price: an amount + a currency unit (see the beginner guide —
  // 1s = 64 dragon eggs, 1sh = 1 shulker = 1728). Legacy listings only carry
  // the free-text `price` field; formatPrice/priceEggs handle both.
  const PRICE_UNITS = ['d','s','sh'];
  const UNIT_EGGS = { d:1, s:64, sh:1728 };
  function formatPrice(d){
    if (d && d.priceAmount != null && UNIT_EGGS[d.priceUnit]) return d.priceAmount + d.priceUnit;
    return (d && d.price) || '';
  }
  // Comparable value in dragon eggs, or null for legacy free-text prices.
  function priceEggs(d){
    if (d && d.priceAmount != null && UNIT_EGGS[d.priceUnit]) return d.priceAmount * UNIT_EGGS[d.priceUnit];
    return null;
  }

  // ---- DOM ----
  const tradeView = document.getElementById('trade-view');
  if (!tradeView) return;
  const tradeInner = document.getElementById('trade-inner');
  const byId = (id) => document.getElementById(id);

  // ---- draft state for the form ----
  const draft = { kind:'essence', priceUnit:'s', item:{ piece:'chestplate', material:'Netherite', toolType:'sword', essences:[], soul:null } };
  let uid = null, connected = false, staticBuilt = false;
  let tradeTab = 'mine'; // which sub-tab is shown: 'mine' | 'others'
  // verification state
  let myPseudo = null;        // my verified pseudo, or null if not verified
  let myReq = null;           // my pending request { pseudo, contact, mode }, or null
  let iAmBanned = false;      // is the current uid banned?
  let authMode = null;        // request flow: null = choice screen, 'create' | 'login'
  const verifiedPseudos = new Set(); // all verified pseudos, for listing badges
  const verifiedByUid = {};          // uid -> pseudo, to label moderators by name
  // firestore subscriptions
  let unsubListings = null, unsubVerified = null, unsubMyReq = null, unsubMyBanned = null;

  // Tiers that actually exist for an essence.
  function essLevels(name){
    const e = essByNorm[norm(name)];
    if (!e || !e.prices) return [1];
    const out = [];
    e.prices.forEach((raw, i) => {
      const t = (raw || '').trim();
      if (t && !t.startsWith('(') && t.length <= 10) out.push(i + 1);
    });
    return out.length ? out : [1];
  }
  function levelOptions(levels, sel){
    return levels.map(l => `<option value="${l}"${l===sel?' selected':''}>${ROMAN[l-1]}</option>`).join('');
  }

  // ---- static shell ----
  function buildStaticUI(){
    if (staticBuilt) return;
    staticBuilt = true;
    tradeInner.innerHTML = `
      <div class="trade-head">
        <h2 class="trade-title">${escapeHtml(tr('trade.heading'))}</h2>
        <p class="trade-intro">${escapeHtml(tr('trade.intro'))}</p>
        <p class="trade-hint">${escapeHtml(tr('trade.ttlNotice'))}</p>
      </div>
      <div class="trade-subtabs" id="trade-subtabs" role="tablist">
        <button class="trade-subtab${tradeTab==='mine'?' active':''}" type="button" role="tab" data-subtab="mine">${escapeHtml(tr('trade.myListings'))}</button>
        <button class="trade-subtab${tradeTab==='others'?' active':''}" type="button" role="tab" data-subtab="others">${escapeHtml(tr('trade.othersListings'))}</button>
      </div>
      <section class="trade-panel" data-panel="mine"${tradeTab==='mine'?'':' hidden'}>
        <div id="trade-gate"></div>
        <div id="trade-mine" class="trade-listings"></div>
      </section>
      <section class="trade-panel" data-panel="others"${tradeTab==='others'?'':' hidden'}>
        <div id="trade-listings" class="trade-listings"></div>
      </section>
    `;
    renderGate();
    if (CTX.renderAdmin) CTX.renderAdmin();
    renderListingsFromCache();
  }

  // ---- gate: decide what the top area shows depending on verification state ----
  function renderGate(){
    const gate = byId('trade-gate');
    if (!gate) return;
    if (!FB){ gate.innerHTML = `<p class="trade-status err">${escapeHtml(tr('trade.offline'))}</p>`; return; }
    if (!uid){ gate.innerHTML = `<p class="trade-status">${escapeHtml(tr('trade.connecting'))}</p>`; return; }
    if (iAmBanned){ gate.innerHTML = `<div class="verify-banner err"><span>${escapeHtml(tr('trade.banned'))}</span></div>`; return; }
    if (myPseudo){ renderSellForm(gate); return; }
    if (myReq){ renderPending(gate); return; }
    renderRequestForm(gate);
  }

  function renderSellForm(gate){
    gate.innerHTML = `
      <div class="verify-banner ok">
        <span class="verify-badge">${escapeHtml(tr('trade.badgeVerified'))}</span>
        <span>${escapeHtml(tr('trade.sellingAs'))} <strong>${escapeHtml(myPseudo)}</strong></span>
      </div>
      <div class="trade-form" id="trade-form">
        <div class="trade-row trade-price-row">
          <input id="t-price" class="trade-input" type="number" min="0" step="any" inputmode="decimal" placeholder="${escapeHtml(tr('trade.priceAmount'))}" autocomplete="off">
          <select id="t-price-unit" class="trade-select" title="${escapeHtml(tr('trade.priceUnit'))}">${PRICE_UNITS.map(u=>`<option value="${u}"${u===draft.priceUnit?' selected':''}>${u}</option>`).join('')}</select>
        </div>
        <div class="trade-kind" id="trade-kind">
          <button class="kind-btn${draft.kind==='essence'?' active':''}" type="button" data-kind="essence">${escapeHtml(tr('trade.kindEssence'))}</button>
          <button class="kind-btn${draft.kind==='item'?' active':''}" type="button" data-kind="item">${escapeHtml(tr('trade.kindItem'))}</button>
        </div>
        <div id="trade-kind-body"></div>
        <input id="t-note" class="trade-input" type="text" maxlength="120" placeholder="${escapeHtml(tr('trade.note'))}" autocomplete="off">
        <button id="t-publish" class="trade-publish" type="button">${escapeHtml(tr('trade.publish'))}</button>
        <div id="t-status" class="trade-status"></div>
      </div>`;
    renderKindBody();
  }

  function renderRequestForm(gate){
    // step 1 — let the user pick between creating an account or logging in,
    // so moderators can tell in the panel whether to link an existing pseudo.
    if (!authMode){
      gate.innerHTML = `
        <div class="verify-panel">
          <h3 class="verify-title">${escapeHtml(tr('trade.verifyNeeded'))}</h3>
          <p class="verify-intro">${escapeHtml(tr('trade.authChoiceIntro'))}</p>
          <div class="auth-choice">
            <button class="auth-opt" type="button" data-auth-mode="create">
              <span class="auth-opt-title">${escapeHtml(tr('trade.authCreate'))}</span>
              <span class="auth-opt-desc">${escapeHtml(tr('trade.authCreateDesc'))}</span>
            </button>
            <button class="auth-opt" type="button" data-auth-mode="login">
              <span class="auth-opt-title">${escapeHtml(tr('trade.authLogin'))}</span>
              <span class="auth-opt-desc">${escapeHtml(tr('trade.authLoginDesc'))}</span>
            </button>
          </div>
        </div>`;
      return;
    }
    // step 2 — the actual request form, wording adapted to the chosen mode
    const isLogin = authMode === 'login';
    gate.innerHTML = `
      <div class="verify-panel">
        <button class="auth-back" type="button" data-auth-back>${escapeHtml(tr('trade.authBack'))}</button>
        <h3 class="verify-title">${escapeHtml(tr(isLogin ? 'trade.authLogin' : 'trade.authCreate'))}</h3>
        <p class="verify-intro">${escapeHtml(tr(isLogin ? 'trade.authLoginIntro' : 'trade.authCreateIntro'))}</p>
        <input id="t-req-pseudo" class="trade-input" type="text" maxlength="32" placeholder="${escapeHtml(tr('trade.reqPseudo'))}" autocomplete="off">
        <input id="t-req-contact" class="trade-input" type="text" maxlength="120" placeholder="${escapeHtml(tr('trade.reqContact'))}" autocomplete="off">
        <button id="t-req-submit" class="trade-publish" type="button">${escapeHtml(tr('trade.reqSubmit'))}</button>
        <div id="t-req-status" class="trade-status"></div>
      </div>`;
  }

  function renderPending(gate){
    gate.innerHTML = `
      <div class="verify-panel pending">
        <h3 class="verify-title">${escapeHtml(tr('trade.reqPending'))}</h3>
        <p class="verify-intro">${escapeHtml(tr('trade.reqPendingFor'))} <strong>${escapeHtml(myReq.pseudo || '')}</strong></p>
        <button id="t-req-cancel" class="trade-del" type="button">${escapeHtml(tr('trade.reqCancel'))}</button>
        <div id="t-req-status" class="trade-status"></div>
      </div>`;
  }

  function renderKindBody(){
    const body = byId('trade-kind-body');
    if (!body) return;
    if (draft.kind === 'essence'){
      body.innerHTML = `
        <div class="trade-row">
          <input id="t-ess" class="trade-input" type="text" data-esspick placeholder="${escapeHtml(tr('trade.pickEssence'))}" autocomplete="off">
          <select id="t-ess-lvl" class="trade-select">${levelOptions([1], 1)}</select>
        </div>`;
    } else {
      const chips = draft.item.essences.map((en,i) => `
        <div class="ess-chip">
          <span class="ess-chip-name">${escapeHtml(en.name)}</span>
          <select class="trade-select" data-item-lvl="${i}">${levelOptions(essLevels(en.name), en.level)}</select>
          <button class="chip-x" type="button" data-item-rm="${i}" aria-label="×">×</button>
        </div>`).join('');
      const addBtn = draft.item.essences.length < 3
        ? `<input id="t-item-ess" class="trade-input" type="text" data-esspick placeholder="${escapeHtml(tr('trade.addItemEss'))}" autocomplete="off">` : '';
      let soul;
      if (draft.item.soul){
        const s = soulByKey[draft.item.soul.type];
        soul = `<div class="soul-chip" style="--soul:${s.color}"><span class="soul-dot"></span><span class="soul-chip-name">${escapeHtml(s.label)}</span>
          <select class="trade-select" id="t-soul-count">${[1,2,3,4].map(n=>`<option value="${n}"${n===draft.item.soul.count?' selected':''}>×${n}</option>`).join('')}</select>
          <button class="chip-x" type="button" data-soul-rm aria-label="×">×</button></div>`;
      } else {
        soul = `<div class="soul-picker">${SOULS.map(s=>`<button class="soul-opt" type="button" data-soul-pick="${s.key}" style="--soul:${s.color}"><span class="soul-dot"></span>${escapeHtml(s.label)}</button>`).join('')}</div>`;
      }
      const pieceSel = `<select id="t-item-piece" class="trade-select">${PIECES.map(p=>`<option value="${p}"${p===draft.item.piece?' selected':''}>${escapeHtml(pieceLabel(p))}</option>`).join('')}</select>`;
      const matSel = `<select id="t-item-mat" class="trade-select">${MATERIALS.map(m=>`<option value="${m}"${m===draft.item.material?' selected':''}>${m}</option>`).join('')}</select>`;
      const toolSel = draft.item.piece === 'tool'
        ? `<label class="trade-field"><span class="trade-sub">${escapeHtml(tr('trade.toolType'))}</span><select id="t-item-tool" class="trade-select">${TOOL_TYPES.map(tt=>`<option value="${tt}"${tt===draft.item.toolType?' selected':''}>${escapeHtml(toolLabel(tt))}</option>`).join('')}</select></label>`
        : '';
      body.innerHTML = `
        <div class="trade-row">
          <label class="trade-field"><span class="trade-sub">${escapeHtml(tr('trade.piece'))}</span>${pieceSel}</label>
          <label class="trade-field"><span class="trade-sub">${escapeHtml(tr('trade.material'))}</span>${matSel}</label>
          ${toolSel}
        </div>
        <div class="trade-sub">${escapeHtml(tr('build.essences'))}</div>
        <div class="ess-list">${chips}${addBtn}</div>
        <div class="trade-sub">${escapeHtml(tr('trade.soul'))}</div>
        ${soul}`;
    }
  }

  // ---- listings ----
  let listingsCache = [];
  let listingsLoaded = false; // first snapshot received
  function timeAgo(ts){
    if (!ts || !ts.toDate) return '';
    try { return ts.toDate().toLocaleDateString(lang, { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }); }
    catch(e){ return ''; }
  }
  // Small "expires on <date>" note; turns red when the listing has under 2 days
  // left, so sellers know it's about to be auto-removed.
  function expiryMarkup(d){
    if (!d.expireAt || !d.expireAt.toDate) return '';
    const ms = d.expireAt.toDate().getTime() - Date.now();
    if (ms <= 0) return '';
    const soon = ms < 2 * 24 * 60 * 60 * 1000;
    return `<span class="listing-expiry${soon ? ' soon' : ''}">${escapeHtml(tr('trade.expiresOn'))} ${timeAgo(d.expireAt)}</span>`;
  }
  function whatMarkup(d){
    if (d.kind === 'essence'){
      return `<span class="listing-what">${escapeHtml(tr('trade.sellsEssence'))} <strong>${escapeHtml(d.essence||'?')}</strong> ${ROMAN[(d.level||1)-1]||''}</span>`;
    }
    const it = d.item || {};
    const pieceName = (it.piece === 'tool' && it.toolType) ? toolLabel(it.toolType) : (it.piece ? pieceLabel(it.piece) : '');
    const head = ((it.material || '') + ' ' + pieceName).trim();
    const es = (it.essences||[]).map(en => `${escapeHtml(en.name)} ${ROMAN[(en.level||1)-1]||''}`).join(', ');
    let soul = '';
    if (it.soul && soulByKey[it.soul.type]){
      const s = soulByKey[it.soul.type];
      soul = ` <span class="listing-soul" style="--soul:${s.color}"><span class="soul-dot"></span>${escapeHtml(s.label)} ×${it.soul.count}</span>`;
    }
    return `<span class="listing-what">${escapeHtml(tr('trade.sellsItem'))}: <strong>${escapeHtml(head || 'Item')}</strong>${es ? ' — ' + es : ''}${soul}</span>`;
  }
  function renderListingsFromCache(){ renderListings(listingsCache); }
  // is this listing one of mine? any of my PCs (same verified pseudo) counts,
  // with a fallback to the legacy owner-uid match for older listings.
  function isMine(d){ return (myPseudo && d.seller === myPseudo) || (uid && d.owner === uid); }
  function listingMarkup(doc){
    const d = doc.data();
    const mine = isMine(d);
    const badge = verifiedPseudos.has(d.seller)
      ? `<span class="verify-badge sm" title="${escapeHtml(tr('trade.badgeVerified'))}">✓</span>` : '';
    return `<div class="listing">
      <div class="listing-main">
        <div class="listing-top"><span class="listing-seller">${badge}${escapeHtml(d.seller||'?')}</span><span class="listing-price">${escapeHtml(formatPrice(d))}</span></div>
        ${whatMarkup(d)}
        ${d.note ? `<div class="listing-note">${escapeHtml(d.note)}</div>` : ''}
      </div>
      <div class="listing-side">
        <span class="listing-time">${timeAgo(d.createdAt)}</span>
        ${expiryMarkup(d)}
        ${mine ? `<button class="listing-del" type="button" data-del="${escapeHtml(doc.id)}">${escapeHtml(tr('trade.delete'))}</button>` : ''}
      </div>
    </div>`;
  }
  function isExpired(d){ return !!(d.expireAt && d.expireAt.toDate && d.expireAt.toDate().getTime() <= Date.now()); }
  function renderListings(docs){
    // Self-cleanup: a seller removes their own expired listings on load (rules
    // allow owner/seller delete). Belt-and-suspenders with the moderator sweep.
    if (FB && (myPseudo || uid)){
      docs.filter(doc => isExpired(doc.data()) && isMine(doc.data()))
        .forEach(doc => FB.db.collection('listings').doc(doc.id).delete().catch(() => {}));
    }
    // Hide expired listings for everyone right away, even before they're swept.
    docs = docs.filter(doc => !isExpired(doc.data()));
    listingsCache = docs;
    listingsLoaded = true;
    // let the Équipement tab refresh its market offers section
    document.dispatchEvent(new CustomEvent('tradelistings'));
    const mineDocs = docs.filter(doc => isMine(doc.data()));
    const otherDocs = docs.filter(doc => !isMine(doc.data()));

    // "My sales" tab — the sell form (gate) sits above; only list once the
    // seller is verified, otherwise the gate already explains what to do.
    const mineEl = byId('trade-mine');
    if (mineEl){
      mineEl.innerHTML = !myPseudo ? '' : (mineDocs.length
        ? mineDocs.map(listingMarkup).join('')
        : `<p class="trade-empty">${escapeHtml(tr('trade.myEmpty'))}</p>`);
    }

    const el = byId('trade-listings');
    if (!el) return;
    el.innerHTML = otherDocs.length
      ? otherDocs.map(listingMarkup).join('')
      : `<p class="trade-empty">${escapeHtml(tr('trade.empty'))}</p>`;
  }

  function status(msg, ok){
    const el = byId('t-status');
    if (el){ el.textContent = msg; el.className = 'trade-status' + (ok ? ' ok' : msg ? ' err' : ''); }
  }

  // ---- connect / subscriptions ----
  function connect(){
    buildStaticUI();
    if (connected) return;
    if (!FB){ renderGate(); return; }
    connected = true;
    subscribeListings();
    subscribeVerified();
    FB.ready.then(u => {
      uid = u;
      // my own pending request (owner-readable)
      unsubMyReq = FB.db.collection('requests').doc(uid)
        .onSnapshot(doc => { myReq = doc.exists ? doc.data() : null; renderGate(); }, () => {});
      subscribeMyBanned();
      if (CTX.checkModerator) CTX.checkModerator();
      renderGate();
    }).catch(() => { renderGate(); });
  }

  // public listings (readable by anyone). Extracted from connect() so the
  // Équipement tab can lazily subscribe (market offers on the shopping list)
  // without opening the Trade tab.
  function subscribeListings(){
    if (unsubListings || !FB) return;
    unsubListings = FB.db.collection('listings').orderBy('createdAt','desc').limit(100)
      .onSnapshot(snap => renderListings(snap.docs), () => {});
  }

  // verified pseudos (readable by anyone) — used for seller badges, the sell
  // gate, and moderator names. Extracted so the mod bootstrap can reuse it.
  function subscribeVerified(){
    if (unsubVerified) return;
    unsubVerified = FB.db.collection('verified')
      .onSnapshot(snap => {
        verifiedPseudos.clear();
        Object.keys(verifiedByUid).forEach(k => delete verifiedByUid[k]);
        snap.docs.forEach(d => { const p = d.data().pseudo; if (p){ verifiedPseudos.add(p); verifiedByUid[d.id] = p; } });
        const mineDoc = snap.docs.find(d => d.id === uid);
        myPseudo = mineDoc ? (mineDoc.data().pseudo || null) : null;
        renderGate();
        if (CTX.renderAdmin) CTX.renderAdmin();
        renderListingsFromCache();
      }, () => {});
  }

  // Watch my own ban doc so a banned visitor immediately sees the notice and
  // loses the sell form, even without a moderator's list.
  function subscribeMyBanned(){
    if (unsubMyBanned || !FB || !uid) return;
    unsubMyBanned = FB.db.collection('banned').doc(uid)
      .onSnapshot(doc => { iAmBanned = doc.exists; renderGate(); }, () => {});
  }

  // Lightweight bootstrap run on page load (independent of the lazy trade
  // connect): resolves the uid and checks whether this session is a moderator,
  // so the Modération tab can appear without first opening the Trade tab.
  function initMod(){
    if (!FB) return;
    FB.ready.then(u => { uid = u; if (CTX.checkModerator) CTX.checkModerator(); }).catch(() => {});
  }

  // ---- actions ----
  function submitRequest(){
    if (!FB || !uid || iAmBanned) return;
    const pseudo = (byId('t-req-pseudo').value || '').trim().slice(0,32);
    const contact = (byId('t-req-contact').value || '').trim().slice(0,120);
    const st = byId('t-req-status');
    if (!pseudo || !contact){ if (st){ st.textContent = tr('trade.reqErrFields'); st.className = 'trade-status err'; } return; }
    const btn = byId('t-req-submit'); if (btn) btn.disabled = true;
    FB.db.collection('requests').doc(uid).set({
      uid, pseudo, contact, mode: (authMode === 'login' ? 'login' : 'create'),
      at: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => { /* myReq snapshot re-renders */ })
      .catch(err => { if (st){ st.textContent = (err && err.message) || tr('trade.errAuth'); st.className = 'trade-status err'; } if (btn) btn.disabled = false; });
  }

  function cancelRequest(){
    if (!FB || !uid) return;
    authMode = null; // back to the create/login choice
    FB.db.collection('requests').doc(uid).delete().catch(() => {});
  }

  function publish(){
    if (!FB){ status(tr('trade.offline'), false); return; }
    if (!uid){ status(tr('trade.errAuth'), false); return; }
    if (iAmBanned){ status(tr('trade.banned'), false); return; }
    if (!myPseudo){ status(tr('trade.errNotVerified'), false); return; }
    const amount = parseFloat(byId('t-price').value);
    const unit = draft.priceUnit;
    const note = (byId('t-note').value || '').trim().slice(0,120);
    if (!(amount > 0) || !UNIT_EGGS[unit]){ status(tr('trade.errFields'), false); return; }

    // `price` keeps a display string so older clients / the mod panel still work.
    const doc = { seller: myPseudo, price: amount + unit, priceAmount: amount, priceUnit: unit, kind: draft.kind, owner: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      expireAt: firebase.firestore.Timestamp.fromMillis(Date.now() + LISTING_TTL_MS) };
    if (note) doc.note = note;

    if (draft.kind === 'essence'){
      const e = essByNorm[norm(byId('t-ess').value || '')];
      if (!e){ status(tr('trade.errFields'), false); return; }
      doc.essence = e.name;
      doc.level = +byId('t-ess-lvl').value || 1;
    } else {
      if (!draft.item.essences.length && !draft.item.soul){ status(tr('trade.errFields'), false); return; }
      doc.item = {
        piece: draft.item.piece || 'chestplate',
        material: draft.item.material || '',
        essences: draft.item.essences.map(en => ({ name:en.name, level:en.level })),
        soul: draft.item.soul || null
      };
      if (doc.item.piece === 'tool') doc.item.toolType = draft.item.toolType || 'sword';
    }

    const btn = byId('t-publish');
    btn.disabled = true;
    FB.db.collection('listings').add(doc).then(() => {
      status(tr('trade.published'), true);
      byId('t-price').value = '';
      byId('t-note').value = '';
      draft.item = { piece: draft.item.piece, material: draft.item.material, toolType: draft.item.toolType, essences:[], soul:null };
      renderKindBody();
      if (draft.kind === 'essence'){ const ei = byId('t-ess'); if (ei) ei.value = ''; }
      btn.disabled = false;
    }).catch(err => { status((err && err.message) || tr('trade.errAuth'), false); btn.disabled = false; });
  }

  // ---- events ----
  function switchSubtab(tab){
    if (tab !== 'mine' && tab !== 'others') return;
    tradeTab = tab;
    document.querySelectorAll('#trade-subtabs .trade-subtab').forEach(b =>
      b.classList.toggle('active', b.getAttribute('data-subtab') === tab));
    document.querySelectorAll('.trade-panel[data-panel]').forEach(p =>
      p.hidden = p.getAttribute('data-panel') !== tab);
  }

  tradeView.addEventListener('click', (ev) => {
    const t = ev.target;
    const sub = t.closest('[data-subtab]');
    if (sub){ switchSubtab(sub.getAttribute('data-subtab')); return; }
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
    const am = t.closest('[data-auth-mode]');
    if (am){ authMode = am.getAttribute('data-auth-mode'); renderGate(); return; }
    if (t.closest('[data-auth-back]')){ authMode = null; renderGate(); return; }
    if (t.closest('#t-req-submit')){ submitRequest(); return; }
    if (t.closest('#t-req-cancel')){ cancelRequest(); return; }
    const del = t.closest('[data-del]');
    if (del){
      if (confirm(tr('trade.confirmDelete'))) FB.db.collection('listings').doc(del.getAttribute('data-del')).delete();
      return;
    }
  });

  tradeView.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 't-ess'){
      const e = essByNorm[norm(t.value)];
      const lv = e ? essLevels(e.name) : [1];
      const sel = byId('t-ess-lvl');
      if (sel) sel.innerHTML = levelOptions(lv, lv[0]);
      return;
    }
    if (t.id === 't-item-ess'){
      const e = essByNorm[norm(t.value)];
      if (e && draft.item.essences.length < 3){ draft.item.essences.push({ name:e.name, level: essLevels(e.name)[0] }); renderKindBody(); }
      return;
    }
    const il = t.closest('[data-item-lvl]');
    if (il){ draft.item.essences[+il.getAttribute('data-item-lvl')].level = +t.value; return; }
    if (t.id === 't-price-unit'){ draft.priceUnit = t.value; return; }
    if (t.id === 't-soul-count'){ if (draft.item.soul) draft.item.soul.count = +t.value; return; }
    if (t.id === 't-item-piece'){ draft.item.piece = t.value; renderKindBody(); return; }
    if (t.id === 't-item-tool'){ draft.item.toolType = t.value; return; }
    if (t.id === 't-item-mat'){ draft.item.material = t.value; return; }
  });

  // ---- shared context for trade-mod.js (loaded AFTER this file) ----
  // The mod panel reads live state + helpers from here; it registers its own
  // renderAdmin / checkModerator back onto CTX, which we call (guarded) wherever
  // the trade side needs the mod panel refreshed (build, language change, verified
  // snapshot). verifiedByUid / verifiedPseudos are shared by reference (mutated in
  // place, never reassigned), so the mod side always sees live data.
  const CTX = window.__TRADE__ = {
    FB: FB, tr: tr, escapeHtml: escapeHtml, norm: norm, byId: byId,
    getUid: function(){ return uid; },
    verifiedByUid: verifiedByUid,
    verifiedPseudos: verifiedPseudos,
    subscribeVerified: subscribeVerified,
    // market-offers API for build.js (loaded BEFORE this file, but it only
    // reads __TRADE__ lazily at render time)
    ensureListings: subscribeListings,
    listingsLoaded: function(){ return listingsLoaded; },
    getListings: function(){ return listingsCache; },
    formatPrice: formatPrice,
    priceEggs: priceEggs
  };

  // ---- lazy connect when the trade tab is shown ----
  document.addEventListener('tabchange', (ev) => { if (ev.detail === 'trade') connect(); });
  if (!tradeView.hidden) connect(); else buildStaticUI();
  // check moderator status on load so the Modération tab can appear
  initMod();

  document.addEventListener('codexlang', (ev) => {
    const code = ev.detail;
    if (I18N.strings[code]){ lang = code; S = I18N.strings[code]; }
    staticBuilt = false; buildStaticUI();
  });
})();
