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
var UI_LANG = T['_lang'] || 'en';
var countryNames = new Intl.DisplayNames([UI_LANG], { type: 'region' });
function countryName(code) {
  try { return countryNames.of(code) || code; } catch(e) { return code; }
}

// ---- Number formatting ----
var numberFormatter = new Intl.NumberFormat(UI_LANG);
function fmtCount(n) { return numberFormatter.format(n); }

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
    labelEl.textContent = t('links.search');
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
    else res.json().then(function(body) { toast(body.error || t('client.disableError'), 'error'); }).catch(function() { toast(t('client.disableError'), 'error'); });
  });
}

function showDeleteLinkModal(id) {
  document.getElementById('detail-menu').style.display = 'none';
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.delete')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmDelete')) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-danger" onclick="doDeleteLink(' + id + ')">' + esc(t('linkDetail.delete')) + '</button></div>'
  );
}
function doDeleteLink(id) {
  api('/links/' + id, { method: 'DELETE' }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.linkDeleted')); window.location.href = '/_/admin/links'; }
    else res.json().then(function(body) { toast(body.error || t('client.deleteError'), 'error'); }).catch(function() { toast(t('client.deleteError'), 'error'); });
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
  api('/links/' + id + '/enable', { method: 'POST' }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.linkEnabled')); window.location.reload(); }
    else res.json().then(function(body) { toast(body.error || t('client.enableError'), 'error'); }).catch(function() { toast(t('client.enableError'), 'error'); });
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
        html += '<button class="btn btn-ghost" ' + active + ' onclick="doSetPrimary(' + linkId + ',\\'' + s.slug + '\\')" style="justify-content:flex-start;font-family:var(--font-family-mono);font-size:0.875rem">';
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
function doSetPrimary(linkId, slug) {
  api('/links/' + linkId + '/slugs/primary', { method: 'PUT', body: JSON.stringify({ slug: slug }) }).then(function(res) {
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
function confirmDeleteSlug(linkId, slug) {
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.deleteSlug')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmDeleteSlug').replace('{slug}', slug)) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-danger" onclick="doDeleteSlug(' + linkId + ',\\'' + slug + '\\')">' + esc(t('linkDetail.deleteSlug')) + '</button></div>'
  );
}
function doDeleteSlug(linkId, slug) {
  api('/links/' + linkId + '/slugs/' + slug, { method: 'DELETE' }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.customAdded')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Error', 'error'); });
  });
}

function confirmDisableSlug(linkId, slug) {
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.disableSlug')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmDisableSlug').replace('{slug}', slug)) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-danger" onclick="doDisableSlug(' + linkId + ',\\'' + slug + '\\')">' + esc(t('linkDetail.disableSlug')) + '</button></div>'
  );
}
function doDisableSlug(linkId, slug) {
  api('/links/' + linkId + '/slugs/' + slug + '/disable', { method: 'POST' }).then(function(res) {
    if (res.ok) { closeModal(); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Error', 'error'); });
  });
}

function confirmEnableSlug(linkId, slug) {
  openModal(
    '<div class="modal-title">' + esc(t('linkDetail.enableSlug')) + '</div>' +
    '<p style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1.5rem">' + esc(t('linkDetail.confirmEnableSlug').replace('{slug}', slug)) + '</p>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('client.cancel')) + '</button><button class="btn btn-primary" onclick="doEnableSlug(' + linkId + ',\\'' + slug + '\\')">' + esc(t('linkDetail.enableSlug')) + '</button></div>'
  );
}
function doEnableSlug(linkId, slug) {
  api('/links/' + linkId + '/slugs/' + slug + '/enable', { method: 'POST' }).then(function(res) {
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
function setDefaultRange(range) {
  var payload = range === '' ? { default_range: null } : { default_range: range };
  api('/settings', { method: 'PUT', body: JSON.stringify(payload) }).then(function(res) {
    if (res.ok) toast(t('client.settingsSaved'));
    else toast(t('client.settingsError'), 'error');
  });
}

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
    ? t('client.combos', {count: fmtCount(combos)})
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

// ---- Analytics + Timeline ----
var _tlData = null;

function deviceIcon(name) {
  if (name === 'mobile') return 'phone_android';
  if (name === 'tablet') return 'tablet';
  return 'computer';
}
function linkModeIcon(name) {
  if (name === 'qr') return 'qr_code_2';
  return 'link';
}
function osIcon(name) {
  if (name === 'ios') return 'phone_iphone';
  if (name === 'macos') return 'laptop_mac';
  if (name === 'android') return 'android';
  if (name === 'windows') return 'desktop_windows';
  if (name === 'linux' || name === 'chromeos') return 'computer';
  return 'devices';
}

function renderStatCard(containerId, items, color, opts) {
  opts = opts || {};
  var el = document.getElementById(containerId);
  if (!el) return;
  var body = el.querySelector('.stat-card-body');
  if (!body) return;
  if (!items || items.length === 0) {
    body.innerHTML = '<div style="color:var(--color-text-muted);font-size:0.875rem">' + esc(t('linkDetail.noData')) + '</div>';
    return;
  }
  var maxVal = 0;
  for (var mi = 0; mi < items.length; mi++) maxVal += items[mi].count;
  if (maxVal === 0) maxVal = 1;
  var html = '';
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var pct = maxVal > 0 ? Math.round((item.count / maxVal) * 100) : 0;
    var name = opts.mapName ? opts.mapName(item.name) : item.name;
    var flagStr = opts.flagFromName ? '<span class="flag">' + esc(item.name) + '</span>' : '';
    var iconStr = opts.iconFn ? '<span class="icon">' + opts.iconFn(item.name) + '</span>' : '';
    html += '<div class="stat-row">';
    html += '<div class="name' + (opts.mono ? ' mono' : '') + '">' + flagStr + iconStr + '<span class="label">' + esc(name) + '</span></div>';
    html += '<div class="right"><span class="count">' + fmtCount(item.count) + '</span><span class="pct">' + pct + '%</span></div>';
    html += '<div class="bar"><div class="fill ' + color + '" style="width:' + pct + '%"></div></div>';
    html += '</div>';
  }
  body.innerHTML = html;
}

function loadAnalytics(linkId, range) {
  // Update active button
  var btns = document.querySelectorAll('.timeline-range-btn');
  for (var i = 0; i < btns.length; i++) {
    btns[i].className = 'timeline-range-btn' + (btns[i].getAttribute('data-range') === range ? ' active' : '');
  }

  // Fetch both timeline and analytics in parallel
  var timelineReq = api('/links/' + linkId + '/timeline?range=' + range).then(function(r) { return r.json(); });
  var analyticsReq = api('/links/' + linkId + '/analytics?range=' + range).then(function(r) { return r.json(); });

  Promise.all([timelineReq, analyticsReq]).then(function(results) {
    var tlData = results[0];
    var stats = results[1];
    _tlData = tlData;

    // Update hero total clicks
    var heroTotal = document.getElementById('hero-total-clicks');
    if (heroTotal) heroTotal.textContent = fmtNum(stats.total_clicks);
    var timelineTotal = document.getElementById('timeline-total');
    if (timelineTotal) timelineTotal.textContent = fmtNum(stats.total_clicks);
    var heroAvg = document.getElementById('hero-avg-per-day');
    if (heroAvg) {
      var createdAt = parseInt(heroAvg.getAttribute('data-created-at'), 10);
      heroAvg.textContent = fmtAvgPerDay(stats.total_clicks, range, createdAt);
    }

    // Update per-slug click counts and bars
    var slugCounts = {};
    var slugMax = 0;
    var sc = stats.slug_clicks || [];
    for (var si = 0; si < sc.length; si++) {
      slugCounts[sc[si].slug] = sc[si].count;
      slugMax += sc[si].count;
    }
    if (slugMax === 0) slugMax = 1;
    var rows = document.querySelectorAll('.slugs-row[data-slug-id]');
    for (var ri = 0; ri < rows.length; ri++) {
      var sid = rows[ri].getAttribute('data-slug-id');
      var cnt = slugCounts[sid] || 0;
      var countEl = rows[ri].querySelector('[data-slug-count]');
      if (countEl) countEl.textContent = String(cnt);
      var fillEl = rows[ri].querySelector('[data-slug-fill]');
      if (fillEl) fillEl.style.width = ((cnt / slugMax) * 100).toFixed(0) + '%';
    }

    // Update timeline chart
    renderTimeline(tlData);

    // Update all stat cards
    renderStatCard('card-countries', stats.countries, 'orange', { mapName: countryName, flagFromName: true });
    renderStatCard('card-domains', stats.referrer_hosts, 'mint', { mono: true });
    renderStatCard('card-sources', stats.referrers, 'mint', { mono: true });
    renderStatCard('card-link-modes', stats.link_modes, 'orange', { iconFn: linkModeIcon });
    renderStatCard('card-devices', stats.devices, 'orange', { iconFn: deviceIcon });
    renderStatCard('card-os', stats.os, 'mint', { iconFn: osIcon });
    renderStatCard('card-browsers', stats.browsers, 'mint');

    // Update count pills and hero metrics
    updateCount('count-countries', stats.num_countries);
    updateCount('count-domains', stats.num_referrer_hosts);
    updateCount('count-sources', stats.num_referrers);
    updateCount('count-os', stats.num_os);
    updateCount('count-browsers', stats.num_browsers);
    updateCount('hero-num-countries', stats.num_countries);
    updateCount('hero-num-domains', stats.num_referrer_hosts);
  });
}

function updateCount(id, value) {
  var el = document.getElementById(id);
  if (el) el.textContent = fmtNum(value);
}

function fmtNum(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

var RANGE_SECONDS = { '24h': 86400, '7d': 7*86400, '30d': 30*86400, '90d': 90*86400, '1y': 365*86400 };
function fmtAvgPerDay(totalClicks, range, createdAt) {
  var days;
  if (range !== 'all') {
    days = RANGE_SECONDS[range] / 86400;
  } else {
    var nowSec = Math.floor(Date.now() / 1000);
    var seconds = Math.max(1, nowSec - createdAt);
    days = Math.max(1, seconds / 86400);
  }
  var avg = totalClicks / days;
  if (avg === 0) return '0';
  if (avg < 1) return avg.toFixed(2);
  if (avg < 10) return avg.toFixed(1);
  return String(Math.round(avg));
}

var MONTH_KEYS = ['month.jan','month.feb','month.mar','month.apr','month.may','month.jun','month.jul','month.aug','month.sep','month.oct','month.nov','month.dec'];
function monthName(m) { return t(MONTH_KEYS[m - 1]); }

function fmtLabel(label, range) {
  if (range === '24h') {
    // "YYYY-MM-DD HH" → "HH:00"
    return label.slice(11) + ':00';
  }
  if (range === '7d' || range === '30d' || range === '90d' || range === '1y') {
    var parts = label.split('-');
    return monthName(parseInt(parts[1], 10)) + ' ' + parseInt(parts[2], 10);
  }
  // "all": label can be YYYY-MM-DD (daily/weekly) or YYYY-MM (monthly)
  var parts = label.split('-');
  if (parts.length === 3) {
    return monthName(parseInt(parts[1], 10)) + ' ' + parseInt(parts[2], 10);
  }
  return monthName(parseInt(parts[1], 10)) + ' ' + parts[0].slice(2);
}

function renderTimeline(data) {
  var container = document.getElementById('timeline-chart');
  if (!data.buckets || data.buckets.length === 0) {
    container.innerHTML = '<div class="empty-card-hint">' + esc(t('linkDetail.noClickData')) + '</div>';
    return;
  }

  var buckets = data.buckets;
  var n = buckets.length;
  var maxVal = 0;
  for (var i = 0; i < n; i++) {
    if (buckets[i].count > maxVal) maxVal = buckets[i].count;
  }
  if (maxVal === 0) maxVal = 1;

  var step = niceStep(maxVal);
  var gridMax = Math.ceil(maxVal / step) * step;
  if (gridMax === 0) gridMax = step;

  var w = 800, h = 220;
  var pad = { l: 36, r: 8, t: 10, b: 24 };
  var innerW = w - pad.l - pad.r;
  var innerH = h - pad.t - pad.b;
  var stepX = n > 1 ? innerW / (n - 1) : 0;

  var pts = new Array(n);
  for (var i = 0; i < n; i++) {
    var x = n > 1 ? pad.l + i * stepX : pad.l + innerW / 2;
    var y = pad.t + innerH - (buckets[i].count / gridMax) * innerH;
    pts[i] = [x, y];
  }

  var line = '';
  for (var i = 0; i < n; i++) {
    line += (i === 0 ? 'M' : 'L') + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1) + ' ';
  }
  var lastX = n > 1 ? pad.l + innerW : pts[0][0];
  var baseY = pad.t + innerH;
  var area = line + 'L' + lastX.toFixed(1) + ',' + baseY + ' L' + pad.l + ',' + baseY + ' Z';

  var grid = [0, 0.25, 0.5, 0.75, 1];
  var parts = [];
  parts.push('<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none">');
  parts.push('<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">');
  parts.push('<stop offset="0%" stop-color="var(--color-accent)" stop-opacity="0.45"/>');
  parts.push('<stop offset="100%" stop-color="var(--color-accent)" stop-opacity="0"/>');
  parts.push('</linearGradient></defs>');

  for (var gi = 0; gi < grid.length; gi++) {
    var gy = pad.t + innerH * grid[gi];
    var val = Math.round(gridMax * (1 - grid[gi]));
    parts.push('<line x1="' + pad.l + '" x2="' + (w - pad.r) + '" y1="' + gy + '" y2="' + gy + '" stroke="var(--color-border)" stroke-opacity="0.35" stroke-width="1" vector-effect="non-scaling-stroke"/>');
    parts.push('<text x="' + (pad.l - 6) + '" y="' + (gy + 3) + '" font-size="9" fill="var(--color-text-subtle)" text-anchor="end" font-family="var(--font-family-mono)">' + fmtNum(val) + '</text>');
  }

  parts.push('<path d="' + area + '" fill="url(#chartGrad)"/>');
  parts.push('<path d="' + line + '" fill="none" stroke="var(--color-accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>');

  var dotInterval = n > 60 ? Math.ceil(n / 10) : (n > 30 ? 5 : (n > 14 ? 3 : 1));
  for (var i = 0; i < n; i++) {
    if (i % dotInterval === 0 || i === n - 1) {
      parts.push('<circle cx="' + pts[i][0].toFixed(1) + '" cy="' + pts[i][1].toFixed(1) + '" r="2.5" fill="var(--color-accent)" stroke="var(--color-surface-raised)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>');
    }
  }

  for (var i = 0; i < n; i++) {
    if (i % dotInterval === 0 || i === n - 1) {
      var label = i === n - 1 ? t('linkDetail.today') : fmtLabel(buckets[i].label, data.range);
      parts.push('<text x="' + pts[i][0].toFixed(1) + '" y="' + (h - 6) + '" font-size="9" fill="var(--color-text-subtle)" text-anchor="middle" font-family="var(--font-family-mono)">' + esc(label) + '</text>');
    }
  }

  parts.push('</svg>');
  container.innerHTML = parts.join('');
}

function niceStep(max) {
  if (max <= 4) return 1;
  var rough = max / 4;
  var pow = Math.pow(10, Math.floor(Math.log10(rough)));
  var norm = rough / pow;
  if (norm <= 1) return pow;
  if (norm <= 2) return 2 * pow;
  if (norm <= 5) return 5 * pow;
  return 10 * pow;
}

// Auto-load analytics on link detail page
var analyticsRangeBar = document.getElementById('timeline-range');
if (analyticsRangeBar) {
  var linkId = parseInt(analyticsRangeBar.getAttribute('data-link-id'), 10);
  var initialRange = analyticsRangeBar.getAttribute('data-initial-range') || 'all';
  if (linkId) loadAnalytics(linkId, initialRange);
}

// Poll for auto-label if label is empty (background title fetch may be in flight)
var labelDisplay = document.getElementById('label-display');
if (labelDisplay && !labelDisplay.querySelector('.inline-edit-value')) {
  var labelLinkId = analyticsRangeBar ? parseInt(analyticsRangeBar.getAttribute('data-link-id'), 10) : 0;
  if (labelLinkId) {
    var labelAttempts = 0;
    var labelPoll = setInterval(function() {
      labelAttempts++;
      if (labelAttempts > 5) { clearInterval(labelPoll); return; }
      api('/links/' + labelLinkId).then(function(res) {
        if (!res.ok) return;
        return res.json();
      }).then(function(link) {
        if (!link || !link.label) return;
        clearInterval(labelPoll);
        // Update the display inline without reloading
        var display = document.getElementById('label-display');
        var placeholder = display.querySelector('.inline-edit-placeholder');
        if (placeholder) {
          var span = document.createElement('span');
          span.className = 'inline-edit-value';
          span.textContent = link.label;
          placeholder.replaceWith(span);
        }
        // Update the hidden input too
        var inp = document.getElementById('detail-label');
        if (inp) inp.value = link.label;
      });
    }, 2000);
  }
}

// ---- Live polling (15s) ----
var POLL_INTERVAL = 15000;

function getActiveRange() {
  var btn = document.querySelector('.timeline-range-btn.active')
    || document.querySelector('.range-picker a.active');
  return btn ? btn.getAttribute('data-range') : 'all';
}

// Dashboard polling
function pollDashboard() {
  var range = getActiveRange();
  var path = '/dashboard' + (range ? '?range=' + encodeURIComponent(range) : '');
  api(path).then(function(res) {
    if (!res.ok) return;
    return res.json();
  }).then(function(d) {
    if (!d) return;
    var el;

    el = document.getElementById('dash-total-links');
    if (el) el.textContent = fmtCount(d.total_links);

    el = document.getElementById('dash-total-clicks');
    if (el) el.textContent = fmtCount(d.total_clicks);

    // Top countries
    var countriesCard = document.getElementById('dash-top-countries');
    if (countriesCard) {
      var cBody = countriesCard.querySelector('.bento-value');
      var cAfter = '';
      var cMax = 0;
      for (var ci = 0; ci < d.top_countries.length; ci++) cMax += d.top_countries[ci].count;
      if (cMax === 0) cMax = 1;
      if (d.top_countries.length === 0) {
        cAfter = '';
        if (cBody) cBody.innerHTML = '<span style="color:var(--color-text-muted)">' + esc(t('dashboard.noData')) + '</span>';
      } else {
        if (cBody) cBody.innerHTML = '';
      }
      // Remove old stat rows and rebuild
      var oldCRows = countriesCard.querySelectorAll('.stat-row');
      for (var cr = 0; cr < oldCRows.length; cr++) oldCRows[cr].remove();
      for (var ci = 0; ci < d.top_countries.length; ci++) {
        var cc = d.top_countries[ci];
        var cpct = Math.round((cc.count / cMax) * 100);
        var row = document.createElement('div');
        row.className = 'stat-row';
        row.innerHTML = '<div class="name"><span class="flag">' + esc(cc.name) + '</span><span class="label">' + esc(countryName(cc.name)) + '</span></div>' +
          '<div class="right"><span class="count">' + fmtCount(cc.count) + '</span><span class="pct">' + cpct + '%</span></div>' +
          '<div class="bar"><div class="fill orange" style="width:' + cpct + '%"></div></div>';
        countriesCard.appendChild(row);
      }
    }

    // Top sources
    var sourcesCard = document.getElementById('dash-top-sources');
    if (sourcesCard) {
      var oldSRows = sourcesCard.querySelectorAll('.stat-row');
      for (var sr = 0; sr < oldSRows.length; sr++) oldSRows[sr].remove();
      var sNoData = sourcesCard.querySelector('div[style]');
      var sMax = 0;
      for (var si = 0; si < d.top_referrers.length; si++) sMax += d.top_referrers[si].count;
      if (sMax === 0) sMax = 1;
      if (d.top_referrers.length === 0) {
        if (!sNoData) {
          var nd = document.createElement('div');
          nd.style.cssText = 'color:var(--color-text-muted);font-size:0.875rem';
          nd.textContent = t('dashboard.noData');
          sourcesCard.appendChild(nd);
        }
      } else {
        if (sNoData && sNoData.textContent === t('dashboard.noData')) sNoData.remove();
        for (var si = 0; si < d.top_referrers.length; si++) {
          var ref = d.top_referrers[si];
          var rpct = Math.round((ref.count / sMax) * 100);
          var row = document.createElement('div');
          row.className = 'stat-row';
          row.innerHTML = '<div class="name"><span class="label">' + esc(ref.name) + '</span></div>' +
            '<div class="right"><span class="count">' + fmtCount(ref.count) + '</span><span class="pct">' + rpct + '%</span></div>' +
            '<div class="bar"><div class="fill mint" style="width:' + rpct + '%"></div></div>';
          sourcesCard.appendChild(row);
        }
      }
    }

    // Recent links
    var recentCard = document.getElementById('dash-recent-links');
    if (recentCard) {
      var recentLinks = recentCard.querySelectorAll('a');
      for (var rl = 0; rl < recentLinks.length; rl++) recentLinks[rl].remove();
      var recentNoData = recentCard.querySelector('div[style*="color:var(--color-text-muted)"]');
      if (d.recent_links.length === 0) {
        if (!recentNoData) {
          var nd = document.createElement('div');
          nd.style.cssText = 'color:var(--color-text-muted);font-size:0.875rem';
          nd.textContent = t('dashboard.noLinks');
          recentCard.appendChild(nd);
        }
      } else {
        if (recentNoData) recentNoData.remove();
        for (var ri = 0; ri < d.recent_links.length; ri++) {
          var link = d.recent_links[ri];
          var slug = '';
          for (var si = 0; si < link.slugs.length; si++) {
            if (!link.slugs[si].is_custom) { slug = link.slugs[si].slug; break; }
          }
          if (!slug && link.slugs.length > 0) slug = link.slugs[0].slug;
          var a = document.createElement('a');
          a.href = '/_/admin/links/' + link.id;
          a.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;cursor:pointer;overflow:hidden;min-width:0;text-decoration:none;color:inherit';
          a.innerHTML = '<span class="slug-chip" onclick="event.preventDefault();event.stopPropagation();copyUrl(\\'' + esc(slug) + '\\')" title="' + esc(t('dashboard.clickToCopy')) + '">' + esc(slug) + ' <span class="icon" style="font-size:14px">content_copy</span></span>' +
            '<span style="flex:1;min-width:0;font-size:0.8rem;color:var(--color-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(link.url) + '</span>' +
            '<span style="font-family:var(--font-family-display);font-weight:700;color:var(--color-accent);flex-shrink:0">' + fmtCount(link.total_clicks) + '</span>';
          recentCard.appendChild(a);
        }
      }
    }

    // Top links
    var topLinksCard = document.getElementById('dash-top-links');
    if (topLinksCard) {
      var oldTLinks = topLinksCard.querySelectorAll('a');
      for (var tl = 0; tl < oldTLinks.length; tl++) oldTLinks[tl].remove();
      var tlNoData = topLinksCard.querySelector('div[style*="color:var(--color-text-muted)"]');
      var tlMax = 0;
      for (var ti = 0; ti < d.top_links.length; ti++) tlMax += d.top_links[ti].total_clicks;
      if (tlMax === 0) tlMax = 1;
      if (d.top_links.length === 0) {
        if (!tlNoData) {
          var nd = document.createElement('div');
          nd.style.cssText = 'color:var(--color-text-muted);font-size:0.875rem';
          nd.textContent = t('dashboard.noData');
          topLinksCard.appendChild(nd);
        }
      } else {
        if (tlNoData) tlNoData.remove();
        for (var ti = 0; ti < d.top_links.length; ti++) {
          var tLink = d.top_links[ti];
          var tSlug = '';
          for (var si = 0; si < tLink.slugs.length; si++) {
            if (!tLink.slugs[si].is_custom) { tSlug = tLink.slugs[si].slug; break; }
          }
          if (!tSlug && tLink.slugs.length > 0) tSlug = tLink.slugs[0].slug;
          var tPct = Math.round((tLink.total_clicks / tlMax) * 100);
          var a = document.createElement('a');
          a.href = '/_/admin/links/' + tLink.id;
          a.className = 'top-link-row';
          a.innerHTML = '<div class="stat-row">' +
            '<div class="name mono"><span class="label">' + esc(tSlug) + '</span></div>' +
            '<div class="right"><span class="count">' + fmtCount(tLink.total_clicks) + '</span><span class="pct">' + tPct + '%</span></div>' +
            '<div class="bar"><div class="fill orange" style="width:' + tPct + '%"></div></div>' +
            '</div>' +
            '<div class="top-link-row-url">' + esc(tLink.url) + '</div>';
          topLinksCard.appendChild(a);
        }
      }
    }
  });
}

// Link detail polling
function pollLinkDetail(linkId) {
  var range = getActiveRange();
  loadAnalytics(linkId, range);
}

// Start polling based on current page
if (document.getElementById('dashboard-bento')) {
  setInterval(pollDashboard, POLL_INTERVAL);
}

if (analyticsRangeBar) {
  var pollLinkId = parseInt(analyticsRangeBar.getAttribute('data-link-id'), 10);
  if (pollLinkId) {
    setInterval(function() { pollLinkDetail(pollLinkId); }, POLL_INTERVAL);
  }
}

// ============================================================
// Bundles
// ============================================================

var BUNDLE_ACCENTS = ['orange','red','green','blue','purple'];

// Curated icon set for bundles. Material Symbol names grouped by semantic
// category so the grid reads top-to-bottom as: containers, campaigns,
// people, tech, creative, analytics, commerce.
var BUNDLE_ICONS = [
  'inventory_2','folder','folder_open','archive','bookmarks','collections_bookmark','category',
  'campaign','flag','rocket_launch','celebration','local_fire_department','bolt','auto_awesome',
  'handshake','groups','business_center','work','corporate_fare','diversity_3','school',
  'code','terminal','data_object','api','integration_instructions','cloud','memory',
  'palette','brush','design_services','photo_camera','movie','mic','edit',
  'analytics','trending_up','insights','bar_chart','dashboard','monitoring','query_stats',
  'shopping_cart','store','sell','paid','savings','redeem','credit_card',
];

function renderIconPicker(selected) {
  var chosen = selected || 'inventory_2';
  // If the pre-selected icon is not in our curated set (e.g. from an older
  // bundle that had a typed icon), prepend it so it stays selectable.
  var list = BUNDLE_ICONS.slice();
  if (list.indexOf(chosen) === -1) list.unshift(chosen);
  var html = '<div class="bundle-icon-picker" id="bundle-icon-picker">';
  list.forEach(function(name) {
    var cls = 'bundle-icon-option' + (name === chosen ? ' selected' : '');
    html += '<button type="button" class="' + cls + '" data-icon="' + esc(name) + '" onclick="selectBundleIcon(\\'' + name + '\\')" aria-label="' + esc(name) + '"><span class="icon">' + esc(name) + '</span></button>';
  });
  html += '</div>';
  html += '<input type="hidden" id="bundle-icon" value="' + esc(chosen) + '">';
  return html;
}

function selectBundleIcon(name) {
  var picker = document.getElementById('bundle-icon-picker');
  if (!picker) return;
  var buttons = picker.querySelectorAll('.bundle-icon-option');
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].classList.toggle('selected', buttons[i].getAttribute('data-icon') === name);
  }
  var input = document.getElementById('bundle-icon');
  if (input) input.value = name;
}

function renderAccentPicker(selected, inputId) {
  var html = '<div class="accent-picker" id="accent-picker">';
  BUNDLE_ACCENTS.forEach(function(a) {
    var cls = 'accent-swatch accent-' + a + (a === selected ? ' selected' : '');
    html += '<button type="button" class="' + cls + '" data-accent="' + a + '" onclick="selectAccent(\\'' + a + '\\')" title="' + esc(t('bundles.accent.' + a)) + '"></button>';
  });
  html += '<input type="hidden" id="' + inputId + '" value="' + esc(selected) + '">';
  html += '</div>';
  return html;
}

function selectAccent(a) {
  var picker = document.getElementById('accent-picker');
  if (!picker) return;
  var swatches = picker.querySelectorAll('.accent-swatch');
  for (var i = 0; i < swatches.length; i++) {
    swatches[i].classList.toggle('selected', swatches[i].getAttribute('data-accent') === a);
  }
  var input = document.getElementById('bundle-accent');
  if (input) input.value = a;
}

function showCreateBundleModal(onCreated) {
  // Stash the optional callback so doCreateBundle can pick it up without us
  // having to rewrite the button's onclick attribute after render.
  window.__bundleOnCreated = typeof onCreated === 'function' ? onCreated : null;
  var html = '<div class="modal-title">' + esc(t('bundles.newBundle')) + '</div>';
  html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formName')) + ' *</label>';
  html += '<input class="form-input" id="bundle-name" placeholder="' + esc(t('bundles.formNameHint')) + '"></div>';
  html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formDescription')) + '</label>';
  html += '<input class="form-input" id="bundle-description" placeholder="' + esc(t('bundles.formDescriptionHint')) + '"></div>';
  html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formIcon')) + '</label>';
  html += renderIconPicker('inventory_2') + '</div>';
  html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formAccent')) + '</label>';
  html += renderAccentPicker('orange', 'bundle-accent') + '</div>';
  html += '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('bundles.cancel')) + '</button>';
  html += '<button class="btn btn-primary" onclick="doCreateBundle()">' + esc(t('bundles.create')) + '</button></div>';
  openModal(html);
  setTimeout(function() { var el = document.getElementById('bundle-name'); if (el) el.focus(); }, 100);
}

function doCreateBundle() {
  var name = document.getElementById('bundle-name').value.trim();
  if (!name) { toast(t('client.urlRequired'), 'error'); return; }
  var body = {
    name: name,
    description: document.getElementById('bundle-description').value.trim() || null,
    icon: document.getElementById('bundle-icon').value.trim() || null,
    accent: document.getElementById('bundle-accent').value || 'orange',
  };
  var onCreated = window.__bundleOnCreated;
  window.__bundleOnCreated = null;
  api('/bundles', { method: 'POST', body: JSON.stringify(body) }).then(function(res) {
    if (res.ok) {
      res.json().then(function(bundle) {
        closeModal();
        toast(t('client.bundles.created'));
        if (typeof onCreated === 'function') {
          onCreated(bundle);
        } else {
          window.location.reload();
        }
      });
    } else {
      res.json().then(function(data) { toast(data.error || t('client.bundles.createError'), 'error'); });
    }
  });
}

function showEditBundleModal(bundleId) {
  var menu = document.getElementById('detail-menu');
  if (menu) menu.style.display = 'none';
  api('/bundles/' + bundleId).then(function(res) {
    if (!res.ok) { toast(t('client.bundles.saveError'), 'error'); return; }
    res.json().then(function(b) {
      var html = '<div class="modal-title">' + esc(t('bundles.editBundle')) + '</div>';
      html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formName')) + ' *</label>';
      html += '<input class="form-input" id="bundle-name" value="' + esc(b.name || '') + '"></div>';
      html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formDescription')) + '</label>';
      html += '<input class="form-input" id="bundle-description" value="' + esc(b.description || '') + '"></div>';
      html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formIcon')) + '</label>';
      html += renderIconPicker(b.icon || 'inventory_2') + '</div>';
      html += '<div class="form-group"><label class="form-label">' + esc(t('bundles.formAccent')) + '</label>';
      html += renderAccentPicker(b.accent || 'orange', 'bundle-accent') + '</div>';
      html += '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('bundles.cancel')) + '</button>';
      html += '<button class="btn btn-primary" onclick="doUpdateBundle(' + bundleId + ')">' + esc(t('bundles.save')) + '</button></div>';
      openModal(html);
    });
  });
}

function doUpdateBundle(bundleId) {
  var name = document.getElementById('bundle-name').value.trim();
  if (!name) { toast(t('client.urlRequired'), 'error'); return; }
  var body = {
    name: name,
    description: document.getElementById('bundle-description').value.trim() || null,
    icon: document.getElementById('bundle-icon').value.trim() || null,
    accent: document.getElementById('bundle-accent').value || 'orange',
  };
  api('/bundles/' + bundleId, { method: 'PUT', body: JSON.stringify(body) }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.bundles.updated')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || t('client.bundles.saveError'), 'error'); });
  });
}

function archiveBundle(bundleId, name) {
  var menu = document.getElementById('detail-menu');
  if (menu) menu.style.display = 'none';
  if (!confirm(t('client.bundles.confirmArchive', { name: name }))) return;
  api('/bundles/' + bundleId + '/archive', { method: 'POST' }).then(function(res) {
    if (res.ok) { toast(t('client.bundles.archived')); window.location.href = '/_/admin/bundles'; }
    else toast(t('client.bundles.saveError'), 'error');
  });
}

function unarchiveBundle(bundleId) {
  var menu = document.getElementById('detail-menu');
  if (menu) menu.style.display = 'none';
  api('/bundles/' + bundleId + '/unarchive', { method: 'POST' }).then(function(res) {
    if (res.ok) { toast(t('client.bundles.unarchived')); window.location.reload(); }
    else toast(t('client.bundles.saveError'), 'error');
  });
}

function deleteBundleAction(bundleId, name) {
  var menu = document.getElementById('detail-menu');
  if (menu) menu.style.display = 'none';
  if (!confirm(t('client.bundles.confirmDelete', { name: name }))) return;
  api('/bundles/' + bundleId, { method: 'DELETE' }).then(function(res) {
    if (res.ok) { toast(t('client.bundles.deleted')); window.location.href = '/_/admin/bundles'; }
    else toast(t('client.bundles.deleteError'), 'error');
  });
}

function removeLinkFromBundle(bundleId, linkId) {
  if (!confirm(t('bundles.removeFromBundle') + '?')) return;
  api('/bundles/' + bundleId + '/links/' + linkId, { method: 'DELETE' }).then(function(res) {
    if (res.ok) { toast(t('client.bundles.updated')); window.location.reload(); }
    else toast(t('client.bundles.saveError'), 'error');
  });
}

function showAddToBundleModal(linkId) {
  var menu = document.getElementById('detail-menu');
  if (menu) menu.style.display = 'none';
  Promise.all([
    api('/bundles?archived=false'),
    api('/links/' + linkId + '/bundles'),
  ]).then(function(responses) {
    return Promise.all(responses.map(function(r) { return r.json(); }));
  }).then(function(data) {
    var allBundles = data[0] || [];
    var memberOf = data[1] || [];
    var memberIds = {};
    memberOf.forEach(function(b) { memberIds[b.id] = true; });

    var html = '<div class="modal-title">' + esc(t('linkDetail.addToBundle')) + '</div>';
    if (allBundles.length === 0) {
      html += '<div class="add-to-bundle-empty">' + esc(t('client.bundles.noBundles')) + '</div>';
    } else {
      html += '<div class="add-to-bundle-list">';
      allBundles.forEach(function(b) {
        var selectedCls = memberIds[b.id] ? ' selected' : '';
        html += '<button type="button" class="add-to-bundle-row accent-' + esc(b.accent || 'orange') + selectedCls + '" data-bundle-id="' + b.id + '" onclick="toggleAddToBundleRow(this)">';
        html += '<span class="icon">' + esc(b.icon || 'inventory_2') + '</span>';
        html += '<div><div class="add-to-bundle-row-name">' + esc(b.name) + '</div>';
        if (b.description) html += '<div class="add-to-bundle-row-desc">' + esc(b.description) + '</div>';
        html += '</div></button>';
      });
      html += '</div>';
    }
    html += '<div class="add-to-bundle-create"><button type="button" class="btn btn-ghost" onclick="showCreateBundleForLink(' + linkId + ')">+ ' + esc(t('client.bundles.createNew')) + '</button></div>';
    html += '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('bundles.cancel')) + '</button>';
    html += '<button class="btn btn-primary" onclick="saveAddToBundle(' + linkId + ')">' + esc(t('bundles.save')) + '</button></div>';
    openModal(html);

    // Stash the original memberships so save can compute the diff.
    window.__bundleOriginalMembership = memberIds;
  });
}

function showCreateBundleForLink(linkId) {
  // On create, attach the link to the new bundle. The callback is threaded
  // through the modal rather than spliced into the primary button's onclick
  // attribute, so renames to the modal markup do not silently break this.
  showCreateBundleModal(function(bundle) {
    api('/bundles/' + bundle.id + '/links', {
      method: 'POST',
      body: JSON.stringify({ link_id: linkId }),
    }).then(function(res) {
      if (res.ok) {
        toast(t('client.bundles.updated'));
        window.location.reload();
      } else {
        toast(t('client.bundles.saveError'), 'error');
      }
    });
  });
}

function toggleAddToBundleRow(el) {
  el.classList.toggle('selected');
}

function saveAddToBundle(linkId) {
  var original = window.__bundleOriginalMembership || {};
  var rows = document.querySelectorAll('.add-to-bundle-list .add-to-bundle-row');
  var desired = {};
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].classList.contains('selected')) desired[rows[i].getAttribute('data-bundle-id')] = true;
  }
  var toAdd = [];
  var toRemove = [];
  for (var id in desired) if (!original[id]) toAdd.push(id);
  for (var id2 in original) if (!desired[id2]) toRemove.push(id2);

  var ops = [];
  toAdd.forEach(function(bid) {
    ops.push(api('/bundles/' + bid + '/links', {
      method: 'POST',
      body: JSON.stringify({ link_id: linkId }),
    }));
  });
  toRemove.forEach(function(bid) {
    ops.push(api('/bundles/' + bid + '/links/' + linkId, { method: 'DELETE' }));
  });

  Promise.all(ops).then(function(results) {
    var failed = results.some(function(r) { return !r.ok; });
    if (failed) {
      toast(t('client.bundles.saveError'), 'error');
    } else {
      closeModal();
      toast(t('client.bundles.updated'));
      window.location.reload();
    }
  });
}

function showAddLinkToBundlePicker(bundleId, excludeIds) {
  var exclude = {};
  if (excludeIds && excludeIds.length) {
    for (var i = 0; i < excludeIds.length; i++) exclude[excludeIds[i]] = true;
  }
  api('/links').then(function(res) {
    if (!res.ok) { toast(t('client.createLinkError'), 'error'); return; }
    res.json().then(function(links) {
      var available = links.filter(function(link) { return !exclude[link.id]; });
      var html = '<div class="modal-title">' + esc(t('bundles.addLinkToBundle')) + '</div>';
      html += '<div class="form-group"><input class="form-input" id="bundle-link-search" placeholder="' + esc(t('links.search')) + '" oninput="filterBundleLinkPicker()"></div>';
      html += '<div class="add-to-bundle-list" id="bundle-link-picker-list">';
      if (available.length === 0) {
        html += '<div class="muted-hint">' + esc(t('bundles.allLinksAdded')) + '</div>';
      } else {
        available.forEach(function(link) {
          var slug = '';
          if (link.slugs && link.slugs.length > 0) {
            var primary = link.slugs.find(function(s) { return s.is_primary; }) || link.slugs[0];
            slug = primary.slug;
          }
          var label = link.label || link.url;
          html += '<div class="add-to-bundle-row" data-search="' + esc((link.label || '') + ' ' + link.url + ' ' + slug).toLowerCase() + '" onclick="doAddLinkToBundle(' + bundleId + ',' + link.id + ')">';
          html += '<span class="slug-chip">' + esc(slug) + '</span>';
          html += '<div><div class="add-to-bundle-row-name">' + esc(label) + '</div>';
          html += '<div class="add-to-bundle-row-desc">' + esc(link.url) + '</div></div>';
          html += '</div>';
        });
      }
      html += '</div>';
      html += '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">' + esc(t('bundles.cancel')) + '</button></div>';
      openModal(html);
    });
  });
}

function filterBundleLinkPicker() {
  var q = (document.getElementById('bundle-link-search').value || '').toLowerCase();
  var rows = document.querySelectorAll('#bundle-link-picker-list .add-to-bundle-row');
  for (var i = 0; i < rows.length; i++) {
    var hay = rows[i].getAttribute('data-search') || '';
    rows[i].style.display = hay.indexOf(q) >= 0 ? '' : 'none';
  }
}

function doAddLinkToBundle(bundleId, linkId) {
  api('/bundles/' + bundleId + '/links', {
    method: 'POST',
    body: JSON.stringify({ link_id: linkId }),
  }).then(function(res) {
    if (res.ok) { closeModal(); toast(t('client.bundles.updated')); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || t('client.bundles.saveError'), 'error'); });
  });
}

// Delegated click handler for bundle-detail menu buttons. Reading bundle id
// and name from data-* attributes avoids interpolating user-controlled text
// into an inline onclick handler.
document.addEventListener('click', function(ev) {
  var btn = ev.target && ev.target.closest ? ev.target.closest('[data-bundle-action]') : null;
  if (!btn) return;
  var action = btn.getAttribute('data-bundle-action');
  var id = parseInt(btn.getAttribute('data-bundle-id'), 10);
  var name = btn.getAttribute('data-bundle-name') || '';
  if (!id) return;
  if (action === 'archive') archiveBundle(id, name);
  else if (action === 'unarchive') unarchiveBundle(id);
  else if (action === 'delete') deleteBundleAction(id, name);
});
`;
}
