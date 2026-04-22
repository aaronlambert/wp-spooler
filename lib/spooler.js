const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULTS = {
  author: 'Just iMajin Web Sites',
  authorUri: 'http://imajin.guru/',
  version: '1.0.0',
  themeUri: 'https://www.elegantthemes.com/',
  template: 'Divi',
};

const EXCLUDED_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  '.cache',
  '.parcel-cache',
  '.next',
  '.turbo',
  '.sass-cache',
]);

const EXCLUDED_FILE_NAMES = new Set(['.DS_Store', 'Thumbs.db']);

const TEXT_FILE_EXTENSIONS = new Set([
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.js',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.jsx',
  '.json',
  '.md',
  '.txt',
  '.php',
  '.html',
  '.htm',
  '.xml',
  '.yml',
  '.yaml',
  '.env',
  '.ini',
  '.sh',
  '.bat',
  '.ps1',
  '.conf',
]);

function slugify(value = '') {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function titleCaseWords(value = '') {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isoDate(value) {
  if (value) return value;
  return new Date().toISOString().slice(0, 10);
}

function generateSuggestedValues(siteName = '') {
  const siteFolderName = slugify(siteName);
  const baseTitle = siteName.trim() || titleCaseWords(siteFolderName);
  const themeSlug = siteFolderName ? `${siteFolderName}-divi-child` : '';
  return {
    siteFolderName,
    themeSlug,
    themeDisplayName: baseTitle ? `${baseTitle} Divi Child Theme` : '',
    textDomain: themeSlug,
  };
}

function normalizeInput(payload = {}) {
  const siteName = (payload.siteName || '').trim();
  const suggestions = generateSuggestedValues(siteName);

  const siteFolderName = slugify(payload.siteFolderName || suggestions.siteFolderName);
  const themeSlug = slugify(payload.themeSlug || suggestions.themeSlug);
  const themeDisplayName = (payload.themeDisplayName || suggestions.themeDisplayName).trim();
  const textDomain = slugify(payload.textDomain || themeSlug);

  const normalized = {
    siteName,
    siteFolderName,
    themeSlug,
    themeDisplayName,
    themeUri: (payload.themeUri || DEFAULTS.themeUri).trim(),
    author: (payload.author || DEFAULTS.author).trim(),
    authorUri: (payload.authorUri || DEFAULTS.authorUri).trim(),
    version: (payload.version || DEFAULTS.version).trim(),
    textDomain,
    updated: isoDate((payload.updated || '').trim()),
    description: (payload.description || '').trim(),
  };

  validateInput(normalized);
  return normalized;
}

function validateInput(input) {
  if (!input.siteFolderName) {
    throw new Error('Site folder name is required.');
  }
  if (!input.themeSlug) {
    throw new Error('Theme slug is required.');
  }
  if (!input.themeDisplayName) {
    throw new Error('Theme display name is required.');
  }

  const folderNamePattern = /^[a-z0-9-]+$/;
  if (!folderNamePattern.test(input.siteFolderName)) {
    throw new Error('Site folder name can only contain lowercase letters, numbers, and hyphens.');
  }
  if (!folderNamePattern.test(input.themeSlug)) {
    throw new Error('Theme slug can only contain lowercase letters, numbers, and hyphens.');
  }
}

function shouldExclude(fromPath) {
  const name = path.basename(fromPath);
  if (EXCLUDED_DIR_NAMES.has(name) || EXCLUDED_FILE_NAMES.has(name)) {
    return true;
  }
  return false;
}

async function copyTemplate({ templatePath, destinationPath }) {
  await fs.cp(templatePath, destinationPath, {
    recursive: true,
    errorOnExist: true,
    force: false,
    filter: (from) => !shouldExclude(from),
  });
}

async function renameThemeFolder(sitePath, newThemeSlug) {
  const candidateDirs = [
    path.join(sitePath, 'wp-content', 'themes', '_themename-divi-child'),
    path.join(sitePath, '_themename-divi-child'),
  ];

  for (const oldDir of candidateDirs) {
    try {
      const stat = await fs.stat(oldDir);
      if (!stat.isDirectory()) continue;
      const targetDir = path.join(path.dirname(oldDir), newThemeSlug);
      await fs.rename(oldDir, targetDir);
      return targetDir;
    } catch {
      // Ignore missing candidate path and try next.
    }
  }

  throw new Error('Could not find _themename-divi-child folder inside copied site.');
}

function replaceHeaderValue(css, field, value) {
  const re = new RegExp(`(^\\s*${field}:)(.*)$`, 'm');
  if (re.test(css)) {
    return css.replace(re, `$1 ${value}`);
  }
  return css;
}

async function updateStyleCss(styleCssPath, values) {
  const original = await fs.readFile(styleCssPath, 'utf8');
  let updated = original;
  updated = replaceHeaderValue(updated, 'Theme Name', values.themeDisplayName);
  updated = replaceHeaderValue(updated, 'Theme URI', values.themeUri);
  updated = replaceHeaderValue(updated, 'Author', values.author);
  updated = replaceHeaderValue(updated, 'Author URI', values.authorUri);
  updated = replaceHeaderValue(updated, 'Version', values.version);
  updated = replaceHeaderValue(updated, 'Text Domain', values.textDomain);
  updated = replaceHeaderValue(updated, 'Updated', values.updated);
  updated = replaceHeaderValue(updated, 'Description', values.description);

  await fs.writeFile(styleCssPath, updated, 'utf8');
}

function shouldProcessAsText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (TEXT_FILE_EXTENSIONS.has(ext)) return true;
  const base = path.basename(filePath);
  return base === 'style.css' || base === '.env' || base.endsWith('.example');
}

async function walkFiles(dirPath, collector = []) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (shouldExclude(fullPath)) continue;
    if (entry.isDirectory()) {
      await walkFiles(fullPath, collector);
    } else if (entry.isFile()) {
      collector.push(fullPath);
    }
  }
  return collector;
}

async function replacePlaceholders(sitePath, replacements) {
  const files = await walkFiles(sitePath);

  for (const filePath of files) {
    if (!shouldProcessAsText(filePath)) continue;

    let content;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    let changed = false;
    let output = content;

    for (const { from, to } of replacements) {
      if (!from || from === to) continue;
      const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');
      if (regex.test(output)) {
        output = output.replace(regex, to);
        changed = true;
      }
    }

    if (changed) {
      await fs.writeFile(filePath, output, 'utf8');
    }
  }
}

function stylePreview(values) {
  return `/*\nTheme Name: ${values.themeDisplayName}\nTheme URI: ${values.themeUri}\nTemplate: ${DEFAULTS.template}\nAuthor: ${values.author}\nAuthor URI: ${values.authorUri}\nVersion: ${values.version}\nText Domain: ${values.textDomain}\nUpdated: ${values.updated}\nDescription: ${values.description}\n*/`;
}

async function createSiteSpool(payload, options = {}) {
  const values = normalizeInput(payload);
  const rootPath = options.rootPath || process.cwd();
  const templateFolderName = options.templateFolderName || 'wp-theme-spool';

  const templatePath = path.join(rootPath, templateFolderName);
  const destinationPath = path.join(rootPath, values.siteFolderName);

  const templateStat = await fs.stat(templatePath).catch(() => null);
  if (!templateStat || !templateStat.isDirectory()) {
    throw new Error(`Template folder not found: ${templatePath}`);
  }

  const existing = await fs.stat(destinationPath).catch(() => null);
  if (existing) {
    throw new Error(`Destination already exists: ${destinationPath}`);
  }

  await copyTemplate({ templatePath, destinationPath });
  const themeDirPath = await renameThemeFolder(destinationPath, values.themeSlug);
  const styleCssPath = path.join(themeDirPath, 'style.css');

  await updateStyleCss(styleCssPath, values);
  await replacePlaceholders(destinationPath, [
    { from: '_themename-divi-child', to: values.themeSlug },
    { from: 'custom-divi-child-theme', to: values.textDomain },
    { from: 'Custom Divi Child Theme', to: values.themeDisplayName },
  ]);

  return {
    siteFolderName: values.siteFolderName,
    themeFolderName: values.themeSlug,
    sitePath: destinationPath,
    stylePreview: stylePreview(values),
  };
}

module.exports = {
  DEFAULTS,
  generateSuggestedValues,
  normalizeInput,
  createSiteSpool,
  stylePreview,
};
