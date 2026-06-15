// ── Constants ──────────────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 'todo',      icon: '✅', label: 'Todo' },
  { id: 'ecommerce', icon: '🛍️', label: 'Boutique' },
  { id: 'dashboard', icon: '📊', label: 'Dashboard' },
  { id: 'crm',       icon: '👥', label: 'CRM' },
  { id: 'finance',   icon: '💰', label: 'Budget' },
  { id: 'quiz',      icon: '🧠', label: 'Quiz' },
  { id: 'blog',      icon: '📝', label: 'Blog' },
  { id: 'calendar',  icon: '📅', label: 'Planning' },
];

const LOADING_STEPS = [
  'Analyse de ta description…',
  'Construction de l\'interface…',
  'Finalisation du code…',
];

const API_URL = 'https://api.base44.app/api/apps/6a05cc815554bfe5eed22c82/functions/generateCode';
const STORAGE_KEY = 'nocode_projects_v1';

// ── State ──────────────────────────────────────────────────────────────────

var state = {
  projects: [],
  currentProjectId: null,
  selectedTemplate: 'todo',
  currentCode: '',
  currentBlobUrl: null,
  conversation: [],
  isGenerating: false,
  projectsPanelOpen: true,
};

// ── Init ───────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
  renderTemplates();
  loadProjects();
  renderProjectsList();

  document.getElementById('sendBtn').addEventListener('click', sendMessage);
  document.getElementById('downloadBtn').addEventListener('click', downloadApp);
  document.getElementById('openTabBtn').addEventListener('click', openPreviewTab);
  document.getElementById('newProjectBtn').addEventListener('click', function (e) {
    e.stopPropagation();
    newProject();
  });
  document.getElementById('projectsToggle').addEventListener('click', toggleProjectsPanel);

  document.getElementById('chatInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendMessage(); }
  });

  document.getElementById('tab-preview').addEventListener('click', function () { switchTab('preview'); });
  document.getElementById('tab-code').addEventListener('click', function () { switchTab('code'); });
  document.getElementById('dev-full').addEventListener('click', function () { setDevice('full'); });
  document.getElementById('dev-tablet').addEventListener('click', function () { setDevice('tablet'); });
  document.getElementById('dev-mobile').addEventListener('click', function () { setDevice('mobile'); });
});

// ── Templates ──────────────────────────────────────────────────────────────

function renderTemplates() {
  var grid = document.getElementById('templateGrid');
  grid.innerHTML = TEMPLATES.map(function (t) {
    return '<button class="template-mini" data-id="' + t.id + '">' +
      '<div class="text-base">' + t.icon + '</div>' +
      '<div class="text-gray-400 mt-0.5" style="font-size:10px">' + t.label + '</div></button>';
  }).join('');
  grid.querySelectorAll('.template-mini').forEach(function (btn) {
    btn.addEventListener('click', function () { selectTemplate(this.dataset.id); });
  });
  selectTemplate('todo');
}

function selectTemplate(id) {
  state.selectedTemplate = id;
  document.querySelectorAll('.template-mini').forEach(function (el) { el.classList.remove('selected'); });
  var card = document.querySelector('.template-mini[data-id="' + id + '"]');
  if (card) card.classList.add('selected');
}

// ── Projects ───────────────────────────────────────────────────────────────

function loadProjects() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    state.projects = raw ? JSON.parse(raw) : [];
  } catch (e) {
    state.projects = [];
  }
}

function saveProjects() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.projects));
  } catch (e) { /* storage full or unavailable */ }
}

function makeProjectName(firstMessage) {
  var words = firstMessage.trim().split(/\s+/).slice(0, 6).join(' ');
  return words.length > 35 ? words.slice(0, 35) + '…' : words || 'Nouveau projet';
}

function saveCurrentProject() {
  if (!state.currentProjectId) return;
  var project = state.projects.find(function (p) { return p.id === state.currentProjectId; });
  if (!project) return;
  project.code = state.currentCode;
  project.conversation = state.conversation.slice();
  project.template = state.selectedTemplate;
  project.updatedAt = new Date().toISOString();
  saveProjects();
  renderProjectsList();
}

function renderProjectsList() {
  var list = document.getElementById('projectsList');
  var emptyMsg = document.getElementById('emptyProjectsMsg');
  var countBadge = document.getElementById('projectCount');

  countBadge.textContent = state.projects.length;
  list.querySelectorAll('.project-card').forEach(function (c) { c.remove(); });

  if (state.projects.length === 0) {
    emptyMsg.style.display = 'block';
    return;
  }

  emptyMsg.style.display = 'none';

  var sorted = state.projects.slice().sort(function (a, b) {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });

  sorted.forEach(function (p) {
    var isActive = p.id === state.currentProjectId;
    var date = new Date(p.updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    var tpl = TEMPLATES.find(function (t) { return t.id === p.template; }) || TEMPLATES[0];

    var card = document.createElement('div');
    card.className = 'project-card mb-1.5' + (isActive ? ' active' : '');
    card.dataset.id = p.id;
    card.innerHTML =
      '<div class="flex items-center justify-between">' +
        '<div class="flex items-center gap-1.5 min-w-0">' +
          '<span class="text-sm flex-shrink-0">' + tpl.icon + '</span>' +
          '<span class="text-xs font-medium text-gray-200 truncate">' + escapeHtml(p.name) + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-1.5 flex-shrink-0 ml-2">' +
          '<span class="text-xs text-gray-600">' + date + '</span>' +
          '<button class="delete-btn text-gray-600 hover:text-red-400 transition-all text-xs leading-none" title="Supprimer">✕</button>' +
        '</div>' +
      '</div>';

    card.addEventListener('click', function (e) {
      if (e.target.closest('.delete-btn')) return;
      openProject(p.id);
    });
    card.querySelector('.delete-btn').addEventListener('click', function (e) {
      e.stopPropagation();
      deleteProject(p.id);
    });

    emptyMsg.insertAdjacentElement('beforebegin', card);
  });
}

function openProject(id) {
  var project = state.projects.find(function (p) { return p.id === id; });
  if (!project) return;

  state.currentProjectId = id;
  state.currentCode = project.code || '';
  state.conversation = (project.conversation || []).slice();
  selectTemplate(project.template || 'todo');
  updateProjectNameBadge(project.name);
  restoreChat();

  if (project.code) {
    renderPreview(project.code);
    document.getElementById('downloadBtn').classList.remove('hidden');
    document.getElementById('openTabBtn').classList.remove('hidden');
  } else {
    resetPreview();
  }

  renderProjectsList();
}

function deleteProject(id) {
  state.projects = state.projects.filter(function (p) { return p.id !== id; });
  saveProjects();
  if (state.currentProjectId === id) {
    newProject();
  } else {
    renderProjectsList();
  }
}

function newProject() {
  state.currentProjectId = null;
  state.currentCode = '';
  state.conversation = [];
  if (state.currentBlobUrl) { URL.revokeObjectURL(state.currentBlobUrl); state.currentBlobUrl = null; }
  document.getElementById('downloadBtn').classList.add('hidden');
  document.getElementById('openTabBtn').classList.add('hidden');
  document.getElementById('projectNameWrapper').classList.add('hidden');
  selectTemplate('todo');
  resetPreview();
  resetChat();
  renderProjectsList();
}

function updateProjectNameBadge(name) {
  var wrapper = document.getElementById('projectNameWrapper');
  wrapper.classList.remove('hidden');
  wrapper.classList.add('flex');
  document.getElementById('currentProjectName').textContent = name;
}

function toggleProjectsPanel() {
  state.projectsPanelOpen = !state.projectsPanelOpen;
  var list = document.getElementById('projectsList');
  var chevron = document.getElementById('projectsChevron');
  list.className = state.projectsPanelOpen
    ? 'projects-expanded px-3 pb-3'
    : 'projects-collapsed px-3';
  chevron.textContent = state.projectsPanelOpen ? '▾' : '▸';
}

// ── Chat ───────────────────────────────────────────────────────────────────

function resetChat() {
  var messages = document.getElementById('chatMessages');
  messages.innerHTML = '';
  appendChatBubble('ai', '👋 Décris l\'app que tu veux créer — je la génère pour toi. Tu peux choisir un type ci-dessus pour guider la génération !');
}

function restoreChat() {
  var messages = document.getElementById('chatMessages');
  messages.innerHTML = '';
  if (state.conversation.length === 0) {
    resetChat();
    return;
  }
  state.conversation.forEach(function (msg) {
    appendChatBubble(msg.role, msg.content, msg.type);
  });
  messages.scrollTop = messages.scrollHeight;
}

function appendChatBubble(role, content, type) {
  var messages = document.getElementById('chatMessages');
  var div = document.createElement('div');
  var cls = 'chat-bubble ';
  if (role === 'user') {
    cls += 'chat-bubble-user';
  } else if (type === 'success') {
    cls += 'chat-bubble-ai chat-bubble-success';
  } else if (type === 'error') {
    cls += 'chat-bubble-ai chat-bubble-error';
  } else {
    cls += 'chat-bubble-ai';
  }
  div.className = cls;
  div.textContent = content;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
  return div;
}

function showTypingIndicator() {
  var messages = document.getElementById('chatMessages');
  var div = document.createElement('div');
  div.id = 'typingIndicator';
  div.className = 'chat-bubble chat-bubble-ai';
  div.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function hideTypingIndicator() {
  var el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  if (state.isGenerating) return;
  var input = document.getElementById('chatInput');
  var msg = input.value.trim();
  if (!msg) return;

  input.value = '';
  appendChatBubble('user', msg);
  state.conversation.push({ role: 'user', content: msg });

  if (!state.currentCode) {
    await generateFromChat(msg);
  } else {
    await modifyFromChat(msg);
  }
}

async function generateFromChat(userMsg) {
  state.isGenerating = true;
  setSendBtnEnabled(false);
  showTypingIndicator();
  showLoadingOverlay('Génération en cours…');

  // Create and register project
  var project = {
    id: Date.now().toString(),
    name: makeProjectName(userMsg),
    template: state.selectedTemplate,
    code: '',
    conversation: state.conversation.slice(),
    model: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  state.projects.push(project);
  state.currentProjectId = project.id;
  saveProjects();
  renderProjectsList();
  updateProjectNameBadge(project.name);

  var stepInterval = startLoadingSteps();

  try {
    var data = await callBackend({ template: state.selectedTemplate, description: userMsg });
    state.currentCode = data.code;
    project.code = data.code;
    project.model = data.model || 'Gemini 2.5';
    project.updatedAt = new Date().toISOString();

    document.getElementById('modelBadge').textContent = data.model || 'Gemini 2.5';
    renderPreview(state.currentCode);
    document.getElementById('downloadBtn').classList.remove('hidden');
    document.getElementById('openTabBtn').classList.remove('hidden');

    hideTypingIndicator();
    var okMsg = '✅ App générée avec ' + (data.model || 'Gemini') + ' ! Dis-moi ce que tu veux modifier.';
    appendChatBubble('ai', okMsg, 'success');
    state.conversation.push({ role: 'ai', content: okMsg, type: 'success' });
    saveCurrentProject();
  } catch (e) {
    hideTypingIndicator();
    hideLoadingOverlay();
    var errMsg = '❌ ' + (e.message || 'Erreur lors de la génération. Réessaie.');
    appendChatBubble('ai', errMsg, 'error');
    state.conversation.push({ role: 'ai', content: errMsg, type: 'error' });
    // Remove empty project on failure
    state.projects = state.projects.filter(function (p) { return p.id !== project.id; });
    state.currentProjectId = null;
    saveProjects();
    renderProjectsList();
    document.getElementById('projectNameWrapper').classList.add('hidden');
    document.getElementById('projectNameWrapper').classList.remove('flex');
  } finally {
    clearInterval(stepInterval);
    hideLoadingOverlay();
    state.isGenerating = false;
    setSendBtnEnabled(true);
  }
}

async function modifyFromChat(userMsg) {
  state.isGenerating = true;
  setSendBtnEnabled(false);
  showTypingIndicator();

  try {
    var data = await callBackend({ currentCode: state.currentCode, modifyPrompt: userMsg });
    state.currentCode = data.code;
    renderPreview(state.currentCode);

    hideTypingIndicator();
    var okMsg = '✅ Modification appliquée ! Autre chose ?';
    appendChatBubble('ai', okMsg, 'success');
    state.conversation.push({ role: 'ai', content: okMsg, type: 'success' });
    saveCurrentProject();
  } catch (e) {
    hideTypingIndicator();
    var errMsg = '❌ ' + (e.message || 'Erreur lors de la modification. Réessaie.');
    appendChatBubble('ai', errMsg, 'error');
    state.conversation.push({ role: 'ai', content: errMsg, type: 'error' });
  } finally {
    state.isGenerating = false;
    setSendBtnEnabled(true);
  }
}

function setSendBtnEnabled(enabled) {
  document.getElementById('sendBtn').disabled = !enabled;
}

// ── Backend ────────────────────────────────────────────────────────────────

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

// ── Preview ────────────────────────────────────────────────────────────────

function renderPreview(code) {
  if (state.currentBlobUrl) URL.revokeObjectURL(state.currentBlobUrl);
  var blob = new Blob([code], { type: 'text/html; charset=utf-8' });
  state.currentBlobUrl = URL.createObjectURL(blob);
  var frame = document.getElementById('previewFrame');
  frame.removeAttribute('sandbox');
  frame.src = state.currentBlobUrl;
  document.getElementById('codeDisplay').textContent = code;
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('previewWrapper').classList.remove('hidden');
}

function resetPreview() {
  if (state.currentBlobUrl) { URL.revokeObjectURL(state.currentBlobUrl); state.currentBlobUrl = null; }
  document.getElementById('previewWrapper').classList.add('hidden');
  document.getElementById('loadingState').classList.add('hidden');
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('codeDisplay').textContent = '';
  switchTab('preview');
  setDevice('full');
}

function openPreviewTab() {
  if (state.currentBlobUrl) window.open(state.currentBlobUrl, '_blank');
}

function downloadApp() {
  if (!state.currentCode) return;
  var a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([state.currentCode], { type: 'text/html' }));
  a.download = 'app-' + state.selectedTemplate + '.html';
  a.click();
}

// ── Loading overlay ────────────────────────────────────────────────────────

var _loadingInterval = null;
var _loadingStep = 0;

function showLoadingOverlay(title) {
  if (state.currentCode) return; // don't overlay an existing preview
  document.getElementById('emptyState').classList.add('hidden');
  var el = document.getElementById('loadingState');
  el.classList.remove('hidden');
  var titleEl = document.getElementById('loadingTitle');
  if (titleEl && title) titleEl.textContent = title;
}

function hideLoadingOverlay() {
  document.getElementById('loadingState').classList.add('hidden');
}

function startLoadingSteps() {
  _loadingStep = 0;
  updateLoadingStep(0);
  _loadingInterval = setInterval(function () {
    _loadingStep = Math.min(_loadingStep + 1, LOADING_STEPS.length - 1);
    updateLoadingStep(_loadingStep);
  }, 7000);
  return _loadingInterval;
}

function updateLoadingStep(step) {
  var text = document.getElementById('loadingStepText');
  if (text) text.textContent = LOADING_STEPS[step] || LOADING_STEPS[LOADING_STEPS.length - 1];
}

// ── UI helpers ─────────────────────────────────────────────────────────────

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
