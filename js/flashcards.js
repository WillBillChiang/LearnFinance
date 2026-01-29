// Flashcard study module with Leitner spaced-repetition system
import { $, fetchJSON, getBasePath, createEl, escapeHTML } from './utils.js';
import { initSwipeGesture } from './gestures.js';

const STORAGE_KEY = 'lf_flashcards';
const BOX_INTERVALS = { 1: 0, 2: 2, 3: 4, 4: 7, 5: 14 };

// Available exams list (matches data/exams.json ids)
const EXAM_OPTIONS = [
  { id: 'sie', name: 'SIE - Securities Industry Essentials' },
  { id: 'series7', name: 'Series 7 - General Securities Representative' },
  { id: 'series6', name: 'Series 6 - Investment Company / Variable Contracts' },
  { id: 'series63', name: 'Series 63 - Uniform Securities Agent State Law' },
  { id: 'series65', name: 'Series 65 - Uniform Investment Adviser Law' },
  { id: 'series66', name: 'Series 66 - Uniform Combined State Law' },
  { id: 'series79', name: 'Series 79 - Investment Banking Representative' },
  { id: 'series82', name: 'Series 82 - Private Securities Offerings' },
  { id: 'series24', name: 'Series 24 - General Securities Principal' },
  { id: 'series53', name: 'Series 53 - Municipal Securities Principal' },
  { id: 'series3', name: 'Series 3 - National Commodities Futures' },
  { id: 'series52', name: 'Series 52 - Municipal Securities Representative' },
  { id: 'series50', name: 'Series 50 - Municipal Advisor Representative' },
  { id: 'series99', name: 'Series 99 - Operations Professional' },
  { id: 'series27', name: 'Series 27 - Financial and Operations Principal' },
  { id: 'series4', name: 'Series 4 - Registered Options Principal' }
];

/* -------------------------------------------------- */
/*  State                                              */
/* -------------------------------------------------- */
let allCards = [];
let studyQueue = [];
let currentIndex = 0;
let sessionStats = { mastered: 0, reviewing: 0, total: 0 };
let leitnerState = {};
let currentExamId = '';

/* -------------------------------------------------- */
/*  Helpers                                            */
/* -------------------------------------------------- */
function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function loadLeitnerState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLeitnerState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leitnerState));
  } catch { /* quota exceeded - silently fail */ }
}

function getCardState(cardId) {
  if (!leitnerState[cardId]) {
    leitnerState[cardId] = { box: 1, nextReview: todayISO() };
  }
  return leitnerState[cardId];
}

function isDue(cardId) {
  const state = getCardState(cardId);
  return state.nextReview <= todayISO();
}

function boxToStars(box) {
  return box; // 1-5 maps directly to 1-5 stars
}

/* -------------------------------------------------- */
/*  Sorting                                            */
/* -------------------------------------------------- */
function sortCards(cards) {
  const today = todayISO();
  return [...cards].sort((a, b) => {
    const sa = getCardState(a.id);
    const sb = getCardState(b.id);
    const aDue = sa.nextReview <= today;
    const bDue = sb.nextReview <= today;

    // Due cards first
    if (aDue && !bDue) return -1;
    if (!aDue && bDue) return 1;

    // Then by box level ascending (weakest first)
    if (sa.box !== sb.box) return sa.box - sb.box;

    // Then by next review date ascending
    return sa.nextReview.localeCompare(sb.nextReview);
  });
}

/* -------------------------------------------------- */
/*  Rendering                                          */
/* -------------------------------------------------- */
function getRoot() {
  return $('#flashcard-root');
}

function renderDeckSelector() {
  const root = getRoot();
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const preselectedExam = params.get('exam');

  root.innerHTML = '';

  const form = createEl('form', { class: 'flashcard-selector' });

  // Exam dropdown
  const examGroup = createEl('div', { class: 'form-group' });
  const examLabel = createEl('label', { for: 'fc-exam-select', text: 'Select Exam' });
  const examSelect = createEl('select', { id: 'fc-exam-select', class: 'form-select' });

  const defaultOpt = createEl('option', { value: '', text: '-- Choose an exam --' });
  examSelect.appendChild(defaultOpt);

  EXAM_OPTIONS.forEach(exam => {
    const opt = createEl('option', { value: exam.id, text: exam.name });
    if (preselectedExam && exam.id === preselectedExam) opt.selected = true;
    examSelect.appendChild(opt);
  });

  examGroup.appendChild(examLabel);
  examGroup.appendChild(examSelect);
  form.appendChild(examGroup);

  // Topic filter dropdown
  const topicGroup = createEl('div', { class: 'form-group' });
  const topicLabel = createEl('label', { for: 'fc-topic-filter', text: 'Filter by Topic (optional)' });
  const topicSelect = createEl('select', { id: 'fc-topic-filter', class: 'form-select', disabled: 'true' });
  const topicDefault = createEl('option', { value: '', text: 'All Topics' });
  topicSelect.appendChild(topicDefault);

  topicGroup.appendChild(topicLabel);
  topicGroup.appendChild(topicSelect);
  form.appendChild(topicGroup);

  // Start button
  const startBtn = createEl('button', {
    type: 'submit',
    class: 'btn btn--primary btn--lg',
    text: 'Start Studying',
    disabled: 'true'
  });
  form.appendChild(startBtn);

  root.appendChild(form);

  // Populate topics when exam changes
  examSelect.addEventListener('change', async () => {
    const examId = examSelect.value;
    topicSelect.innerHTML = '';
    const allOpt = createEl('option', { value: '', text: 'All Topics' });
    topicSelect.appendChild(allOpt);

    if (!examId) {
      topicSelect.disabled = true;
      startBtn.disabled = true;
      return;
    }

    startBtn.disabled = false;

    // Try to load the flashcard data to extract topics
    const basePath = getBasePath();
    const data = await fetchJSON(`${basePath}data/flashcards/${examId}.json`);
    if (data && data.cards) {
      const topics = [...new Set(data.cards.map(c => c.topic).filter(Boolean))];
      topics.sort();
      topics.forEach(topic => {
        const opt = createEl('option', { value: topic, text: topic });
        topicSelect.appendChild(opt);
      });
      if (topics.length > 0) {
        topicSelect.disabled = false;
      }
    }
  });

  // Submit handler
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const examId = examSelect.value;
    if (!examId) return;
    const topic = topicSelect.value || '';
    startSession(examId, topic);
  });

  // Auto-start if exam was preselected
  if (preselectedExam) {
    examSelect.dispatchEvent(new Event('change'));
  }
}

async function startSession(examId, topicFilter) {
  currentExamId = examId;
  sessionStats = { mastered: 0, reviewing: 0, total: 0 };
  leitnerState = loadLeitnerState();

  // Show skeleton loading state
  const root = getRoot();
  if (root) {
    root.innerHTML = `
      <div style="max-width:500px;margin:0 auto;padding:var(--space-xl);" aria-busy="true" aria-label="Loading flashcards">
        <div class="skeleton skeleton--title" style="margin:0 auto var(--space-lg)"></div>
        <div class="skeleton" style="height:320px;border-radius:var(--radius-xl);margin-bottom:var(--space-lg)"></div>
        <div style="display:flex;gap:var(--space-md);justify-content:center">
          <div class="skeleton skeleton--btn"></div>
          <div class="skeleton skeleton--btn"></div>
        </div>
      </div>
    `;
  }

  const basePath = getBasePath();
  const data = await fetchJSON(`${basePath}data/flashcards/${examId}.json`);

  if (!data || !data.cards || data.cards.length === 0) {
    const root = getRoot();
    root.innerHTML = `
      <div class="flashcard-empty">
        <h2>No Flashcards Available</h2>
        <p>Flashcard data for this exam hasn't been added yet.</p>
        <a href="./" class="btn btn--primary">Back to Flashcards</a>
      </div>
    `;
    return;
  }

  allCards = data.cards;

  // Apply topic filter if set
  if (topicFilter) {
    allCards = allCards.filter(c => c.topic === topicFilter);
  }

  studyQueue = sortCards(allCards);
  currentIndex = 0;
  sessionStats.total = studyQueue.length;

  renderCard();
}

function renderCard() {
  const root = getRoot();
  if (!root) return;

  if (currentIndex >= studyQueue.length) {
    renderSummary();
    return;
  }

  const card = studyQueue[currentIndex];
  const state = getCardState(card.id);
  const stars = boxToStars(state.box);

  root.innerHTML = '';

  // Progress bar
  const progressWrap = createEl('div', { class: 'flashcard-progress' });
  const progressText = createEl('span', {
    class: 'flashcard-progress__text',
    text: `${currentIndex + 1} of ${studyQueue.length}`
  });
  const progressBar = createEl('div', { class: 'flashcard-progress__bar' });
  const progressFill = createEl('div', { class: 'flashcard-progress__fill' });
  progressFill.style.width = `${((currentIndex + 1) / studyQueue.length) * 100}%`;
  progressBar.appendChild(progressFill);
  progressWrap.appendChild(progressText);
  progressWrap.appendChild(progressBar);
  root.appendChild(progressWrap);

  // Mastery stars
  const starsWrap = createEl('div', { class: 'flashcard-stars', 'aria-label': `Mastery level ${stars} of 5` });
  for (let i = 1; i <= 5; i++) {
    const star = createEl('span', {
      class: i <= stars ? 'flashcard-star flashcard-star--filled' : 'flashcard-star',
      html: i <= stars ? '&#9733;' : '&#9734;'
    });
    starsWrap.appendChild(star);
  }
  root.appendChild(starsWrap);

  // Card stack visual
  const stackWrap = createEl('div', { class: 'card-stack' });

  // Background cards for depth effect
  const remainingCards = studyQueue.length - currentIndex;
  const stackDepth = Math.min(remainingCards, 3);
  for (let i = stackDepth - 1; i >= 1; i--) {
    const bgCard = createEl('div', { class: `card-stack__bg card-stack__bg--${i}` });
    stackWrap.appendChild(bgCard);
  }

  // Main flip card
  const flipCard = createEl('div', { class: 'flip-card', tabindex: '0', role: 'button', 'aria-label': 'Flashcard - click or press Space to flip' });
  const flipInner = createEl('div', { class: 'flip-card__inner' });
  const front = createEl('div', { class: 'flip-card__front' });
  const back = createEl('div', { class: 'flip-card__back' });

  // Front content
  if (card.topic) {
    front.appendChild(createEl('span', { class: 'flip-card__topic', text: card.topic }));
  }
  front.appendChild(createEl('p', { class: 'flip-card__text', text: card.question || card.term || '' }));

  // Back content
  back.appendChild(createEl('p', { class: 'flip-card__text', text: card.answer || card.definition || '' }));

  flipInner.appendChild(front);
  flipInner.appendChild(back);
  flipCard.appendChild(flipInner);
  stackWrap.appendChild(flipCard);

  root.appendChild(stackWrap);

  // Flip handler
  const flipHandler = (e) => {
    // Prevent flip when clicking action buttons
    if (e && e.target && e.target.closest('.flashcard-actions')) return;
    flipCard.classList.toggle('flipped');

    // Show action buttons after first flip
    const actions = $('#flashcard-actions');
    if (actions && flipCard.classList.contains('flipped')) {
      actions.hidden = false;
    }
  };

  flipCard.addEventListener('click', flipHandler);

  // Action buttons (hidden until card is flipped)
  const actions = createEl('div', { class: 'flashcard-actions', id: 'flashcard-actions' });
  actions.hidden = true;

  const stillBtn = createEl('button', {
    class: 'btn btn--danger flashcard-btn flashcard-btn--left',
    html: '&larr; Still Learning'
  });
  const knowBtn = createEl('button', {
    class: 'btn btn--success flashcard-btn flashcard-btn--right',
    html: 'Know It &rarr;'
  });

  stillBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleAnswer(false, flipCard);
  });

  knowBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleAnswer(true, flipCard);
  });

  actions.appendChild(stillBtn);
  actions.appendChild(knowBtn);
  root.appendChild(actions);

  // Swipe support
  initSwipeGesture(flipCard, {
    onSwipeRight: () => handleAnswer(true, flipCard),
    onSwipeLeft: () => handleAnswer(false, flipCard)
  });

  // Focus the card for keyboard support
  flipCard.focus();
}

function handleAnswer(knowIt, cardEl) {
  const card = studyQueue[currentIndex];
  const state = getCardState(card.id);
  const today = todayISO();

  if (knowIt) {
    // Move up one box (max 5)
    state.box = Math.min(state.box + 1, 5);
    state.nextReview = addDays(today, BOX_INTERVALS[state.box]);
    sessionStats.mastered++;

    // Animate off to the right
    if (cardEl) {
      cardEl.classList.add('swipe-right');
    }
  } else {
    // Reset to box 1
    state.box = 1;
    state.nextReview = today;
    sessionStats.reviewing++;

    // Animate off to the left
    if (cardEl) {
      cardEl.classList.add('swipe-left');
    }
  }

  leitnerState[card.id] = state;
  saveLeitnerState();

  // Advance after animation
  setTimeout(() => {
    currentIndex++;
    renderCard();
  }, 350);
}

function renderSummary() {
  const root = getRoot();
  if (!root) return;

  const reviewed = sessionStats.mastered + sessionStats.reviewing;

  root.innerHTML = '';

  const summary = createEl('div', { class: 'flashcard-summary' });

  summary.appendChild(createEl('h2', { class: 'flashcard-summary__title', text: 'Session Complete!' }));

  const statsGrid = createEl('div', { class: 'flashcard-summary__stats' });

  statsGrid.appendChild(createStatCard('Cards Mastered', sessionStats.mastered, 'mastered'));
  statsGrid.appendChild(createStatCard('Still Learning', sessionStats.reviewing, 'reviewing'));
  statsGrid.appendChild(createStatCard('Total Reviewed', reviewed, 'total'));

  summary.appendChild(statsGrid);

  // Mastery percentage
  const pct = reviewed > 0 ? Math.round((sessionStats.mastered / reviewed) * 100) : 0;
  const ring = createEl('div', { class: 'flashcard-summary__ring' });
  ring.innerHTML = `
    <svg viewBox="0 0 120 120" class="flashcard-ring-svg">
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-border, #e2e8f0)" stroke-width="8" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="var(--color-primary, #3b82f6)" stroke-width="8"
        stroke-dasharray="${(pct / 100) * 327} 327"
        stroke-linecap="round" transform="rotate(-90 60 60)" />
      <text x="60" y="60" text-anchor="middle" dominant-baseline="central"
        font-size="28" font-weight="700" fill="var(--color-text, #1e293b)">${pct}%</text>
    </svg>
    <p class="flashcard-summary__ring-label">Mastery Rate</p>
  `;
  summary.appendChild(ring);

  // Buttons
  const btnGroup = createEl('div', { class: 'flashcard-summary__actions' });

  const reviewBtn = createEl('button', {
    class: 'btn btn--primary',
    text: 'Review Again'
  });
  reviewBtn.addEventListener('click', () => {
    startSession(currentExamId, '');
  });

  const backBtn = createEl('a', {
    href: currentExamId ? `../exams/${currentExamId}.html` : './',
    class: 'btn btn--secondary',
    text: 'Back to Exam'
  });

  btnGroup.appendChild(reviewBtn);
  btnGroup.appendChild(backBtn);
  summary.appendChild(btnGroup);

  root.appendChild(summary);
}

function createStatCard(label, value, type) {
  const card = createEl('div', { class: `flashcard-stat flashcard-stat--${type}` });
  card.appendChild(createEl('span', { class: 'flashcard-stat__value', text: String(value) }));
  card.appendChild(createEl('span', { class: 'flashcard-stat__label', text: label }));
  return card;
}

/* -------------------------------------------------- */
/*  Keyboard support                                   */
/* -------------------------------------------------- */
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Only handle when on flashcards page
    if (document.body.dataset.page !== 'flashcards') return;

    const flipCard = $('.flip-card');
    if (!flipCard) return;

    switch (e.key) {
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        flipCard.classList.toggle('flipped');
        // Show action buttons
        const actions = $('#flashcard-actions');
        if (actions && flipCard.classList.contains('flipped')) {
          actions.hidden = false;
        }
        break;

      case 'ArrowRight':
        e.preventDefault();
        if (flipCard.classList.contains('flipped')) {
          handleAnswer(true, flipCard);
        }
        break;

      case 'ArrowLeft':
        e.preventDefault();
        if (flipCard.classList.contains('flipped')) {
          handleAnswer(false, flipCard);
        }
        break;
    }
  });
}

/* -------------------------------------------------- */
/*  Init                                               */
/* -------------------------------------------------- */
export function initFlashcards() {
  const root = getRoot();
  if (!root) return;

  setupKeyboard();

  // Check URL params
  const params = new URLSearchParams(window.location.search);
  const examId = params.get('exam');

  if (examId) {
    // Start directly with this exam
    startSession(examId, '');
  } else {
    // Show deck selector
    renderDeckSelector();
  }
}
