// Copyright 2026 Oddbit (https://oddbit.id)
// SPDX-License-Identifier: Apache-2.0

function escapeForJs(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/"/g, '\\"');
}

export function adminClientScript(email: string, version: string): string {
  return `
'use strict';
var API = '/_/api';
var CURRENT_USER = '${escapeForJs(email)}';
var APP_VERSION = '${version}';
var REPO_URL = 'https://github.com/oddbit/shrtnr';

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
  toast('Copied ' + url);
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
  document.querySelectorAll('.theme-btn').forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
  });
}
function setTheme(theme) {
  applyTheme(theme);
  api('/preferences', { method: 'PUT', body: JSON.stringify({ theme: theme }) }).then(function(res) {
    if (res.ok) toast('Theme updated');
    else toast('Failed to save theme', 'error');
  });
}

// ---- Country names ----
var countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
function countryName(code) {
  try { return countryNames.of(code) || code; } catch(e) { return code; }
}

// ---- Date formatting ----
function formatDate(ts) {
  var d = new Date(ts * 1000);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---- Quick shorten (dashboard) ----
function quickShorten() {
  var url = document.getElementById('quick-url').value.trim();
  if (!url) { toast('Paste a URL first', 'error'); return; }
  api('/links', { method: 'POST', body: JSON.stringify({ url: url }) }).then(function(res) {
    if (res.ok) {
      return res.json().then(function(link) {
        var primary = link.slugs.find(function(s) { return !s.is_vanity; });
        if (primary) copyUrl(primary.slug);
        toast('Link created & copied!');
        window.location.href = '/_/links/' + link.id;
      });
    } else {
      return res.json().then(function(data) {
        toast(data.error || 'Failed to create link', 'error');
      });
    }
  });
}

// ---- Create link (modal) ----
function showCreateModal() {
  var len = (document.getElementById('slug-length-default') || {}).value || '3';
  openModal(
    '<div class="modal-title">New Link</div>' +
    '<div class="form-group"><label class="form-label">Destination URL *</label><input class="form-input" id="m-url" placeholder="https://example.com/long/path"></div>' +
    '<div class="form-group"><label class="form-label">Label (optional)</label><input class="form-input" id="m-label" placeholder="My Blog Post"></div>' +
    '<div class="form-row"><div class="form-group"><label class="form-label">Slug Length</label><input class="form-input" id="m-len" type="number" min="3" value="' + esc(len) + '"></div>' +
    '<div class="form-group"><label class="form-label">Vanity Slug (optional)</label><input class="form-input" id="m-vanity" placeholder="my-post"></div></div>' +
    '<div class="form-group"><label class="form-label">Expires At (optional)</label><input class="form-input" id="m-expires" type="datetime-local"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createLink()">Create</button></div>'
  );
}

function createLink() {
  var url = document.getElementById('m-url').value.trim();
  if (!url) { toast('URL is required', 'error'); return; }
  var body = { url: url };
  var label = document.getElementById('m-label').value.trim();
  if (label) body.label = label;
  var len = parseInt(document.getElementById('m-len').value);
  if (len >= 3) body.slug_length = len;
  var vanity = document.getElementById('m-vanity').value.trim();
  if (vanity) body.vanity_slug = vanity;
  var exp = document.getElementById('m-expires').value;
  if (exp) body.expires_at = Math.floor(new Date(exp).getTime() / 1000);

  api('/links', { method: 'POST', body: JSON.stringify(body) }).then(function(res) {
    if (res.ok) {
      return res.json().then(function(link) {
        closeModal();
        toast('Link created');
        window.location.href = '/_/links/' + link.id;
      });
    } else {
      return res.json().then(function(data) {
        toast(data.error || 'Failed to create link', 'error');
      });
    }
  });
}

// ---- API Keys ----
function showCreateKeyModal() {
  openModal(
    '<div class="modal-title">Create API Key</div>' +
    '<div class="form-group"><label class="form-label">Title *</label><input class="form-input" id="m-key-title" placeholder="e.g. CI Pipeline, Mobile App"></div>' +
    '<div class="form-group"><label class="form-label">Scope *</label>' +
    '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.25rem">' +
    '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem"><input type="radio" name="key-scope" value="create"> <strong>Create</strong> <span style="color:var(--on-bg-muted)">\\u2014 can shorten URLs</span></label>' +
    '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem"><input type="radio" name="key-scope" value="read"> <strong>Read</strong> <span style="color:var(--on-bg-muted)">\\u2014 can list links and analytics</span></label>' +
    '<label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.875rem"><input type="radio" name="key-scope" value="create,read" checked> <strong>Create + Read</strong> <span style="color:var(--on-bg-muted)">\\u2014 full API access</span></label>' +
    '</div></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-primary" onclick="createKey()">Create Key</button></div>'
  );
}

function createKey() {
  var title = document.getElementById('m-key-title').value.trim();
  if (!title) { toast('Title is required', 'error'); return; }
  var checked = document.querySelector('input[name="key-scope"]:checked');
  var scope = checked ? checked.value : null;
  if (!scope) { toast('Select a scope', 'error'); return; }

  api('/keys', { method: 'POST', body: JSON.stringify({ title: title, scope: scope }) }).then(function(res) {
    if (!res.ok) {
      return res.json().then(function(data) { toast(data.error || 'Failed to create key', 'error'); });
    }
    return res.json().then(function(data) { showKeyRevealModal(data.raw_key); });
  });
}

function showKeyRevealModal(rawKey) {
  openModal(
    '<div class="modal-title">Key Created</div>' +
    '<p style="font-size:0.875rem;color:var(--on-bg-muted);margin-bottom:1rem">Copy your API key now. It will not be shown again.</p>' +
    '<div class="key-revealed" id="revealed-key">' + esc(rawKey) + '</div>' +
    '<div class="key-warning"><span class="icon" style="font-size:18px">warning</span> Store this key securely. You cannot retrieve it later.</div>' +
    '<div class="modal-actions"><button class="btn btn-secondary" onclick="copyRawKey()"><span class="icon">content_copy</span> Copy</button><button class="btn btn-ghost" onclick="closeKeyRevealModal()">Done</button></div>'
  );
}

function copyRawKey() {
  var key = document.getElementById('revealed-key').textContent;
  navigator.clipboard.writeText(key);
  toast('API key copied');
}

function closeKeyRevealModal() {
  closeModal();
  window.location.reload();
}

function deleteKey(id, title) {
  if (!confirm('Delete API key "' + title + '"? This cannot be undone.')) return;
  api('/keys/' + id, { method: 'DELETE' }).then(function(res) {
    if (res.ok) { toast('Key deleted'); window.location.reload(); }
    else toast('Failed to delete key', 'error');
  });
}

// ---- Link actions (detail page) ----
function disableLink(id) {
  if (!confirm('Disable this link? It will stop redirecting immediately.')) return;
  api('/links/' + id + '/disable', { method: 'POST' }).then(function(res) {
    if (res.ok) { toast('Link disabled'); window.location.reload(); }
    else toast('Failed to disable', 'error');
  });
}

function enableLink(id) {
  api('/links/' + id, { method: 'PUT', body: JSON.stringify({ expires_at: null }) }).then(function(res) {
    if (res.ok) { toast('Link enabled'); window.location.reload(); }
    else toast('Failed to enable', 'error');
  });
}

function addVanityFromDetail(linkId) {
  var slug = document.getElementById('detail-vanity').value.trim();
  if (!slug) return;
  api('/links/' + linkId + '/slugs', { method: 'POST', body: JSON.stringify({ slug: slug }) }).then(function(res) {
    if (res.ok) { toast('Vanity slug added'); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Failed to add vanity slug', 'error'); });
  });
}

function saveDetailExpiry(linkId) {
  var exp = document.getElementById('detail-expires').value;
  var body = { expires_at: exp ? Math.floor(new Date(exp).getTime() / 1000) : null };
  api('/links/' + linkId, { method: 'PUT', body: JSON.stringify(body) }).then(function(res) {
    if (res.ok) { toast('Expiry updated'); window.location.reload(); }
    else res.json().then(function(data) { toast(data.error || 'Failed to update', 'error'); });
  });
}

function clearDetailExpiry(linkId) {
  api('/links/' + linkId, { method: 'PUT', body: JSON.stringify({ expires_at: null }) }).then(function(res) {
    if (res.ok) { toast('Expiry cleared'); window.location.reload(); }
    else toast('Failed to clear expiry', 'error');
  });
}

// ---- QR Code ----
function showQRModal(slug) {
  var url = location.origin + '/' + slug;
  openModal(
    '<div class="modal-title">QR Code</div>' +
    '<p style="text-align:center;font-size:0.85rem;color:var(--on-bg-muted);margin-bottom:1rem">' + esc(url) + '</p>' +
    '<div class="qr-wrap" id="qr-target"></div>' +
    '<div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Close</button></div>'
  );
  generateQR(url, document.getElementById('qr-target'));
}

function generateQR(text, container) {
  var size = 220;
  var canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  var ctx = canvas.getContext('2d');
  var qr = makeQR(text);
  if (!qr) { container.textContent = 'QR generation failed'; return; }
  var modules = qr.length;
  var cellSize = size / modules;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#001110';
  for (var r = 0; r < modules; r++) {
    for (var c = 0; c < modules; c++) {
      if (qr[r][c]) ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
    }
  }
  container.appendChild(canvas);
}

function makeQR(text) {
  var data = [];
  for (var i = 0; i < text.length; i++) data.push(text.charCodeAt(i));
  var caps = [0, 17, 32, 53, 78, 106, 134, 154, 192, 230, 271];
  var ver = 1;
  while (ver <= 10 && caps[ver] < data.length) ver++;
  if (ver > 10) return null;
  var size = ver * 4 + 17;
  var grid = Array.from({length: size}, function() { return new Uint8Array(size); });
  var reserved = Array.from({length: size}, function() { return new Uint8Array(size); });
  function setFinder(r, c) {
    for (var dr = -1; dr <= 7; dr++) {
      for (var dc = -1; dc <= 7; dc++) {
        var rr = r + dr, cc = c + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        reserved[rr][cc] = 1;
        if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
          var edge = dr === 0 || dr === 6 || dc === 0 || dc === 6;
          var inner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
          grid[rr][cc] = (edge || inner) ? 1 : 0;
        }
      }
    }
  }
  setFinder(0, 0); setFinder(0, size - 7); setFinder(size - 7, 0);
  for (var i = 8; i < size - 8; i++) {
    reserved[6][i] = 1; grid[6][i] = (i % 2 === 0) ? 1 : 0;
    reserved[i][6] = 1; grid[i][6] = (i % 2 === 0) ? 1 : 0;
  }
  if (ver >= 2) {
    var aligns = [6, [0,0], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50]][ver];
    if (Array.isArray(aligns)) {
      for (var ai = 0; ai < aligns.length; ai++) {
        for (var aj = 0; aj < aligns.length; aj++) {
          var ar = aligns[ai], ac = aligns[aj];
          if (reserved[ar] && reserved[ar][ac]) continue;
          for (var dr = -2; dr <= 2; dr++) {
            for (var dc = -2; dc <= 2; dc++) {
              var rr = ar + dr, cc = ac + dc;
              if (rr >= 0 && rr < size && cc >= 0 && cc < size) {
                reserved[rr][cc] = 1;
                grid[rr][cc] = (Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0)) ? 1 : 0;
              }
            }
          }
        }
      }
    }
  }
  for (var i = 0; i < 8; i++) {
    reserved[8][i] = 1; reserved[8][size - 1 - i] = 1;
    reserved[i][8] = 1; reserved[size - 1 - i][8] = 1;
  }
  reserved[8][8] = 1;
  reserved[size - 8][8] = 1; grid[size - 8][8] = 1;
  var eccL = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
  var totalCodewords = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
  var numEcc = eccL[ver];
  var numData = totalCodewords[ver] - numEcc;
  var bits = '';
  bits += '0100';
  bits += (ver <= 9 ? toBin(data.length, 8) : toBin(data.length, 16));
  for (var i = 0; i < data.length; i++) bits += toBin(data[i], 8);
  var maxBits = numData * 8;
  bits += '0000'.slice(0, Math.min(4, maxBits - bits.length));
  while (bits.length % 8) bits += '0';
  var pads = [0xEC, 0x11];
  var pi = 0;
  while (bits.length < maxBits) { bits += toBin(pads[pi % 2], 8); pi++; }
  var dataBytes = [];
  for (var i = 0; i < bits.length; i += 8) dataBytes.push(parseInt(bits.slice(i, i + 8), 2));
  var eccBytes = rsEncode(dataBytes, numEcc);
  var allBytes = dataBytes.concat(eccBytes);
  var bitStr = '';
  for (var i = 0; i < allBytes.length; i++) bitStr += toBin(allBytes[i], 8);
  var bitIdx = 0;
  var upward = true;
  for (var col = size - 1; col >= 0; col -= 2) {
    if (col === 6) col = 5;
    var rows = [];
    if (upward) { for (var i = size - 1; i >= 0; i--) rows.push(i); }
    else { for (var i = 0; i < size; i++) rows.push(i); }
    for (var ri = 0; ri < rows.length; ri++) {
      var row = rows[ri];
      for (var dci = 0; dci < 2; dci++) {
        var dc = [0, -1][dci];
        var c = col + dc;
        if (c < 0 || reserved[row][c]) continue;
        grid[row][c] = bitIdx < bitStr.length ? parseInt(bitStr[bitIdx++]) : 0;
      }
    }
    upward = !upward;
  }
  for (var r = 0; r < size; r++) {
    for (var c = 0; c < size; c++) {
      if (!reserved[r][c] && (r + c) % 2 === 0) grid[r][c] ^= 1;
    }
  }
  var fmtBits = [1,1,1,0,1,1,1,1,1,0,0,1,0,1,0];
  for (var i = 0; i < 6; i++) grid[8][i] = fmtBits[i];
  grid[8][7] = fmtBits[6]; grid[8][8] = fmtBits[7]; grid[7][8] = fmtBits[8];
  for (var i = 0; i < 6; i++) grid[5 - i][8] = fmtBits[9 + i];
  for (var i = 0; i < 7; i++) grid[size - 1 - i][8] = fmtBits[i];
  for (var i = 0; i < 8; i++) grid[8][size - 8 + i] = fmtBits[7 + i];
  return grid;
}
function toBin(n, len) { return n.toString(2).padStart(len, '0'); }
function rsEncode(data, numEcc) {
  var exp = new Uint8Array(512);
  var log = new Uint8Array(256);
  var x = 1;
  for (var i = 0; i < 255; i++) { exp[i] = x; log[x] = i; x = (x << 1) ^ (x >= 128 ? 0x11D : 0); }
  for (var i = 255; i < 512; i++) exp[i] = exp[i - 255];
  function gfMul(a, b) { return a === 0 || b === 0 ? 0 : exp[log[a] + log[b]]; }
  var gen = [1];
  for (var i = 0; i < numEcc; i++) {
    var newGen = new Array(gen.length + 1).fill(0);
    for (var j = 0; j < gen.length; j++) { newGen[j] ^= gen[j]; newGen[j + 1] ^= gfMul(gen[j], exp[i]); }
    gen = newGen;
  }
  var msg = new Uint8Array(data.length + numEcc);
  msg.set(data);
  for (var i = 0; i < data.length; i++) {
    var coef = msg[i];
    if (coef === 0) continue;
    for (var j = 0; j < gen.length; j++) msg[i + j] ^= gfMul(gen[j], coef);
  }
  return Array.from(msg.slice(data.length));
}

// ---- Settings ----
function saveSettings() {
  var val = parseInt(document.getElementById('slug-length-input').value);
  if (val < 3) { toast('Minimum slug length is 3', 'error'); return; }
  api('/settings', { method: 'PUT', body: JSON.stringify({ slug_default_length: val }) }).then(function(res) {
    if (res.ok) toast('Settings saved');
    else toast('Failed to save settings', 'error');
  });
}

function updateComboHint() {
  var el = document.getElementById('slug-combo-hint');
  if (!el) return;
  var len = parseInt(document.getElementById('slug-length-input').value) || 3;
  var combos = Math.pow(56, Math.max(len, 3));
  el.textContent = len >= 3
    ? combos.toLocaleString() + ' possible combinations'
    : 'Minimum length is 3 characters';
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
    if (compareVersions(APP_VERSION, latest) < 0) {
      var releaseUrl = release.html_url || (REPO_URL + '/releases/tag/v' + latest);
      var html = '<div style="display:flex;flex-direction:column;gap:0.75rem">';
      html += '<div><span style="font-family:var(--font-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--on-bg-muted)">&rarr;</span> <span style="font-family:var(--font-mono);color:var(--secondary);font-weight:600">' + esc(latest) + '</span> available</div>';
      html += '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">';
      html += '<a href="' + esc(releaseUrl) + '" target="_blank" rel="noopener" class="btn btn-primary btn-sm" style="display:inline-flex;align-items:center;gap:0.4rem;text-decoration:none"><span class="icon" style="font-size:16px">open_in_new</span> Release notes</a>';
      html += '<a href="' + REPO_URL + '" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="display:inline-flex;align-items:center;gap:0.4rem;text-decoration:none"><span class="icon" style="font-size:16px">code</span> View repo</a>';
      html += '</div>';
      html += '<div style="font-size:0.75rem;color:var(--on-bg-muted);line-height:1.5">To update: sync your fork on GitHub, then your deployment will redeploy automatically.</div>';
      html += '</div>';
      el.innerHTML = html;
    } else {
      el.innerHTML = '<span style="font-family:var(--font-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--secondary)"><span class="icon" style="font-size:16px;vertical-align:text-bottom">check_circle</span> Up to date</span>';
    }
  }).catch(function() {
    el.innerHTML = '<span style="font-family:var(--font-mono)">' + esc(APP_VERSION) + '</span> <span style="color:var(--on-bg-muted)">&middot; Could not check for updates</span>';
  });
}

// ---- Init ----
var quickUrlEl = document.getElementById('quick-url');
if (quickUrlEl) quickUrlEl.addEventListener('keydown', function(e) { if (e.key === 'Enter') quickShorten(); });

var slugLengthEl = document.getElementById('slug-length-input');
if (slugLengthEl) slugLengthEl.addEventListener('input', updateComboHint);

if (document.getElementById('version-status')) checkForUpdates();
`;
}
