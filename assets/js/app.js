const STORAGE_KEY = 'zippilot-pro-v1';

const state = {
  mode: 'backend',
  zipFile: null,
  zipMeta: { name: '', size: 0 },
  files: [],
  deletedFiles: {},
  strippedFolders: {},
  repos: [],
  selectedRepos: {},
  deployProvider: 'render',
  mobileProvider: 'codemagic',
  providerCatalog: { backend: [], mobile: [] },
  templateLibrary: [],
  deployHistory: [],
  artifacts: [],
  activity: [],
  savedConfigs: { backend: {}, mobile: {} },
  cleanup: { repos: [], selectedRepo: '', remoteItems: [], selectedRemote: {} },
  tokens: { gh: '', cleanup: '', deploy: '', build: '' }
};

const els = {};

window.addEventListener('DOMContentLoaded', async () => {
  cacheEls();
  bindEvents();
  hydrateLocalState();
  await Promise.all([loadProviderCatalog(), loadTemplateLibrary()]);
  renderAll();
  addActivity('App ready: workflow dashboard loaded');
});

function cacheEls() {
  const ids = [
    'navList','currentModeTitle','currentModeBadge','modeSummary','dynamicSteps','activityLog','clearLogBtn',
    'zipInput','uploadBox','zipName','zipCount','zipSize','extractBtn','workspaceChecks','fileSearch','treePanel','managerSummary','restoreBtn','expandBtn','collapseBtn','zipModeLabel',
    'ghToken','loadReposBtn','saveTokenBtn','newRepoName','newRepoDesc','newRepoPrivate','createRepoBtn','repoSearch','repoList','repoCountLabel','commitMsg','branchName','pushStrategy','pushSummary','pushBtn','copyCurlBtn','pushProgressWrap','pushProgressLabel','pushProgressBar','repoAllBtn','repoNoneBtn',
    'backendProviderGrid','backendProviderTitle','backendProviderBadge','deployToken','deployRepo','deployBranch','deployService','deployRootDir','deployRegion','deployBuild','deployStart','deployEnv','saveDeployBtn','prepareDeployBtn','openProviderDocsBtn','deployPayload','attemptProviderBtn','copyDeployPayloadBtn','copyDeployCurlBtn','providerHint','providerActionHint','manualDeployUrl','addDeployUrlBtn','deployHistory','refreshProvidersBtn',
    'mobileProviderGrid','mobileProviderTitle','mobileProviderBadge','buildToken','buildAppId','buildWorkflowId','buildBranch','buildPlatform','buildEnv','prepareBuildBtn','triggerBuildBtn','copyBuildCurlBtn','buildPayload','buildHint','manualArtifactUrl','addArtifactBtn','artifactGrid',
    'cleanupToken','syncCleanupBtn','loadCleanupReposBtn','cleanupBranch','loadRemoteBtn','cleanupRepoLabel','cleanupRepoSearch','cleanupRepoList','cleanupAllBtn','cleanupNoneBtn','cleanupSummary','remoteTree','cleanupCommitMsg','deleteRemoteBtn','cleanupProgressWrap','cleanupProgressLabel','cleanupProgressBar',
    'templatePicker','templateBox','copyTemplateBtn','exportWorkspaceBtn','importWorkspaceInput','resetWorkspaceBtn',
    'statFiles','statRepos','statDeploys','statBuilds'
  ];
  ids.forEach(id => els[id] = document.getElementById(id));
}

function bindEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => switchPanel(btn.dataset.target)));
  document.querySelectorAll('[data-jump]').forEach(btn => btn.addEventListener('click', () => switchPanel(btn.dataset.jump)));

  document.getElementById('modeBackend').addEventListener('click', () => setMode('backend'));
  document.getElementById('modeFrontend').addEventListener('click', () => setMode('frontend'));

  els.uploadBox.addEventListener('click', () => els.zipInput.click());
  els.uploadBox.addEventListener('dragover', e => { e.preventDefault(); els.uploadBox.classList.add('dragging'); });
  els.uploadBox.addEventListener('dragleave', () => els.uploadBox.classList.remove('dragging'));
  els.uploadBox.addEventListener('drop', e => {
    e.preventDefault();
    els.uploadBox.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) setZip(file);
  });
  els.zipInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) setZip(file);
    e.target.value = '';
  });
  els.extractBtn.addEventListener('click', extractZip);
  els.fileSearch.addEventListener('input', renderTree);
  els.restoreBtn.addEventListener('click', () => { state.deletedFiles = {}; state.strippedFolders = {}; saveState(); renderTree(); });
  els.expandBtn.addEventListener('click', () => toggleAllFolders(true));
  els.collapseBtn.addEventListener('click', () => toggleAllFolders(false));
  els.treePanel.addEventListener('click', handleTreeClick);

  els.loadReposBtn.addEventListener('click', loadRepos);
  els.saveTokenBtn.addEventListener('click', () => {
    state.tokens.gh = els.ghToken.value.trim();
    saveState();
    toast('GitHub token local save ho gaya', 'ok');
  });
  els.createRepoBtn.addEventListener('click', createRepo);
  els.repoSearch.addEventListener('input', renderRepos);
  els.repoAllBtn.addEventListener('click', () => selectAllRepos(true));
  els.repoNoneBtn.addEventListener('click', () => selectAllRepos(false));
  els.pushBtn.addEventListener('click', pushToRepos);
  els.copyCurlBtn.addEventListener('click', copyPushSummary);
  els.ghToken.addEventListener('input', () => { state.tokens.gh = els.ghToken.value.trim(); saveState(); updatePushSummary(); });

  els.refreshProvidersBtn.addEventListener('click', async () => { await loadProviderCatalog(true); renderProviders(); toast('Provider catalog refresh ho gaya', 'ok'); });
  ['deployToken','deployRepo','deployBranch','deployService','deployRootDir','deployRegion','deployBuild','deployStart','deployEnv'].forEach(id => {
    els[id].addEventListener('input', buildDeployPayload);
  });
  ['buildToken','buildAppId','buildWorkflowId','buildBranch','buildPlatform','buildEnv'].forEach(id => {
    els[id].addEventListener('input', buildMobilePayload);
  });
  els.saveDeployBtn.addEventListener('click', saveDeployConfig);
  els.prepareDeployBtn.addEventListener('click', buildDeployPayload);
  els.openProviderDocsBtn.addEventListener('click', openProviderDocs);
  els.copyDeployPayloadBtn.addEventListener('click', () => copyText(els.deployPayload.value, 'Deploy payload copied'));
  els.copyDeployCurlBtn.addEventListener('click', copyDeployCurl);
  els.attemptProviderBtn.addEventListener('click', attemptProviderAction);
  els.addDeployUrlBtn.addEventListener('click', addManualDeployUrl);

  els.prepareBuildBtn.addEventListener('click', buildMobilePayload);
  els.triggerBuildBtn.addEventListener('click', triggerBuildAction);
  els.copyBuildCurlBtn.addEventListener('click', copyBuildCurl);
  els.addArtifactBtn.addEventListener('click', addManualArtifact);

  els.syncCleanupBtn.addEventListener('click', () => {
    els.cleanupToken.value = els.ghToken.value;
    state.tokens.cleanup = els.cleanupToken.value.trim();
    saveState();
    toast('Cleanup token sync ho gaya', 'ok');
  });
  els.cleanupToken.addEventListener('input', () => { state.tokens.cleanup = els.cleanupToken.value.trim(); saveState(); });
  els.loadCleanupReposBtn.addEventListener('click', loadCleanupRepos);
  els.cleanupRepoSearch.addEventListener('input', renderCleanupRepos);
  els.loadRemoteBtn.addEventListener('click', loadRemoteTree);
  els.cleanupAllBtn.addEventListener('click', () => selectAllRemote(true));
  els.cleanupNoneBtn.addEventListener('click', () => selectAllRemote(false));
  els.remoteTree.addEventListener('click', handleRemoteClick);
  els.deleteRemoteBtn.addEventListener('click', deleteSelectedRemote);

  els.templatePicker.addEventListener('change', renderTemplateBox);
  els.copyTemplateBtn.addEventListener('click', () => copyText(els.templateBox.value, 'Template copied'));
  els.exportWorkspaceBtn.addEventListener('click', exportWorkspace);
  els.importWorkspaceInput.addEventListener('change', importWorkspace);
  els.resetWorkspaceBtn.addEventListener('click', resetWorkspace);

  els.clearLogBtn.addEventListener('click', () => {
    state.activity = [];
    saveState();
    renderActivity();
  });
}

function hydrateLocalState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    Object.assign(state, saved);
  } catch (err) {
    console.warn(err);
  }

  els.ghToken.value = state.tokens.gh || '';
  els.cleanupToken.value = state.tokens.cleanup || '';
  els.deployToken.value = state.tokens.deploy || '';
  els.buildToken.value = state.tokens.build || '';
  els.commitMsg.value = state.commitMsg || 'Add files from ZIP';
  els.branchName.value = state.branchName || 'main';
  els.cleanupBranch.value = state.cleanupBranch || 'main';
}

function saveState() {
  const persist = {
    mode: state.mode,
    zipMeta: state.zipMeta,
    deletedFiles: state.deletedFiles,
    strippedFolders: state.strippedFolders,
    repos: state.repos,
    selectedRepos: state.selectedRepos,
    deployProvider: state.deployProvider,
    mobileProvider: state.mobileProvider,
    providerCatalog: state.providerCatalog,
    templateLibrary: state.templateLibrary,
    deployHistory: state.deployHistory,
    artifacts: state.artifacts,
    activity: state.activity.slice(0, 80),
    savedConfigs: state.savedConfigs,
    cleanup: {
      repos: state.cleanup.repos,
      selectedRepo: state.cleanup.selectedRepo,
      remoteItems: state.cleanup.remoteItems,
      selectedRemote: state.cleanup.selectedRemote
    },
    tokens: state.tokens,
    commitMsg: els.commitMsg ? els.commitMsg.value : 'Add files from ZIP',
    branchName: els.branchName ? els.branchName.value : 'main',
    cleanupBranch: els.cleanupBranch ? els.cleanupBranch.value : 'main'
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
}

function renderAll() {
  switchPanel('dashboard', false);
  setMode(state.mode, false);
  renderProviders();
  renderRepos();
  renderTree();
  renderCleanupRepos();
  renderRemoteTree();
  renderDeployHistory();
  renderArtifacts();
  renderActivity();
  renderWorkspaceChecks();
  renderTemplatePicker();
  buildDeployPayload();
  buildMobilePayload();
  updatePushSummary();
  updateStats();
}

function switchPanel(target, log = true) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.target === target));
  document.querySelectorAll('.panel').forEach(panel => panel.classList.toggle('active', panel.id === `panel-${target}`));
  if (log) addActivity(`Panel opened: ${target}`);
}

function setMode(mode, log = true) {
  state.mode = mode;
  document.getElementById('modeBackend').classList.toggle('selected', mode === 'backend');
  document.getElementById('modeFrontend').classList.toggle('selected', mode === 'frontend');
  els.currentModeTitle.textContent = mode === 'backend' ? 'Backend workflow active' : 'Frontend / APK workflow active';
  els.currentModeBadge.textContent = mode;
  els.modeSummary.textContent = mode === 'backend'
    ? 'Backend deployment links aur URLs yahin se manage honge.'
    : 'Frontend/mobile builds, artifact URLs aur APK board yahin se manage honge.';
  els.dynamicSteps.innerHTML = mode === 'backend'
    ? '<div class="step-chip active">1. ZIP</div><div class="step-chip">2. Manage</div><div class="step-chip">3. GitHub</div><div class="step-chip">4. Deploy</div>'
    : '<div class="step-chip active">1. ZIP</div><div class="step-chip">2. Manage</div><div class="step-chip">3. GitHub</div><div class="step-chip">4. Build</div><div class="step-chip">5. APK</div>';
  els.zipModeLabel.textContent = `${mode} mode`;
  saveState();
  if (log) addActivity(`Workflow mode switched to ${mode}`);
}

async function loadProviderCatalog(force = false) {
  if (!force && state.providerCatalog.backend.length && state.providerCatalog.mobile.length) return;
  try {
    const res = await fetch('./assets/data/provider-catalog.json');
    state.providerCatalog = await res.json();
    saveState();
  } catch (err) {
    toast('Provider catalog load nahi hua', 'err');
  }
}

async function loadTemplateLibrary() {
  if (state.templateLibrary.length) return;
  try {
    const res = await fetch('./assets/data/template-library.json');
    state.templateLibrary = await res.json();
    saveState();
  } catch (err) {
    toast('Template library load nahi hui', 'err');
  }
}

function renderProviders() {
  const backend = state.providerCatalog.backend || [];
  const mobile = state.providerCatalog.mobile || [];

  els.backendProviderGrid.innerHTML = backend.map(provider => `
    <article class="provider-card ${provider.id === state.deployProvider ? 'active' : ''}" data-provider="${provider.id}" data-kind="backend">
      <strong>${provider.name}</strong>
      <p>${provider.summary}</p>
    </article>
  `).join('');

  els.mobileProviderGrid.innerHTML = mobile.map(provider => `
    <article class="provider-card ${provider.id === state.mobileProvider ? 'active' : ''}" data-provider="${provider.id}" data-kind="mobile">
      <strong>${provider.name}</strong>
      <p>${provider.summary}</p>
    </article>
  `).join('');

  document.querySelectorAll('.provider-card').forEach(card => card.addEventListener('click', () => {
    if (card.dataset.kind === 'backend') {
      state.deployProvider = card.dataset.provider;
      fillSavedDeployConfig();
      buildDeployPayload();
      renderProviders();
      addActivity(`Backend provider selected: ${state.deployProvider}`);
    } else {
      state.mobileProvider = card.dataset.provider;
      fillSavedBuildConfig();
      buildMobilePayload();
      renderProviders();
      addActivity(`Mobile provider selected: ${state.mobileProvider}`);
    }
    saveState();
  }));

  fillSavedDeployConfig(false);
  fillSavedBuildConfig(false);
  buildDeployPayload();
  buildMobilePayload();
}

function getProvider(kind, id) {
  const list = state.providerCatalog[kind] || [];
  return list.find(item => item.id === id);
}

function fillSavedDeployConfig(updateInputs = true) {
  const saved = state.savedConfigs.backend[state.deployProvider] || {};
  const provider = getProvider('backend', state.deployProvider) || { name: 'Provider' };
  els.backendProviderTitle.textContent = `${provider.name} config`;
  els.backendProviderBadge.textContent = state.deployProvider;
  els.providerHint.textContent = provider.hint || 'Selected provider ke hisaab se request payload niche banega.';
  if (!updateInputs) return;
  els.deployRepo.value = saved.repo || '';
  els.deployBranch.value = saved.branch || 'main';
  els.deployService.value = saved.service || '';
  els.deployRootDir.value = saved.rootDir || '';
  els.deployRegion.value = saved.region || '';
  els.deployBuild.value = saved.build || '';
  els.deployStart.value = saved.start || '';
  els.deployEnv.value = saved.env || '';
}

function fillSavedBuildConfig(updateInputs = true) {
  const saved = state.savedConfigs.mobile[state.mobileProvider] || {};
  const provider = getProvider('mobile', state.mobileProvider) || { name: 'Provider' };
  els.mobileProviderTitle.textContent = `${provider.name} workflow`;
  els.mobileProviderBadge.textContent = state.mobileProvider;
  els.buildHint.textContent = provider.hint || 'Build payload helper ready.';
  if (!updateInputs) return;
  els.buildAppId.value = saved.appId || '';
  els.buildWorkflowId.value = saved.workflowId || '';
  els.buildBranch.value = saved.branch || 'main';
  els.buildPlatform.value = saved.platform || 'android';
  els.buildEnv.value = saved.env || '';
}

function setZip(file) {
  if (!file.name.toLowerCase().endsWith('.zip')) {
    toast('Sirf ZIP file select karo', 'err');
    return;
  }
  state.zipFile = file;
  state.zipMeta = { name: file.name, size: file.size };
  state.files = [];
  state.deletedFiles = {};
  state.strippedFolders = {};
  els.zipName.textContent = file.name;
  els.zipCount.textContent = '0';
  els.zipSize.textContent = formatBytes(file.size);
  renderTree();
  renderWorkspaceChecks();
  saveState();
  addActivity(`ZIP selected: ${file.name}`);
}

async function extractZip() {
  if (!state.zipFile) {
    toast('Pehle ZIP select karo', 'err');
    return;
  }
  toggleBusy(els.extractBtn, true, 'Extracting...');
  try {
    const zip = await JSZip.loadAsync(state.zipFile);
    const entries = [];
    const tasks = [];
    Object.keys(zip.files).forEach(path => {
      const item = zip.files[path];
      if (!item.dir) {
        tasks.push(item.async('blob').then(blob => entries.push({ path, blob, size: blob.size })));
      }
    });
    await Promise.all(tasks);
    state.files = entries.sort((a, b) => a.path.localeCompare(b.path));
    els.zipCount.textContent = String(entries.length);
    renderTree();
    renderWorkspaceChecks();
    updatePushSummary();
    updateStats();
    saveState();
    addActivity(`ZIP extracted: ${entries.length} files ready`);
    toast(`${entries.length} files extract ho gayi`, 'ok');
  } catch (err) {
    toast(err.message || 'ZIP extract fail hua', 'err');
  } finally {
    toggleBusy(els.extractBtn, false, 'Extract ZIP');
  }
}

function buildTree(files) {
  const root = {};
  files.forEach(file => {
    const parts = file.path.replace(/\\/g, '/').split('/');
    let cursor = root;
    parts.forEach((part, idx) => {
      if (!cursor[part]) cursor[part] = { name: part, path: '', isFile: false, children: {} };
      if (idx === parts.length - 1) {
        cursor[part].isFile = true;
        cursor[part].path = file.path;
      }
      cursor = cursor[part].children;
    });
  });
  return root;
}

function getVisibleFiles() {
  const query = els.fileSearch.value.trim().toLowerCase();
  return state.files.filter(file => file.path.toLowerCase().includes(query));
}

function renderTree() {
  const visibleFiles = getVisibleFiles();
  if (!state.files.length) {
    els.treePanel.innerHTML = '<div class="empty-state">Pehle ZIP extract karo.</div>';
    els.managerSummary.textContent = 'Pehle ZIP extract karo.';
    return;
  }
  const tree = buildTree(visibleFiles);
  const html = renderNode(tree, '', 0);
  els.treePanel.innerHTML = html || '<div class="empty-state">Search match nahi mila.</div>';
  const activeFiles = getActiveFiles();
  els.managerSummary.textContent = `${activeFiles.length} / ${state.files.length} files push ke liye ready • ${Object.keys(state.deletedFiles).length} deleted • ${Object.keys(state.strippedFolders).length} stripped folders`;
}

function renderNode(node, prefix, depth) {
  return Object.keys(node).sort((a, b) => {
    const na = node[a];
    const nb = node[b];
    if (na.isFile === nb.isFile) return a.localeCompare(b);
    return na.isFile ? 1 : -1;
  }).map(name => {
    const item = node[name];
    const folderPrefix = `${prefix}${name}/`;
    const padding = depth * 18;
    if (item.isFile) {
      const deleted = !!state.deletedFiles[item.path];
      return `
        <div class="tree-row" style="padding-left:${padding + 14}px">
          <span>📄</span>
          <span class="name ${deleted ? 'muted' : ''}">${escapeHtml(name)}</span>
          <button class="action-mini ${deleted ? 'restore' : 'delete'}" data-action="${deleted ? 'restore-file' : 'delete-file'}" data-path="${escapeHtml(item.path)}">${deleted ? 'Restore' : 'Delete'}</button>
        </div>
      `;
    }
    const stripped = !!state.strippedFolders[folderPrefix];
    const nodeId = makeId(folderPrefix);
    return `
      <div class="tree-row" style="padding-left:${padding + 14}px">
        <span class="toggle-folder" data-action="toggle-folder" data-node="${nodeId}">▶</span>
        <span>📁</span>
        <span class="name folder ${stripped ? 'muted' : ''}">${escapeHtml(name)}</span>
        <button class="action-mini ${stripped ? 'restore' : 'strip'}" data-action="${stripped ? 'restore-folder' : 'strip-folder'}" data-prefix="${escapeHtml(folderPrefix)}">${stripped ? 'Restore' : 'Strip folder'}</button>
      </div>
      <div id="${nodeId}" style="display:none">${renderNode(item.children, folderPrefix, depth + 1)}</div>
    `;
  }).join('');
}

function handleTreeClick(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  if (action === 'toggle-folder') {
    const target = document.getElementById(btn.dataset.node);
    const open = target.style.display === 'block';
    target.style.display = open ? 'none' : 'block';
    btn.textContent = open ? '▶' : '▼';
    return;
  }
  if (action === 'delete-file') state.deletedFiles[btn.dataset.path] = true;
  if (action === 'restore-file') delete state.deletedFiles[btn.dataset.path];
  if (action === 'strip-folder') state.strippedFolders[btn.dataset.prefix] = true;
  if (action === 'restore-folder') delete state.strippedFolders[btn.dataset.prefix];
  saveState();
  renderTree();
  updatePushSummary();
}

function toggleAllFolders(open) {
  els.treePanel.querySelectorAll('[id^="node_"]').forEach(node => node.style.display = open ? 'block' : 'none');
  els.treePanel.querySelectorAll('[data-action="toggle-folder"]').forEach(btn => btn.textContent = open ? '▼' : '▶');
}

function getActiveFiles() {
  return state.files.reduce((acc, file) => {
    if (state.deletedFiles[file.path]) return acc;
    let newPath = file.path;
    Object.keys(state.strippedFolders).forEach(prefix => {
      if (file.path.startsWith(prefix)) newPath = file.path.slice(prefix.length) || file.path.split('/').slice(-1)[0];
    });
    if (!newPath) return acc;
    acc.push({ path: newPath, blob: file.blob, size: file.size });
    return acc;
  }, []);
}

function renderWorkspaceChecks() {
  const active = getActiveFiles();
  const paths = active.map(item => item.path.toLowerCase());
  const checks = [
    {
      label: 'Frontend entry',
      icon: '🌐',
      ok: paths.some(p => p.endsWith('index.html') || p.endsWith('main.dart') || p.endsWith('app.js')),
      text: 'index.html / main.dart / app.js jaisa entry file'
    },
    {
      label: 'Backend config',
      icon: '🧠',
      ok: paths.some(p => p.endsWith('package.json') || p.endsWith('requirements.txt') || p.endsWith('dockerfile') || p.endsWith('pom.xml')),
      text: 'package.json / requirements.txt / Dockerfile etc.'
    },
    {
      label: 'Mobile hints',
      icon: '📱',
      ok: paths.some(p => p.includes('android/') || p.endsWith('pubspec.yaml') || p.endsWith('build.gradle')),
      text: 'Android/Flutter files detect hue ya nahi'
    },
    {
      label: 'README/docs',
      icon: '📘',
      ok: paths.some(p => p.endsWith('readme.md')),
      text: 'README present ho to deployment easy hota hai'
    }
  ];
  els.workspaceChecks.innerHTML = checks.map(item => `
    <div class="check-item ${item.ok ? 'good' : 'warn'}">
      <span>${item.icon}</span>
      <div><strong>${item.label}</strong><small>${item.ok ? 'Ready' : 'Missing'} • ${item.text}</small></div>
    </div>
  `).join('');
}

async function loadRepos() {
  const token = els.ghToken.value.trim();
  if (!token) return toast('GitHub token enter karo', 'err');
  state.tokens.gh = token;
  saveState();
  toggleBusy(els.loadReposBtn, true, 'Loading...');
  try {
    let page = 1;
    let all = [];
    while (true) {
      const res = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Token invalid ya access deny');
      const chunk = await res.json();
      if (!Array.isArray(chunk) || !chunk.length) break;
      all = all.concat(chunk);
      page += 1;
      if (chunk.length < 100) break;
    }
    state.repos = all.map(repo => ({ name: repo.name, full: repo.full_name, private: repo.private, defaultBranch: repo.default_branch || 'main' }));
    state.cleanup.repos = state.repos.slice();
    saveState();
    renderRepos();
    renderCleanupRepos();
    updateStats();
    addActivity(`GitHub repos loaded: ${state.repos.length}`);
    toast(`${state.repos.length} repos load ho gaye`, 'ok');
  } catch (err) {
    toast(err.message || 'Repos load fail hua', 'err');
  } finally {
    toggleBusy(els.loadReposBtn, false, 'Load repos');
  }
}

function renderRepos() {
  const query = els.repoSearch.value.trim().toLowerCase();
  const list = state.repos.filter(repo => !query || repo.full.toLowerCase().includes(query) || repo.name.toLowerCase().includes(query));
  if (!list.length) {
    els.repoList.innerHTML = '<div class="empty-state">Koi repo nahi. Load repos dabao.</div>';
  } else {
    els.repoList.innerHTML = list.map(repo => `
      <label class="repo-item">
        <input type="checkbox" data-repo="${repo.full}" ${state.selectedRepos[repo.full] ? 'checked' : ''}>
        <div class="repo-meta">
          <strong>${escapeHtml(repo.name)}</strong>
          <small>${escapeHtml(repo.full)} • default: ${escapeHtml(repo.defaultBranch)}</small>
        </div>
        <span class="badge ${repo.private ? 'priv' : 'pub'}">${repo.private ? 'private' : 'public'}</span>
      </label>
    `).join('');
    els.repoList.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.addEventListener('change', () => {
      if (chk.checked) state.selectedRepos[chk.dataset.repo] = true;
      else delete state.selectedRepos[chk.dataset.repo];
      saveState();
      updatePushSummary();
      renderRepos();
    }));
  }
  els.repoCountLabel.textContent = `${Object.keys(state.selectedRepos).length} selected`;
  updatePushSummary();
}

function selectAllRepos(flag) {
  if (flag) state.repos.forEach(repo => state.selectedRepos[repo.full] = true);
  else state.selectedRepos = {};
  saveState();
  renderRepos();
}

async function createRepo() {
  const token = els.ghToken.value.trim();
  const name = els.newRepoName.value.trim();
  if (!token || !name) return toast('Token aur repo name chahiye', 'err');
  toggleBusy(els.createRepoBtn, true, 'Creating...');
  try {
    const res = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: els.newRepoDesc.value.trim(),
        private: els.newRepoPrivate.checked,
        auto_init: false
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Repo create fail hua');
    state.repos.unshift({ name: data.name, full: data.full_name, private: data.private, defaultBranch: data.default_branch || 'main' });
    state.selectedRepos[data.full_name] = true;
    saveState();
    renderRepos();
    toast(`Repo create ho gaya: ${data.full_name}`, 'ok');
    addActivity(`New repo created: ${data.full_name}`);
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    toggleBusy(els.createRepoBtn, false, 'Create repo');
  }
}

function updatePushSummary() {
  const active = getActiveFiles();
  const selected = Object.keys(state.selectedRepos).length;
  const deleted = Object.keys(state.deletedFiles).length;
  const stripped = Object.keys(state.strippedFolders).length;
  els.pushSummary.textContent = `${active.length} files ready • ${selected} repos selected • ${deleted} deleted • ${stripped} stripped folders`;
  els.pushBtn.disabled = !(els.ghToken.value.trim() && active.length && selected);
  updateStats();
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function pushToRepos() {
  const token = els.ghToken.value.trim();
  const branch = els.branchName.value.trim() || 'main';
  const message = els.commitMsg.value.trim() || 'Add files from ZIP';
  const strategy = document.getElementById('pushStrategy').value;
  const repos = Object.keys(state.selectedRepos);
  const files = getActiveFiles();
  if (!token || !repos.length || !files.length) return;

  toggleBusy(els.pushBtn, true, 'Pushing...');
  els.pushProgressWrap.classList.remove('hidden');
  let done = 0;
  const total = repos.length * files.length;

  try {
    for (const fullName of repos) {
      const [owner, repo] = fullName.split('/');
      for (const file of files) {
        const pathUrl = file.path.split('/').map(encodeURIComponent).join('/');
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${pathUrl}`;
        const content = await blobToBase64(file.blob);
        let sha = null;
        const existing = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (existing.ok) {
          const found = await existing.json();
          sha = found.sha;
          if (strategy === 'safe') {
            done += 1;
            updateProgress(els.pushProgressBar, els.pushProgressLabel, done, total, `${fullName} • skip existing ${file.path}`);
            continue;
          }
        }
        const body = { message, content, branch };
        if (sha) body.sha = sha;
        const res = await fetch(url, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.message || `Push failed: ${file.path}`);
        }
        done += 1;
        updateProgress(els.pushProgressBar, els.pushProgressLabel, done, total, `${fullName} • ${file.path}`);
      }
    }
    toast('Push complete', 'ok');
    addActivity(`Push complete: ${repos.length} repos, ${files.length} files`);
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    toggleBusy(els.pushBtn, false, 'Push to selected repos');
    saveState();
  }
}

function copyPushSummary() {
  const lines = [
    `Mode: ${state.mode}`,
    `ZIP: ${state.zipMeta.name || '-'}`,
    `Active files: ${getActiveFiles().length}`,
    `Repos: ${Object.keys(state.selectedRepos).join(', ') || '-'}`,
    `Branch: ${els.branchName.value.trim() || 'main'}`,
    `Commit: ${els.commitMsg.value.trim() || 'Add files from ZIP'}`
  ].join('\n');
  copyText(lines, 'Push summary copied');
}

function buildDeployPayload() {
  const provider = getProvider('backend', state.deployProvider) || {};
  const env = parseEnvText(els.deployEnv.value);
  const payload = {
    provider: state.deployProvider,
    endpoint: provider.apiEndpoint || '',
    action: provider.action || 'validate_or_prepare',
    repo: els.deployRepo.value.trim(),
    branch: els.deployBranch.value.trim() || 'main',
    serviceName: els.deployService.value.trim(),
    rootDir: els.deployRootDir.value.trim(),
    region: els.deployRegion.value.trim(),
    buildCommand: els.deployBuild.value.trim(),
    startCommand: els.deployStart.value.trim(),
    env
  };

  if (state.deployProvider === 'railway') {
    payload.graphql = {
      query: provider.sampleQuery,
      variables: {
        projectName: els.deployService.value.trim() || 'zip-deploy-project',
        repo: els.deployRepo.value.trim(),
        branch: els.deployBranch.value.trim() || 'main'
      }
    };
  }

  if (state.deployProvider === 'render') {
    payload.requestBody = {
      name: els.deployService.value.trim(),
      rootDir: els.deployRootDir.value.trim(),
      buildCommand: els.deployBuild.value.trim(),
      startCommand: els.deployStart.value.trim(),
      region: els.deployRegion.value.trim(),
      repo: els.deployRepo.value.trim(),
      branch: els.deployBranch.value.trim() || 'main'
    };
  }

  els.deployPayload.value = JSON.stringify(payload, null, 2);
  state.tokens.deploy = els.deployToken.value.trim();
  saveState();
}

function saveDeployConfig() {
  state.savedConfigs.backend[state.deployProvider] = {
    repo: els.deployRepo.value.trim(),
    branch: els.deployBranch.value.trim(),
    service: els.deployService.value.trim(),
    rootDir: els.deployRootDir.value.trim(),
    region: els.deployRegion.value.trim(),
    build: els.deployBuild.value.trim(),
    start: els.deployStart.value.trim(),
    env: els.deployEnv.value
  };
  state.tokens.deploy = els.deployToken.value.trim();
  saveState();
  toast('Deploy config save ho gaya', 'ok');
  addActivity(`Deploy config saved for ${state.deployProvider}`);
}

function openProviderDocs() {
  const provider = getProvider('backend', state.deployProvider);
  if (!provider?.docs) return;
  window.open(provider.docs, '_blank');
}

function copyDeployCurl() {
  const provider = getProvider('backend', state.deployProvider) || {};
  const token = els.deployToken.value.trim() || '<TOKEN>';
  let curl = '';
  if (state.deployProvider === 'railway') {
    curl = `curl -X POST ${provider.apiEndpoint} \\\n  -H "Authorization: Bearer ${token}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(JSON.parse(els.deployPayload.value).graphql || {}, null, 2)}'`;
  } else {
    curl = `curl -X GET ${provider.apiEndpoint || provider.docs || '<endpoint>'} \\\n  -H "Authorization: Bearer ${token}"`;
  }
  copyText(curl, 'Deploy curl copied');
}

async function attemptProviderAction() {
  const provider = getProvider('backend', state.deployProvider) || {};
  const token = els.deployToken.value.trim();
  if (!token) return toast('Provider token enter karo', 'err');
  state.tokens.deploy = token;
  saveState();
  toggleBusy(els.attemptProviderBtn, true, 'Running...');

  try {
    let result;
    if (state.deployProvider === 'render') {
      result = await fetch(provider.apiEndpoint, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json());
      const first = Array.isArray(result) ? result[0] : null;
      const url = first?.service?.serviceDetails?.url || first?.serviceDetails?.url || first?.url || '';
      state.deployHistory.unshift({
        provider: provider.name,
        title: first?.service?.name || first?.name || els.deployService.value.trim() || 'Render action',
        url,
        status: 'API response received',
        meta: new Date().toLocaleString(),
        raw: JSON.stringify(result).slice(0, 800)
      });
    } else if (state.deployProvider === 'railway') {
      const body = {
        query: provider.sampleQuery,
        variables: { }
      };
      result = await fetch(provider.apiEndpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(r => r.json());
      state.deployHistory.unshift({
        provider: provider.name,
        title: els.deployService.value.trim() || 'Railway resources',
        url: '',
        status: 'GraphQL response received',
        meta: new Date().toLocaleString(),
        raw: JSON.stringify(result).slice(0, 800)
      });
    } else {
      const payload = JSON.parse(els.deployPayload.value || '{}');
      state.deployHistory.unshift({
        provider: provider.name,
        title: payload.serviceName || payload.repo || provider.name,
        url: '',
        status: 'Payload prepared (manual submit recommended)',
        meta: new Date().toLocaleString(),
        raw: JSON.stringify(payload).slice(0, 800)
      });
      result = payload;
    }
    state.deployHistory = state.deployHistory.slice(0, 24);
    saveState();
    renderDeployHistory();
    updateStats();
    addActivity(`Backend action executed for ${provider.name}`);
    toast(`${provider.name} action complete`, 'ok');
  } catch (err) {
    toast(err.message || 'Provider action fail hui', 'err');
    addActivity(`Backend action failed for ${provider.name}`);
  } finally {
    toggleBusy(els.attemptProviderBtn, false, 'Attempt live action');
  }
}

function addManualDeployUrl() {
  const url = els.manualDeployUrl.value.trim();
  if (!url) return;
  state.deployHistory.unshift({
    provider: getProvider('backend', state.deployProvider)?.name || state.deployProvider,
    title: els.deployService.value.trim() || 'Manual URL',
    url,
    status: 'Manual done URL',
    meta: new Date().toLocaleString(),
    raw: ''
  });
  state.deployHistory = state.deployHistory.slice(0, 24);
  els.manualDeployUrl.value = '';
  saveState();
  renderDeployHistory();
  updateStats();
  addActivity(`Manual deploy URL added: ${url}`);
}

function renderDeployHistory() {
  if (!state.deployHistory.length) {
    els.deployHistory.innerHTML = '<div class="empty-state">Abhi koi deploy history nahi.</div>';
    return;
  }
  els.deployHistory.innerHTML = state.deployHistory.map((item, idx) => `
    <article class="history-card">
      <h4>${escapeHtml(item.provider)} • ${escapeHtml(item.title)}</h4>
      <p><strong>Status:</strong> ${escapeHtml(item.status)}</p>
      <p><strong>Time:</strong> ${escapeHtml(item.meta)}</p>
      ${item.url ? `<p><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></p>` : '<p>No URL yet</p>'}
      ${item.raw ? `<details><summary>Response</summary><pre>${escapeHtml(item.raw)}</pre></details>` : ''}
      <div class="button-row top-gap"><button class="ghost-btn" onclick="removeDeployHistory(${idx})">Remove</button></div>
    </article>
  `).join('');
}
window.removeDeployHistory = function(idx) {
  state.deployHistory.splice(idx, 1);
  saveState();
  renderDeployHistory();
  updateStats();
};

function buildMobilePayload() {
  const provider = getProvider('mobile', state.mobileProvider) || {};
  const env = parseEnvText(els.buildEnv.value);
  const payload = {
    provider: state.mobileProvider,
    endpoint: provider.apiEndpoint || '',
    appId: els.buildAppId.value.trim(),
    workflowId: els.buildWorkflowId.value.trim(),
    branch: els.buildBranch.value.trim() || 'main',
    platform: els.buildPlatform.value.trim() || 'android',
    env
  };

  if (state.mobileProvider === 'codemagic') {
    payload.requestBody = {
      appId: els.buildAppId.value.trim(),
      workflowId: els.buildWorkflowId.value.trim(),
      branch: els.buildBranch.value.trim() || 'main',
      environment: { variables: env }
    };
  }

  els.buildPayload.value = JSON.stringify(payload, null, 2);
  state.tokens.build = els.buildToken.value.trim();
  state.savedConfigs.mobile[state.mobileProvider] = {
    appId: els.buildAppId.value.trim(),
    workflowId: els.buildWorkflowId.value.trim(),
    branch: els.buildBranch.value.trim(),
    platform: els.buildPlatform.value.trim(),
    env: els.buildEnv.value
  };
  saveState();
}

async function triggerBuildAction() {
  buildMobilePayload();
  const provider = getProvider('mobile', state.mobileProvider) || {};
  const token = els.buildToken.value.trim();
  if (!token) return toast('Build provider token enter karo', 'err');
  toggleBusy(els.triggerBuildBtn, true, 'Triggering...');
  try {
    let result;
    if (state.mobileProvider === 'codemagic') {
      const payload = JSON.parse(els.buildPayload.value).requestBody;
      const res = await fetch(provider.apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify(payload)
      });
      result = await res.json();
      if (!res.ok) throw new Error(result.message || 'Build trigger fail hua');
      state.artifacts.unshift({
        provider: provider.name,
        title: `${payload.appId || 'app'} • ${payload.workflowId || 'workflow'}`,
        url: result.buildId ? `Build ID: ${result.buildId}` : '',
        status: 'Build triggered',
        time: new Date().toLocaleString(),
        raw: JSON.stringify(result)
      });
    } else {
      const payload = JSON.parse(els.buildPayload.value);
      state.artifacts.unshift({
        provider: provider.name,
        title: payload.appId || provider.name,
        url: '',
        status: 'Payload prepared',
        time: new Date().toLocaleString(),
        raw: JSON.stringify(payload)
      });
      result = payload;
    }
    state.artifacts = state.artifacts.slice(0, 24);
    saveState();
    renderArtifacts();
    updateStats();
    addActivity(`Build action executed for ${provider.name}`);
    toast(`${provider.name} build action complete`, 'ok');
  } catch (err) {
    toast(err.message || 'Build action fail hui', 'err');
  } finally {
    toggleBusy(els.triggerBuildBtn, false, 'Trigger build');
  }
}

function copyBuildCurl() {
  const provider = getProvider('mobile', state.mobileProvider) || {};
  const token = els.buildToken.value.trim() || '<TOKEN>';
  let curl = `curl -X POST ${provider.apiEndpoint || '<endpoint>'} \\\n  -H "Content-Type: application/json" \\\n  -d '${els.buildPayload.value.replace(/'/g, "'\\''")}'`;
  if (state.mobileProvider === 'codemagic') {
    curl = `curl -X POST ${provider.apiEndpoint} \\\n  -H "Content-Type: application/json" \\\n  -H "x-auth-token: ${token}" \\\n  -d '${JSON.stringify(JSON.parse(els.buildPayload.value).requestBody || {}, null, 2)}'`;
  }
  copyText(curl, 'Build curl copied');
}

function addManualArtifact() {
  const url = els.manualArtifactUrl.value.trim();
  if (!url) return;
  state.artifacts.unshift({
    provider: getProvider('mobile', state.mobileProvider)?.name || state.mobileProvider,
    title: `${state.mobileProvider} artifact`,
    url,
    status: 'Manual artifact URL',
    time: new Date().toLocaleString(),
    raw: ''
  });
  state.artifacts = state.artifacts.slice(0, 24);
  els.manualArtifactUrl.value = '';
  saveState();
  renderArtifacts();
  updateStats();
  addActivity(`Artifact added: ${url}`);
}

function renderArtifacts() {
  if (!state.artifacts.length) {
    els.artifactGrid.innerHTML = '<div class="empty-state">APK / artifact links abhi empty hain.</div>';
    return;
  }
  els.artifactGrid.innerHTML = state.artifacts.map((item, idx) => `
    <article class="artifact-card">
      <h4>${escapeHtml(item.provider)} • ${escapeHtml(item.title)}</h4>
      <p><strong>Status:</strong> ${escapeHtml(item.status)}</p>
      <p><strong>Time:</strong> ${escapeHtml(item.time)}</p>
      ${item.url && item.url.startsWith('http') ? `<p><a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.url)}</a></p>` : `<p>${escapeHtml(item.url || 'No artifact URL yet')}</p>`}
      ${item.raw ? `<details><summary>Payload / response</summary><pre>${escapeHtml(item.raw)}</pre></details>` : ''}
      <div class="button-row top-gap"><button class="ghost-btn" onclick="removeArtifact(${idx})">Remove</button></div>
    </article>
  `).join('');
}
window.removeArtifact = function(idx) {
  state.artifacts.splice(idx, 1);
  saveState();
  renderArtifacts();
  updateStats();
};

async function loadCleanupRepos() {
  const token = els.cleanupToken.value.trim();
  if (!token) return toast('Cleanup token enter karo', 'err');
  if (!state.repos.length) {
    await loadRepos();
  }
  state.cleanup.repos = state.repos.slice();
  saveState();
  renderCleanupRepos();
  addActivity('Cleanup repo list ready');
}

function renderCleanupRepos() {
  const query = els.cleanupRepoSearch.value.trim().toLowerCase();
  const list = (state.cleanup.repos || []).filter(repo => !query || repo.full.toLowerCase().includes(query));
  if (!list.length) {
    els.cleanupRepoList.innerHTML = '<div class="empty-state">Load repos for cleanup.</div>';
    return;
  }
  els.cleanupRepoList.innerHTML = list.map(repo => `
    <button class="repo-item" style="width:100%;background:${state.cleanup.selectedRepo === repo.full ? 'rgba(255,122,122,0.08)' : 'transparent'};border:none" data-clean-repo="${repo.full}">
      <div class="repo-meta">
        <strong>${escapeHtml(repo.name)}</strong>
        <small>${escapeHtml(repo.full)}</small>
      </div>
      <span class="badge ${repo.private ? 'priv' : 'pub'}">${repo.private ? 'private' : 'public'}</span>
    </button>
  `).join('');
  els.cleanupRepoList.querySelectorAll('[data-clean-repo]').forEach(btn => btn.addEventListener('click', () => {
    state.cleanup.selectedRepo = btn.dataset.cleanRepo;
    els.cleanupRepoLabel.textContent = `Selected: ${state.cleanup.selectedRepo}`;
    saveState();
    renderCleanupRepos();
  }));
  els.cleanupRepoLabel.textContent = state.cleanup.selectedRepo ? `Selected: ${state.cleanup.selectedRepo}` : 'Koi repo select nahi';
}

async function loadRemoteTree() {
  const token = els.cleanupToken.value.trim();
  const branch = els.cleanupBranch.value.trim() || 'main';
  const full = state.cleanup.selectedRepo;
  if (!token || !full) return toast('Cleanup token aur repo select karo', 'err');
  const [owner, repo] = full.split('/');
  state.cleanup.remoteItems = [];
  state.cleanup.selectedRemote = {};
  toggleBusy(els.loadRemoteBtn, true, 'Loading...');
  try {
    async function walk(path) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Branch ya repo access issue');
      const data = await res.json();
      for (const item of data) {
        if (item.type === 'file') state.cleanup.remoteItems.push({ path: item.path, sha: item.sha });
        if (item.type === 'dir') await walk(item.path);
      }
    }
    await walk('');
    saveState();
    renderRemoteTree();
    addActivity(`Remote tree loaded: ${state.cleanup.remoteItems.length} files`);
    toast('Remote files load ho gayi', 'ok');
  } catch (err) {
    toast(err.message || 'Remote tree load fail hua', 'err');
  } finally {
    toggleBusy(els.loadRemoteBtn, false, 'Load remote files');
  }
}

function renderRemoteTree() {
  const list = state.cleanup.remoteItems || [];
  if (!list.length) {
    els.remoteTree.innerHTML = '<div class="empty-state">Remote files load karo.</div>';
    els.cleanupSummary.textContent = 'Remote files load karo.';
    els.deleteRemoteBtn.disabled = true;
    return;
  }
  els.remoteTree.innerHTML = list.map(item => `
    <div class="remote-row">
      <input type="checkbox" data-remote="${item.path}" ${state.cleanup.selectedRemote[item.path] ? 'checked' : ''}>
      <span>📄</span>
      <span class="name ${state.cleanup.selectedRemote[item.path] ? 'muted' : ''}">${escapeHtml(item.path)}</span>
    </div>
  `).join('');
  els.remoteTree.querySelectorAll('input[data-remote]').forEach(chk => chk.addEventListener('change', () => {
    if (chk.checked) {
      const item = list.find(x => x.path === chk.dataset.remote);
      state.cleanup.selectedRemote[item.path] = item.sha;
    } else delete state.cleanup.selectedRemote[chk.dataset.remote];
    saveState();
    renderRemoteTree();
  }));
  const count = Object.keys(state.cleanup.selectedRemote).length;
  els.cleanupSummary.textContent = `${list.length} remote files • ${count} selected for delete`;
  els.deleteRemoteBtn.disabled = !count;
}

function handleRemoteClick() {}

function selectAllRemote(flag) {
  state.cleanup.selectedRemote = {};
  if (flag) state.cleanup.remoteItems.forEach(item => state.cleanup.selectedRemote[item.path] = item.sha);
  saveState();
  renderRemoteTree();
}

async function deleteSelectedRemote() {
  const token = els.cleanupToken.value.trim();
  const branch = els.cleanupBranch.value.trim() || 'main';
  const message = els.cleanupCommitMsg.value.trim() || 'Delete files via ZIPPilot Pro';
  const full = state.cleanup.selectedRepo;
  const selected = Object.keys(state.cleanup.selectedRemote);
  if (!selected.length || !full) return;
  if (!confirm(`${selected.length} files delete hongi. Continue?`)) return;
  const [owner, repo] = full.split('/');
  toggleBusy(els.deleteRemoteBtn, true, 'Deleting...');
  els.cleanupProgressWrap.classList.remove('hidden');
  let done = 0;
  try {
    for (const path of selected) {
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sha: state.cleanup.selectedRemote[path], branch })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Delete fail: ${path}`);
      }
      done += 1;
      updateProgress(els.cleanupProgressBar, els.cleanupProgressLabel, done, selected.length, `Deleting ${path}`);
    }
    toast('Remote delete complete', 'ok');
    addActivity(`Remote cleanup complete: ${done} files deleted`);
    await loadRemoteTree();
  } catch (err) {
    toast(err.message || 'Delete fail hua', 'err');
  } finally {
    toggleBusy(els.deleteRemoteBtn, false, 'Delete selected');
  }
}

function renderTemplatePicker() {
  if (!state.templateLibrary.length) {
    els.templatePicker.innerHTML = '<option>No templates</option>';
    return;
  }
  els.templatePicker.innerHTML = state.templateLibrary.map((tpl, idx) => `<option value="${idx}">${tpl.name}</option>`).join('');
  renderTemplateBox();
}

function renderTemplateBox() {
  const item = state.templateLibrary[Number(els.templatePicker.value) || 0];
  if (!item) {
    els.templateBox.value = '';
    return;
  }
  els.templateBox.value = item.content;
}

function exportWorkspace() {
  const payload = {
    mode: state.mode,
    zipMeta: state.zipMeta,
    selectedRepos: state.selectedRepos,
    deployProvider: state.deployProvider,
    mobileProvider: state.mobileProvider,
    deployHistory: state.deployHistory,
    artifacts: state.artifacts,
    savedConfigs: state.savedConfigs,
    tokens: state.tokens,
    exportedAt: new Date().toISOString()
  };
  downloadText('zippilot-workspace.json', JSON.stringify(payload, null, 2));
  addActivity('Workspace exported');
}

async function importWorkspace(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    Object.assign(state, {
      mode: data.mode || state.mode,
      zipMeta: data.zipMeta || state.zipMeta,
      selectedRepos: data.selectedRepos || {},
      deployProvider: data.deployProvider || state.deployProvider,
      mobileProvider: data.mobileProvider || state.mobileProvider,
      deployHistory: data.deployHistory || [],
      artifacts: data.artifacts || [],
      savedConfigs: data.savedConfigs || { backend: {}, mobile: {} },
      tokens: data.tokens || state.tokens
    });
    hydrateFieldsFromState();
    saveState();
    renderAll();
    toast('Workspace import ho gaya', 'ok');
    addActivity('Workspace imported');
  } catch (err) {
    toast('Import JSON invalid hai', 'err');
  }
  e.target.value = '';
}

function hydrateFieldsFromState() {
  els.ghToken.value = state.tokens.gh || '';
  els.cleanupToken.value = state.tokens.cleanup || '';
  els.deployToken.value = state.tokens.deploy || '';
  els.buildToken.value = state.tokens.build || '';
}

function resetWorkspace() {
  if (!confirm('Local state reset karni hai?')) return;
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

function renderActivity() {
  if (!state.activity.length) {
    els.activityLog.innerHTML = '<div class="empty-state">Abhi koi activity nahi.</div>';
    return;
  }
  els.activityLog.innerHTML = state.activity.map(item => `
    <div class="activity-item">
      <time>${escapeHtml(item.time)}</time>
      <div>${escapeHtml(item.text)}</div>
    </div>
  `).join('');
}

function addActivity(text) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  state.activity.unshift({ time, text });
  state.activity = state.activity.slice(0, 60);
  saveState();
  renderActivity();
}

function updateStats() {
  els.statFiles.textContent = String(getActiveFiles().length || state.files.length || 0);
  els.statRepos.textContent = String(Object.keys(state.selectedRepos).length || 0);
  els.statDeploys.textContent = String(state.deployHistory.length || 0);
  els.statBuilds.textContent = String(state.artifacts.length || 0);
}

function parseEnvText(text) {
  return text.split(/\n+/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('=')) return acc;
    const idx = trimmed.indexOf('=');
    acc[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    return acc;
  }, {});
}

function copyText(text, successMsg = 'Copied') {
  navigator.clipboard.writeText(text).then(() => toast(successMsg, 'ok')).catch(() => toast('Copy fail hua', 'err'));
}

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type === 'ok' ? 'ok' : type === 'err' ? 'err' : 'info'}`;
  el.textContent = message;
  document.getElementById('toastWrap').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

function toggleBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.label || button.textContent;
  }
}

function updateProgress(bar, label, done, total, text) {
  const pct = Math.round((done / total) * 100);
  bar.style.width = `${pct}%`;
  label.textContent = `${text} • ${done}/${total} (${pct}%)`;
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const units = ['B','KB','MB','GB'];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value > 9 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function makeId(value) {
  return `node_${btoa(unescape(encodeURIComponent(value))).replace(/=/g, '')}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
