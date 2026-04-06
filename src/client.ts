// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

import type { Translations } from "./i18n/types";
import { RANDOM_CHARSET } from "./slugs";
import { MIN_SLUG_LENGTH } from "./constants";

export function adminClientScript(version: string, translations: Translations): string {
  const tJson = JSON.stringify(translations);
  return `
'use strict';
var API = '/_/admin/api';
var APP_VERSION = '${version}';
var REPO_URL = 'https://oddb.it/github-shrtnr-app';
var CHARSET_SIZE = ${RANDOM_CHARSET.length};
var MIN_SLUG_LEN = ${MIN_SLUG_LENGTH};
var T = ${tJson};

function t(key, params) {
  var val = T[key] || key;
  if (params) {
    for (var k in params) {
      val = val.replace(new RegExp('\\\\{' + k + '\\\\}', 'g'), String(params[k]));
    }
  }
  return val;
}

// ---- Toast ----
function toast(msg, type) {
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast toast-' + (type || 'success');
  el.style.display = 'block';
  setTimeout(function() { el.style.display = 'none'; }, 3000);
}

// ---- Modal ----
function closeModal() { document.getElementById('modal-overlay').style.display = 'none'; }
function openModal(html) {
  document.getElementById('modal').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}

// ---- Escape ----
function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ---- API helper ----
function api(path, opts) {
  opts = opts || {};
  if (!opts.headers) opts.headers = {};
  if (opts.body && !opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
  return fetch(API + path, opts).then(function(res) {
    if (res.status === 401) { window.location.reload(); return res; }
    return res;
  });
}

// ---- Copy ----
function copyUrl(slug) {
  var url = location.origin + '/' + slug;
  navigator.clipboard.writeText(url);
  toast(t('client.copied', {url: url}));
}

// ---- Mobile drawer ----
function toggleDrawer() {
  var s = document.querySelector('.sidebar');
  var b = document.getElementById('sidebar-backdrop');
  var open = s.classList.toggle('open');
  b.classList.toggle('open', open);
}
function closeDrawer() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebar-backdrop').classList.remove('open');
}

// ---- Theme ----
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('#theme-picker .theme-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });
}
function setTheme(theme) {
  applyTheme(theme);
  document.cookie = 'theme=' + theme + ';path=/;max-age=31536000;SameSite=Lax';
  api('/settings', { method: 'PUT', body: JSON.stringify({ theme: theme }) });
  toast(t('client.themeUpdated'));
}

// ---- Language ----
function setLanguage(lang) {
  document.cookie = 'lang=' + lang + ';path=/;max-age=31536000;SameSite=Lax';
  api('/settings', { method: 'PUT', body: JSON.stringify({ lang: lang }) }).then(function() {
    window.location.reload();
  });
}

// ---- Country names ----
var countryNames = new Intl.DisplayNames([T['_lang'] || 'en'], { type: 'region' });
function countryName(code) {
  try { return countryNames.of(code) || code; } catch(e) { return code; }
}

// ---- Date formatting ----
function formatDate(ts) {
  var d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---- Quick shorten / search ----
function isUrl(value) {
  try { var u = new URL(value); return u.protocol === 'http:' || u.protocol === 'https:'; } catch(e) { return false; }
}

function quickShorten() {
  var value = document.getElementById('quick-url').value.trim();
  if (!value) { toast(t('client.pasteUrl'), 'error'); return; }
  if (!isUrl(value)) {
    window.location.href = '/_/admin/links?search=' + encodeURIComponent(value);
    return;
  }
  api('/links', { method: 'POST', body: JSON.stringify({ url: value }) }).then(function(res) {
    if (res.ok) {
      var isDuplicate = res.status === 200;
      return res.json().then(function(link) {
        if (isDuplicate) {
          if (link.duplicate_count > 1) {
            window.location.href = '/_/admin/links?search=' + encodeURIComponent(value);
          } else {
            window.location.href = '/_/admin/links/' + link.id;
          }
        } else {
          var primary = link.slugs.find(function(s) { return !s.is_custom; });
          if (primary) copyUrl(primary.slug);
          toast(t('client.linkCreatedCopied'));
          window.location.href = '/_/admin/links/' + link.id;
        }
      });
    } else {
      return res.json().then(function(data) {
        toast(data.error || t('client.createLinkError'), 'error');
      });
    }
  });
}

function updateQuickActionButton() {
  var el = document.getElementById('quick-url');
  var iconEl = document.getElementById('quick-action-icon');
  var labelEl = document.getElementById('quick-action-label');
  if (!el || !iconEl || !labelEl) return;
  var value = el.value.trim();
  if (value && !isUrl(value)) {
    iconEl.textContent = 'search';
    labelEl.textContent = t('links.go');
  } else {
    iconEl.textContent = 'bolt';
    labelEl.textContent = t('dashboard.shorten');
  }
}

// ---- Create link (modal) ----
function showCreateModal() {
  var len = (document.getElementById('slug-length-default') || {}).value || '3';
  openModal(
    '<div class="modal-title">' + esc(t('client.modalNewLink')) + '</div>' +
    '<div class="form-group"><label class="form-label">' + esc(t('client.destinationUrl')) + '</label><input class="form-input" id="m-url" placeholder="https://example.com/long/path"></div>' +
    '<div class="form-group"><label class="form-label">' + esc(t('client.labelOptional')) + '</label><input class="form-input" id="m-label" placeholder="My Blog Post"></div>' +
    '<div class="form-row"><div class="form-group"><label class="form-label">' + esc(t('client.slugLength')) + '</label><input class="form-input" id="m-len" type="number" min="3" value="' + esc(len) + '"></div>' +
    '<div class="form-group"><label class="form-label">' + esc(t('client.customOptional')) + '</label><input class="form-input" id="m-custom" placeholder="my-post"></div></div>' +
    '<div class="form-group"><label class="form-label">' + esc(t('client.expiresOptional')) + '</label><input class="form-input" id="m-expires" type="datetime-local"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-primary" onclick="createLink()">' + esc(t('client.create')) + '</button></div>'
  );
}

function createLink() {
  var url = document.getElementById('m-url').value.trim();
  if (!url) { toast(t('client.urlRequired'), 'error'); return; }
  var body = { url: url };
  var label = document.getElementById('m-label').value.trim();
  if (label) body.label = label;
  var len = parseInt(document.getElementById('m-len').value);
  if (len >= 3) body.slug_length = len;
  var custom = document.getElementById('m-custom').value.trim();
  var exp = document.getElementById('m-expires').value;
  if (exp) body.expires_at = Math.floor(new Date(exp).getTime() / 1000);

  api('/links', { method: 'POST', body: JSON.stringify(body) }).then(function(res) {
    if (res.ok) {
      var isDuplicate = res.status === 200;
      return res.json().then(function(link) {
        if (isDuplicate) {
          closeModal();
          if (link.duplicate_count > 1) {
            window.location.href = '/_/admin/links?search=' + encodeURIComponent(body.url);
          } else {
            window.location.href = '/_/admin/links/' + link.id;
          }
          return;
        }
        if (!custom) {
          closeModal();
          toast(t('client.linkCreated'));
          window.location.href = '/_/admin/links/' + link.id;
          return;
        }
        api('/links/' + link.id + '/slugs', { method: 'POST', body: JSON.stringify({ slug: custom }) }).then(function(slugRes) {
          closeModal();
          if (!slugRes.ok) {
            toast(t('client.linkCreated'));
          } else {
            toast(t('client.linkCreated'));
          }
          window.location.href = '/_/admin/links/' + link.id;
        });
      });
    } else {
      return res.json().then(function(data) {
        toast(data.error || t('client.createLinkError'), 'error');
      });
    }
  });
}

// ---- Duplicate link ----
function createDuplicate(url) {
  api('/links', { method: 'POST', body: JSON.stringify({ url: url, allow_duplicate: true }) }).then(function(res) {
    if (res.ok) {
      return res.json().then(function(link) {
        var primary = link.slugs.find(function(s) { return !s.is_custom; });
        if (primary) copyUrl(primary.slug);
        toast(t('client.linkCreatedCopied'));
        window.location.href = '/_/admin/links/' + link.id;
      });
    } else {
      return res.json().then(function(data) {
        toast(data.error || t('client.createLinkError'), 'error');
      });
    }
  });
}

// ---- API Keys ----
function showCreateKeyModal() {
  openModal(
    '<div class="modal-title">' + esc(t('client.createApiKey')) + '</div>' +
    '<div class="form-group"><label class="form-label">' + esc(t('client.keyTitleLabel')) + '</label><input class="form-input" id="m-key-title" placeholder="e.g. CI Pipeline, Mobile App"></div>' +
    '<div class="form-group"><label class="form-label">' + esc(t('client.keyScopeLabel')) + '</label>' +
    '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.25rem">' +
    '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem"><input type="radio" name="key-scope" value="create"> <strong>' + esc(t('client.scopeCreate')) + '</strong> <span style="color:var(--color-text-muted)">\\u2014 ' + esc(t('client.scopeCreateDesc')) + '</span></label>' +
    '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem"><input type="radio" name="key-scope" value="read"> <strong>' + esc(t('client.scopeRead')) + '</strong> <span style="color:var(--color-text-muted)">\\u2014 ' + esc(t('client.scopeReadDesc')) + '</span></label>' +
    '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem"><input type="radio" name="key-scope" value="create,read" checked> <strong>' + esc(t('client.scopeCreateRead')) + '</strong> <span style="color:var(--color-text-muted)">\\u2014 ' + esc(t('client.scopeCreateReadDesc')) + '</span></label>' +
    '</div></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-primary" onclick="createKey()">' + esc(t('client.createKey')) + '</button></div>'
  );
}

function createKey() {
  var title = document.getElementById('m-key-title').value.trim();
  if (!title) { toast(t('client.titleRequired'), 'error'); return; }
  var checked = document.querySelector('input[name="key-scope"]:checked');
  var scope = checked ? checked.value : null;
  if (!scope) { toast(t('client.selectScope'), 'error'); return; }

  api('/keys', { method: 'POST', body: JSON.stringify({ title: title, scope: scope }) }).then(function(res) {
    if (!res.ok) {
      return res.json().then(function(data) { toast(data.error || t('client.createKeyError'), 'error'); });
    }
    return res.json().then(function(data) { showKeyRevealModal(data.raw_key); });
  });
}

function showKeyRevealModal(rawKey) {
  openModal(
    '<div class="modal-title">' + esc(t('client.keyCreated')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1rem">' + esc(t('client.keyCreatedDesc')) + '</p>' +
    '<div class="key-revealed" id="revealed-key">' + esc(rawKey) + '</div>' +
    '<div class="key-warning"><span class="icon" style="font-size:18px">warning</span> ' + esc(t('client.keyWarning')) + '</div>' +
    '<div class="modal-actions"><button class="btn btn-secondary" onclick="copyRawKey()"><span class="icon">content_copy</span> ' + esc(t('client.copy')) + '</button><button class="btn btn-ghost" onclick="closeKeyRevealModal()">' + esc(t('client.done')) + '</button></div>'
  );
}

function copyRawKey() {
  var key = document.getElementById('revealed-key').textContent;
  navigator.clipboard.writeText(key);
  toast(t('client.apiKeyCopied'));
}

function closeKeyRevealModal() {
  closeModal();
  window.location.reload();
}

function deleteKey(id, title) {
  if (!confirm(t('client.confirmDeleteKey', {title: title}))) return;
  api('/keys/' + id, { method: 'DELETE' }).then(function(res) {
    if (res.ok) { toast(t('client.keyDeleted')); window.location.reload(); }
    else toast(t('client.keyDeleteError'), 'error');
  });
}

// ---- Triple-dot menu ----
function toggleDetailMenu() {
  var menu = document.getElementById('detail-menu');
  var visible = menu.style.display !== 'none';
  menu.style.display = visible ? 'none' : 'block';
  if (!visible) {
    document.addEventListener('click', closeDetailMenuOnOutside);
  }
}
function closeDetailMenuOnOutside(e) {
  var menu = document.getElementById('detail-menu');
  if (menu && !menu.parentElement.contains(e.target)) {
    menu.style.display = 'none';
    document.removeEventListener('click', closeDetailMenuOnOutside);
  }
}

// ---- Link actions (detail page) ----
function showDisableLinkModal(id) {
  document.getElementById('detail-menu').style.display = 'none';
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.disable')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmDisable')) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-danger" onclick="doDisableLink(' + id + ')">' + esc(t('linkDetail.disable')) + '</button></div>'
  );
}
function doDisableLink(id) {
  api('/links/' + id + '/disable', { method: 'POST' }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.linkDisabled')); window.location.reload(); }
    else toast(t('client.disableError'), 'error');
  });
}

function showEnableLinkModal(id) {
  document.getElementById('detail-menu').style.display = 'none';
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.enable')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmEnable')) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-primary" onclick="doEnableLink(' + id + ')">' + esc(t('linkDetail.enable')) + '</button></div>'
  );
}
function doEnableLink(id) {
  api('/links/' + id, { method: 'PUT', body: JSON.stringify({ expires_at: null }) }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.linkEnabled')); window.location.reload(); }
    else toast(t('client.enableError'), 'error');
  });
}

// ---- Add custom slug modal ----
function showAddSlugModal(linkId) {
  document.getElementById('detail-menu').style.display = 'none';
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.addCustomSlug')) + '</div>' +
    '<div class="form-group"><label class="form-label">Slug</label><input class="form-input" id="m-new-slug" placeholder="my-custom-slug"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-primary" onclick="doAddSlug(' + linkId + ')">' + esc(t('linkDetail.add')) + '</button></div>'
  );
  setTimeout(function() { document.getElementById('m-new-slug').focus(); }, 100);
}
function doAddSlug(linkId) {
  var slug = document.getElementById('m-new-slug').value.trim();
  if (!slug) { toast(t('client.urlRequired'), 'error'); return; }
  api('/links/' + linkId + '/slugs', { method: 'POST', body: JSON.stringify({ slug: slug }) }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.customAdded')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || t('client.customError'), 'error'); });
  });
}

// ---- Change primary slug modal ----
function showChangePrimaryModal(linkId) {
  document.getElementById('detail-menu').style.display = 'none';
  // Fetch link data to render slug list
  api('/links/' + linkId).then(function(res) {
    if (!res.ok) { toast(t('client.createLinkError'), 'error'); return; }
    return res.json().then(function(link) {
      var html = '<div class="modal-title">' + esc(t('linkDetail.selectPrimary')) + '</div>';
      html += '<div style="display:flex;flex-direction:column;gap:0.25rem;margin-bottom:1rem">';
      link.slugs.forEach(function(s) {
        var active = s.is_primary ? ' style="background:var(--color-selection);border-color:var(--color-accent)"' : '';
        html += '<button class="btn btn-ghost" ' + active + ' onclick="doSetPrimary(' + linkId + ',' + s.id + ')" style="justify-content:flex-start;font-family:var(--font-family-mono);font-size:0.875rem">';
        html += '/' + esc(s.slug);
        if (s.is_primary) html += ' <span class="icon" style="font-size:14px;color:var(--color-accent);margin-left:auto">star</span>';
        html += '</button>';
      });
      html += '</div>';
      html += '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button></div>';
      openModal(html);
    });
  });
}
function doSetPrimary(linkId, slugId) {
  api('/links/' + linkId + '/slugs/primary', { method: 'PUT', body: JSON.stringify({ slug_id: slugId }) }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.labelUpdated')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Error', 'error'); });
  });
}

// ---- Duplicate link modal ----
function showDuplicateModal(linkId, url) {
  document.getElementById('detail-menu').style.display = 'none';
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.duplicateTitle')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:0.75rem">' + esc(t('linkDetail.duplicateBody')) + '</p>' +
    '<p style="font-size:0.8rem;color:var(--color-text-muted);margin-bottom:1.5rem;opacity:0.7">' + esc(t('linkDetail.duplicateHelper')) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-primary" onclick="doDuplicate(\\'' + esc(url).replace(/'/g, "\\\\'") + '\\')">' + esc(t('linkDetail.duplicate')) + '</button></div>'
  );
}
function doDuplicate(url) {
  createDuplicate(url);
  closeModal();
}

// ---- Slug actions (detail page) ----
function confirmDeleteSlug(linkId, slugId, slugText) {
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.deleteSlug')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmDeleteSlug').replace('{slug}', slugText)) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-danger" onclick="doDeleteSlug(' + linkId + ',' + slugId + ')">' + esc(t('linkDetail.deleteSlug')) + '</button></div>'
  );
}
function doDeleteSlug(linkId, slugId) {
  api('/links/' + linkId + '/slugs/' + slugId, { method: 'DELETE' }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.customAdded')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Error', 'error'); });
  });
}

function confirmDisableSlug(linkId, slugId, slugText) {
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.disableSlug')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmDisableSlug').replace('{slug}', slugText)) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-danger" onclick="doDisableSlug(' + linkId + ',' + slugId + ')">' + esc(t('linkDetail.disableSlug')) + '</button></div>'
  );
}
function doDisableSlug(linkId, slugId) {
  api('/links/' + linkId + '/slugs/' + slugId + '/disable', { method: 'POST' }).then(function(res) {
    if (res.ok) { closeModal(); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Error', 'error'); });
  });
}

function confirmEnableSlug(linkId, slugId, slugText) {
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.enableSlug')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmEnableSlug').replace('{slug}', slugText)) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-primary" onclick="doEnableSlug(' + linkId + ',' + slugId + ')">' + esc(t('linkDetail.enableSlug')) + '</button></div>'
  );
}
function doEnableSlug(linkId, slugId) {
  api('/links/' + linkId + '/slugs/' + slugId + '/enable', { method: 'POST' }).then(function(res) {
    if (res.ok) { closeModal(); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Error', 'error'); });
  });
}

// ---- Inline edit: Label ----
function beginEditLabel() {
  document.getElementById('label-display').style.display = 'none';
  document.getElementById('label-form').style.display = 'flex';
  var inp = document.getElementById('detail-label');
  inp.focus();
  inp.select();
}

function cancelEditLabel() {
  document.getElementById('label-form').style.display = 'none';
  document.getElementById('label-display').style.display = 'flex';
}

function saveDetailLabel(linkId) {
  var val = document.getElementById('detail-label').value.trim();
  var body = { label: val || null };
  api('/links/' + linkId, { method: 'PUT', body: JSON.stringify(body) }).then(function(res) {
    if (res.ok) { toast(t('client.labelUpdated')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || t('client.labelError'), 'error'); });
  });
}

// ---- Inline edit: Expiry ----
function beginEditExpiry() {
  document.getElementById('expiry-display').style.display = 'none';
  document.getElementById('expiry-form').style.display = 'flex';
  document.getElementById('detail-expires').focus();
}

function cancelEditExpiry() {
  document.getElementById('expiry-form').style.display = 'none';
  document.getElementById('expiry-display').style.display = 'flex';
}

function saveDetailExpiry(linkId) {
  var exp = document.getElementById('detail-expires').value;
  var body = { expires_at: exp ? Math.floor(new Date(exp).getTime() / 1000) : null };
  api('/links/' + linkId, { method: 'PUT', body: JSON.stringify(body) }).then(function(res) {
    if (res.ok) { toast(t('client.expiryUpdated')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || t('client.expiryError'), 'error'); });
  });
}

function clearDetailExpiry(linkId) {
  api('/links/' + linkId, { method: 'PUT', body: JSON.stringify({ expires_at: null }) }).then(function(res) {
    if (res.ok) { toast(t('client.expiryCleared')); window.location.reload(); }
    else toast(t('client.expiryClearError'), 'error');
  });
}

// ---- QR Code modal ----
var _qrSlug = '';
var _qrSrc = '';

function showQRModal(linkId, slug) {
  _qrSlug = slug;
  _qrSrc = API + '/links/' + linkId + '/qr?slug=' + encodeURIComponent(slug);
  var shortUrl = location.origin + '/' + slug;
  openModal(
    '<div class="modal-title">' + esc(t('client.qrCode')) + '</div>' +
    '<p style="text-align:center;font-size:0.85rem;color:var(--color-text-muted);margin:0 0 1.25rem">' + esc(shortUrl) + '</p>' +
    '<div style="display:flex;justify-content:center;margin-bottom:1.25rem">' +
      '<img id="qr-img" src="' + _qrSrc + '" style="width:280px;height:280px;border-radius:var(--radius-md);background:#fff;padding:12px;box-sizing:border-box">' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.close')) + '</button>' +
      '<button class="btn btn-ghost btn-sm" onclick="downloadQrSvg()">' +
        '<span class="icon">download</span> ' + esc(t('client.downloadSvg')) +
      '</button>' +
      '<button class="btn btn-secondary btn-sm" onclick="downloadQrPng()">' +
        '<span class="icon">download</span> ' + esc(t('client.downloadPng')) +
      '</button>' +
    '</div>'
  );
}

function downloadQrSvg() {
  fetch(_qrSrc).then(function(r) { return r.blob(); }).then(function(blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.download = _qrSlug + '-qr.svg';
    a.href = url;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function downloadQrPng() {
  var img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = function() {
    var canvas = document.createElement('canvas');
    canvas.width = 400; canvas.height = 400;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 400, 400);
    ctx.drawImage(img, 0, 0, 400, 400);
    canvas.toBlob(function(blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.download = _qrSlug + '-qr.png';
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };
  img.src = _qrSrc;
}

// ---- Settings ----
function saveSettings() {
  var val = parseInt(document.getElementById('slug-length-input').value);
  if (val < 3) { toast(t('client.minSlugLength'), 'error'); return; }
  api('/settings', { method: 'PUT', body: JSON.stringify({ slug_default_length: val }) }).then(function(res) {
    if (res.ok) toast(t('client.settingsSaved'));
    else toast(t('client.settingsError'), 'error');
  });
}

function updateComboHint() {
  var el = document.getElementById('slug-combo-hint');
  if (!el) return;
  var len = parseInt(document.getElementById('slug-length-input').value) || MIN_SLUG_LEN;
  var combos = Math.pow(CHARSET_SIZE, Math.max(len, MIN_SLUG_LEN));
  el.textContent = len >= MIN_SLUG_LEN
    ? t('client.combos', {count: combos.toLocaleString()})
    : t('client.minLength');
}

// ---- Version check ----
function compareVersions(a, b) {
  var pa = a.split('.').map(Number);
  var pb = b.split('.').map(Number);
  for (var i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
  }
  return 0;
}

function checkForUpdates() {
  var el = document.getElementById('version-status');
  if (!el) return;
  fetch('https://api.github.com/repos/oddbit/shrtnr/releases/latest', {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  }).then(function(res) {
    if (!res.ok) throw new Error('GitHub API error');
    return res.json();
  }).then(function(release) {
    var latest = (release.tag_name || '').replace(/^v/, '');
    if (!latest) throw new Error('No version tag');
    var releaseUrl = release.html_url || (REPO_URL + '/releases/tag/v' + latest);
    if (compareVersions(APP_VERSION, latest) < 0) {
      var html = '<div style="display:flex;flex-direction:column;gap:0.75rem">';
      html += '<div style="display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap">';
      html += '<div><span style="font-family:var(--font-family-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--color-text-muted)">&rarr;</span> <span style="font-family:var(--font-family-mono);color:var(--color-success);font-weight:600">' + esc(latest) + '</span> <span style="color:var(--color-text-muted);font-size:0.8rem">' + esc(t('client.updateAvailable')) + '</span></div>';
      html += '</div>';
      html += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">';
      html += '<a href="' + esc(releaseUrl) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:0.4rem;text-decoration:none"><span class="icon" style="font-size:16px">open_in_new</span> ' + esc(t('client.releaseNotes')) + '</a>';
      html += '<a href="' + REPO_URL + '" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:0.4rem;text-decoration:none"><span class="icon" style="font-size:16px">code</span> ' + esc(t('client.viewRepo')) + '</a>';
      html += '<button id="install-app-btn" class="btn btn-secondary btn-sm" onclick="installApp()" style="display:none;align-items:center;gap:0.4rem"><span class="icon" style="font-size:16px">install_desktop</span> ' + esc(t('settings.installApp')) + '</button>';
      html += '</div>';
      html += '<div style="font-size:0.75rem;color:var(--color-text-muted);line-height:1.5">' + esc(t('client.updateHint')) + '</div>';
      html += '</div>';
      el.innerHTML = html;
    } else {
      el.innerHTML =
        '<div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">' +
          '<div style="display:flex;align-items:center;gap:0.4rem">' +
            '<span style="font-family:var(--font-family-mono);font-weight:600">' + esc(APP_VERSION) + '</span>' +
            '<span style="color:var(--color-success);display:inline-flex;align-items:center;gap:0.2rem">' +
              '<span class="icon" style="font-size:15px;vertical-align:text-bottom">check_circle</span> ' + esc(t('client.upToDate')) +
            '</span>' +
          '</div>' +
          '<a href="' + esc(releaseUrl) + '" target="_blank" rel="noopener" ' +
            'style="color:var(--color-text-muted);font-size:0.8rem;text-decoration:none;display:inline-flex;align-items:center;gap:0.2rem">' +
            esc(t('client.whatsNew')) + ' <span class="icon" style="font-size:13px">open_in_new</span>' +
          '</a>' +
          '<button id="install-app-btn" class="btn btn-secondary btn-sm" onclick="installApp()" style="display:none;align-items:center;gap:0.4rem"><span class="icon" style="font-size:14px">install_desktop</span> ' + esc(t('settings.installApp')) + '</button>' +
        '</div>';
    }
  }).catch(function() {
    el.innerHTML = '<span style="font-family:var(--font-family-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--color-text-muted)">&middot; ' + esc(t('client.updateCheckFailed')) + '</span>';
  });
}

// ---- PWA install ----
var _installPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
  e.preventDefault();
  _installPrompt = e;
  var btn = document.getElementById('install-app-btn');
  if (btn) btn.style.display = 'inline-flex';
});
window.addEventListener('appinstalled', function() {
  var btn = document.getElementById('install-app-btn');
  if (btn) btn.style.display = 'none';
  _installPrompt = null;
});
function installApp() {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  _installPrompt.userChoice.then(function() { _installPrompt = null; });
}

// ---- Init ----
var quickUrlEl = document.getElementById('quick-url');
if (quickUrlEl) {
  quickUrlEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') quickShorten(); });
  quickUrlEl.addEventListener('input', updateQuickActionButton);
  updateQuickActionButton();
}

var slugLengthEl = document.getElementById('slug-length-input');
if (slugLengthEl) slugLengthEl.addEventListener('input', updateComboHint);

if (document.getElementById('version-status')) checkForUpdates();
`;
}
