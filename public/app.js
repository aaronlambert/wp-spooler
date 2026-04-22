const form = document.getElementById('spoolForm');
const siteNameInput = document.getElementById('siteName');
const siteFolderNameInput = document.getElementById('siteFolderName');
const themeSlugInput = document.getElementById('themeSlug');
const themeDisplayNameInput = document.getElementById('themeDisplayName');
const textDomainInput = document.getElementById('textDomain');
const messageEl = document.getElementById('message');
const previewEl = document.getElementById('preview');
const resultEl = document.getElementById('result');

const resultSiteFolder = document.getElementById('resultSiteFolder');
const resultThemeFolder = document.getElementById('resultThemeFolder');
const resultPath = document.getElementById('resultPath');
const copyPathBtn = document.getElementById('copyPathBtn');

let manualSiteFolderEdit = false;
let manualThemeSlugEdit = false;
let manualThemeDisplayEdit = false;
let manualTextDomainEdit = false;

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function formDataObject() {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function setMessage(text, status = '') {
  messageEl.textContent = text;
  messageEl.className = status;
}

async function refreshPreview() {
  try {
    const payload = formDataObject();
    const { preview } = await postJson('/api/preview', payload);
    previewEl.textContent = preview;
  } catch (error) {
    previewEl.textContent = error.message;
  }
}

async function applySuggestions() {
  const siteName = siteNameInput.value;
  const { suggestions } = await postJson('/api/suggest', { siteName });

  if (!manualSiteFolderEdit) siteFolderNameInput.value = suggestions.siteFolderName;
  if (!manualThemeSlugEdit) themeSlugInput.value = suggestions.themeSlug;
  if (!manualThemeDisplayEdit) themeDisplayNameInput.value = suggestions.themeDisplayName;
  if (!manualTextDomainEdit) textDomainInput.value = suggestions.textDomain;
}

function markManualEdits() {
  siteFolderNameInput.addEventListener('input', () => {
    manualSiteFolderEdit = true;
  });
  themeSlugInput.addEventListener('input', () => {
    manualThemeSlugEdit = true;
  });
  themeDisplayNameInput.addEventListener('input', () => {
    manualThemeDisplayEdit = true;
  });
  textDomainInput.addEventListener('input', () => {
    manualTextDomainEdit = true;
  });
}

siteNameInput.addEventListener('input', async () => {
  try {
    await applySuggestions();
    await refreshPreview();
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

form.addEventListener('input', () => {
  refreshPreview();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  setMessage('Creating site...');
  resultEl.classList.add('hidden');

  try {
    const payload = formDataObject();
    const data = await postJson('/api/create-site', payload);
    setMessage('Site created successfully.', 'success');

    resultSiteFolder.textContent = data.result.siteFolderName;
    resultThemeFolder.textContent = data.result.themeFolderName;
    resultPath.textContent = data.result.sitePath;
    resultEl.classList.remove('hidden');
    previewEl.textContent = data.result.stylePreview;
  } catch (error) {
    setMessage(error.message, 'error');
  }
});

copyPathBtn.addEventListener('click', async () => {
  const value = resultPath.textContent;
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
    setMessage('Path copied to clipboard.', 'success');
  } catch {
    setMessage('Unable to copy path in this browser.', 'error');
  }
});

async function bootstrap() {
  const defaultsRes = await fetch('/api/defaults');
  const data = await defaultsRes.json();
  document.getElementById('themeUri').value = data.defaults.themeUri;
  document.getElementById('author').value = data.defaults.author;
  document.getElementById('authorUri').value = data.defaults.authorUri;
  document.getElementById('version').value = data.defaults.version;

  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('updated').value = today;

  markManualEdits();
  await applySuggestions();
  await refreshPreview();
}

bootstrap().catch((error) => {
  setMessage(error.message, 'error');
});
