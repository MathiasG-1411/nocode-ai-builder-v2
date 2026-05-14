const TEMPLATES = [
  { id: 'todo',      icon: '✅', label: 'Todo / Tâches' },
  { id: 'ecommerce', icon: '🛍️', label: 'Boutique' },
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'crm',       icon: '👥', label: 'CRM / Contacts' },
  { id: 'finance',   icon: '💰', label: 'Budget' },
  { id: 'quiz',      icon: '🧠', label: 'Quiz / Jeu' },
  { id: 'blog',      icon: '📝', label: 'Blog / Notes' },
  { id: 'calendar',  icon: '📅', label: 'Planning' },
];

let selectedTemplate = 'todo';
let currentCode = '';
let currentBlobUrl = null;

document.addEventListener('DOMContentLoaded', function () {
  renderTemplates();

  document.getElementById('generateBtn').addEventListener('click', generateApp);
  document.getElementById('modifyBtn').addEventListener('click', modifyApp);
  document.getElementById('downloadBtn').addEventListener('click', downloadApp);
  document.getElementById('newProjectBtn').addEventListener('click', newProject);
  document.getElementById('openTabBtn').addEventListener('click', openPreviewTab);

  document.getElementById('mainPrompt').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.ctrlKey) generateApp();
  });

  document.getElementById('tab-preview').addEventListener('click', function () { switchTab('preview'); });
  document.getElementById('tab-code').addEventListener('click', function () { switchTab('code'); });

  document.getElementById('dev-full').addEventListener('click', function () { setDevice('full'); });
  document.getElementById('dev-tablet').addEventListener('click', function () { setDevice('tablet'); });
  document.getElementById('dev-mobile').addEventListener('click', function () { setDevice('mobile'); });
});

function renderTemplates() {
  const grid = document.getElementById('templateGrid');
  grid.innerHTML = TEMPLATES.map(function (t) {
    return '<button class="template-card border border-gray-700 rounded-xl p-3 text-left hover:border-indigo-500 transition-all cursor-pointer" data-id="' + t.id + '">' +
      '<div class="text-2xl mb-1">' + t.icon + '</div>' +
      '<div class="text-xs font-semibold text-gray-300">' + t.label + '</div></button>';
  }).join('');
  grid.querySelectorAll('.template-card').forEach(function (btn) {
    btn.addEventListener('click', function () { selectTemplate(this.dataset.id); });
  });
  selectTemplate('todo');
}

function selectTemplate(id) {
  selectedTemplate = id;
  document.querySelectorAll('.template-card').forEach(function (el) { el.classList.remove('selected'); });
  var card = document.querySelector('.template-card[data-id="' + id + '"]');
  if (card) card.classList.add('selected');
}

async function generateApp() {
  var desc = document.getElementById('mainPrompt').value.trim();
  setLoading(true);
  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: selectedTemplate, description: desc })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    currentCode = data.code;
    document.getElementById('modelBadge').textContent = data.model || 'Gemini 2.5';
    renderPreview(currentCode);
    document.getElementById('modifySection').classList.remove('hidden');
    document.getElementById('downloadSection').classList.remove('hidden');
    document.getElementById('openTabBtn').classList.remove('hidden');
    showStatus('✅ App générée !', 'green');
  } catch (e) {
    showStatus('❌ ' + e.message, 'red');
  } finally {
    setLoading(false);
  }
}

async function modifyApp() {
  var mod = document.getElementById('modifyPrompt').value.trim();
  if (!mod || !currentCode) return;
  setLoading(true);
  try {
    var res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentCode: currentCode, modifyPrompt: mod })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erreur serveur');
    currentCode = data.code;
    renderPreview(currentCode);
    document.getElementById('modifyPrompt').value = '';
    showStatus('✅ Modification appliquée !', 'green');
  } catch (e) {
    showStatus('❌ ' + e.message, 'red');
  } finally {
    setLoading(false);
  }
}

function renderPreview(code) {
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
  var blob = new Blob([code], { type: 'text/html; charset=utf-8' });
  currentBlobUrl = URL.createObjectURL(blob);
  var frame = document.getElementById('previewFrame');
  frame.removeAttribute('sandbox');
  frame.src = currentBlobUrl;
  document.getElementById('codeDisplay').textContent = code;
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('previewWrapper').classList.remove('hidden');
}

function openPreviewTab() {
  if (currentBlobUrl) window.open(currentBlobUrl, '_blank');
}

function setLoading(on) {
  var btn = document.getElementById('generateBtn');
  var txt = document.getElementById('generateBtnText');
  if (on) {
    btn.disabled = true; btn.classList.add('opacity-60');
    txt.textContent = 'Génération en cours...';
    if (!currentCode) {
      document.getElementById('emptyState').classList.add('hidden');
      document.getElementById('loadingState').classList.remove('hidden');
    }
  } else {
    btn.disabled = false; btn.classList.remove('opacity-60');
    txt.textContent = '✨ Générer l\'app';
    document.getElementById('loadingState').classList.add('hidden');
  }
}

function showStatus(msg, color) {
  var el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'mt-2 text-xs text-center py-1.5 px-3 rounded-lg ' +
    (color === 'green' ? 'bg-emerald-900/50 text-emerald-400' : 'bg-red-900/50 text-red-400');
  el.classList.remove('hidden');
  setTimeout(function () { el.classList.add('hidden'); }, 5000);
}

function switchTab(tab) {
  ['preview', 'code'].forEach(function (t) {
    document.getElementById('panel-' + t).classList.add('hidden');
    var el = document.getElementById('tab-' + t);
    el.classList.remove('tab-active');
    el.classList.add('bg-gray-800', 'text-gray-400');
  });
  document.getElementById('panel-' + tab).classList.remove('hidden');
  var active = document.getElementById('tab-' + tab);
  active.classList.add('tab-active');
  active.classList.remove('bg-gray-800', 'text-gray-400');
}

function setDevice(d) {
  var box = document.getElementById('deviceBox');
  ['full', 'tablet', 'mobile'].forEach(function (x) {
    document.getElementById('dev-' + x).className = 'text-xs px-3 py-1 rounded-lg bg-gray-800 text-gray-500';
  });
  document.getElementById('dev-' + d).className = 'text-xs px-3 py-1 rounded-lg bg-gray-700 text-white';
  if (d === 'full') { box.style.maxWidth = '100%'; box.style.maxHeight = '100%'; }
  else if (d === 'tablet') { box.style.maxWidth = '768px'; box.style.maxHeight = '1024px'; }
  else { box.style.maxWidth = '375px'; box.style.maxHeight = '812px'; }
}

function newProject() {
  currentCode = '';
  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
  document.getElementById('mainPrompt').value = '';
  document.getElementById('modifyPrompt').value = '';
  document.getElementById('modifySection').classList.add('hidden');
  document.getElementById('downloadSection').classList.add('hidden');
  document.getElementById('openTabBtn').classList.add('hidden');
  document.getElementById('previewWrapper').classList.add('hidden');
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('codeDisplay').textContent = '';
  switchTab('preview');
}

function downloadApp() {
  if (!currentCode) return;
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([currentCode], { type: 'text/html' }));
  a.download = 'app-' + selectedTemplate + '.html';
  a.click();
}
