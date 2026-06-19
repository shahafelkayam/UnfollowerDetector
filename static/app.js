/* ============================================
   UnfollowerDetector — App v2
   ============================================ */

// ---- State ----
const state = {
    hasFiles: false,
    counts: { following: 0, followers: 0, unfollowers: 0, whitelisted: 0, inactive: 0 },
    unfollowers: [],
    whitelisted: [],
    inactive: [],
    activeTab: 'unfollowers',
    searchQuery: ''
};

// ---- DOM ----
function $(id) { return document.getElementById(id); }

const dom = {};

function cacheDom() {
    dom.pageWelcome = $('page-welcome');
    dom.pageDashboard = $('page-dashboard');

    dom.choiceContinue = $('choice-continue');
    dom.choiceUpload = $('choice-upload');
    dom.btnContinue = $('btn-continue');
    dom.btnShowUpload = $('btn-show-upload');
    dom.uploadSection = $('upload-section');

    dom.dropZone = $('drop-zone');
    dom.inputZip = $('input-zip');
    dom.inputFolder = $('input-folder');
    dom.inputJson = $('input-json');
    dom.uploadProgress = $('upload-progress');
    dom.progressBarFill = $('progress-bar-fill');
    dom.progressText = $('progress-text');

    dom.btnBack = $('btn-back');
    dom.clearBtn = $('clear-btn');

    dom.countFollowing = $('count-following');
    dom.countFollowers = $('count-followers');
    dom.countUnfollowers = $('count-unfollowers');
    dom.countWhitelisted = $('count-whitelisted');
    dom.countInactive = $('count-inactive');
    dom.countUnfollowed = $('count-unfollowed');

    dom.badgeUnfollowers = $('badge-unfollowers');
    dom.badgeWhitelisted = $('badge-whitelisted');
    dom.badgeInactive = $('badge-inactive');
    dom.badgeUnfollowed = $('badge-unfollowed');

    dom.tabBtns = document.querySelectorAll('.tab');
    dom.searchInput = $('search-input');
    dom.usersGrid = $('users-grid');
    dom.listLoader = $('list-loader');
    dom.emptyState = $('empty-state');
    dom.emptyTitle = $('empty-title');
    dom.emptyDesc = $('empty-desc');

    dom.toastContainer = $('toast-container');
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', async () => {
    cacheDom();
    setupEvents();
    await checkForExistingData();
});

// ---- Routing ----
function showPage(name) {
    dom.pageWelcome.classList.toggle('active', name === 'welcome');
    dom.pageDashboard.classList.toggle('active', name === 'dashboard');
    if (name === 'dashboard') fetchData();
}

// ---- Events ----
function setupEvents() {
    // Welcome page
    dom.btnContinue.addEventListener('click', () => showPage('dashboard'));
    dom.btnShowUpload.addEventListener('click', () => {
        dom.choiceContinue.style.display = 'none';
        dom.choiceUpload.style.display = 'none';
        dom.uploadSection.style.display = 'flex';
    });

    // Dashboard back
    dom.btnBack.addEventListener('click', async () => {
        showPage('welcome');
        await checkForExistingData();
        dom.uploadSection.style.display = 'none';
        dom.choiceUpload.style.display = 'flex';
    });

    // Clear
    dom.clearBtn.addEventListener('click', async () => {
        if (confirm('Clear all uploaded data and start fresh?')) {
            await clearConnections();
            showPage('welcome');
            await checkForExistingData();
            dom.uploadSection.style.display = 'none';
            dom.choiceUpload.style.display = 'flex';
        }
    });

    // Tabs
    dom.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            switchTab(tab);
        });
    });

    // Search
    dom.searchInput.addEventListener('input', e => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        renderList();
    });

    // Drop zone
    dom.dropZone.addEventListener('dragover', e => { e.preventDefault(); dom.dropZone.classList.add('dragover'); });
    dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('dragover'));
    dom.dropZone.addEventListener('drop', async e => {
        e.preventDefault();
        dom.dropZone.classList.remove('dragover');

        // Use DataTransferItem API to detect folders
        const items = e.dataTransfer.items;
        if (items && items.length > 0) {
            const entries = [];
            for (let i = 0; i < items.length; i++) {
                const entry = items[i].webkitGetAsEntry && items[i].webkitGetAsEntry();
                if (entry) entries.push(entry);
            }

            // Check if any entry is a directory
            const hasDirectory = entries.some(e => e.isDirectory);
            if (hasDirectory) {
                // Recursively collect all files from dragged directories
                const allFiles = await collectFilesFromEntries(entries);
                if (allFiles.length > 0) {
                    return handleFolderUploadFromEntries(allFiles);
                } else {
                    showToast('No valid Instagram JSON files found in the dropped folder.', 'error');
                    return;
                }
            }
        }

        // Fallback: regular files
        if (e.dataTransfer.files.length > 0) handleSmartUpload(e.dataTransfer.files);
    });

    // File inputs
    dom.inputZip.addEventListener('change', e => { if (e.target.files.length) handleZipUpload(e.target.files[0]); e.target.value = ''; });
    dom.inputFolder.addEventListener('change', e => { if (e.target.files.length) handleFolderUpload(e.target.files); e.target.value = ''; });
    dom.inputJson.addEventListener('change', e => { if (e.target.files.length) handleJsonUpload(e.target.files); e.target.value = ''; });
}

// ---- Welcome: check for existing data ----
async function checkForExistingData() {
    try {
        const res = await fetch('/api/has-data');
        const data = await res.json();
        if (data.has_data) {
            dom.choiceContinue.style.display = 'flex';
        } else {
            dom.choiceContinue.style.display = 'none';
        }
    } catch {
        dom.choiceContinue.style.display = 'none';
    }
}

// ---- Smart Upload Dispatcher ----
async function handleSmartUpload(files) {
    // If single ZIP
    if (files.length === 1 && files[0].name.toLowerCase().endsWith('.zip')) {
        return handleZipUpload(files[0]);
    }

    // If files have relative paths (folder upload via file input)
    const hasNestedPaths = Array.from(files).some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'));
    if (hasNestedPaths) {
        return handleFolderUpload(files);
    }

    // Otherwise treat as individual JSON files
    const jsonFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.json'));
    const zipFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.zip'));

    if (zipFiles.length > 0) {
        await handleZipUpload(zipFiles[0]);
    }
    if (jsonFiles.length > 0) {
        await handleJsonUpload(jsonFiles);
    }
    if (zipFiles.length === 0 && jsonFiles.length === 0) {
        showToast('No valid files detected. Please upload .zip, .json files, or drag a folder.', 'error');
    }
}

// ---- Recursive directory traversal for drag-and-drop folders ----
function collectFilesFromEntries(entries) {
    return new Promise(async (resolve) => {
        const allFiles = [];

        async function readEntry(entry) {
            if (entry.isFile) {
                const file = await new Promise(res => entry.file(res));
                // Reconstruct the relative path from fullPath (strip leading /)
                file._relativePath = entry.fullPath.replace(/^\//, '');
                allFiles.push(file);
            } else if (entry.isDirectory) {
                const reader = entry.createReader();
                const subEntries = await new Promise(res => {
                    const results = [];
                    const readBatch = () => {
                        reader.readEntries(batch => {
                            if (batch.length === 0) {
                                res(results);
                            } else {
                                results.push(...batch);
                                readBatch();
                            }
                        });
                    };
                    readBatch();
                });
                for (const sub of subEntries) {
                    await readEntry(sub);
                }
            }
        }

        for (const entry of entries) {
            await readEntry(entry);
        }

        resolve(allFiles);
    });
}

// ---- Handle folder contents collected from drag-and-drop entries ----
async function handleFolderUploadFromEntries(files) {
    showProgress('Processing folder contents...');
    const filePayloads = [];
    const allFoundNames = [];
    let processed = 0;
    const total = files.length;

    for (const file of files) {
        const nameLower = file.name.toLowerCase();
        if (!nameLower.endsWith('.json')) {
            processed++;
            continue;
        }

        const path = file._relativePath || file.name;
        const basename = path.split('/').pop().split('\\').pop();
        const basenameLower = basename.toLowerCase();

        if (basenameLower === 'following.json' || /^followers.*\.json$/i.test(basenameLower)) {
            try {
                const text = await readFileAsText(file);
                const parsed = JSON.parse(text);
                filePayloads.push({ path, content: parsed });
                allFoundNames.push(basename);
            } catch (err) {
                showToast(`Warning: Could not parse ${basename}: ${err.message}`, 'error');
            }
        }

        processed++;
        setProgress(Math.round((processed / total) * 70), `Reading files... (${processed}/${total})`);
    }

    if (filePayloads.length === 0) {
        hideProgress();
        showToast('No following.json or followers_*.json files found in the folder.', 'error');
        return;
    }

    setProgress(80, `Uploading ${filePayloads.length} file(s) to server...`);

    try {
        const res = await fetch('/api/upload-directory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: filePayloads })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        setProgress(100, 'Done!');
        hideProgress();
        showToast(`Saved: ${data.files.join(', ')}`, 'success');
        await navigateIfComplete();
    } catch (err) {
        hideProgress();
        showToast('Folder upload error: ' + err.message, 'error');
    }
}

// ---- Verify both following + followers exist before navigating ----
async function navigateIfComplete() {
    try {
        const res = await fetch('/api/status');
        const data = await res.json();

        const hasFollowing = data.counts.following > 0;
        const hasFollowers = data.counts.followers > 0;

        if (hasFollowing && hasFollowers) {
            showPage('dashboard');
        } else {
            let missing = [];
            let found = [];
            if (!hasFollowing) missing.push('following.json'); else found.push(`following (${data.counts.following})`);
            if (!hasFollowers) missing.push('followers_*.json'); else found.push(`followers (${data.counts.followers})`);
            let msg = `Still missing: ${missing.join(' and ')}.`;
            if (found.length) msg += ` Found: ${found.join(', ')}.`;
            msg += ' Please upload both files.';
            showToast(msg, 'error');
        }
    } catch {
        showPage('dashboard');
    }
}

// ---- ZIP Upload ----
async function handleZipUpload(file) {
    showProgress('Reading ZIP file...');
    try {
        const arrayBuffer = await readFileAsArrayBuffer(file);
        const base64 = arrayBufferToBase64(arrayBuffer);

        setProgress(40, 'Uploading ZIP to server...');

        const res = await fetch('/api/upload-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content: base64 })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        setProgress(100, 'Done!');
        hideProgress();
        showToast(`Extracted: ${(data.files || []).join(', ')}`, 'success');
        await navigateIfComplete();
    } catch (err) {
        hideProgress();
        showToast('ZIP upload error: ' + err.message, 'error');
    }
}

// ---- Folder Upload ----
async function handleFolderUpload(files) {
    showProgress('Processing folder contents...');
    const filePayloads = [];
    let processed = 0;
    const total = files.length;

    for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.json')) {
            processed++;
            continue;
        }

        const path = file.webkitRelativePath || file.name;
        const basename = path.split('/').pop().split('\\').pop();

        // Only include following.json or followers*.json (case-insensitive)
        const basenameLower = basename.toLowerCase();
        if (basenameLower === 'following.json' || /^followers.*\.json$/i.test(basenameLower)) {
            try {
                const text = await readFileAsText(file);
                const parsed = JSON.parse(text);
                filePayloads.push({ path: path, content: parsed });
            } catch (err) {
                showToast(`Warning: Could not parse ${basename}: ${err.message}`, 'error');
            }
        }

        processed++;
        setProgress(Math.round((processed / total) * 70), `Reading files... (${processed}/${total})`);
    }

    if (filePayloads.length === 0) {
        hideProgress();
        showToast('No following.json or followers_*.json files found in the folder.', 'error');
        return;
    }

    setProgress(80, `Uploading ${filePayloads.length} file(s) to server...`);

    try {
        const res = await fetch('/api/upload-directory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: filePayloads })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        setProgress(100, 'Done!');
        hideProgress();
        showToast(`Saved: ${data.files.join(', ')}`, 'success');
        await navigateIfComplete();
    } catch (err) {
        hideProgress();
        showToast('Folder upload error: ' + err.message, 'error');
    }
}

// ---- JSON Files Upload (individual) ----
async function handleJsonUpload(files) {
    showProgress('Uploading JSON files...');
    let uploaded = 0;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.toLowerCase().endsWith('.json')) continue;

        try {
            const text = await readFileAsText(file);
            const parsed = JSON.parse(text);

            const res = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: file.name, content: parsed })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            uploaded++;
        } catch (err) {
            showToast(`Error uploading ${file.name}: ${err.message}`, 'error');
        }

        setProgress(Math.round(((i + 1) / files.length) * 100), `Uploading ${i + 1}/${files.length}...`);
    }

    if (uploaded > 0) {
        showToast(`Successfully uploaded ${uploaded} file(s).`, 'success');
        hideProgress();
        await navigateIfComplete();
    } else {
        hideProgress();
    }
}

// ---- File read utilities ----
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Read failed'));
        r.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = () => reject(new Error('Read failed'));
        r.readAsArrayBuffer(file);
    });
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// ---- Progress UI ----
function showProgress(text) {
    dom.uploadProgress.style.display = 'flex';
    dom.progressBarFill.style.width = '10%';
    dom.progressText.textContent = text;
}
function setProgress(pct, text) {
    dom.progressBarFill.style.width = pct + '%';
    if (text) dom.progressText.textContent = text;
}
function hideProgress() {
    dom.uploadProgress.style.display = 'none';
    dom.progressBarFill.style.width = '0%';
}

// ---- Dashboard Data ----
async function fetchData() {
    showLoader();
    try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('Failed to fetch status');
        const data = await res.json();

        state.hasFiles = data.has_files;
        state.counts = data.counts;
        state.unfollowers = data.unfollowers;
        state.whitelisted = data.whitelisted;
        state.inactive = data.inactive;
        state.unfollowed = data.unfollowed;

        updateStats();
        renderList();
    } catch (err) {
        showToast(err.message, 'error');
        hideLoader();
    }
}

function switchTab(tab) {
    dom.tabBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab[data-tab="${tab}"]`).classList.add('active');
    state.activeTab = tab;
    renderList();
}

function updateStats() {
    const c = state.counts;
    dom.countFollowing.textContent = state.hasFiles ? c.following.toLocaleString() : '—';
    dom.countFollowers.textContent = state.hasFiles ? c.followers.toLocaleString() : '—';
    dom.countUnfollowers.textContent = state.hasFiles ? c.unfollowers.toLocaleString() : '—';
    dom.countWhitelisted.textContent = state.hasFiles ? c.whitelisted.toLocaleString() : '—';
    dom.countInactive.textContent = state.hasFiles ? c.inactive.toLocaleString() : '—';
    dom.countUnfollowed.textContent = state.hasFiles ? c.unfollowed.toLocaleString() : '—';

    dom.badgeUnfollowers.textContent = c.unfollowers;
    dom.badgeWhitelisted.textContent = c.whitelisted;
    dom.badgeInactive.textContent = c.inactive;
    dom.badgeUnfollowed.textContent = c.unfollowed;
}

// ---- Render List ----
function renderList() {
    hideLoader();
    dom.usersGrid.innerHTML = '';

    if (!state.hasFiles) {
        showEmptyState('No data loaded', 'Go back and upload your Instagram data export to see results here.');
        return;
    }

    let list = state[state.activeTab] || [];

    if (state.searchQuery) {
        list = list.filter(u => u.username.toLowerCase().includes(state.searchQuery));
    }

    if (list.length === 0) {
        if (state.searchQuery) {
            showEmptyState('No matches', `Nothing matching "${state.searchQuery}" in this tab.`);
        } else if (state.activeTab === 'unfollowers') {
            showEmptyState('All clear! 🎉', 'Everyone you follow follows you back.');
        } else if (state.activeTab === 'whitelisted') {
            showEmptyState('No whitelisted accounts', 'Whitelist users you want to keep following even though they don\'t follow back.');
        } else if (state.activeTab === 'unfollowed') {
            showEmptyState('No unfollowed accounts', 'Mark users here after you manually unfollow them on Instagram.');
        } else {
            showEmptyState('No inactive accounts', 'Mark users as inactive when their accounts appear dormant.');
        }
        return;
    }

    hideEmptyState();
    list.forEach((user, idx) => {
        const card = createUserCard(user);
        // Stagger animation
        card.style.animationDelay = `${Math.min(idx * 0.03, 0.5)}s`;
        card.classList.add('fade-in');
        dom.usersGrid.appendChild(card);
    });
}

function createUserCard(user) {
    const card = document.createElement('div');
    card.className = 'user-card';

    const initials = user.username.slice(0, 2);

    let actionsHtml;
    if (state.activeTab === 'unfollowers') {
        actionsHtml = `
            <button class="action-btn btn-whitelist" title="Whitelist — keep following peacefully" onclick="handleAction('${user.username}','whitelist', this)">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
            </button>
            <button class="action-btn btn-inactive" title="Mark as inactive account" onclick="handleAction('${user.username}','inactive', this)">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
            </button>
            <button class="action-btn btn-unfollowed" title="Mark as just unfollowed" onclick="handleAction('${user.username}','unfollowed', this)">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>`;
    } else {
        actionsHtml = `
            <button class="action-btn btn-remove" title="Move back to Unfollowers" onclick="handleAction('${user.username}','remove', this)">
                <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>`;
    }

    card.innerHTML = `
        <div class="user-card-left">
            <div class="user-avatar">${initials}</div>
            <div class="user-details">
                <a href="${user.href}" target="_blank" rel="noopener" class="user-username" title="Open Instagram profile">
                    <span>${user.username}</span>
                    <svg class="user-ext-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                </a>
                <span class="user-link-hint">Click to visit profile</span>
            </div>
        </div>
        <div class="user-actions">${actionsHtml}</div>`;

    return card;
}

// ---- Actions ----
async function handleAction(username, action, btnElement) {
    let card = null;
    if (btnElement) {
        card = btnElement.closest('.user-card');
        if (card) {
            // Fix height so grid doesn't collapse weirdly during animation
            card.style.height = card.offsetHeight + 'px';
            card.classList.add('is-removing');
        }
    }

    try {
        const res = await fetch('/api/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, action })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Action failed');
        
        // Show subtle notification
        showToast(data.message, 'success');
        
        if (card) {
            // Wait for animation to finish before fetching new state
            setTimeout(() => {
                fetchData();
            }, 300);
        } else {
            fetchData();
        }
    } catch (err) {
        if (card) card.classList.remove('is-removing');
        showToast(err.message, 'error');
    }
}
window.handleAction = handleAction;

// ---- Clear ----
async function clearConnections() {
    try {
        const res = await fetch('/api/clear', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        showToast(data.message, 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ---- UI Helpers ----
function showLoader() {
    dom.listLoader.style.display = 'flex';
    dom.usersGrid.style.display = 'none';
    dom.emptyState.style.display = 'none';
}
function hideLoader() {
    dom.listLoader.style.display = 'none';
    dom.usersGrid.style.display = 'grid';
}
function showEmptyState(title, desc) {
    dom.emptyTitle.textContent = title;
    dom.emptyDesc.textContent = desc;
    dom.emptyState.style.display = 'flex';
    dom.usersGrid.style.display = 'none';
}
function hideEmptyState() {
    dom.emptyState.style.display = 'none';
    dom.usersGrid.style.display = 'grid';
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2.5" fill="none">
            ${type === 'success'
                ? '<polyline points="20 6 9 17 4 12"></polyline>'
                : '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>'}
        </svg>
        <span>${message}</span>`;

    dom.toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'toastIn 0.3s var(--ease-out) reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
