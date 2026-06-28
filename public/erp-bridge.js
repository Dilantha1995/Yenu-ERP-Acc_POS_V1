/* ═══════════════════════════════════════════════════════════════════
   YENUERP BRIDGE — Multi-tenant, tenant-scoped storage
   Loaded by accounts.html and pos.html.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const ME_KEY  = 'psms_session';
  const TENANTS_KEY = 'yenuerp_tenants';
  const MODULE  = (location.pathname.split('/').pop() || '').replace('.html','') || 'unknown';

  let session = null;
  try { session = JSON.parse(localStorage.getItem(ME_KEY) || 'null'); } catch (e) {}
  if (!session) { location.replace('/'); return; }

  const tenant = session.tenant || 'default';
  let tenantData = null;
  let tenantBranding = null;
  let tenantLogo = null;
  try {
    const tenants = JSON.parse(localStorage.getItem(TENANTS_KEY) || '{}');
    tenantData = tenants[tenant];
    tenantBranding = JSON.parse(localStorage.getItem('tenant:' + tenant + ':setup:branding') || 'null');
    if (tenantBranding && tenantBranding.logoData) tenantLogo = tenantBranding.logoData;
  } catch(e){}

  let trialDaysLeft = null;
  let trialExpired = false;
  let isPromo = !!session.promoCode;
  if (session.trialEnd) {
    trialDaysLeft = Math.ceil((new Date(session.trialEnd) - new Date()) / 86400000);
    trialExpired = trialDaysLeft < 0 && session.plan_status !== 'active' && !isPromo;
  }

  const access = session.access || ['accounts','pos'];
  if (MODULE && !access.includes(MODULE) && MODULE !== 'index') {
    alert('Your account does not have access to ' + MODULE + '. Returning to workspace.');
    location.replace('/app');
    return;
  }

  const T_PREFIX = 'tenant:' + tenant + ':';
  const state = {
    get(key, fallback) {
      try { const v = localStorage.getItem(T_PREFIX + key); return v ? JSON.parse(v) : (fallback||null); }
      catch(e) { return fallback||null; }
    },
    set(key, value) { try { localStorage.setItem(T_PREFIX + key, JSON.stringify(value)); } catch(e){} },
    async load() { try { return JSON.parse(localStorage.getItem('psms_state_' + MODULE) || 'null'); } catch(e){ return null; } },
    save(obj) { try { localStorage.setItem('psms_state_' + MODULE, JSON.stringify(obj)); } catch(e){} }
  };

  const bus = {
    listeners: {},
    on(event, cb) { (this.listeners[event] = this.listeners[event] || []).push(cb); },
    emit(event, payload) {
      const evt = { event, payload, ts: Date.now(), module: MODULE, tenant };
      (this.listeners[event] || []).forEach(cb => { try { cb(payload); } catch(e){} });
      try { localStorage.setItem('psms_bus_last', JSON.stringify(evt)); } catch(e) {}
    }
  };
  window.addEventListener('storage', e => {
    if (e.key === 'psms_bus_last' && e.newValue) {
      try {
        const evt = JSON.parse(e.newValue);
        if (evt.module === MODULE) return;
        if (evt.tenant !== tenant) return;
        (bus.listeners[evt.event] || []).forEach(cb => { try { cb(evt.payload); } catch(_){} });
      } catch(_){}
    }
  });

  function esc(s){ return String(s||'').replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }

  function injectSwitcher () {
    const isExpired = trialExpired;
    const showWarn = isExpired || (trialDaysLeft != null && trialDaysLeft <= 3);
    const trialColor = isExpired ? '#dc2626' : (trialDaysLeft <= 3 ? '#d97706' : '#0891b2');

    const wrap = document.createElement('div');
    wrap.id = 'erpSwitcher';
    wrap.innerHTML =
      '<style>' +
      '#erpSwitcher{position:fixed;top:11px;right:18px;z-index:9999;font-family:"Segoe UI",system-ui,sans-serif;font-size:12px}' +

      // Single trigger pill — combines logo, company, user, arrow
      '#erpSwitcher .es-trigger{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.97);border:1px solid rgba(255,255,255,.4);border-radius:22px;padding:4px 12px 4px 5px;cursor:pointer;box-shadow:0 6px 18px rgba(13,45,110,.22);color:#0d2d6e;font-weight:700;font-family:inherit;font-size:12px;transition:transform .15s,box-shadow .15s;position:relative}' +
      '#erpSwitcher .es-trigger:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(13,45,110,.28)}' +
      '#erpSwitcher .es-logo{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,#1849a9,#0d2d6e);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:10.5px;letter-spacing:.02em;flex-shrink:0}' +
      '#erpSwitcher .es-logo img{width:100%;height:100%;border-radius:7px;object-fit:cover}' +
      '#erpSwitcher .es-coname{max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}' +
      '#erpSwitcher .es-sep{color:#cbd2e0;font-weight:400}' +
      '#erpSwitcher .es-av{width:22px;height:22px;border-radius:50%;color:#fff;font-size:9.5px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0}' +
      '#erpSwitcher .es-arr{color:#9ba3b5;font-size:10px;margin-left:2px}' +
      '#erpSwitcher .es-warn-dot{position:absolute;top:-3px;right:-3px;width:11px;height:11px;border-radius:50%;background:' + trialColor + ';border:2px solid #fff;box-shadow:0 0 0 1px ' + trialColor + '}' +

      // Responsive: hide company name on narrow screens
      '@media (max-width: 900px){' +
        '#erpSwitcher .es-coname,#erpSwitcher .es-sep{display:none}' +
      '}' +

      // Dropdown menu
      '#erpSwitcher .es-menu{position:absolute;top:42px;right:0;background:#fff;border:1px solid #e2e6ee;border-radius:12px;box-shadow:0 18px 50px rgba(13,45,110,.22);min-width:260px;display:none;overflow:hidden;animation:esIn .12s ease-out}' +
      '@keyframes esIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}' +
      '#erpSwitcher .es-menu.on{display:block}' +
      '#erpSwitcher .es-mhead{background:linear-gradient(135deg,#f8faff,#eef2fc);padding:14px 16px;border-bottom:1px solid #e2e6ee}' +
      '#erpSwitcher .es-mco{font-weight:800;color:#0d2d6e;font-size:13px;margin-bottom:2px}' +
      '#erpSwitcher .es-muser{display:flex;align-items:center;gap:8px;margin-top:6px}' +
      '#erpSwitcher .es-muser .es-mav{width:28px;height:28px;border-radius:50%;color:#fff;font-size:10.5px;font-weight:800;display:flex;align-items:center;justify-content:center}' +
      '#erpSwitcher .es-muser-info{line-height:1.3}' +
      '#erpSwitcher .es-muser-name{font-weight:700;color:#1c2030;font-size:12px}' +
      '#erpSwitcher .es-muser-role{font-size:10.5px;color:#5c6478;font-weight:500}' +
      '#erpSwitcher .es-mtrial{margin-top:8px;font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:11px;display:inline-block}' +
      '#erpSwitcher .es-msection{padding:7px 8px;font-size:9.5px;font-weight:800;color:#9ba3b5;letter-spacing:.06em;text-transform:uppercase;padding-left:12px;padding-top:11px}' +
      '#erpSwitcher .es-mi{display:flex;align-items:center;gap:10px;padding:9px 14px;cursor:pointer;color:#1c2030;font-weight:600;font-size:12px;transition:background .1s}' +
      '#erpSwitcher .es-mi:hover{background:#eef2fc;color:#1849a9}' +
      '#erpSwitcher .es-mi.cur{background:#eef2fc;color:#1849a9}' +
      '#erpSwitcher .es-mi.cur::after{content:"●";color:#16a34a;margin-left:auto;font-size:10px}' +
      '#erpSwitcher .es-mi.sep{border-top:1px solid #e2e6ee;color:#991b1b;margin-top:4px}' +
      '#erpSwitcher .es-mi.sep:hover{background:#fef2f2;color:#991b1b}' +
      '#erpSwitcher .es-ic{font-size:14px;width:18px;text-align:center}' +
      '#erpExpiredBanner{position:fixed;top:0;left:0;right:0;background:#fef2f2;color:#991b1b;border-bottom:1px solid #fecaca;padding:8px 18px;text-align:center;font-size:12px;font-weight:600;z-index:9998;font-family:"Segoe UI",system-ui,sans-serif}' +
      '#erpExpiredBanner a{color:#991b1b;font-weight:800;text-decoration:underline;margin-left:8px}' +
      '</style>' +

      // Single trigger pill
      '<button class="es-trigger" onclick="event.stopPropagation();document.getElementById(\'erpMenu\').classList.toggle(\'on\')" title="' + esc(session.coName || tenant) + ' · ' + esc(session.name || '') + '">' +
        '<span class="es-logo">' +
          (tenantLogo ? '<img src="' + tenantLogo + '" alt="">' :
            (window._YENU && window._YENU.coCode ? window._YENU.coCode.slice(0,2).toUpperCase() : 'Y')) +
        '</span>' +
        '<span class="es-coname">' + esc(session.coName || tenant) + '</span>' +
        '<span class="es-sep">·</span>' +
        '<span class="es-av" style="background:' + (session.color||'#1849a9') + '">' + (session.short||'U') + '</span>' +
        '<span class="es-arr">▾</span>' +
        (showWarn ? '<span class="es-warn-dot"></span>' : '') +
      '</button>' +
      '<div class="es-menu" id="erpMenu"></div>';

    document.body.appendChild(wrap);

    // Build menu contents
    const menu = document.getElementById('erpMenu');
    const mods = [
      { id:'setup',    label:'Company Setup',   ic:'⚙', file:'setup.html' },
      { id:'accounts', label:'AccountsCore',    ic:'📒', file:'accounts.html' },
      { id:'pos',      label:'RetailFlow POS',  ic:'🛒', file:'pos.html' }
    ];

    let badgeHtml = '';
    if (isPromo) {
      badgeHtml = '<div class="es-mtrial" style="background:#dcfce7;color:#14532d">🎁 ' + esc(session.promoLabel || 'PROMO') + '</div>';
    } else if (isExpired) {
      badgeHtml = '<div class="es-mtrial" style="background:#fef2f2;color:#991b1b">⚠ Trial ended</div>';
    } else if (trialDaysLeft != null) {
      const tColor = trialDaysLeft <= 3 ? '#fffbeb;color:#92400e' : '#f0f9ff;color:#0c4a6e';
      badgeHtml = '<div class="es-mtrial" style="background:' + tColor + '">⏳ ' + trialDaysLeft + ' days left in trial</div>';
    }

    menu.innerHTML =
      // Header section with company + user
      '<div class="es-mhead">' +
        '<div class="es-mco">' + esc(session.coName || tenant) + '</div>' +
        '<div class="es-muser">' +
          '<div class="es-mav" style="background:' + (session.color||'#1849a9') + '">' + (session.short||'U') + '</div>' +
          '<div class="es-muser-info">' +
            '<div class="es-muser-name">' + esc(session.name || '') + '</div>' +
            '<div class="es-muser-role">' + esc(session.role || 'User') + ' · ' + esc(session.email || '') + '</div>' +
          '</div>' +
        '</div>' +
        badgeHtml +
      '</div>' +
      // Modules section
      '<div class="es-msection">Switch module</div>' +
      mods.filter(function(m){ return access.includes(m.id) || m.id === 'setup'; }).map(function(m){
        return '<div class="es-mi' + (m.id===MODULE?' cur':'') + '" onclick="location.href=\'/' + m.file + '\'">' +
          '<span class="es-ic">' + m.ic + '</span>' + esc(m.label) +
        '</div>';
      }).join('') +
      // Sign out
      '<div class="es-mi sep" onclick="if(confirm(\'Sign out of ' + esc(session.coName||'workspace') + '?\')){localStorage.removeItem(\'' + ME_KEY + '\');location.href=\'/\'}">' +
        '<span class="es-ic">⎋</span>Sign out' +
      '</div>';

    document.addEventListener('click', function(e){
      if(!e.target.closest('#erpSwitcher')) menu.classList.remove('on');
    });

    if (isExpired) {
      const b = document.createElement('div');
      b.id = 'erpExpiredBanner';
      b.innerHTML = '⚠ Your free trial has ended — this workspace is read-only. <a href="/app">Upgrade your plan to continue</a>';
      document.body.insertBefore(b, document.body.firstChild);
      document.body.style.paddingTop = '36px';
    }
  }

  window.ERP = {
    session, tenant, tenantData,
    isDemo: function(){ return true; },
    module: MODULE,
    state, bus, ready: false,
    postSale: function(sale){ bus.emit('pos.sale.completed', sale); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){
      injectSwitcher();
      window.ERP.ready = true;
      document.dispatchEvent(new CustomEvent('erp:ready'));
    });
  } else {
    injectSwitcher();
    window.ERP.ready = true;
    document.dispatchEvent(new CustomEvent('erp:ready'));
  }

  if (MODULE === 'accounts') {
    bus.on('pos.sale.completed', function(sale){
      console.log('[YenuERP] POS sale received:', sale && sale.id);
      if (window.AccountsHooks && window.AccountsHooks.addJournal) {
        const total = +(sale.total || 0);
        const tax   = +(sale.tax   || 0);
        const net   = total - tax;
        const lines = [
          { acc: sale.paymentMethod === 'cash' ? '1000' : '1100', dr: total, cr: 0 },
          { acc: '4000', dr: 0, cr: net }
        ];
        if (tax > 0) lines.push({ acc: '2200', dr: 0, cr: tax });
        window.AccountsHooks.addJournal({
          source: 'RetailFlow',
          sourceRef: sale.id,
          date: sale.date || new Date().toISOString().slice(0,10),
          memo: 'POS sale ' + sale.id,
          lines: lines
        });
      }
    });
  }
})();
