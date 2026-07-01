(function(){
  const DATA = window.__MINEWIND_DATA__;
  const I18N = window.__I18N__;
  const essences = DATA.essences;
  const tierLegend = DATA.tierLegend;

  // ---- i18n (mirrors app.js, kept in sync via the 'codexlang' event) ----
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
    const dig = (obj) => key.split('.').reduce((o, k) => (o && o[k] != null) ? o[k] : undefined, obj);
    const v = dig(S);
    if (v != null) return v;
    const f = dig(I18N.strings.fr);
    return f != null ? f : key;
  }
  function escapeHtml(s){
    return (s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function norm(s){
    return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  }

  // ---- data helpers ----
  const ROMAN = ['I','II','III','IV','V'];
  const tierValue = {};
  tierLegend.forEach(r => { tierValue[r.tier] = r.value; });
  // Rough worth of each tier code, in "s" (1 stack = 64 dragon eggs), for the shopping total.
  // Z (bidding wars) and TBD have no estimate — they're counted as "undetermined".
  const TIER_STACKS = { X:40, SSS:20, SS:12, S:8, AAA:7, AA:6, A:5, BBB:4, BB:3, B:2, CCC:1, CC:0.5, C:0.25 };
  const essByNorm = {};
  essences.forEach(e => { essByNorm[norm(e.name)] = e; });

  // Type restriction: a weapon-only essence can't go on armor and vice-versa.
  // Spells aren't restricted, so they remain available on every slot.
  function typesOf(e){ return (e && e.type || '').split(',').map(s => s.trim()); }
  function isSpell(e){ return typesOf(e).includes('spell'); }
  // Essences that stack across the WHOLE loadout (not per item), with their max effective tier.
  // e.g. Untouchable: putting II on two different pieces yields IV.
  const SET_STACK = { 'untouchable': 4 };
  function isSetStack(name){ return SET_STACK[norm(name)] != null; }
  // Which essences a slot category accepts:
  //  - 'any'    (helmet/head): everything — a tool/weapon can sit there
  //  - 'weapon' (offhand): weapon essences + spells
  //  - 'armor'  (chest/legs/boots): armor essences only — NO spells, no weapon-only
  function appliesTo(e, cat){
    if (!e) return false;
    if (cat === 'any') return true;
    const types = typesOf(e);
    if (cat === 'weapon') return types.includes('weapon') || types.includes('spell');
    if (cat === 'armor') return types.includes('armor');
    return false;
  }

  function translateLegend(value){
    if (value === 'Pas encore échangé') return tr('notTraded');
    return value.replace('ou moins', tr('orLess'));
  }
  function priceText(raw){
    const t = (raw||'').trim();
    if (!t) return '—';
    return tierValue[t] != null ? translateLegend(tierValue[t]) : t;
  }
  // available levels (non-empty price) for an essence; always at least level 1
  function levelsOf(name){
    const e = essByNorm[norm(name)];
    if (!e) return [{lvl:1, raw:''}];
    const out = (e.prices||[]).map((raw,i) => ({lvl:i+1, raw:(raw||'').trim()})).filter(x => x.raw);
    return out.length ? out : [{lvl:1, raw:''}];
  }

  // ---- souls (game terms kept in English across all languages) ----
  const SOULS = [
    {key:'fire',        label:'Fire',        color:'#ff7a45'},
    {key:'ice',         label:'Ice',         color:'#5fc7ff'},
    {key:'shadow',      label:'Shadow',      color:'#9b8cff'},
    {key:'dragon',      label:'Dragon',      color:'#7ed957'},
    {key:'orc',         label:'Orc',         color:'#b5c25a'},
    {key:'nature',      label:'Nature',      color:'#54c98b'},
    {key:'dimensional', label:'Dimensional', color:'#c879ff'},
    {key:'blood',       label:'Blood',       color:'#e0454a'},
    {key:'undead',      label:'Undead',      color:'#9fb3a6'}
  ];
  const soulByKey = {};
  SOULS.forEach(s => { soulByKey[s.key] = s; });

  // ---- state: multiple named sets (persisted) ----
  const SLOTS = ['helmet','chestplate','leggings','boots','offhand'];
  // helmet/head can hold a tool or weapon, so it accepts every essence type
  const SLOT_CAT = { helmet:'any', chestplate:'armor', leggings:'armor', boots:'armor', offhand:'weapon' };
  const MAX_ESS = 3, MAX_SOULS = 4;

  // The head holds ONE item — either a weapon or an armor piece, not a mix.
  // It locks to a mode as soon as a committing essence is placed.
  function helmetMode(essList){
    for (const en of essList){
      const types = typesOf(essByNorm[norm(en.name)]);
      if (types.includes('spell')) return 'weapon';          // spells imply a weapon/tool on the head
      const arm = types.includes('armor'), wep = types.includes('weapon');
      if (arm && !wep) return 'armor';                       // armor-only essence → armor mode
      if (wep && !arm) return 'weapon';                      // weapon-only essence → weapon mode
      // weapon+armor combos don't commit a mode on their own
    }
    return null;
  }
  // Effective accepted category for a slot given what's already on it.
  function slotCat(slotKey, slotObj){
    const base = SLOT_CAT[slotKey];
    if (base !== 'any') return base;
    return helmetMode((slotObj && slotObj.essences) || []) || 'any';
  }
  const BUILDS_KEY = 'minewind-builds';
  const LEGACY_KEY = 'minewind-build';

  function emptySlots(){
    const o = {};
    SLOTS.forEach(k => { o[k] = { essences:[], soul:null }; });
    return o;
  }
  function sanitizeSlots(src){
    const out = emptySlots();
    if (src){
      SLOTS.forEach(k => {
        const s = src[k];
        if (!s) return;
        let firstSpell = null;
        const seen = new Set();
        const kept = [];
        for (const raw of (s.essences || [])){
          if (!raw || !raw.name) continue;
          const e = essByNorm[norm(raw.name)];
          if (!e) continue;
          if (kept.length >= MAX_ESS) break;
          if (!appliesTo(e, slotCat(k, { essences: kept }))) continue; // category / helmet-mode lock
          const level = Math.min(5, Math.max(1, raw.level || 1));
          const id = norm(e.name) + '|' + level;
          if (seen.has(id)) continue;                                   // same essence + same tier twice
          if (isSpell(e)){
            if (firstSpell && firstSpell !== norm(e.name)) continue;     // a second, different spell
            firstSpell = norm(e.name);
          }
          seen.add(id);
          kept.push({ name: e.name, level, owned: !!raw.owned });
        }
        out[k].essences = kept;
        // soul: one type, quantity 1-4 (convert legacy `souls` array if present)
        let soul = null;
        if (s.soul && soulByKey[s.soul.type]){
          soul = { type: s.soul.type, count: Math.min(MAX_SOULS, Math.max(1, s.soul.count||1)) };
        } else if (Array.isArray(s.souls) && s.souls.length && soulByKey[s.souls[0]]){
          soul = { type: s.souls[0], count: Math.min(MAX_SOULS, s.souls.length) };
        }
        out[k].soul = soul;
      });
    }
    return out;
  }
  function newId(){ return 'set-' + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
  function defaultName(i){ return tr('build.defaultSetName') + ' ' + (i+1); }
  function makeSet(name, srcSlots){ return { id:newId(), name:name, slots: sanitizeSlots(srcSlots) }; }

  function loadBuilds(){
    // current multi-set format
    try {
      const raw = localStorage.getItem(BUILDS_KEY);
      if (raw){
        const p = JSON.parse(raw);
        if (p && Array.isArray(p.sets) && p.sets.length){
          const sets = p.sets.map((s,i) => ({
            id: s.id || newId(),
            name: (s.name != null ? String(s.name) : defaultName(i)).slice(0,40),
            slots: sanitizeSlots(s.slots)
          }));
          const activeId = sets.some(s => s.id === p.activeId) ? p.activeId : sets[0].id;
          return { sets, activeId };
        }
      }
    } catch(e){}
    // migrate a legacy single build
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw){
        const p = JSON.parse(raw);
        const set = makeSet(defaultName(0), p && p.slots);
        return { sets:[set], activeId:set.id };
      }
    } catch(e){}
    const set = makeSet(defaultName(0), null);
    return { sets:[set], activeId:set.id };
  }
  let builds = loadBuilds();
  function active(){ return builds.sets.find(s => s.id === builds.activeId) || builds.sets[0]; }
  function save(){ try { localStorage.setItem(BUILDS_KEY, JSON.stringify(builds)); } catch(e){} }

  // ---- share a set via URL (no backend: the whole set is encoded in the link) ----
  function b64url(str){
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }
  function unb64url(s){
    s = s.replace(/-/g,'+').replace(/_/g,'/');
    const bin = atob(s);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function shareUrl(set){
    const payload = b64url(JSON.stringify({ n: set.name, s: set.slots }));
    return location.origin + location.pathname + '#s=' + payload;
  }
  function importFromHash(){
    const m = (location.hash || '').match(/[#&]s=([^&]+)/);
    if (!m) return false;
    try {
      const data = JSON.parse(unb64url(m[1]));
      const set = makeSet((data.n != null ? String(data.n) : defaultName(builds.sets.length)).slice(0,40), data.s);
      builds.sets.push(set);
      builds.activeId = set.id;
      save();
      history.replaceState(null, '', location.pathname + location.search);
      return true;
    } catch(e){ return false; }
  }

  function addSet(){
    const set = makeSet(defaultName(builds.sets.length), null);
    builds.sets.push(set);
    builds.activeId = set.id;
    openPicker = null;
    save(); renderBuild();
  }
  function deleteSet(id){
    if (builds.sets.length <= 1) return;
    builds.sets = builds.sets.filter(s => s.id !== id);
    if (builds.activeId === id) builds.activeId = builds.sets[0].id;
    openPicker = null;
    save(); renderBuild();
  }

  // ---- DOM ----
  const buildView = document.getElementById('build-view');
  const buildInner = document.getElementById('build-inner');
  const pickerList = document.getElementById('ess-picker-list');
  const codexView = document.getElementById('codex-view');
  const tabs = document.getElementById('tabs');

  // The same essence can be stacked at DIFFERENT tiers. First tier still free for an essence on a slot:
  function freeLevel(slot, name){
    const used = active().slots[slot].essences.filter(en => norm(en.name) === norm(name)).map(en => en.level);
    const found = levelsOf(name).map(l => l.lvl).find(l => !used.includes(l));
    return (found != null) ? found : null;
  }
  // Stacked effect of an essence on an item: sum of its tiers, capped at the essence's max tier.
  function stackCap(name){
    if (SET_STACK[norm(name)] != null) return SET_STACK[norm(name)];
    const e = essByNorm[norm(name)];
    const c = parseInt((e && e.cap) || '', 10);
    if (c) return c;
    const lv = levelsOf(name);
    return lv[lv.length - 1].lvl; // fall back to highest available tier
  }
  // Essences a slot can still receive: category filter, single-distinct-spell rule, and a free tier left.
  function allowedEssences(slot){
    const cat = slotCat(slot, active().slots[slot]);
    const spellNames = active().slots[slot].essences
      .filter(en => isSpell(essByNorm[norm(en.name)])).map(en => norm(en.name));
    return essences.filter(e =>
      appliesTo(e, cat) &&
      !(isSpell(e) && spellNames.length && !spellNames.includes(norm(e.name))) && // a different spell already there
      freeLevel(slot, e.name) != null      // still has a tier not yet on this item
    );
  }
  function fillPicker(slot){
    pickerList.innerHTML = allowedEssences(slot)
      .map(e => `<option value="${escapeHtml(e.name)}"></option>`).join('');
  }

  let openPicker = null; // { slot, type:'essence'|'soul' }

  // ---- render ----
  function slotMarkup(key){
    const slot = active().slots[key];
    const name = tr('build.slots.' + key);

    // essences
    let essChips = slot.essences.map((entry, i) => {
      const lvls = levelsOf(entry.name);
      if (!lvls.some(l => l.lvl === entry.level)) entry.level = lvls[0].lvl;
      // tiers used by OTHER entries of the same essence can't be picked twice
      const usedByOthers = slot.essences
        .filter((en, j) => j !== i && norm(en.name) === norm(entry.name)).map(en => en.level);
      const opts = lvls.filter(l => l.lvl === entry.level || !usedByOthers.includes(l.lvl)).map(l =>
        `<option value="${l.lvl}"${l.lvl===entry.level?' selected':''}>${ROMAN[l.lvl-1]} · ${escapeHtml(priceText(l.raw))}</option>`
      ).join('');
      return `<div class="ess-chip">
        <span class="ess-chip-name">${escapeHtml(entry.name)}</span>
        <select class="lvl-select" data-slot="${key}" data-idx="${i}" title="${escapeHtml(tr('build.level'))}">${opts}</select>
        <button class="chip-x" type="button" data-rm-ess="${key}" data-idx="${i}" aria-label="×">×</button>
      </div>`;
    }).join('');
    if (slot.essences.length < MAX_ESS){
      essChips += `<button class="add-chip" type="button" data-add-ess="${key}">+ ${escapeHtml(tr('build.addEssence'))}</button>`;
    }

    // stacking note: essences present more than once -> summed tier capped at the essence's max
    const groups = {};
    slot.essences.forEach(en => { (groups[en.name] = groups[en.name] || []).push(en.level); });
    const stackNotes = Object.keys(groups).filter(n => groups[n].length > 1 && !isSetStack(n)).map(n => {
      const lv = groups[n].slice().sort((a,b) => a-b);
      const eff = Math.min(stackCap(n), lv.reduce((a,b) => a+b, 0));
      return `<div class="stack-note"><span class="stack-name">${escapeHtml(n)}</span>
        <span class="stack-calc">${lv.map(l => ROMAN[l-1]).join(' + ')} → <strong>${ROMAN[eff-1] || eff}</strong></span></div>`;
    }).join('');
    let essPicker = '';
    if (openPicker && openPicker.slot === key && openPicker.type === 'essence'){
      essPicker = `<input class="ess-input" type="text" data-slot="${key}" list="ess-picker-list" autocomplete="off" spellcheck="false" placeholder="${escapeHtml(tr('build.searchEssence'))}">`;
    }

    // soul: a single type with a quantity (1-4)
    let soulChips = '';
    if (slot.soul){
      const s = soulByKey[slot.soul.type];
      const countOpts = [1,2,3,4].map(n => `<option value="${n}"${n===slot.soul.count?' selected':''}>×${n}</option>`).join('');
      soulChips = `<div class="soul-chip" style="--soul:${s.color}">
        <span class="soul-dot"></span>
        <span class="soul-chip-name">${escapeHtml(s.label)}</span>
        <select class="soul-count" data-slot="${key}">${countOpts}</select>
        <button class="chip-x" type="button" data-rm-soul="${key}" aria-label="×">×</button>
      </div>`;
    } else {
      soulChips = `<button class="add-chip" type="button" data-add-soul="${key}">+ ${escapeHtml(tr('build.addSoul'))}</button>`;
    }
    let soulPicker = '';
    if (openPicker && openPicker.slot === key && openPicker.type === 'soul'){
      soulPicker = `<div class="soul-picker">` + SOULS.map(s =>
        `<button class="soul-opt" type="button" data-soul-pick="${s.key}" data-slot="${key}" style="--soul:${s.color}"><span class="soul-dot"></span>${escapeHtml(s.label)}</button>`
      ).join('') + `</div>`;
    }

    return `<div class="slot">
      <div class="slot-name">${escapeHtml(name)}</div>
      <div class="slot-block">
        <div class="slot-label">${escapeHtml(tr('build.essences'))} <span class="slot-count">${slot.essences.length}/${MAX_ESS}</span></div>
        <div class="ess-list">${essChips}</div>
        ${stackNotes ? `<div class="stack-notes">${stackNotes}</div>` : ''}
        ${essPicker}
      </div>
      <div class="slot-block">
        <div class="slot-label">${escapeHtml(tr('build.souls'))} <span class="slot-count">${slot.soul ? slot.soul.count : 0}/${MAX_SOULS}</span></div>
        <div class="chips">${soulChips}</div>
        ${soulPicker}
      </div>
    </div>`;
  }

  function shoppingMarkup(){
    const items = [];
    SLOTS.forEach(key => {
      active().slots[key].essences.forEach((entry, idx) => {
        const lvls = levelsOf(entry.name);
        const cur = lvls.find(l => l.lvl === entry.level) || lvls[0];
        items.push({ slot:key, idx, name:entry.name, level:entry.level, raw:cur.raw, owned:!!entry.owned });
      });
    });

    if (!items.length){
      return `<div class="shopping">
        <div class="shopping-head"><h3>${escapeHtml(tr('build.shopping'))}</h3></div>
        <p class="shopping-empty">${escapeHtml(tr('build.shoppingEmpty'))}</p>
      </div>`;
    }

    const total = items.length;
    const owned = items.filter(i => i.owned).length;
    const remaining = total - owned;

    // estimated remaining cost (sum of unowned tiers, in stacks); some tiers have no estimate
    let cost = 0, undetermined = false;
    items.filter(i => !i.owned).forEach(it => {
      const code = (it.raw || '').trim();
      if (TIER_STACKS[code] != null) cost += TIER_STACKS[code];
      else if (code) undetermined = true;
    });
    const costLabel = remaining
      ? `<span class="stat-cost" title="${escapeHtml(tr('build.estCost'))}">≈ ${Math.round(cost*10)/10}s${undetermined ? ' +' : ''}</span>`
      : '';

    // remaining first, then owned
    items.sort((a,b) => (a.owned - b.owned));

    const rows = items.map(it => `
      <label class="buy-row${it.owned?' done':''}">
        <input type="checkbox" class="own-check" data-slot="${it.slot}" data-idx="${it.idx}"${it.owned?' checked':''}>
        <span class="buy-name">${escapeHtml(it.name)}</span>
        <span class="buy-slot">${escapeHtml(tr('build.slots.' + it.slot))}</span>
        <span class="buy-lvl">${ROMAN[it.level-1]}</span>
        <span class="buy-price">${escapeHtml(priceText(it.raw))}</span>
      </label>`).join('');

    return `<div class="shopping">
      <div class="shopping-head">
        <h3>${escapeHtml(tr('build.shopping'))}</h3>
        <div class="shopping-stats">
          <span class="stat-rem">${remaining} ${escapeHtml(tr('build.remaining'))}</span>
          <span class="stat-own">${owned}/${total} ${escapeHtml(tr('build.acquired'))}</span>
          ${costLabel}
        </div>
      </div>
      <div class="buy-list">${rows}</div>
    </div>`;
  }

  // essences that stack across the whole loadout (Untouchable) -> one combined effect
  function setEffectsMarkup(){
    const totals = {};
    SLOTS.forEach(k => active().slots[k].essences.forEach(en => {
      if (isSetStack(en.name)) (totals[en.name] = totals[en.name] || []).push(en.level);
    }));
    const names = Object.keys(totals);
    if (!names.length) return '';
    const rows = names.map(n => {
      const lv = totals[n].slice().sort((a,b) => a-b);
      const eff = Math.min(stackCap(n), lv.reduce((a,b) => a+b, 0));
      return `<div class="stack-note"><span class="stack-name">${escapeHtml(n)}</span>
        <span class="stack-calc">${lv.map(l => ROMAN[l-1]).join(' + ')} → <strong>${ROMAN[eff-1] || eff}</strong></span></div>`;
    }).join('');
    return `<div class="set-effects">
      <div class="set-effects-label">${escapeHtml(tr('build.setEffect'))}</div>
      ${rows}
    </div>`;
  }

  function renderBuild(){
    const slotsHtml = SLOTS.map(slotMarkup).join('');
    const setTabs = builds.sets.map(s =>
      `<button class="set-tab${s.id===builds.activeId?' active':''}" type="button" data-set-id="${s.id}">${escapeHtml(s.name || '—')}</button>`
    ).join('');
    const canDelete = builds.sets.length > 1;
    buildInner.innerHTML = `
      <div class="sets-bar">
        ${setTabs}
        <button class="set-add" type="button" data-set-add>+ ${escapeHtml(tr('build.newSet'))}</button>
      </div>
      <div class="build-head">
        <div class="build-head-main">
          <input class="set-name-input" id="set-name" type="text" maxlength="40" value="${escapeHtml(active().name)}" placeholder="${escapeHtml(tr('build.setName'))}" autocomplete="off" spellcheck="false">
          <p class="build-intro">${escapeHtml(tr('build.intro'))}</p>
        </div>
        <div class="build-head-actions">
          <button class="build-reset accent" type="button" id="set-share">${escapeHtml(tr('build.share'))}</button>
          ${canDelete ? `<button class="build-reset danger" type="button" id="set-delete">${escapeHtml(tr('build.deleteSet'))}</button>` : ''}
          <button class="build-reset" type="button" id="build-reset">${escapeHtml(tr('build.reset'))}</button>
        </div>
      </div>
      <div class="slots">${slotsHtml}</div>
      ${setEffectsMarkup()}
      ${shoppingMarkup()}
    `;
    // fill + focus the essence picker if just opened
    if (openPicker && openPicker.type === 'essence'){
      fillPicker(openPicker.slot);
      const inp = buildInner.querySelector('.ess-input');
      if (inp) inp.focus();
    }
  }

  // ---- mutations ----
  function addEssence(slot, name){
    const e = essByNorm[norm(name)];
    if (!e) return false;
    const s = active().slots[slot];
    if (!appliesTo(e, slotCat(slot, s))) return false; // category + helmet weapon/armor lock
    if (s.essences.length >= MAX_ESS) return false;
    // only one DISTINCT spell per item (the same spell may still be stacked at other tiers)
    if (isSpell(e) && s.essences.some(en => isSpell(essByNorm[norm(en.name)]) && norm(en.name) !== norm(e.name))) return false;
    const lvl = freeLevel(slot, e.name);
    if (lvl == null) return false; // every tier of this essence is already on the item
    s.essences.push({ name:e.name, level: lvl, owned:false });
    save();
    return true;
  }

  // ---- events ----
  buildView.addEventListener('click', (ev) => {
    const t = ev.target;
    const setTab = t.closest('[data-set-id]');
    if (setTab){
      const id = setTab.getAttribute('data-set-id');
      if (id !== builds.activeId){ builds.activeId = id; openPicker = null; save(); renderBuild(); }
      return;
    }
    if (t.closest('[data-set-add]')){ addSet(); return; }
    if (t.closest('#set-delete')){
      if (confirm(tr('build.deleteSetConfirm'))) deleteSet(builds.activeId);
      return;
    }
    const shareBtn = t.closest('#set-share');
    if (shareBtn){
      const url = shareUrl(active());
      const done = () => {
        const orig = tr('build.share');
        shareBtn.textContent = tr('build.shareCopied');
        setTimeout(() => { shareBtn.textContent = orig; }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(done, () => prompt(tr('build.shareCopied'), url));
      } else {
        prompt(tr('build.shareCopied'), url);
      }
      return;
    }
    const addEss = t.closest('[data-add-ess]');
    if (addEss){ openPicker = { slot:addEss.getAttribute('data-add-ess'), type:'essence' }; renderBuild(); return; }
    const addSoul = t.closest('[data-add-soul]');
    if (addSoul){ openPicker = { slot:addSoul.getAttribute('data-add-soul'), type:'soul' }; renderBuild(); return; }
    const rmEss = t.closest('[data-rm-ess]');
    if (rmEss){
      const slot = rmEss.getAttribute('data-rm-ess'), idx = +rmEss.getAttribute('data-idx');
      active().slots[slot].essences.splice(idx, 1); openPicker = null; save(); renderBuild(); return;
    }
    const rmSoul = t.closest('[data-rm-soul]');
    if (rmSoul){
      const slot = rmSoul.getAttribute('data-rm-soul');
      active().slots[slot].soul = null; save(); renderBuild(); return;
    }
    const soulPick = t.closest('[data-soul-pick]');
    if (soulPick){
      const slot = soulPick.getAttribute('data-slot'), sk = soulPick.getAttribute('data-soul-pick');
      active().slots[slot].soul = { type: sk, count: 1 };
      openPicker = null; save(); renderBuild(); return;
    }
    if (t.closest('#build-reset')){
      if (confirm(tr('build.resetConfirm'))){ active().slots = emptySlots(); openPicker = null; save(); renderBuild(); }
      return;
    }
  });

  buildView.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.classList.contains('ess-input')){
      const slot = t.getAttribute('data-slot');
      if (addEssence(slot, t.value)){ openPicker = null; renderBuild(); }
      return;
    }
    if (t.classList.contains('lvl-select')){
      const slot = t.getAttribute('data-slot'), idx = +t.getAttribute('data-idx');
      active().slots[slot].essences[idx].level = +t.value; save(); renderBuild(); return;
    }
    if (t.classList.contains('own-check')){
      const slot = t.getAttribute('data-slot'), idx = +t.getAttribute('data-idx');
      active().slots[slot].essences[idx].owned = t.checked; save(); renderBuild(); return;
    }
    if (t.classList.contains('soul-count')){
      const slot = t.getAttribute('data-slot');
      if (active().slots[slot].soul) active().slots[slot].soul.count = +t.value; save(); renderBuild(); return;
    }
  });

  // rename the active set live (no full re-render, to keep input focus)
  buildView.addEventListener('input', (ev) => {
    if (ev.target.id === 'set-name'){
      active().name = ev.target.value.slice(0, 40);
      const tab = buildInner.querySelector('.set-tab.active');
      if (tab) tab.textContent = active().name || '—';
      save();
    }
  });
  // on blur, fall back to a default name if left empty
  buildView.addEventListener('focusout', (ev) => {
    if (ev.target.id === 'set-name' && !active().name.trim()){
      active().name = defaultName(builds.sets.indexOf(active()));
      save(); renderBuild();
    }
  });

  // Enter in the essence picker
  buildView.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && ev.target.classList.contains('ess-input')){
      ev.preventDefault();
      const slot = ev.target.getAttribute('data-slot');
      if (addEssence(slot, ev.target.value)){ openPicker = null; renderBuild(); }
    } else if (ev.key === 'Escape' && openPicker){
      openPicker = null; renderBuild();
    }
  });

  // ---- tabs ----
  const TAB_KEY = 'minewind-tab';
  let built = false;
  function setTab(tab){
    const isBuild = tab === 'build';
    codexView.hidden = isBuild;
    buildView.hidden = !isBuild;
    tabs.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.getAttribute('data-tab') === tab));
    localStorage.setItem(TAB_KEY, tab);
    if (isBuild && !built){ built = true; renderBuild(); }
  }
  tabs.addEventListener('click', (ev) => {
    const b = ev.target.closest('.tab');
    if (b) setTab(b.getAttribute('data-tab'));
  });
  const imported = importFromHash();
  setTab(imported || localStorage.getItem(TAB_KEY) === 'build' ? 'build' : 'codex');

  // ---- keep in sync with language switches from app.js ----
  document.addEventListener('codexlang', (ev) => {
    const code = ev.detail;
    if (I18N.strings[code]){ lang = code; S = I18N.strings[code]; }
    if (built) renderBuild();
  });
})();
