// DOM helpers
export const $ = (sel, ctx = document) => ctx.querySelector(sel);
export const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

// Fetch JSON with error handling
export async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
    return null;
  }
}

// Fisher-Yates shuffle
export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Format date
export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Debounce
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Create element helper
export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'class') el.className = val;
    else if (key === 'text') el.textContent = val;
    else if (key === 'html') el.innerHTML = val;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val);
    else if (key.startsWith('data')) el.setAttribute(`data-${key.slice(4).toLowerCase()}`, val);
    else el.setAttribute(key, val);
  }
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  });
  return el;
}

// Toast notifications
let toastContainer = null;

export function showToast(message, type = 'default') {
  if (!toastContainer) {
    toastContainer = createEl('div', { class: 'toast-container' });
    document.body.appendChild(toastContainer);
  }

  const toast = createEl('div', {
    class: `toast toast--${type}`,
    text: message
  });

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Get base path for data files
export function getBasePath() {
  // Derive root from the module's own URL — works on GitHub Pages and local servers
  // import.meta.url = "{root}/js/utils.js", so ".." resolves to "{root}/"
  return new URL('..', import.meta.url).href;
}

// Clamp number
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

// Generate unique ID
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Escape HTML
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
