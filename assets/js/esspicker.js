/* ==========================================================================
   esspicker.js — shared, styled autocomplete for essence inputs.

   Replaces the native <datalist> (which browsers render as a long, unstyleable
   list of every essence). Any <input data-esspick> gets a floating, filtered,
   keyboard-navigable menu that shows only the best matches.

   Integration contract: on selection it sets input.value and fires bubbling
   `input` + `change` events, so the existing build.js / trade.js `change`
   handlers (and inventory.js reading .value) keep working unchanged.

   Vanilla IIFE, no modules — reads window.__MINEWIND_DATA__ at event time.
   ========================================================================== */
(function(){
  'use strict';

  var MAX = 8; // never dump all 256 — show the best handful

  // Optional per-input candidate filters. A page can register one and an input
  // opts in via data-esspick-filter="<name>"; used by build.js to keep the
  // Loadout picker category-aware (only essences a given slot can receive).
  window.EssPicker = window.EssPicker || { filters: Object.create(null) };

  function norm(s){
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim();
  }
  function essences(){
    var d = window.__MINEWIND_DATA__;
    return (d && d.essences) || [];
  }
  function sigil(type){
    var t = (type || '').split(',')[0];
    if (t === 'armor') return 'var(--sigil-armor)';
    if (t === 'weapon') return 'var(--sigil-weapon)';
    return 'var(--sigil-spell)';
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  // bold the matched fragment of the name when present
  function mark(name, q){
    if (!q) return escapeHtml(name);
    var i = norm(name).indexOf(q);
    if (i < 0) return escapeHtml(name);
    return escapeHtml(name.slice(0,i)) + '<b>' + escapeHtml(name.slice(i, i+q.length)) + '</b>' + escapeHtml(name.slice(i+q.length));
  }

  function baseList(input){
    var list = essences();
    var fname = input && input.getAttribute('data-esspick-filter');
    var fn = fname && window.EssPicker.filters[fname];
    return fn ? list.filter(function(e){ return fn(e, input); }) : list;
  }

  function search(query, input){
    var q = norm(query);
    var list = baseList(input);
    if (!q) return list.slice(0, MAX);
    var starts = [], incl = [], alias = [];
    for (var i=0; i<list.length; i++){
      var e = list[i], n = norm(e.name);
      if (n.indexOf(q) === 0) starts.push(e);
      else if (n.indexOf(q) > 0) incl.push(e);
      else if ((e.aliases||[]).some(function(a){ return norm(a).indexOf(q) >= 0; })) alias.push(e);
      if (starts.length >= MAX) break;
    }
    return starts.concat(incl, alias).slice(0, MAX);
  }

  // ---- single shared floating menu ----
  var menu = null;
  var curInput = null;
  var curOpts = [];
  var active = -1;

  function ensureMenu(){
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'esspick-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    document.body.appendChild(menu);
    // select on mousedown so it beats the input's blur/close
    menu.addEventListener('mousedown', function(ev){
      var opt = ev.target.closest('.esspick-opt');
      if (!opt) return;
      ev.preventDefault();
      choose(+opt.getAttribute('data-i'));
    });
    menu.addEventListener('mousemove', function(ev){
      var opt = ev.target.closest('.esspick-opt');
      if (opt) setActive(+opt.getAttribute('data-i'));
    });
    return menu;
  }

  function position(){
    if (!curInput) return;
    var r = curInput.getBoundingClientRect();
    menu.style.left = r.left + 'px';
    menu.style.top = (r.bottom + 4) + 'px';
    menu.style.width = r.width + 'px';
  }

  function render(query){
    ensureMenu();
    curOpts = search(query, curInput);
    if (!curOpts.length){
      menu.hidden = true;
      return;
    }
    var q = norm(query);
    menu.innerHTML = curOpts.map(function(e, i){
      return '<div class="esspick-opt" role="option" data-i="' + i + '">' +
               '<span class="esspick-dot" style="background:' + sigil(e.type) + '"></span>' +
               '<span class="esspick-name">' + mark(e.name, q) + '</span>' +
               '<span class="esspick-sec">' + escapeHtml((e.section || '').replace(/ Key Essences?$/i, '')) + '</span>' +
             '</div>';
    }).join('');
    active = 0;
    paintActive();
    menu.hidden = false;
    position();
  }

  function paintActive(){
    var opts = menu.querySelectorAll('.esspick-opt');
    for (var i=0; i<opts.length; i++){
      opts[i].classList.toggle('active', i === active);
    }
    if (opts[active]) opts[active].scrollIntoView({ block:'nearest' });
  }
  function setActive(i){
    if (i === active) return;
    active = i; paintActive();
  }

  function close(){
    if (menu) menu.hidden = true;
    curInput = null; curOpts = []; active = -1;
  }

  function choose(i){
    var e = curOpts[i];
    var input = curInput;
    if (!e || !input) return;
    close();
    input.value = e.name;
    input.dispatchEvent(new Event('input', { bubbles:true }));
    input.dispatchEvent(new Event('change', { bubbles:true }));
  }

  function isPicker(el){
    return el && el.tagName === 'INPUT' && el.hasAttribute('data-esspick');
  }

  // ---- wiring (delegated, survives re-renders) ----
  document.addEventListener('focusin', function(ev){
    if (!isPicker(ev.target)) return;
    curInput = ev.target;
    render(curInput.value);
  });
  document.addEventListener('input', function(ev){
    if (ev.target !== curInput) return;
    render(curInput.value);
  });
  document.addEventListener('focusout', function(ev){
    if (ev.target !== curInput) return;
    // let a menu mousedown selection run first
    setTimeout(function(){
      if (document.activeElement !== curInput) close();
    }, 0);
  });

  // capture phase so we can pre-empt build.js / trade.js Enter/Escape handlers
  document.addEventListener('keydown', function(ev){
    if (ev.target !== curInput || !menu || menu.hidden) return;
    if (ev.key === 'ArrowDown'){
      ev.preventDefault();
      setActive(Math.min(active + 1, curOpts.length - 1));
    } else if (ev.key === 'ArrowUp'){
      ev.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (ev.key === 'Enter'){
      if (active >= 0 && curOpts[active]){
        ev.preventDefault();
        ev.stopPropagation();
        choose(active);
      }
    } else if (ev.key === 'Escape'){
      ev.stopPropagation();
      close();
    }
  }, true);

  // keep the menu glued to the input; close if we scroll away
  window.addEventListener('scroll', function(){ if (curInput) position(); }, true);
  window.addEventListener('resize', function(){ if (curInput) position(); });
})();
