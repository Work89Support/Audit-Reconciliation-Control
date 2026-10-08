/* Local UI behaviour only: no authentication, network or financial actions. */
window.AuditUi = (() => {
  const dialogs = [];
  const focusables = el => [...el.querySelectorAll('button, [href], input, select, textarea, [tabindex]')]
    .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length && !node.closest('[hidden], [inert]'));
  function sync() {
    const top = dialogs.at(-1)?.el;
    const shell = document.getElementById('appShell');
    if (shell) shell.inert = !!top;
    dialogs.forEach(({el}) => { el.inert = el !== top; });
  }
  function open(el) {
    if (el._hideTimer) { clearTimeout(el._hideTimer); el._hideTimer = null; }
    if (!dialogs.some(item => item.el === el)) dialogs.push({el, previous: document.activeElement});
    sync();
    el.tabIndex = -1;
    (focusables(el)[0] || el).focus({preventScroll:true});
  }
  function close(el) {
    const index = dialogs.findIndex(item => item.el === el);
    if (index < 0) return;
    const [{previous}] = dialogs.splice(index, 1);
    el.inert = true;
    sync();
    const top = dialogs.at(-1)?.el;
    if (previous?.isConnected && !previous.closest('[hidden], [inert]') && (!top || top.contains(previous))) previous.focus({preventScroll:true});
    else if (top) (focusables(top)[0] || top).focus({preventScroll:true});
  }
  function keydown(event) {
    const top = dialogs.at(-1)?.el;
    if (!top || event.key !== 'Tab') return;
    const items = focusables(top), first = items[0], last = items.at(-1);
    if (!first) { event.preventDefault(); top.focus(); }
    else if (event.shiftKey && (document.activeElement === first || !items.includes(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || !items.includes(document.activeElement))) { event.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', keydown);
  // Native validation stays authoritative; add persistent, field-local guidance.
  document.addEventListener('invalid', event => {
    const field = event.target;
    if (field.form?.id !== 'accessUserForm') return;
    field.setAttribute('aria-invalid', 'true');
    const id = field.id + 'Error';
    let message = document.getElementById(id);
    if (!message) { message = document.createElement('small'); message.id = id; message.className = 'form-error'; field.insertAdjacentElement('afterend', message); }
    message.textContent = field.validationMessage;
    const ids = new Set((field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(id); field.setAttribute('aria-describedby', [...ids].join(' '));
  }, true);
  document.addEventListener('input', event => {
    const field = event.target;
    if (field.form?.id !== 'accessUserForm') return;
    field.removeAttribute('aria-invalid');
    const message = document.getElementById(field.id + 'Error');
    if (message) message.textContent = '';
  });
  function syncNav() {
    const toggle = document.getElementById('navToggle'), sidebar = document.getElementById('sidebar');
    if (!toggle || !sidebar) return;
    const mobile = window.matchMedia('(max-width: 1080px)').matches;
    const expanded = mobile ? sidebar.classList.contains('open') : !document.getElementById('appShell').classList.contains('sidebar-collapsed');
    const label = expanded ? 'ซ่อนแถบเมนู' : 'แสดงแถบเมนู';
    toggle.setAttribute('aria-expanded', String(expanded));
    toggle.setAttribute('aria-label', label); toggle.title = label;
  }
  function tabs(root) {
    const items = [...root.querySelectorAll('[role="tab"]')];
    items.forEach((tab, i) => {
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      tab.addEventListener('keydown', event => {
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length-1 : event.key === 'ArrowRight' ? (i+1)%items.length : event.key === 'ArrowLeft' ? (i+items.length-1)%items.length : -1;
        if (next < 0) return;
        event.preventDefault();
        items.forEach(item => { item.tabIndex = -1; });
        items[next].tabIndex = 0; items[next].focus(); items[next].click();
        requestAnimationFrame(() => {
          const replacement = root.querySelectorAll('[role="tab"]')[next];
          if (replacement) replacement.focus({preventScroll:true});
        });
      });
    });
  }
  return {open, close, syncNav, tabs, top: () => dialogs.at(-1)?.el, keydown};
})();
