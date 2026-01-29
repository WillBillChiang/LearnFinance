// Learn section – interactive functions for course catalog, overview, chapter pages
import { $, $$, fetchJSON, getBasePath, createEl, showToast, debounce } from './utils.js';

const STORAGE_KEY = 'lf_progress';

// ── Internal helpers ──────────────────────────────────────────────

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { exams: {}, streaks: { dates: [], current: 0, longest: 0 } };
    const data = JSON.parse(raw);
    if (!data.exams || typeof data.exams !== 'object') data.exams = {};
    if (!data.streaks || typeof data.streaks !== 'object') {
      data.streaks = { dates: [], current: 0, longest: 0 };
    }
    return data;
  } catch {
    return { exams: {}, streaks: { dates: [], current: 0, longest: 0 } };
  }
}

function saveProgressData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save progress:', err);
  }
}

function ensureExam(data, examId) {
  if (!data.exams[examId]) {
    data.exams[examId] = {
      topicsStudied: [],
      quizScores: [],
      flashcardsMastered: 0,
      lastActivity: null,
      chaptersCompleted: []
    };
  }
  // Ensure chaptersCompleted array exists for older progress data
  if (!Array.isArray(data.exams[examId].chaptersCompleted)) {
    data.exams[examId].chaptersCompleted = [];
  }
  return data.exams[examId];
}

// ── 1. Course Catalog ─────────────────────────────────────────────

/**
 * Initialize the learn catalog page.
 * Fetches manifest, computes per-exam completion, renders progress rings,
 * and wires up category filter buttons.
 */
export async function initCourseCatalog() {
  const cards = $$('.course-card[data-exam]');
  if (cards.length === 0) return;

  const basePath = getBasePath();
  const manifest = await fetchJSON(`${basePath}data/learn-manifest.json`);
  if (!manifest) return;

  const progress = loadProgress();
  const { createProgressRing } = await import('./charts.js');

  // Render progress ring for each course card
  cards.forEach(card => {
    const examId = card.dataset.exam;
    const examManifest = manifest[examId] || manifest.exams?.[examId];
    if (!examManifest) return;

    const totalChapters = Array.isArray(examManifest)
      ? examManifest.length
      : (examManifest.chapters?.length ?? examManifest.chapterCount ?? 0);

    const examProgress = ensureExam(progress, examId);
    const completed = examProgress.chaptersCompleted.length;
    const percent = totalChapters > 0 ? Math.round((completed / totalChapters) * 100) : 0;

    const color = percent >= 75 ? '#10b981' : percent >= 40 ? '#f59e0b' : '#3b82f6';
    const ring = createProgressRing(percent, 64, 5, color);

    // Insert ring into a designated container or prepend to card
    const ringContainer = $('.course-card__progress', card) || $('.course-card__ring', card);
    if (ringContainer) {
      ringContainer.innerHTML = '';
      ringContainer.appendChild(ring);
    } else {
      // Create one and prepend
      const wrapper = createEl('div', { class: 'course-card__progress' }, [ring]);
      card.prepend(wrapper);
    }
  });

  // Wire up category filter buttons (same pattern as search.js)
  const filterBtns = $$('[data-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Toggle active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const category = btn.dataset.filter;

      cards.forEach(card => {
        if (category === 'all') {
          card.style.display = '';
        } else {
          const cardCategory = card.dataset.category || card.dataset.filter || '';
          card.style.display = cardCategory === category ? '' : 'none';
        }
      });

      // Update empty state if present
      const visible = cards.filter(c => c.style.display !== 'none');
      const emptyEl = $('.catalog-empty');
      if (emptyEl) {
        emptyEl.style.display = visible.length === 0 ? '' : 'none';
      }
    });
  });
}

// ── 2. Course Overview ────────────────────────────────────────────

/**
 * Initialize the course overview page.
 * Shows chapter list with completion status, highlights next unread chapter,
 * renders progress bar and sidebar progress ring.
 */
export async function initCourseOverview() {
  const examId = document.body.dataset.exam;
  if (!examId) return;

  const basePath = getBasePath();
  const manifest = await fetchJSON(`${basePath}data/learn-manifest.json`);
  if (!manifest) return;

  const examManifest = manifest[examId] || manifest.exams?.[examId];
  if (!examManifest) return;

  const chapters = Array.isArray(examManifest)
    ? examManifest
    : (examManifest.chapters || []);

  const totalChapters = chapters.length;
  const progress = loadProgress();
  const examProgress = ensureExam(progress, examId);
  const completedSet = new Set(examProgress.chaptersCompleted);

  const chapterItems = $$('.chapter-item');
  let firstIncomplete = null;

  chapterItems.forEach(item => {
    const chapterId = item.dataset.chapter;
    if (!chapterId) return;

    if (completedSet.has(chapterId)) {
      item.classList.add('chapter-item--completed');
    } else if (!firstIncomplete) {
      firstIncomplete = item;
    }
  });

  // Highlight next unread chapter
  if (firstIncomplete) {
    // Remove any existing current marker
    $$('.chapter-item--current').forEach(el => el.classList.remove('chapter-item--current'));
    firstIncomplete.classList.add('chapter-item--current');
  }

  // Compute overall percentage
  const completedCount = examProgress.chaptersCompleted.length;
  const percent = totalChapters > 0 ? Math.round((completedCount / totalChapters) * 100) : 0;

  // Update progress bar
  const progressBar = $('.progress-bar__fill') || $('#course-progress-fill');
  if (progressBar) {
    progressBar.style.width = `${percent}%`;
  }

  const progressLabel = $('.progress-bar__label') || $('#course-progress-label');
  if (progressLabel) {
    progressLabel.textContent = `${percent}% complete (${completedCount}/${totalChapters} chapters)`;
  }

  const progressBarContainer = $('.progress-bar') || $('#course-progress');
  if (progressBarContainer) {
    progressBarContainer.setAttribute('aria-valuenow', percent);
  }

  // Render progress ring in sidebar
  const sidebarRing = $('.course-sidebar__progress') || $('.sidebar__progress-ring');
  if (sidebarRing) {
    const { createProgressRing } = await import('./charts.js');
    const color = percent >= 75 ? '#10b981' : percent >= 40 ? '#f59e0b' : '#3b82f6';
    const ring = createProgressRing(percent, 100, 7, color);
    sidebarRing.innerHTML = '';
    sidebarRing.appendChild(ring);
  }
}

// ── 3. Table of Contents ──────────────────────────────────────────

/**
 * Build a sticky table-of-contents from h2 elements in .lesson,
 * highlight the current section via IntersectionObserver,
 * and smooth-scroll to sections on click.
 */
export function initTableOfContents() {
  const lesson = $('.lesson');
  if (!lesson) return;

  const headings = $$('h2', lesson);
  if (headings.length === 0) return;

  // Find or create TOC container
  let tocContainer = $('.lesson__toc') || $('.toc');
  if (!tocContainer) return; // No TOC container in the DOM, bail out

  const tocList = createEl('ul', { class: 'lesson__toc-list' });

  // Ensure every heading has an id
  headings.forEach((heading, i) => {
    if (!heading.id) {
      heading.id = `section-${i + 1}-${heading.textContent
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')}`;
    }

    const link = createEl('a', {
      class: 'lesson__toc-link',
      href: `#${heading.id}`,
      text: heading.textContent
    });

    link.addEventListener('click', (e) => {
      e.preventDefault();
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Update URL hash without jumping
      history.replaceState(null, '', `#${heading.id}`);
    });

    const li = createEl('li', { class: 'lesson__toc-item' }, [link]);
    tocList.appendChild(li);
  });

  tocContainer.innerHTML = '';
  tocContainer.appendChild(tocList);

  // IntersectionObserver to highlight current section
  const tocLinks = $$('.lesson__toc-link', tocContainer);
  let currentActive = null;

  const observer = new IntersectionObserver(
    (entries) => {
      // Find the topmost visible heading
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

      if (visible.length > 0) {
        const targetId = visible[0].target.id;
        const matchLink = tocLinks.find(link => link.getAttribute('href') === `#${targetId}`);

        if (matchLink && matchLink !== currentActive) {
          if (currentActive) currentActive.classList.remove('lesson__toc-link--active');
          matchLink.classList.add('lesson__toc-link--active');
          currentActive = matchLink;
        }
      }
    },
    {
      rootMargin: '-10% 0px -80% 0px',
      threshold: 0
    }
  );

  headings.forEach(heading => observer.observe(heading));
}

// ── 4. Chapter Progress ───────────────────────────────────────────

/**
 * Handle "Mark Complete" button for the current chapter.
 * Reads exam/chapter from body data attributes, toggles completion
 * in localStorage, and updates UI.
 */
export function initChapterProgress() {
  const examId = document.body.dataset.exam;
  const chapterId = document.body.dataset.chapter;
  if (!examId || !chapterId) return;

  const btn = $('.mark-complete-btn') || $('[data-action="mark-complete"]');
  if (!btn) return;

  const progress = loadProgress();
  const examProgress = ensureExam(progress, examId);
  const isComplete = examProgress.chaptersCompleted.includes(chapterId);

  // Set initial button state
  if (isComplete) {
    setCompletedState(btn);
  }

  btn.addEventListener('click', () => {
    const current = loadProgress();
    const exam = ensureExam(current, examId);

    if (exam.chaptersCompleted.includes(chapterId)) {
      // Already complete — allow toggle off
      exam.chaptersCompleted = exam.chaptersCompleted.filter(id => id !== chapterId);
      current.exams[examId] = exam;
      saveProgressData(current);
      setPendingState(btn);
      showToast('Chapter marked as incomplete', 'default');
    } else {
      // Mark complete
      exam.chaptersCompleted.push(chapterId);
      exam.lastActivity = new Date().toISOString();
      current.exams[examId] = exam;

      // Record activity for streak tracking
      const today = new Date().toISOString().slice(0, 10);
      if (!current.streaks.dates.includes(today)) {
        current.streaks.dates.push(today);
      }

      saveProgressData(current);
      setCompletedState(btn);
      showToast('Chapter marked as complete!', 'success');
    }
  });
}

function setCompletedState(btn) {
  btn.classList.add('mark-complete-btn--completed');
  btn.setAttribute('aria-pressed', 'true');
  btn.innerHTML = '<span class="mark-complete-btn__icon">&#10003;</span> Completed';
}

function setPendingState(btn) {
  btn.classList.remove('mark-complete-btn--completed');
  btn.setAttribute('aria-pressed', 'false');
  btn.innerHTML = 'Mark Complete';
}

// ── 5. Lesson Quiz ────────────────────────────────────────────────

/**
 * Wire up inline lesson quizzes. Each .lesson-quiz__item contains a question
 * and multiple .answer-btn buttons. Tracks score and shows a summary.
 */
export function initLessonQuiz() {
  const quizItems = $$('.lesson-quiz__item');
  if (quizItems.length === 0) return;

  const totalQuestions = quizItems.length;
  let answeredCount = 0;
  let correctCount = 0;

  quizItems.forEach(item => {
    const buttons = $$('.answer-btn', item);
    if (buttons.length === 0) return;

    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        // Prevent re-answering
        if (item.dataset.answered === 'true') return;
        item.dataset.answered = 'true';

        const isCorrect = btn.dataset.correct === 'true';
        answeredCount++;

        // Disable all buttons in this question
        buttons.forEach(b => {
          b.disabled = true;
          b.classList.add('answer-btn--disabled');
        });

        if (isCorrect) {
          correctCount++;
          btn.classList.add('answer-btn--correct');
        } else {
          btn.classList.add('answer-btn--incorrect');

          // Apply shake animation
          btn.classList.add('answer-btn--shake');
          btn.addEventListener('animationend', () => {
            btn.classList.remove('answer-btn--shake');
          }, { once: true });

          // Reveal the correct answer
          const correctBtn = buttons.find(b => b.dataset.correct === 'true');
          if (correctBtn) {
            correctBtn.classList.add('answer-btn--correct', 'answer-btn--revealed');
          }
        }

        // Show explanation if one exists
        const explanation = $('.lesson-quiz__explanation', item);
        if (explanation) {
          explanation.classList.add('lesson-quiz__explanation--visible');
          explanation.setAttribute('aria-hidden', 'false');
        }

        // Check if all questions answered — show summary
        if (answeredCount === totalQuestions) {
          showQuizSummary(correctCount, totalQuestions);
        }
      });
    });
  });
}

function showQuizSummary(correct, total) {
  const summaryEl = $('.lesson-quiz__summary');
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const quality = percent >= 80 ? 'excellent' : percent >= 60 ? 'good' : 'needs-review';

  const summaryHTML = `
    <div class="lesson-quiz__summary-content lesson-quiz__summary--${quality}">
      <h3 class="lesson-quiz__summary-title">Quiz Complete!</h3>
      <p class="lesson-quiz__summary-score">
        You got <strong>${correct}</strong> out of <strong>${total}</strong> correct (${percent}%)
      </p>
      <p class="lesson-quiz__summary-message">${getSummaryMessage(percent)}</p>
    </div>
  `;

  if (summaryEl) {
    summaryEl.innerHTML = summaryHTML;
    summaryEl.classList.add('lesson-quiz__summary--visible');
    summaryEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    // Append summary after the last quiz item
    const quizContainer = $('.lesson-quiz') || $$('.lesson-quiz__item').pop()?.parentElement;
    if (quizContainer) {
      const div = createEl('div', { class: 'lesson-quiz__summary lesson-quiz__summary--visible', html: summaryHTML });
      quizContainer.appendChild(div);
      div.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Save quiz score to progress
  const examId = document.body.dataset.exam;
  if (examId) {
    const progress = loadProgress();
    const exam = ensureExam(progress, examId);
    exam.quizScores.push({
      date: new Date().toISOString(),
      score: correct,
      total,
      passed: percent >= 70
    });
    exam.lastActivity = new Date().toISOString();
    saveProgressData(progress);
  }
}

function getSummaryMessage(percent) {
  if (percent === 100) return 'Perfect score! You have mastered this material.';
  if (percent >= 80) return 'Great job! You have a strong understanding of this topic.';
  if (percent >= 60) return 'Good effort. Review the missed questions to strengthen your knowledge.';
  if (percent >= 40) return 'You might want to re-read this chapter before moving on.';
  return 'Consider reviewing this material more carefully and trying again.';
}

// ── 6. Process Animations ─────────────────────────────────────────

/**
 * Reveal .process-step elements with a staggered animation as they
 * scroll into view using IntersectionObserver.
 */
export function initProcessAnimations() {
  const steps = $$('.process-step');
  if (steps.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const step = entry.target;

        // Calculate stagger delay based on index within parent
        const parent = step.parentElement;
        const siblings = parent ? $$('.process-step', parent) : [step];
        const index = siblings.indexOf(step);
        const delay = Math.max(0, index) * 120; // 120ms stagger

        setTimeout(() => {
          step.classList.add('process-step--visible');
        }, delay);

        // Stop observing once revealed
        observer.unobserve(step);
      });
    },
    { threshold: 0.3 }
  );

  steps.forEach(step => observer.observe(step));
}

// ── 7. Compare Tables ─────────────────────────────────────────────

/**
 * Add interactive highlighting to .compare-table elements.
 * Row click toggles row highlight; column header click toggles column highlight.
 */
export function initCompareTables() {
  const tables = $$('.compare-table');
  if (tables.length === 0) return;

  tables.forEach(table => {
    // Row click → toggle row highlight
    const rows = $$('tr', table);
    rows.forEach(row => {
      // Skip header rows from row-click highlighting
      if (row.parentElement.tagName === 'THEAD') return;

      row.addEventListener('click', (e) => {
        // Don't interfere with column header clicks bubbling up
        if (e.target.closest('th')) return;
        row.classList.toggle('compare-table__row--highlight');
      });
    });

    // Column header click → toggle column highlight
    const headerCells = $$('thead th[data-col], thead td[data-col]', table);
    headerCells.forEach(headerCell => {
      headerCell.style.cursor = 'pointer';

      headerCell.addEventListener('click', () => {
        const col = headerCell.dataset.col;
        if (!col) return;

        // Toggle highlight class on all cells in this column
        const colCells = $$(`[data-col="${col}"]`, table);
        const isHighlighted = headerCell.classList.contains('compare-table__col--highlight');

        colCells.forEach(cell => {
          if (isHighlighted) {
            cell.classList.remove('compare-table__col--highlight');
          } else {
            cell.classList.add('compare-table__col--highlight');
          }
        });
      });
    });
  });
}

// ── 8. Calculators ────────────────────────────────────────────────

/**
 * Wire up financial calculators by data-type.
 * Supported: bond-yield, margin, breakeven, tax-equiv
 */
export function initCalculators() {
  const calculators = $$('.calculator');
  if (calculators.length === 0) return;

  calculators.forEach(calc => {
    const type = calc.dataset.type;
    if (!type) return;

    const calcBtn = $('.calculator__btn', calc) || $('button', calc);
    if (!calcBtn) return;

    const resultEl = $('.calculator__result', calc);

    calcBtn.addEventListener('click', () => {
      const result = computeCalculation(type, calc);
      if (result === null) return;

      displayResult(resultEl || calc, result, type);
    });

    // Also allow Enter key in inputs
    $$('input', calc).forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          calcBtn.click();
        }
      });
    });
  });
}

function readInput(calc, name) {
  const input = $(`input[name="${name}"], input[data-field="${name}"], #${name}`, calc);
  if (!input) return NaN;
  const val = parseFloat(input.value);
  return val;
}

function computeCalculation(type, calc) {
  switch (type) {
    case 'bond-yield': {
      const coupon = readInput(calc, 'annual-coupon');
      const price = readInput(calc, 'market-price');
      if (isNaN(coupon) || isNaN(price) || price <= 0) {
        showToast('Please enter valid values. Market price must be greater than zero.', 'error');
        return null;
      }
      const currentYield = (coupon / price) * 100;
      return {
        label: 'Current Yield',
        value: `${currentYield.toFixed(2)}%`,
        detail: `Annual Coupon ($${coupon.toFixed(2)}) / Market Price ($${price.toFixed(2)}) \u00D7 100`
      };
    }

    case 'margin': {
      const marketValue = readInput(calc, 'market-value');
      const debitBalance = readInput(calc, 'debit-balance');
      if (isNaN(marketValue) || marketValue <= 0) {
        showToast('Please enter a valid market value greater than zero.', 'error');
        return null;
      }
      const regTMargin = marketValue * 0.5;
      const equity = isNaN(debitBalance) ? regTMargin : marketValue - debitBalance;
      return {
        label: 'Margin Calculation',
        value: `Reg T Margin: $${regTMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        detail: `Market Value: $${marketValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}${!isNaN(debitBalance) ? ` | Equity: $${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}`
      };
    }

    case 'breakeven': {
      const strike = readInput(calc, 'strike-price');
      const premium = readInput(calc, 'premium');
      const optionType = ($('select[name="option-type"], input[name="option-type"]:checked, [data-field="option-type"]', calc)?.value || 'call').toLowerCase();

      if (isNaN(strike) || isNaN(premium) || strike < 0 || premium < 0) {
        showToast('Please enter valid strike price and premium values.', 'error');
        return null;
      }

      const breakeven = optionType === 'put'
        ? strike - premium
        : strike + premium;

      const typeLabel = optionType === 'put' ? 'Put' : 'Call';
      const formula = optionType === 'put'
        ? `Strike ($${strike.toFixed(2)}) - Premium ($${premium.toFixed(2)})`
        : `Strike ($${strike.toFixed(2)}) + Premium ($${premium.toFixed(2)})`;

      return {
        label: `${typeLabel} Breakeven`,
        value: `$${breakeven.toFixed(2)}`,
        detail: formula
      };
    }

    case 'tax-equiv': {
      const taxFreeYield = readInput(calc, 'tax-free-yield');
      const taxRate = readInput(calc, 'tax-rate');
      if (isNaN(taxFreeYield) || isNaN(taxRate)) {
        showToast('Please enter valid yield and tax rate values.', 'error');
        return null;
      }
      // Accept tax rate as percentage (e.g. 32) or decimal (e.g. 0.32)
      const rate = taxRate > 1 ? taxRate / 100 : taxRate;
      if (rate >= 1) {
        showToast('Tax rate must be less than 100%.', 'error');
        return null;
      }
      const taxEquivYield = taxFreeYield / (1 - rate);
      return {
        label: 'Tax-Equivalent Yield',
        value: `${taxEquivYield.toFixed(2)}%`,
        detail: `Tax-Free Yield (${taxFreeYield}%) / (1 - ${(rate * 100).toFixed(1)}% Tax Rate)`
      };
    }

    default:
      console.warn(`Unknown calculator type: ${type}`);
      return null;
  }
}

function displayResult(container, result, type) {
  let resultEl = container.classList.contains('calculator__result')
    ? container
    : $('.calculator__result', container);

  if (!resultEl) {
    resultEl = createEl('div', { class: 'calculator__result' });
    container.appendChild(resultEl);
  }

  // Fade-in animation: reset and re-trigger
  resultEl.classList.remove('calculator__result--visible');

  resultEl.innerHTML = `
    <div class="calculator__result-label">${result.label}</div>
    <div class="calculator__result-value">${result.value}</div>
    <div class="calculator__result-detail">${result.detail}</div>
  `;

  // Trigger reflow to restart CSS animation
  void resultEl.offsetWidth;
  resultEl.classList.add('calculator__result--visible');
}
