// trade-mod.js — moderator "Modération" tab: panel rendering, admin Firestore
// subscriptions, and the mod actions (approve/reject verification requests,
// ban/unban users, owner-only moderator management).
//
// Split out of trade.js to keep each file focused. It shares live state and
// helpers with trade.js through window.__TRADE__ (CTX), which trade.js sets up —
// so this file MUST load AFTER trade.js. No ES modules: classic <script>,
// file:// friendly, same as the rest of the site.
(function(){
  const CTX = window.__TRADE__;
  if (!CTX) return; // trade.js didn't initialise (no trade view) → nothing to do

  // ---- shared helpers + live state from trade.js ----
  const FB = CTX.FB;
  const tr = CTX.tr, escapeHtml = CTX.escapeHtml, norm = CTX.norm, byId = CTX.byId;
  const verifiedByUid = CTX.verifiedByUid;     // uid -> pseudo (mutated in place by trade.js)
  const verifiedPseudos = CTX.verifiedPseudos; // Set of verified pseudos
  const subscribeVerified = CTX.subscribeVerified;
  const uidOf = () => CTX.getUid();            // current uid (resolved async by trade.js)

  // ---- DOM ----
  const modView = document.getElementById('mod-view');
  const modInner = document.getElementById('mod-inner');
  const modTabBtn = document.querySelector('.tab[data-tab="mod"]');

  // ---- moderator state ----
  let isMod = false;    // is the current uid a moderator?
  let isOwner = false;  // is the current uid the OWNER (super-admin)? — manages mods + bans
  let pendingReqs = [], modList = [], bannedList = [];
  let unsubReqs = null, unsubMods = null, unsubBanned = null;
  let verifiedFilter = ''; // live search over the verified-accounts list

  // ---- panel render ----
  function renderAdmin(){
    const uid = uidOf();
    // reveal the Modération tab only for moderators
    if (modTabBtn) modTabBtn.hidden = !isMod;
    const el = modInner;
    if (!el) return;
    if (!isMod){ el.innerHTML = ''; return; }
    const reqs = pendingReqs.length
      ? pendingReqs.map(r => {
          const isLogin = r.mode === 'login';
          const exists = [...verifiedPseudos].some(p => norm(p) === norm(r.pseudo));
          const modeBadge = `<span class="mod-mode ${isLogin ? 'login' : 'create'}">${escapeHtml(tr(isLogin ? 'trade.modModeLogin' : 'trade.modModeCreate'))}</span>`;
          // hint the moderator whether the claimed pseudo already exists
          let hint = '';
          if (isLogin) hint = exists
            ? `<span class="mod-hint ok">${escapeHtml(tr('trade.modPseudoExists'))}</span>`
            : `<span class="mod-hint warn">${escapeHtml(tr('trade.modPseudoUnknown'))}</span>`;
          else if (exists) hint = `<span class="mod-hint warn">${escapeHtml(tr('trade.modPseudoTaken'))}</span>`;
          return `
          <div class="mod-row">
            <div class="mod-row-main">${modeBadge}<strong>${escapeHtml(r.pseudo||'?')}</strong>${hint}
              <span class="mod-contact">${escapeHtml(r.contact||'')}</span>
              <span class="mod-uid">${escapeHtml(r.id)}</span></div>
            <div class="mod-row-act">
              <button class="mod-ok" type="button" data-req-ok="${escapeHtml(r.id)}">${escapeHtml(tr('trade.modApprove'))}</button>
              <button class="mod-no" type="button" data-req-no="${escapeHtml(r.id)}">${escapeHtml(tr('trade.modReject'))}</button>
            </div>
          </div>`;
        }).join('')
      : `<p class="trade-empty">${escapeHtml(tr('trade.modNoRequests'))}</p>`;
    const mods = modList.map(m => {
      const pseudo = verifiedByUid[m.id];
      const you = m.id === uid ? ' ' + escapeHtml(tr('trade.modYou')) : '';
      const main = pseudo
        ? `<strong>${escapeHtml(pseudo)}</strong>${you}<span class="mod-uid">${escapeHtml(m.id)}</span>`
        : `<span class="mod-uid">${escapeHtml(m.id)}${you}</span>`;
      return `
      <div class="mod-row">
        <div class="mod-row-main">${main}</div>
        <div class="mod-row-act">
          <button class="mod-no" type="button" data-mod-rm="${escapeHtml(m.id)}">${escapeHtml(tr('trade.modRemove'))}</button>
        </div>
      </div>`;
    }).join('');
    const banned = bannedList.length
      ? bannedList.map(b => {
          const main = b.pseudo
            ? `<strong>${escapeHtml(b.pseudo)}</strong><span class="mod-uid">${escapeHtml(b.id)}</span>`
            : `<span class="mod-uid">${escapeHtml(b.id)}</span>`;
          return `
          <div class="mod-row">
            <div class="mod-row-main">${main}</div>
            <div class="mod-row-act">
              <button class="mod-ok" type="button" data-ban-rm="${escapeHtml(b.id)}">${escapeHtml(tr('trade.modUnban'))}</button>
            </div>
          </div>`;
        }).join('')
      : `<p class="trade-empty">${escapeHtml(tr('trade.modNoBans'))}</p>`;
    // Managing moderators (add/remove) is OWNER-only, so mods can't promote or
    // remove each other. Any moderator can ban NORMAL users, but never another
    // moderator or the owner (guarded in banByPseudo + the rules).
    const ownerTools = !isOwner ? '' : `
        <div class="mod-section-title">${escapeHtml(tr('trade.modMods'))}</div>
        <div class="mod-list">${mods}</div>
        <div id="t-mod-status" class="trade-status"></div>`;
    const banTools = `
        <div class="mod-section-title">${escapeHtml(tr('trade.modBanned'))}</div>
        <div class="mod-list">${banned}</div>
        <div id="t-ban-status" class="trade-status"></div>`;
    const verifiedTools = `
        <div class="mod-section-title">${escapeHtml(tr('trade.modVerifiedUsers'))}</div>
        <div class="trade-row">
          <input id="t-mod-verified-search" class="trade-input" type="text" maxlength="64" placeholder="${escapeHtml(tr('trade.modSearchPlaceholder'))}" autocomplete="off" value="${escapeHtml(verifiedFilter)}">
        </div>
        <div class="mod-list">${renderVerifiedList(uid)}</div>`;
    el.innerHTML = `
      <div class="mod-panel">
        <h3 class="mod-panel-title">${escapeHtml(tr('trade.modPanel'))}</h3>
        <div class="mod-section-title">${escapeHtml(tr('trade.modRequests'))}</div>
        <div class="mod-list">${reqs}</div>
        ${ownerTools}
        ${banTools}
        ${verifiedTools}
      </div>`;
  }

  // list of every verified account (pseudo + uid), filterable by the search
  // box, with an inline promote-to-mod (owner only) / ban action per row.
  function renderVerifiedList(uid){
    const modIds = new Set(modList.map(m => m.id));
    const bannedIds = new Set(bannedList.map(b => b.id));
    const entries = Object.keys(verifiedByUid).map(u => ({ uid: u, pseudo: verifiedByUid[u] }));
    entries.sort((a, b) => norm(a.pseudo).localeCompare(norm(b.pseudo)));
    const q = norm(verifiedFilter);
    const filtered = q
      ? entries.filter(e => norm(e.pseudo).includes(q) || e.uid.toLowerCase().includes(q))
      : entries;
    if (!filtered.length) return `<p class="trade-empty">${escapeHtml(tr('trade.modNoVerified'))}</p>`;
    return filtered.map(e => {
      const you = e.uid === uid ? ' ' + escapeHtml(tr('trade.modYou')) : '';
      const entryIsMod = modIds.has(e.uid);
      const entryIsBanned = bannedIds.has(e.uid);
      const status = entryIsMod
        ? `<span class="mod-mode login">${escapeHtml(tr('trade.modMods'))}</span>`
        : entryIsBanned ? `<span class="mod-mode">${escapeHtml(tr('trade.modBanned'))}</span>` : '';
      const promoteBtn = (isOwner && !entryIsMod && !entryIsBanned)
        ? `<button class="mod-ok" type="button" data-verified-promote="${escapeHtml(e.uid)}">${escapeHtml(tr('trade.modPromote'))}</button>` : '';
      const banBtn = (!entryIsMod && !entryIsBanned)
        ? `<button class="mod-no" type="button" data-verified-ban="${escapeHtml(e.uid)}">${escapeHtml(tr('trade.modBan'))}</button>` : '';
      return `
      <div class="mod-row">
        <div class="mod-row-main">${status}<strong>${escapeHtml(e.pseudo)}</strong>${you}<span class="mod-uid">${escapeHtml(e.uid)}</span></div>
        <div class="mod-row-act">${promoteBtn}${banBtn}</div>
      </div>`;
    }).join('');
  }

  // ---- subscriptions ----
  // Moderator sweep: on every mod page load, delete ALL expired listings — even
  // those of sellers who never return (rules allow mods to delete any listing).
  // This is our free replacement for a server-side TTL policy (Blaze-only).
  function sweepExpiredListings(){
    if (!FB || !isMod) return;
    FB.db.collection('listings').where('expireAt','<=', firebase.firestore.Timestamp.now()).get()
      .then(snap => Promise.all(snap.docs.map(d => d.ref.delete())))
      .catch(() => {});
  }

  function subscribeAdmin(){
    if (unsubReqs) return;
    unsubReqs = FB.db.collection('requests').orderBy('at','desc').limit(100)
      .onSnapshot(snap => { pendingReqs = snap.docs.map(d => Object.assign({ id:d.id }, d.data())); renderAdmin(); }, () => {});
    unsubMods = FB.db.collection('moderators')
      .onSnapshot(snap => { modList = snap.docs.map(d => ({ id:d.id })); renderAdmin(); }, () => {});
    unsubBanned = FB.db.collection('banned')
      .onSnapshot(snap => { bannedList = snap.docs.map(d => Object.assign({ id:d.id }, d.data())); renderAdmin(); }, () => {});
  }

  // Resolve moderator / owner status for the current uid and wire up the admin
  // subscriptions. Single source of truth, called by trade.js's connect() and
  // initMod(). subscribeVerified() is idempotent, so calling it here is safe.
  function checkModerator(){
    const uid = uidOf();
    if (!FB || !uid) return Promise.resolve();
    return FB.db.collection('moderators').doc(uid).get().then(doc => {
      isMod = doc.exists;
      isOwner = doc.exists && !!(doc.data() && doc.data().owner === true);
      if (isMod){ subscribeVerified(); subscribeAdmin(); sweepExpiredListings(); }
      renderAdmin();
    }).catch(() => {});
  }

  // ---- actions ----
  function approveReq(id){
    const uid = uidOf();
    const r = pendingReqs.find(x => x.id === id);
    if (!r) return;
    FB.db.collection('verified').doc(id).set({
      pseudo: r.pseudo, by: uid, at: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => FB.db.collection('requests').doc(id).delete())
      .catch(err => modStatus((err && err.message) || tr('trade.errAuth')));
  }
  function rejectReq(id){ FB.db.collection('requests').doc(id).delete().catch(() => {}); }

  // Promote by PSEUDO, not uid (nobody knows their own uid). A pseudo can map
  // to several uids (same person, several PCs) → make every one of them a mod.
  // Called from a row in the verified-accounts list with that row's pseudo.
  function addModerator(val){
    if (!isOwner || !val) return;
    const uid = uidOf();
    const key = norm(val);
    const uids = Object.keys(verifiedByUid).filter(u => norm(verifiedByUid[u]) === key);
    if (!uids.length){ modStatus(tr('trade.modErrNotVerified')); return; }
    Promise.all(uids.map(u => FB.db.collection('moderators').doc(u).set({
      by: uid, at: firebase.firestore.FieldValue.serverTimestamp()
    }))).catch(err => modStatus((err && err.message) || tr('trade.errAuth')));
  }
  function removeModerator(id){ if (!isOwner) return; FB.db.collection('moderators').doc(id).delete().catch(err => modStatus((err && err.message) || tr('trade.errAuth'))); }
  function modStatus(msg){ const el = byId('t-mod-status'); if (el){ el.textContent = msg; el.className = 'trade-status err'; } }
  function banStatus(msg, ok){ const el = byId('t-ban-status'); if (el){ el.textContent = msg; el.className = 'trade-status' + (ok ? ' ok' : msg ? ' err' : ''); } }

  // Ban a PSEUDO → bans every uid that maps to it. A pseudo can span several PCs
  // (each its own uid); we collect them from the verified map and from any pending
  // request under that pseudo. A ban only BLOCKS the accounts and removes what they
  // sell — we KEEP their verification so that unbanning fully restores them without
  // re-registration. Mod rights are the one thing we strip, so a banned moderator
  // can't lift their own ban.
  // Called from a row in the verified-accounts list with that row's pseudo.
  function banByPseudo(val){
    if (!isMod || !val) return;
    const uid = uidOf();
    const key = norm(val);
    const uids = new Set();
    Object.keys(verifiedByUid).forEach(u => { if (norm(verifiedByUid[u]) === key) uids.add(u); });
    pendingReqs.forEach(r => { if (norm(r.pseudo) === key) uids.add(r.id); });
    if (!uids.size){ banStatus(tr('trade.modErrNotVerified')); return; }
    // A moderator can't ban another moderator (or the owner). If any of the
    // pseudo's uids is a mod, refuse the whole ban. (Rules enforce this too.)
    const modIds = new Set(modList.map(m => m.id));
    if ([...uids].some(u => modIds.has(u))){ banStatus(tr('trade.modErrBanMod')); return; }
    if (!confirm(tr('trade.confirmBan'))) return;
    const stamp = () => ({ pseudo: val.slice(0,32), by: uid, at: firebase.firestore.FieldValue.serverTimestamp() });
    const ops = [];
    uids.forEach(u => {
      ops.push(FB.db.collection('banned').doc(u).set(stamp()));
      ops.push(FB.db.collection('moderators').doc(u).delete().catch(() => {}));
    });
    // remove only what they sell — their listings (managed by pseudo)
    ops.push(FB.db.collection('listings').where('seller','==', val).get()
      .then(snap => Promise.all(snap.docs.map(d => d.ref.delete())))
      .catch(() => {}));
    Promise.all(ops)
      .then(() => banStatus(tr('trade.modBanDone') + ' (' + uids.size + ')', true))
      .catch(err => banStatus((err && err.message) || tr('trade.errAuth')));
  }
  function unban(id){ if (!isMod) return; FB.db.collection('banned').doc(id).delete().catch(err => banStatus((err && err.message) || tr('trade.errAuth'))); }

  // ---- events ----
  if (modView) modView.addEventListener('click', (ev) => {
    const t = ev.target;
    const rok = t.closest('[data-req-ok]'); if (rok){ approveReq(rok.getAttribute('data-req-ok')); return; }
    const rno = t.closest('[data-req-no]'); if (rno){ rejectReq(rno.getAttribute('data-req-no')); return; }
    const mrm = t.closest('[data-mod-rm]'); if (mrm){ if (confirm(tr('trade.confirmModRemove'))) removeModerator(mrm.getAttribute('data-mod-rm')); return; }
    const brm = t.closest('[data-ban-rm]'); if (brm){ if (confirm(tr('trade.confirmUnban'))) unban(brm.getAttribute('data-ban-rm')); return; }
    const vpromote = t.closest('[data-verified-promote]');
    if (vpromote){ addModerator(verifiedByUid[vpromote.getAttribute('data-verified-promote')]); return; }
    const vban = t.closest('[data-verified-ban]');
    if (vban){ banByPseudo(verifiedByUid[vban.getAttribute('data-verified-ban')]); return; }
  });

  // live-filter the verified-accounts list as the moderator types; renderAdmin()
  // rebuilds the whole panel, so re-focus + restore the caret afterwards.
  if (modView) modView.addEventListener('input', (ev) => {
    if (!ev.target || ev.target.id !== 't-mod-verified-search') return;
    verifiedFilter = ev.target.value;
    const pos = ev.target.selectionStart;
    renderAdmin();
    const el = byId('t-mod-verified-search');
    if (el){ el.focus(); try { el.setSelectionRange(pos, pos); } catch (e) {} }
  });

  // ---- expose to trade.js + set the initial (hidden) tab state ----
  CTX.renderAdmin = renderAdmin;
  CTX.checkModerator = checkModerator;
  renderAdmin();
})();
