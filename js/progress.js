// Progress tracking module - localStorage-based progress management
import { $, $$, fetchJSON, showToast, createEl, getBasePath, formatDate } from './utils.js';

const STORAGE_KEY = 'lf_progress';

// ── Internal helpers ──────────────────────────────────────────────

function getDefaultProgress() {
  return {
    exams: {},
    streaks: {
      dates: [],
      current: 0,
      longest: 0
    }
  };
}

function getDefaultExamProgress() {
  return {
    topicsStudied: [],
    chaptersCompleted: [],
    quizScores: [],
    flashcardsMastered: 0,
    lastActivity: null
  };
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    const data = JSON.parse(raw);
    // Ensure structure integrity
    if (!data.exams || typeof data.exams !== 'object') data.exams = {};
    if (!data.streaks || typeof data.streaks !== 'object') {
      data.streaks = { dates: [], current: 0, longest: 0 };
    }
    if (!Array.isArray(data.streaks.dates)) data.streaks.dates = [];
    return data;
  } catch {
    return getDefaultProgress();
  }
}

function saveProgress(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save progress:', err);
  }
}

function ensureExam(data, examId) {
  if (!data.exams[examId]) {
    data.exams[examId] = getDefaultExamProgress();
  }
  return data.exams[examId];
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function updateStreaks(data) {
  const dates = data.streaks.dates;
  if (dates.length === 0) {
    data.streaks.current = 0;
    return;
  }

  // Sort descending
  const sorted = [...new Set(dates)].sort().reverse();
  data.streaks.dates = sorted;

  // Calculate current streak from today backwards
  const today = todayString();
  let current = 0;
  let checkDate = new Date(today + 'T00:00:00');

  // Allow today or yesterday as the start
  const mostRecent = sorted[0];
  const diffFromToday = Math.floor((checkDate - new Date(mostRecent + 'T00:00:00')) / 86400000);
  if (diffFromToday > 1) {
    data.streaks.current = 0;
    return;
  }

  for (let i = 0; i < sorted.length; i++) {
    const expected = new Date(checkDate);
    expected.setDate(expected.getDate() - i);
    const expectedStr = expected.toISOString().slice(0, 10);
    if (sorted[i] === expectedStr) {
      current++;
    } else if (i === 0 && diffFromToday === 1) {
      // Most recent is yesterday, adjust
      checkDate.setDate(checkDate.getDate() - 1);
      if (sorted[i] === checkDate.toISOString().slice(0, 10)) {
        current++;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  data.streaks.current = current;
  if (current > data.streaks.longest) {
    data.streaks.longest = current;
  }
}

// ── Exported functions ────────────────────────────────────────────

/**
 * Record today's activity in the streak tracker
 */
export function recordActivity() {
  const data = loadProgress();
  const today = todayString();
  if (!data.streaks.dates.includes(today)) {
    data.streaks.dates.push(today);
  }
  updateStreaks(data);
  saveProgress(data);
}

/**
 * Mark a chapter as completed (or uncompleted)
 */
export function markChapterComplete(examId, chapterId, complete = true) {
  const data = loadProgress();
  const exam = ensureExam(data, examId);

  if (!exam.chaptersCompleted) exam.chaptersCompleted = [];

  if (complete && !exam.chaptersCompleted.includes(chapterId)) {
    exam.chaptersCompleted.push(chapterId);
  } else if (!complete) {
    exam.chaptersCompleted = exam.chaptersCompleted.filter(c => c !== chapterId);
  }

  exam.lastActivity = new Date().toISOString();
  saveProgress(data);
  recordActivity();
}

/**
 * Check if a chapter is completed
 */
export function isChapterComplete(examId, chapterId) {
  const data = loadProgress();
  const exam = data.exams[examId];
  if (!exam || !exam.chaptersCompleted) return false;
  return exam.chaptersCompleted.includes(chapterId);
}

/**
 * Get all completed chapters for an exam
 */
export function getCompletedChapters(examId) {
  const data = loadProgress();
  const exam = data.exams[examId];
  if (!exam || !exam.chaptersCompleted) return [];
  return [...exam.chaptersCompleted];
}

/**
 * Toggle a topic as studied or not
 */
export function markTopicStudied(examId, topicId, studied) {
  const data = loadProgress();
  const exam = ensureExam(data, examId);

  if (studied && !exam.topicsStudied.includes(topicId)) {
    exam.topicsStudied.push(topicId);
  } else if (!studied) {
    exam.topicsStudied = exam.topicsStudied.filter(t => t !== topicId);
  }

  exam.lastActivity = new Date().toISOString();
  saveProgress(data);
  recordActivity();
}

/**
 * Append a quiz score result
 */
export function saveQuizScore(examId, score, total, passed) {
  const data = loadProgress();
  const exam = ensureExam(data, examId);

  exam.quizScores.push({
    date: new Date().toISOString(),
    score,
    total,
    passed
  });

  exam.lastActivity = new Date().toISOString();
  saveProgress(data);
  recordActivity();
}

/**
 * Get progress object for a single exam
 */
export function getExamProgress(examId) {
  const data = loadProgress();
  return data.exams[examId] || getDefaultExamProgress();
}

/**
 * Return the full progress data
 */
export function getAllProgress() {
  return loadProgress();
}

/**
 * Export progress as a JSON string
 */
export function exportProgress() {
  return JSON.stringify(loadProgress(), null, 2);
}

/**
 * Validate and merge imported progress JSON
 */
export function importProgress(json) {
  try {
    const imported = typeof json === 'string' ? JSON.parse(json) : json;

    // Validate top-level structure
    if (!imported || typeof imported !== 'object') {
      throw new Error('Invalid progress data format');
    }

    const current = loadProgress();

    // Merge exams
    if (imported.exams && typeof imported.exams === 'object') {
      for (const [examId, examData] of Object.entries(imported.exams)) {
        const existing = ensureExam(current, examId);

        // Merge topicsStudied (union)
        if (Array.isArray(examData.topicsStudied)) {
          const merged = new Set([...existing.topicsStudied, ...examData.topicsStudied]);
          existing.topicsStudied = [...merged];
        }

        // Merge chaptersCompleted (union)
        if (Array.isArray(examData.chaptersCompleted)) {
          if (!existing.chaptersCompleted) existing.chaptersCompleted = [];
          const mergedChapters = new Set([...existing.chaptersCompleted, ...examData.chaptersCompleted]);
          existing.chaptersCompleted = [...mergedChapters];
        }

        // Merge quizScores (append non-duplicate by date)
        if (Array.isArray(examData.quizScores)) {
          const existingDates = new Set(existing.quizScores.map(q => q.date));
          for (const quiz of examData.quizScores) {
            if (quiz.date && !existingDates.has(quiz.date)) {
              existing.quizScores.push(quiz);
            }
          }
        }

        // Take higher flashcardsMastered
        if (typeof examData.flashcardsMastered === 'number') {
          existing.flashcardsMastered = Math.max(
            existing.flashcardsMastered,
            examData.flashcardsMastered
          );
        }

        // Take most recent lastActivity
        if (examData.lastActivity) {
          if (!existing.lastActivity || examData.lastActivity > existing.lastActivity) {
            existing.lastActivity = examData.lastActivity;
          }
        }
      }
    }

    // Merge streak dates (union)
    if (imported.streaks && Array.isArray(imported.streaks.dates)) {
      const mergedDates = new Set([...current.streaks.dates, ...imported.streaks.dates]);
      current.streaks.dates = [...mergedDates];
      // Take longer longest streak
      if (typeof imported.streaks.longest === 'number') {
        current.streaks.longest = Math.max(
          current.streaks.longest || 0,
          imported.streaks.longest
        );
      }
      updateStreaks(current);
    }

    saveProgress(current);
    return true;
  } catch (err) {
    console.error('Import failed:', err);
    return false;
  }
}

/**
 * Clear all progress data
 */
export function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Exam page initialization ─────────────────────────────────────

/**
 * For exam pages: reads checkboxes with data-topic, syncs with stored
 * progress, updates progress bar, and optionally initializes donut chart.
 */
export function initExamProgress() {
  const checkboxes = $$('input[data-topic]');
  if (checkboxes.length === 0) return;

  // Determine exam ID from the page
  const examId = document.body.dataset.exam
    || document.querySelector('[data-exam]')?.dataset.exam
    || window.location.pathname.split('/').filter(Boolean).pop()?.replace('.html', '')
    || 'unknown';

  const progress = getExamProgress(examId);
  const totalTopics = checkboxes.length;

  // Set initial checkbox states from stored progress
  checkboxes.forEach(cb => {
    const topicId = cb.dataset.topic;
    if (progress.topicsStudied.includes(topicId)) {
      cb.checked = true;
    }
  });

  // Update progress bar display
  function updateProgressBar() {
    const studied = checkboxes.filter(cb => cb.checked).length;
    const percent = totalTopics > 0 ? Math.round((studied / totalTopics) * 100) : 0;

    const bar = $('#exam-progress-bar');
    if (bar) {
      const fill = bar.querySelector('.progress-bar__fill') || bar;
      fill.style.width = `${percent}%`;

      const label = bar.querySelector('.progress-bar__label')
        || bar.closest('.progress-bar')?.querySelector('.progress-bar__label');
      if (label) {
        label.textContent = `${percent}% complete`;
      }

      // Also update aria
      bar.setAttribute('aria-valuenow', percent);

      // Update data attribute for CSS
      bar.dataset.percent = percent;
    }

    return { studied, percent };
  }

  // Initial bar update
  updateProgressBar();

  // Listen for changes on each checkbox
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const topicId = cb.dataset.topic;
      markTopicStudied(examId, topicId, cb.checked);

      const { studied, percent } = updateProgressBar();

      if (cb.checked) {
        showToast(`Topic marked as studied (${studied}/${totalTopics})`, 'success');
      } else {
        showToast(`Topic unmarked (${studied}/${totalTopics})`, 'default');
      }
    });
  });

  // Initialize donut chart if the element exists
  const donutEl = $('#donut-chart');
  if (donutEl) {
    initDonutChart(donutEl, examId);
  }
}

async function initDonutChart(container, examId) {
  try {
    const { createDonutChart, createDonutLegend } = await import('./charts.js');

    let segments = [];

    // Load major section weights from exams.json
    try {
      const basePath = getBasePath();
      const exams = await fetchJSON(`${basePath}data/exams.json`);
      if (exams && Array.isArray(exams)) {
        const exam = exams.find(e => e.id === examId);
        if (exam && exam.topics) {
          segments = exam.topics.map(t => ({
            label: t.name,
            value: t.weight
          }));
        }
      }
    } catch {
      // Fallback: try data-topics attribute or checkboxes
    }

    // Fallback: data-topics attribute
    if (segments.length === 0) {
      const topicsAttr = container.dataset.topics;
      if (topicsAttr) {
        try {
          const topicsData = JSON.parse(topicsAttr);
          segments = topicsData.map(t => ({
            label: t.name || t.label,
            value: t.weight || t.value || 0
          }));
        } catch {
          // ignore parse errors
        }
      }
    }

    // Fallback: build from checkboxes
    if (segments.length === 0) {
      segments = buildSegmentsFromCheckboxes(examId);
    }

    if (segments.length === 0) return;

    const chart = createDonutChart(segments, 200, 30);
    const legend = createDonutLegend(segments);

    container.innerHTML = '';
    container.appendChild(chart);
    container.appendChild(legend);
  } catch (err) {
    console.error('Failed to initialize donut chart:', err);
  }
}

function buildSegmentsFromCheckboxes(examId) {
  const progress = getExamProgress(examId);
  const checkboxes = $$('input[data-topic]');
  const topicGroups = {};

  checkboxes.forEach(cb => {
    const topicId = cb.dataset.topic;
    // Group by parent topic (e.g., "sie-t1-s1" -> "sie-t1")
    const parts = topicId.split('-');
    const parentId = parts.slice(0, -1).join('-');
    const groupName = cb.closest('[data-topic-name]')?.dataset.topicName || parentId;

    if (!topicGroups[parentId]) {
      topicGroups[parentId] = { name: groupName, total: 0, studied: 0 };
    }
    topicGroups[parentId].total++;
    if (progress.topicsStudied.includes(topicId)) {
      topicGroups[parentId].studied++;
    }
  });

  return Object.values(topicGroups).map(g => ({
    label: g.name,
    value: g.total > 0 ? Math.round((g.studied / g.total) * 100) : 0
  }));
}

// ── Progress dashboard initialization ────────────────────────────

/**
 * For progress/index.html: renders the full progress dashboard.
 */
export async function initProgressDashboard() {
  const container = $('#progress-dashboard') || document.querySelector('main');
  if (!container) return;

  // Show skeleton loading state
  container.innerHTML = `
    <div style="padding:var(--space-2xl) 0;" aria-busy="true" aria-label="Loading progress">
      <div class="skeleton skeleton--title" style="width:200px;margin-bottom:var(--space-sm)"></div>
      <div class="skeleton skeleton--text" style="width:300px;margin-bottom:var(--space-2xl)"></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--space-md);margin-bottom:var(--space-2xl)">
        <div class="skeleton skeleton--card" style="height:100px"></div>
        <div class="skeleton skeleton--card" style="height:100px"></div>
        <div class="skeleton skeleton--card" style="height:100px"></div>
        <div class="skeleton skeleton--card" style="height:100px"></div>
      </div>
      <div class="skeleton skeleton--card" style="height:200px"></div>
    </div>
  `;

  const progress = loadProgress();
  const basePath = getBasePath();

  // Load exam metadata
  const exams = await fetchJSON(`${basePath}data/exams.json`);
  if (!exams) {
    container.innerHTML = '<p class="error">Failed to load exam data.</p>';
    return;
  }

  const { createProgressRing } = await import('./charts.js');

  // Clear container and build dashboard
  container.innerHTML = '';
  container.className = (container.className || '') + ' progress-dashboard';

  // ── Header ──
  const header = createEl('div', { class: 'progress-dashboard__header' }, [
    createEl('h1', { text: 'Your Progress' }),
    createEl('p', { class: 'progress-dashboard__subtitle', text: 'Track your study journey across all exams' })
  ]);
  container.appendChild(header);

  // ── Stat cards ──
  const stats = computeOverallStats(progress, exams);
  const statsGrid = createEl('div', { class: 'progress-stats' });

  const statItems = [
    { label: 'Topics Studied', value: stats.topicsStudied, icon: '&#x1f4d6;' },
    { label: 'Quizzes Taken', value: stats.quizzesTaken, icon: '&#x1f4dd;' },
    { label: 'Best Score', value: stats.bestScore !== null ? `${stats.bestScore}%` : '--', icon: '&#x1f3c6;' },
    { label: 'Study Streak', value: `${stats.currentStreak} day${stats.currentStreak !== 1 ? 's' : ''}`, icon: '&#x1f525;' }
  ];

  statItems.forEach(stat => {
    const card = createEl('div', { class: 'stat-card' });
    card.innerHTML = `
      <div class="stat-card__icon">${stat.icon}</div>
      <div class="stat-card__value">${stat.value}</div>
      <div class="stat-card__label">${stat.label}</div>
    `;
    statsGrid.appendChild(card);
  });

  container.appendChild(statsGrid);

  // ── Per-exam progress cards ──
  const examSection = createEl('div', { class: 'progress-exams' }, [
    createEl('h2', { text: 'Exam Progress' })
  ]);

  const examGrid = createEl('div', { class: 'progress-exams__grid' });

  exams.forEach(exam => {
    const examProgress = progress.exams[exam.id] || getDefaultExamProgress();
    const totalTopics = countExamTopics(exam);
    const studiedCount = examProgress.topicsStudied.length;
    const percent = totalTopics > 0 ? Math.round((studiedCount / totalTopics) * 100) : 0;

    const quizCount = examProgress.quizScores.length;
    const lastScore = quizCount > 0
      ? examProgress.quizScores[quizCount - 1]
      : null;

    const color = percent >= 75 ? '#10b981' : percent >= 40 ? '#f59e0b' : '#3b82f6';
    const ring = createProgressRing(percent, 90, 7, color);

    const card = createEl('div', { class: 'progress-exam-card' });
    card.innerHTML = `
      <div class="progress-exam-card__ring"></div>
      <div class="progress-exam-card__info">
        <h3 class="progress-exam-card__title">${exam.series || exam.name}</h3>
        <p class="progress-exam-card__name">${exam.name}</p>
        <div class="progress-exam-card__details">
          <span>${studiedCount}/${totalTopics} topics</span>
          <span>${quizCount} quiz${quizCount !== 1 ? 'zes' : ''}</span>
          ${lastScore ? `<span>Last: ${Math.round((lastScore.score / lastScore.total) * 100)}%</span>` : ''}
        </div>
        ${examProgress.lastActivity
          ? `<p class="progress-exam-card__last">Last active: ${formatDate(examProgress.lastActivity)}</p>`
          : '<p class="progress-exam-card__last">Not started</p>'
        }
      </div>
    `;

    card.querySelector('.progress-exam-card__ring').appendChild(ring);
    examGrid.appendChild(card);
  });

  examSection.appendChild(examGrid);
  container.appendChild(examSection);

  // ── Study streak heatmap ──
  const streakSection = createEl('div', { class: 'progress-streaks' }, [
    createEl('h2', { text: 'Study Streak' })
  ]);

  const streakInfo = createEl('div', { class: 'progress-streaks__info' });
  streakInfo.innerHTML = `
    <span class="streaks-current">Current streak: <strong>${progress.streaks.current || 0} day${(progress.streaks.current || 0) !== 1 ? 's' : ''}</strong></span>
    <span class="streaks-longest">Longest streak: <strong>${progress.streaks.longest || 0} day${(progress.streaks.longest || 0) !== 1 ? 's' : ''}</strong></span>
  `;
  streakSection.appendChild(streakInfo);

  const heatmap = buildHeatmap(progress.streaks.dates || []);
  streakSection.appendChild(heatmap);
  container.appendChild(streakSection);

  // ── Export / Import / Reset buttons ──
  const actions = createEl('div', { class: 'progress-actions' });

  const exportBtn = createEl('button', {
    class: 'btn btn--secondary',
    text: 'Export Progress'
  });
  exportBtn.addEventListener('click', () => {
    const json = exportProgress();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = createEl('a', { href: url, download: 'learnfinance-progress.json' });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Progress exported successfully', 'success');
  });

  const importBtn = createEl('button', {
    class: 'btn btn--secondary',
    text: 'Import Progress'
  });
  importBtn.addEventListener('click', () => {
    const input = createEl('input', { type: 'file', accept: '.json' });
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      const file = input.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const success = importProgress(e.target.result);
        if (success) {
          showToast('Progress imported successfully', 'success');
          // Re-render dashboard
          initProgressDashboard();
        } else {
          showToast('Failed to import progress - invalid file', 'error');
        }
      };
      reader.readAsText(file);
      document.body.removeChild(input);
    });

    input.click();
  });

  const resetBtn = createEl('button', {
    class: 'btn btn--danger',
    text: 'Reset Progress'
  });
  resetBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
      resetProgress();
      showToast('Progress has been reset', 'default');
      initProgressDashboard();
    }
  });

  actions.appendChild(exportBtn);
  actions.appendChild(importBtn);
  actions.appendChild(resetBtn);
  container.appendChild(actions);
}

// ── Dashboard helpers ─────────────────────────────────────────────

function computeOverallStats(progress, exams) {
  let topicsStudied = 0;
  let quizzesTaken = 0;
  let bestScore = null;

  for (const examData of Object.values(progress.exams)) {
    topicsStudied += examData.topicsStudied.length;
    quizzesTaken += examData.quizScores.length;

    for (const quiz of examData.quizScores) {
      const pct = quiz.total > 0 ? Math.round((quiz.score / quiz.total) * 100) : 0;
      if (bestScore === null || pct > bestScore) {
        bestScore = pct;
      }
    }
  }

  return {
    topicsStudied,
    quizzesTaken,
    bestScore,
    currentStreak: progress.streaks.current || 0,
    longestStreak: progress.streaks.longest || 0
  };
}

function countExamTopics(exam) {
  if (!exam.topics || !Array.isArray(exam.topics)) return 0;
  let count = 0;
  for (const topic of exam.topics) {
    // Count subtopics if present, otherwise count the topic itself
    if (topic.subtopics && Array.isArray(topic.subtopics)) {
      count += topic.subtopics.length;
    } else {
      count++;
    }
  }
  return count;
}

function buildHeatmap(dates) {
  const wrapper = createEl('div', { class: 'heatmap-wrapper' });

  // Day labels
  const dayLabels = createEl('div', { class: 'heatmap-days' });
  ['', 'Mon', '', 'Wed', '', 'Fri', ''].forEach(label => {
    dayLabels.appendChild(createEl('span', { class: 'heatmap-day-label', text: label }));
  });
  wrapper.appendChild(dayLabels);

  const grid = createEl('div', { class: 'heatmap' });

  // Build a set for quick lookups
  const dateSet = new Set(dates);

  // Start from 52 weeks ago (364 days)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the most recent Sunday to align weeks
  const endDay = new Date(today);
  const dayOfWeek = endDay.getDay(); // 0=Sun

  // Start 51 weeks before the start of this week
  const startDay = new Date(endDay);
  startDay.setDate(startDay.getDate() - dayOfWeek - (51 * 7));

  // 52 weeks x 7 days
  const totalDays = 52 * 7 + dayOfWeek + 1;

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    const isFuture = d > today;
    const isActive = dateSet.has(dateStr);

    const cell = createEl('div', {
      class: `heatmap__cell${isActive ? ' heatmap__cell--active' : ''}${isFuture ? ' heatmap__cell--future' : ''}`,
      title: isFuture ? '' : `${dateStr}${isActive ? ' - Studied' : ''}`
    });

    grid.appendChild(cell);
  }

  wrapper.appendChild(grid);

  // Month labels
  const months = createEl('div', { class: 'heatmap-months' });
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth = -1;

  for (let w = 0; w < 52; w++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + w * 7);
    const m = d.getMonth();
    if (m !== lastMonth) {
      months.appendChild(createEl('span', { class: 'heatmap-month-label', text: monthNames[m] }));
      lastMonth = m;
    } else {
      months.appendChild(createEl('span', { class: 'heatmap-month-label', text: '' }));
    }
  }

  wrapper.appendChild(months);

  return wrapper;
}
