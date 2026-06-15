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

const EXAMPLE_PROMPTS = [
  'Kanban avec colonnes À faire / En cours / Terminé',
  'Gestionnaire de mots de passe avec génération',
  'Tracker d\'habitudes quotidiennes avec graphique',
  'Tableau de bord météo avec prévisions animées',
  'Calculatrice de prêt immobilier interactive',
  'Timer Pomodoro avec statistiques de session',
];

const LOADING_STEPS = [
  'Analyse de ta description…',
  'Construction de l\'interface…',
  'Finalisation du code…',
];

const API_URL = 'https://api.base44.app/api/apps/6a05cc815554bfe5eed22c82/functions/generateCode';

let selectedTemplate = 'todo';
let currentCode = '';
let currentBlobUrl = null;
let loadingStepInterval = null;
let loadingStep = 0;

document.addEventListener('DOMContentLoaded', function () {
  renderTemplates();
  renderExampleChips();

  document.getElementById('generateBtn').addEventListener('click', generateApp);
  document.getElementById('modifyBtn').addEventListener('click', modifyApp);
  document.getElementById('downloadBtn').addEventListener('click', downloadApp);
  document.getElementById('newProjectBtn').addEventListener('click', newProject);
  document.getElementById('openTabBtn').addEventListener('click', openPreviewTab);

  var textarea = document.getElementById('mainPrompt');
  textarea.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.ctrlKey) generateApp();
  });
  textarea.addEventListener('input', function () {
    updateCharCount(this.value.length);
  });

  document.getElementById('tab-preview').addEventListener('click', function () { switchTab('preview'); });
  document.getElementById('tab-code').addEventListener('click', function () { switchTab('code'); });
  document.getElementById('dev-full').addEventListener('click', function () { setDevice('full'); });
  document.getElementById('dev-tablet').addEventListener('click', function () { setDevice('tablet'); });
  document.getElementById('dev-mobile').addEventListener('click', function () { setDevice('mobile'); });
});

function renderTemplates() {
  var grid = document.getElementById('templateGrid');
  grid.innerHTML = TEMPLATES.map(function (t) {
    return '<button class="template-card border border-gray-700/80 rounded-xl p-3 text-left cursor-pointer bg-gray-800/40" data-id="' + t.id + '">' +
      '<div class="text-2xl mb-1.5">' + t.icon + '</div>' +
      '<div class="text-xs font-semibold text-gray-300">' + t.label + '</div></button>';
  }).join('');
  grid.querySelectorAll('.template-card').forEach(function (btn) {
    btn.addEventListener('click', function () { selectTemplate(this.dataset.id); });
  });
  selectTemplate('todo');
}

function renderExampleChips() {
  var list = document.getElementById('chipList');
  list.innerHTML = EXAMPLE_PROMPTS.map(function (p) {
    return '<button class="prompt-chip text-xs bg-indigo-900/30 text-indigo-300 px-2.5 py-1 rounded-lg">' + p + '</button>';
  }).join('');
  list.querySelectorAll('.prompt-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var textarea = document.getElementById('mainPrompt');
      textarea.value = this.textContent;
      updateCharCount(textarea.value.length);
      textarea.focus();
    });
  });
}

function updateCharCount(len) {
  var el = document.getElementById('charCount');
  el.textContent = len + ' / 500';
  el.className = 'text-xs ' + (len > 450 ? 'text-amber-400' : 'text-gray-600');
}

function selectTemplate(id) {
  selectedTemplate = id;
  document.querySelectorAll('.template-card').forEach(function (el) { el.classList.remove('selected'); });
  var card = document.querySelector('.template-card[data-id="' + id + '"]');
  if (card) card.classList.add('selected');
}

async function callBackend(payload) {
  var res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: JSON.stringify(payload) })
  });
  var data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function generateApp() {
  var desc = document.getElementById('mainPrompt').value.trim();
  setLoading(true);
  try {
    var data = await callBackend({ template: selectedTemplate, description: desc });
    currentCode = data.code;
    document.getElementById('modelBadge').textContent = data.model || 'Gemini 2.5';
    renderPreview(currentCode);
    document.getElementById('modifySection').classList.remove('hidden');
    document.getElementById('downloadSection').classList.remove('hidden');
    document.getElementById('openTabBtn').classList.remove('hidden');
    showStatus('✅ App générée avec ' + (data.model || 'Gemini') + ' !', 'green');
  } catch (e) {
    showStatus('❌ ' + (e.message || 'Erreur de génération'), 'red');
  } finally {
    setLoading(false);
  }
}

async function modifyApp() {
  var mod = document.getElementById('modifyPrompt').value.trim();
  if (!mod || !currentCode) return;
  var btn = document.getElementById('modifyBtn');
  btn.disabled = true;
  btn.textContent = 'Modification en cours…';
  btn.classList.add('opacity-60');
  try {
    var data = await callBackend({ currentCode: currentCode, modifyPrompt: mod });
    currentCode = data.code;
    renderPreview(currentCode);
    document.getElementById('modifyPrompt').value = '';
    showStatus('✅ Modification appliquée !', 'green');
  } catch (e) {
    showStatus('❌ ' + (e.message || 'Erreur de modification'), 'red');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Appliquer la modification';
    btn.classList.remove('opacity-60');
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
  document.getElementById('previewWrapper').classList.add('fade-in');
}

function openPreviewTab() {
  if (currentBlobUrl) window.open(currentBlobUrl, '_blank');
}

function setLoading(on) {
  var btn = document.getElementById('generateBtn');
  var txt = document.getElementById('generateBtnText');
  var icon = document.getElementById('generateBtnIcon');

  if (on) {
    btn.disabled = true;
    btn.classList.add('opacity-70');
    icon.textContent = '';
    txt.textContent = 'Génération en cours…';
    loadingStep = 0;
    if (!currentCode) {
      document.getElementById('emptyState').classList.add('hidden');
      document.getElementById('loadingState').classList.remove('hidden');
    }
    startLoadingSteps();
  } else {
    btn.disabled = false;
    btn.classList.remove('opacity-70');
    icon.textContent = '✨';
    txt.textContent = 'Générer l\'app';
    document.getElementById('loadingState').classList.add('hidden');
    stopLoadingSteps();
  }
}

function startLoadingSteps() {
  updateLoadingStep(0);
  loadingStepInterval = setInterval(function () {
    loadingStep = Math.min(loadingStep + 1, LOADING_STEPS.length - 1);
    updateLoadingStep(loadingStep);
  }, 8000);
}

function stopLoadingSteps() {
  if (loadingStepInterval) { clearInterval(loadingStepInterval); loadingStepInterval = null; }
}

function updateLoadingStep(step) {
  var text = document.getElementById('loadingStepText');
  if (text) text.textContent = LOADING_STEPS[step] || LOADING_STEPS[LOADING_STEPS.length - 1];
  var dots = document.querySelectorAll('#stepDots .step-dot');
  dots.forEach(function (d, i) {
    d.classList.remove('active', 'done');
    if (i < step) d.classList.add('done');
    else if (i === step) d.classList.add('active');
  });
}

function showStatus(msg, color) {
  var el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'mt-2 text-xs text-center py-1.5 px-3 rounded-lg status-appear ' +
    (color === 'green' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-800/60' : 'bg-red-900/50 text-red-400 border border-red-800/60');
  el.classList.remove('hidden');
  setTimeout(function () { el.classList.add('hidden'); }, 6000);
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
    document.getElementById('dev-' + x).className = 'text-xs px-3 py-1.5 rounded-lg bg-gray-800 text-gray-500 hover:text-gray-300 transition-all';
  });
  document.getElementById('dev-' + d).className = 'text-xs px-3 py-1.5 rounded-lg bg-gray-700 text-white font-medium transition-all';
  if (d === 'full')        { box.style.maxWidth = ''; box.style.maxHeight = ''; }
  else if (d === 'tablet') { box.style.maxWidth = '768px'; box.style.maxHeight = '1024px'; }
  else                     { box.style.maxWidth = '375px'; box.style.maxHeight = '812px'; }
}

function newProject() {
  currentCode = '';
  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
  document.getElementById('mainPrompt').value = '';
  document.getElementById('modifyPrompt').value = '';
  updateCharCount(0);
  document.getElementById('modifySection').classList.add('hidden');
  document.getElementById('downloadSection').classList.add('hidden');
  document.getElementById('openTabBtn').classList.add('hidden');
  document.getElementById('previewWrapper').classList.add('hidden');
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('codeDisplay').textContent = '';
  document.getElementById('statusMsg').classList.add('hidden');
  switchTab('preview');
  setDevice('full');
}

function downloadApp() {
  if (!currentCode) return;
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([currentCode], { type: 'text/html' }));
  a.download = 'app-' + selectedTemplate + '.html';
  a.click();
}
