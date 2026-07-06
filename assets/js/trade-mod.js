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
        <div class="trade-row">
          <input id="t-mod-add" class="trade-input" type="text" maxlength="128" placeholder="${escapeHtml(tr('trade.modAddId'))}" autocomplete="off">
          <button id="t-mod-add-btn" class="trade-publish" type="button">${escapeHtml(tr('trade.modAdd'))}</button>
        </div>
        <div id="t-mod-status" class="trade-status"></div>`;
    const banTools = `
        <div class="mod-section-title">${escapeHtml(tr('trade.modBanned'))}</div>
        <div class="mod-list">${banned}</div>
        <div class="trade-row">
          <input id="t-mod-ban" class="trade-input" type="text" maxlength="32" placeholder="${escapeHtml(tr('trade.modBanId'))}" autocomplete="off">
          <button id="t-mod-ban-btn" class="trade-del" type="button">${escapeHtml(tr('trade.modBan'))}</button>
        </div>
        <div id="t-ban-status" class="trade-status"></div>`;
    el.innerHTML = `
      <div class="mod-panel">
        <h3 class="mod-panel-title">${escapeHtml(tr('trade.modPanel'))}</h3>
        <div class="mod-section-title">${escapeHtml(tr('trade.modRequests'))}</div>
        <div class="mod-list">${reqs}</div>
        ${ownerTools}
        ${banTools}
      </div>`;
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

  function addModerator(){
    if (!isOwner) return;
    const uid = uidOf();
    const val = (byId('t-mod-add').value || '').trim();
    if (!val) return;
    // Promote by PSEUDO, not uid (nobody knows their own uid). A pseudo can map
    // to several uids (same person, several PCs) → make every one of them a mod.
    const key = norm(val);
    const uids = Object.keys(verifiedByUid).filter(u => norm(verifiedByUid[u]) === key);
    if (!uids.length){ modStatus(tr('trade.modErrNotVerified')); return; }
    Promise.all(uids.map(u => FB.db.collection('moderators').doc(u).set({
      by: uid, at: firebase.firestore.FieldValue.serverTimestamp()
    }))).then(() => { const i = byId('t-mod-add'); if (i) i.value = ''; })
      .catch(err => modStatus((err && err.message) || tr('trade.errAuth')));
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
  function banByPseudo(){
    if (!isMod) return;
    const uid = uidOf();
    const input = byId('t-mod-ban');
    const val = (input && input.value || '').trim();
    if (!val) return;
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
      .then(() => { if (input) input.value = ''; banStatus(tr('trade.modBanDone') + ' (' + uids.size + ')', true); })
      .catch(err => banStatus((err && err.message) || tr('trade.errAuth')));
  }
  function unban(id){ if (!isMod) return; FB.db.collection('banned').doc(id).delete().catch(err => banStatus((err && err.message) || tr('trade.errAuth'))); }

  // ---- events ----
  if (modView) modView.addEventListener('click', (ev) => {
    const t = ev.target;
    if (t.closest('#t-mod-add-btn')){ addModerator(); return; }
    if (t.closest('#t-mod-ban-btn')){ banByPseudo(); return; }
    const rok = t.closest('[data-req-ok]'); if (rok){ approveReq(rok.getAttribute('data-req-ok')); return; }
    const rno = t.closest('[data-req-no]'); if (rno){ rejectReq(rno.getAttribute('data-req-no')); return; }
    const mrm = t.closest('[data-mod-rm]'); if (mrm){ if (confirm(tr('trade.confirmModRemove'))) removeModerator(mrm.getAttribute('data-mod-rm')); return; }
    const brm = t.closest('[data-ban-rm]'); if (brm){ if (confirm(tr('trade.confirmUnban'))) unban(brm.getAttribute('data-ban-rm')); return; }
  });

  // ---- expose to trade.js + set the initial (hidden) tab state ----
  CTX.renderAdmin = renderAdmin;
  CTX.checkModerator = checkModerator;
  renderAdmin();
})();
