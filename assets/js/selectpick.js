/* ==========================================================================
   selectpick.js — shared styled dropdown for native <select> elements.

   The native <select> is kept in place (it stays the source of truth and keeps
   displaying the current value, so no layout/JS changes are needed elsewhere).
   We only replace the ugly native option popup with a floating menu styled like
   the essence picker. On selection we set the <select> value and fire bubbling
   `input` + `change` events, so existing build.js / trade.js / inventory.js
   handlers keep working unchanged.

   Touch devices keep the native picker (it's a better experience there).

   Vanilla IIFE, no modules. Delegated events, so it survives re-renders.
   ========================================================================== */
(function(){
  'use strict';

  var SEL = 'select.trade-select, select.lvl-select, select.soul-count';
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var menu = null, curSel = null, opts = [], active = -1;

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function matchSel(el){
    return el && el.closest ? el.closest(SEL) : null;
  }

  function ensureMenu(){
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'selpick-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    document.body.appendChild(menu);
    // choose on mousedown so it fires before the document-level close handler
    menu.addEventListener('mousedown', function(ev){
      var opt = ev.target.closest('.selpick-opt');
      if (!opt) return;
      ev.preventDefault();
      choose(+opt.getAttribute('data-i'));
    });
    menu.addEventListener('mousemove', function(ev){
      var opt = ev.target.closest('.selpick-opt');
      if (opt) setActive(+opt.getAttribute('data-i'));
    });
    return menu;
  }

  function position(){
    if (!curSel) return;
    var r = curSel.getBoundingClientRect();
    var mh = menu.offsetHeight;
    var below = window.innerHeight - r.bottom;
    menu.style.left = r.left + 'px';
    menu.style.minWidth = r.width + 'px';
    // flip above the field if there isn't room below
    if (below < mh + 8 && r.top > below){
      menu.style.top = (r.top - mh - 4) + 'px';
    } else {
      menu.style.top = (r.bottom + 4) + 'px';
    }
  }

  function open(sel){
    ensureMenu();
    curSel = sel;
    opts = Array.prototype.slice.call(sel.options);
    if (!opts.length) return;
    active = sel.selectedIndex < 0 ? 0 : sel.selectedIndex;
    menu.innerHTML = opts.map(function(o, i){
      return '<div class="selpick-opt' + (i === active ? ' active' : '') + (i === sel.selectedIndex ? ' selected' : '') +
             '" role="option" data-i="' + i + '">' +
               '<span class="selpick-txt">' + escapeHtml(o.text) + '</span>' +
               '<span class="selpick-check" aria-hidden="true">✓</span>' +
             '</div>';
    }).join('');
    menu.hidden = false;
    position();
    paintActive();
    sel.classList.add('selpick-active');
  }

  function paintActive(){
    var o = menu.querySelectorAll('.selpick-opt');
    for (var i=0; i<o.length; i++) o[i].classList.toggle('active', i === active);
    if (o[active]) o[active].scrollIntoView({ block:'nearest' });
  }
  function setActive(i){ if (i !== active){ active = i; paintActive(); } }

  function close(){
    if (menu) menu.hidden = true;
    if (curSel) curSel.classList.remove('selpick-active');
    curSel = null; opts = []; active = -1;
  }

  function choose(i){
    var sel = curSel;
    if (!sel || i < 0 || i >= sel.options.length){ close(); return; }
    var changed = sel.selectedIndex !== i;
    sel.selectedIndex = i;
    close();
    if (changed){
      sel.dispatchEvent(new Event('input', { bubbles:true }));
      sel.dispatchEvent(new Event('change', { bubbles:true }));
    }
  }

  // ---- interactions (delegated, survive re-renders) ----
  document.addEventListener('mousedown', function(ev){
    var sel = matchSel(ev.target);
    // click outside an open menu → close
    if (!sel){
      if (menu && !menu.hidden && !ev.target.closest('.selpick-menu')) close();
      return;
    }
    if (coarse) return;                 // let touch devices use the native picker
    ev.preventDefault();                // suppress the native option popup + focus jump
    if (curSel === sel){ close(); return; }
    if (curSel) close();
    sel.focus();
    open(sel);
  }, true);

  document.addEventListener('keydown', function(ev){
    var sel = matchSel(ev.target);
    if (!sel || coarse) return;
    var isOpen = menu && !menu.hidden && curSel === sel;
    if (!isOpen){
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp' || ev.key === 'Enter' || ev.key === ' '){
        ev.preventDefault();
        open(sel);
      }
      return;
    }
    if (ev.key === 'ArrowDown'){ ev.preventDefault(); setActive(Math.min(active + 1, opts.length - 1)); }
    else if (ev.key === 'ArrowUp'){ ev.preventDefault(); setActive(Math.max(active - 1, 0)); }
    else if (ev.key === 'Enter' || ev.key === ' '){ ev.preventDefault(); ev.stopPropagation(); choose(active); }
    else if (ev.key === 'Escape'){ ev.stopPropagation(); close(); }
    else if (ev.key === 'Tab'){ close(); }
  }, true);

  // keep the menu glued to its select; close on blur
  document.addEventListener('focusout', function(ev){
    if (ev.target === curSel){
      setTimeout(function(){ if (document.activeElement !== curSel) close(); }, 0);
    }
  });
  window.addEventListener('scroll', function(){ if (curSel) position(); }, true);
  window.addEventListener('resize', function(){ if (curSel) position(); });
})();
