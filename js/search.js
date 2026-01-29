import { $, $$, fetchJSON, debounce, getBasePath } from './utils.js';

let examData = null;

export async function initSearch() {
  const searchInput = $('[data-search]');
  if (!searchInput) return;

  // Load exam catalog
  examData = await fetchJSON(getBasePath() + 'data/exams.json');
  if (!examData) return;

  searchInput.addEventListener('input', debounce((e) => {
    filterExams(e.target.value.trim().toLowerCase());
  }, 200));

  // Category filter buttons
  $$('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('[data-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.dataset.filter;
      filterByCategory(category);
    });
  });
}

function filterExams(query) {
  const cards = $$('[data-exam-card]');

  cards.forEach(card => {
    if (!query) {
      card.style.display = '';
      return;
    }

    const searchText = card.dataset.searchText || card.textContent.toLowerCase();
    const match = searchText.includes(query);
    card.style.display = match ? '' : 'none';
  });

  updateEmptyState(cards);
}

function filterByCategory(category) {
  const cards = $$('[data-exam-card]');

  cards.forEach(card => {
    if (category === 'all') {
      card.style.display = '';
    } else {
      card.style.display = card.dataset.category === category ? '' : 'none';
    }
  });

  updateEmptyState(cards);
}

function updateEmptyState(cards) {
  const visible = cards.filter(c => c.style.display !== 'none');
  const emptyEl = $('.catalog-empty');
  if (emptyEl) {
    emptyEl.style.display = visible.length === 0 ? '' : 'none';
  }
}
