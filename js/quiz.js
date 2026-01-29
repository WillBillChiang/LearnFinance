// Quiz engine module
import { $, $$, fetchJSON, shuffleArray, createEl, getBasePath, showToast, escapeHTML } from './utils.js';
import { createTimerRing, createBarChart } from './charts.js';

// ── State ────────────────────────────────────────────────────────

let state = {
  examId: null,
  examMeta: null,
  questions: [],
  answers: {},       // { questionIndex: selectedChoiceIndex }
  flagged: new Set(),
  currentIndex: 0,
  count: 25,
  timed: false,
  totalSeconds: 0,
  secondsLeft: 0,
  timerInterval: null,
  timerRing: null,
  submitted: false,
  reviewMode: false
};

// ── Public entry point ───────────────────────────────────────────

export function initQuiz() {
  const root = $('#quiz-root');
  if (!root) return;

  const params = new URLSearchParams(window.location.search);
  const examParam = params.get('exam');
  const countParam = params.get('count');
  const timedParam = params.get('timed');

  if (examParam) {
    // Direct-launch via URL params
    state.examId = examParam;
    state.count = countParam === 'all' ? Infinity : parseInt(countParam, 10) || 25;
    state.timed = timedParam === 'true';
    startQuiz(root);
  } else {
    // Show config form — populate exam dropdown
    initConfigForm(root);
  }
}

// ── Config form ──────────────────────────────────────────────────

async function initConfigForm(root) {
  const select = $('#quiz-exam-select');
  if (!select) return;

  const basePath = getBasePath();
  const exams = await fetchJSON(`${basePath}data/exams.json`);
  if (!exams || !Array.isArray(exams)) {
    select.innerHTML = '<option value="">Failed to load exams</option>';
    return;
  }

  select.innerHTML = '<option value="" disabled selected>Select an exam...</option>';
  exams.forEach(exam => {
    const opt = document.createElement('option');
    opt.value = exam.id;
    opt.textContent = `${exam.series} - ${exam.name}`;
    select.appendChild(opt);
  });

  const form = $('#quiz-config-form');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();

    const examId = select.value;
    if (!examId) {
      showToast('Please select an exam', 'error');
      return;
    }

    const countRadio = form.querySelector('input[name="qcount"]:checked');
    const countVal = countRadio ? countRadio.value : '25';
    const timedToggle = $('#quiz-timed-toggle');

    state.examId = examId;
    state.count = countVal === 'all' ? Infinity : parseInt(countVal, 10);
    state.timed = timedToggle ? timedToggle.checked : false;

    // Update URL without reload
    const url = new URL(window.location);
    url.searchParams.set('exam', examId);
    url.searchParams.set('count', countVal);
    url.searchParams.set('timed', state.timed);
    window.history.replaceState({}, '', url);

    startQuiz(root);
  });
}

// ── Start quiz ───────────────────────────────────────────────────

async function startQuiz(root) {
  // Show skeleton loading state
  root.innerHTML = `
    <div class="quiz-config" aria-busy="true" aria-label="Loading quiz">
      <div class="skeleton skeleton--title" style="margin-bottom:var(--space-lg)"></div>
      <div class="skeleton skeleton--text"></div>
      <div class="skeleton skeleton--text-short" style="margin-bottom:var(--space-xl)"></div>
      <div class="skeleton" style="height:120px;border-radius:var(--radius-lg);margin-bottom:var(--space-md)"></div>
      <div class="skeleton" style="height:120px;border-radius:var(--radius-lg);margin-bottom:var(--space-md)"></div>
      <div class="skeleton" style="height:120px;border-radius:var(--radius-lg);margin-bottom:var(--space-md)"></div>
      <div class="skeleton" style="height:120px;border-radius:var(--radius-lg)"></div>
    </div>
  `;

  const basePath = getBasePath();

  // Load exam metadata
  const exams = await fetchJSON(`${basePath}data/exams.json`);
  if (exams && Array.isArray(exams)) {
    state.examMeta = exams.find(e => e.id === state.examId) || null;
  }

  // Load questions
  const questions = await fetchJSON(`${basePath}data/quizzes/${state.examId}.json`);
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    root.innerHTML = `
      <div class="quiz-config" style="text-align:center;">
        <h2>No Questions Available</h2>
        <p style="margin:var(--space-md) 0;color:var(--color-text-secondary);">
          No quiz questions found for this exam yet. Check back soon!
        </p>
        <a href="./" class="btn btn--primary">Back to Quiz Setup</a>
      </div>
    `;
    return;
  }

  // Shuffle and limit
  const shuffled = shuffleArray(questions);
  const limit = state.count === Infinity ? shuffled.length : Math.min(state.count, shuffled.length);
  state.questions = shuffled.slice(0, limit);
  state.count = state.questions.length;
  state.answers = {};
  state.flagged = new Set();
  state.currentIndex = 0;
  state.submitted = false;
  state.reviewMode = false;

  // Timer setup
  if (state.timed) {
    state.totalSeconds = Math.round(state.count * 1.5 * 60); // 1.5 min per question
    state.secondsLeft = state.totalSeconds;
  }

  // Clear root and render
  root.innerHTML = '';
  renderQuiz(root);
}

// ── Render quiz ──────────────────────────────────────────────────

function renderQuiz(root) {
  root.innerHTML = '';
  root.className = 'quiz-active';

  // Header
  const header = createEl('div', { class: 'quiz-header' });

  const counter = createEl('span', { class: 'quiz-counter' });
  counter.id = 'quiz-counter';
  header.appendChild(counter);

  if (state.timed) {
    const timerWrap = createEl('div', { class: 'quiz-timer' });
    timerWrap.id = 'quiz-timer';
    const ring = createTimerRing(48);
    state.timerRing = ring;
    timerWrap.appendChild(ring.svg);
    header.appendChild(timerWrap);
    startTimer();
  }

  root.appendChild(header);

  // Progress dots
  const dotsWrap = createEl('div', { class: 'quiz-progress' });
  dotsWrap.id = 'quiz-dots';
  for (let i = 0; i < state.count; i++) {
    const dot = createEl('button', {
      class: 'quiz-dot',
      'aria-label': `Go to question ${i + 1}`,
      type: 'button'
    });
    dot.dataset.index = i;
    dot.addEventListener('click', () => goToQuestion(i, root));
    dotsWrap.appendChild(dot);
  }
  root.appendChild(dotsWrap);

  // Question container
  const qContainer = createEl('div', { id: 'quiz-question-area' });
  root.appendChild(qContainer);

  // Navigation
  const nav = createEl('div', { class: 'quiz-nav' });

  const prevBtn = createEl('button', {
    class: 'btn btn--secondary',
    text: 'Previous',
    type: 'button',
    id: 'quiz-prev'
  });
  prevBtn.addEventListener('click', () => goToQuestion(state.currentIndex - 1, root));

  const flagBtn = createEl('button', {
    class: 'quiz-flag',
    type: 'button',
    id: 'quiz-flag-btn'
  });
  flagBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> Flag';
  flagBtn.addEventListener('click', () => toggleFlag(root));

  const nextBtn = createEl('button', {
    class: 'btn btn--primary',
    text: 'Next',
    type: 'button',
    id: 'quiz-next'
  });
  nextBtn.addEventListener('click', () => {
    if (state.currentIndex === state.count - 1 && !state.submitted) {
      confirmSubmit(root);
    } else {
      goToQuestion(state.currentIndex + 1, root);
    }
  });

  nav.appendChild(prevBtn);
  nav.appendChild(flagBtn);
  nav.appendChild(nextBtn);
  root.appendChild(nav);

  // Render first question
  renderQuestion(root);
}

// ── Render single question ───────────────────────────────────────

function renderQuestion(root) {
  const area = $('#quiz-question-area', root);
  if (!area) return;

  const q = state.questions[state.currentIndex];
  const i = state.currentIndex;

  // Update counter
  const counter = $('#quiz-counter', root);
  if (counter) {
    counter.textContent = `Question ${i + 1} of ${state.count}`;
  }

  // Update dots
  const dots = $$('.quiz-dot', root);
  dots.forEach((dot, idx) => {
    dot.classList.remove('current');
    dot.classList.toggle('answered', state.answers[idx] !== undefined);
    dot.classList.toggle('flagged', state.flagged.has(idx));
    if (state.reviewMode) {
      const isCorrect = state.questions[idx] &&
        state.answers[idx] === state.questions[idx].correct;
      dot.classList.toggle('correct', state.answers[idx] !== undefined && isCorrect);
      dot.classList.toggle('incorrect', state.answers[idx] !== undefined && !isCorrect);
    }
    if (idx === i) dot.classList.add('current');
  });

  // Update nav buttons
  const prevBtn = $('#quiz-prev', root);
  const nextBtn = $('#quiz-next', root);
  const flagBtn = $('#quiz-flag-btn', root);

  if (prevBtn) prevBtn.disabled = i === 0;
  if (nextBtn) {
    if (state.submitted) {
      nextBtn.textContent = i === state.count - 1 ? 'See Results' : 'Next';
    } else {
      nextBtn.textContent = i === state.count - 1 ? 'Submit Quiz' : 'Next';
    }
  }
  if (flagBtn) {
    flagBtn.classList.toggle('flagged', state.flagged.has(i));
    if (state.submitted) flagBtn.style.display = 'none';
  }

  // Build question card with animation
  area.innerHTML = '';
  const card = createEl('div', { class: 'quiz-question slide-left' });

  // Topic label
  if (q.topic) {
    card.appendChild(createEl('div', { class: 'quiz-question__topic', text: q.topic }));
  }

  // Question text
  card.appendChild(createEl('p', { class: 'quiz-question__text', text: q.question }));

  // Choices
  const choicesWrap = createEl('div', { class: 'quiz-choices' });
  const letters = ['A', 'B', 'C', 'D'];

  q.choices.forEach((choice, ci) => {
    const btn = createEl('button', {
      class: 'quiz-choice',
      type: 'button'
    });

    const letterSpan = createEl('span', { class: 'quiz-choice__letter', text: letters[ci] });
    const textSpan = createEl('span', { text: choice });

    btn.appendChild(letterSpan);
    btn.appendChild(textSpan);

    // Selected state
    if (state.answers[i] === ci) {
      btn.classList.add('selected');
    }

    // Review mode: show correct/incorrect
    if (state.reviewMode) {
      btn.classList.add('disabled');
      if (ci === q.correct) {
        btn.classList.add('correct');
      } else if (state.answers[i] === ci && ci !== q.correct) {
        btn.classList.add('incorrect');
      }
    } else if (!state.submitted) {
      btn.addEventListener('click', () => selectAnswer(ci, root));
    }

    choicesWrap.appendChild(btn);
  });

  card.appendChild(choicesWrap);

  // Explanation in review mode
  if (state.reviewMode && q.explanation) {
    const explanation = createEl('div', { class: 'quiz-explanation' });
    explanation.innerHTML = `<strong>Explanation:</strong> ${escapeHTML(q.explanation)}`;
    card.appendChild(explanation);
  }

  area.appendChild(card);
}

// ── Answer selection ─────────────────────────────────────────────

function selectAnswer(choiceIndex, root) {
  if (state.submitted) return;
  state.answers[state.currentIndex] = choiceIndex;
  renderQuestion(root);
}

// ── Flag toggle ──────────────────────────────────────────────────

function toggleFlag(root) {
  const i = state.currentIndex;
  if (state.flagged.has(i)) {
    state.flagged.delete(i);
  } else {
    state.flagged.add(i);
  }
  renderQuestion(root);
}

// ── Navigation ───────────────────────────────────────────────────

function goToQuestion(index, root) {
  if (index < 0 || index >= state.count) {
    if (state.submitted && index >= state.count) {
      showResults(root);
    }
    return;
  }
  state.currentIndex = index;
  renderQuestion(root);
}

// ── Timer ────────────────────────────────────────────────────────

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);

  updateTimerDisplay();

  state.timerInterval = setInterval(() => {
    state.secondsLeft--;
    updateTimerDisplay();

    if (state.secondsLeft <= 0) {
      clearInterval(state.timerInterval);
      state.timerInterval = null;
      showToast('Time is up! Submitting your quiz...', 'error');
      submitQuiz($('#quiz-root'));
    }
  }, 1000);
}

function updateTimerDisplay() {
  if (!state.timerRing) return;

  const percent = (state.secondsLeft / state.totalSeconds) * 100;
  const mins = Math.floor(state.secondsLeft / 60);
  const secs = state.secondsLeft % 60;
  const timeText = `${mins}:${secs.toString().padStart(2, '0')}`;

  state.timerRing.update(percent, timeText);

  const timerWrap = $('#quiz-timer');
  if (timerWrap) {
    timerWrap.classList.remove('warning', 'danger');
    if (percent < 10) timerWrap.classList.add('danger');
    else if (percent < 25) timerWrap.classList.add('warning');
  }
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// ── Submit ───────────────────────────────────────────────────────

function confirmSubmit(root) {
  const unanswered = state.count - Object.keys(state.answers).length;
  const flaggedCount = state.flagged.size;

  let message = 'Are you sure you want to submit your quiz?';
  if (unanswered > 0) {
    message += `\n\nYou have ${unanswered} unanswered question${unanswered !== 1 ? 's' : ''}.`;
  }
  if (flaggedCount > 0) {
    message += `\nYou have ${flaggedCount} flagged question${flaggedCount !== 1 ? 's' : ''} for review.`;
  }

  if (confirm(message)) {
    submitQuiz(root);
  }
}

function submitQuiz(root) {
  state.submitted = true;
  stopTimer();
  showResults(root);
}

// ── Results ──────────────────────────────────────────────────────

async function showResults(root) {
  // Calculate score
  let correct = 0;
  const topicScores = {};

  state.questions.forEach((q, i) => {
    const isCorrect = state.answers[i] === q.correct;
    if (isCorrect) correct++;

    const topic = q.topic || 'General';
    if (!topicScores[topic]) {
      topicScores[topic] = { correct: 0, total: 0 };
    }
    topicScores[topic].total++;
    if (isCorrect) topicScores[topic].correct++;
  });

  const scorePercent = Math.round((correct / state.count) * 100);
  const passingScore = state.examMeta ? state.examMeta.passingScore : 70;
  const passed = scorePercent >= passingScore;

  // Clear and render results
  root.innerHTML = '';
  root.className = 'quiz-container';

  const results = createEl('div', { class: 'quiz-results' });

  // Title
  results.appendChild(createEl('h2', { text: 'Quiz Complete!' }));

  // Animated score counter
  const scoreEl = createEl('div', {
    class: `quiz-score ${passed ? 'pass' : 'fail'}`,
    text: '0%'
  });
  results.appendChild(scoreEl);

  // Pass/Fail badge
  const badge = createEl('div', {
    class: `quiz-result-label ${passed ? 'pass' : 'fail'}`,
    text: passed ? 'PASSED' : 'NOT YET PASSING'
  });
  results.appendChild(badge);

  // Score details
  const details = createEl('p', {
    class: 'quiz-result-details',
    text: `${correct} out of ${state.count} correct (${passingScore}% needed to pass)`
  });
  details.style.cssText = 'color:var(--color-text-secondary);margin-bottom:var(--space-xl);';
  results.appendChild(details);

  // Topic breakdown
  const topicData = Object.entries(topicScores).map(([label, data]) => ({
    label,
    value: data.correct,
    max: data.total
  }));

  if (topicData.length > 0) {
    const breakdownTitle = createEl('h3', { text: 'Topic Breakdown' });
    breakdownTitle.style.cssText = 'text-align:left;margin-bottom:var(--space-md);';
    results.appendChild(breakdownTitle);
    results.appendChild(createBarChart(topicData));
  }

  // Action buttons
  const actions = createEl('div', { class: 'quiz-nav' });
  actions.style.cssText = 'margin-top:var(--space-2xl);justify-content:center;gap:var(--space-md);flex-wrap:wrap;';

  const reviewBtn = createEl('button', {
    class: 'btn btn--secondary',
    text: 'Review Answers',
    type: 'button'
  });
  reviewBtn.addEventListener('click', () => {
    state.reviewMode = true;
    state.currentIndex = 0;
    renderQuiz(root);
  });

  const retryBtn = createEl('button', {
    class: 'btn btn--primary',
    text: 'Try Again',
    type: 'button'
  });
  retryBtn.addEventListener('click', () => {
    // Reset state and re-start
    state.answers = {};
    state.flagged = new Set();
    state.currentIndex = 0;
    state.submitted = false;
    state.reviewMode = false;
    if (state.timed) {
      state.secondsLeft = state.totalSeconds;
    }
    // Re-shuffle
    state.questions = shuffleArray(state.questions);
    renderQuiz(root);
    if (state.timed) startTimer();
  });

  const backBtn = createEl('a', {
    class: 'btn btn--secondary',
    text: 'Back to Exam',
    href: state.examMeta
      ? `../exams/${state.examId}.html`
      : './'
  });

  actions.appendChild(reviewBtn);
  actions.appendChild(retryBtn);
  actions.appendChild(backBtn);
  results.appendChild(actions);

  root.appendChild(results);

  // Animate score counter (count up from 0)
  animateScoreCounter(scoreEl, scorePercent);

  // Save score via dynamic import
  try {
    const { saveQuizScore } = await import('./progress.js');
    saveQuizScore(state.examId, correct, state.count, passed);
  } catch (err) {
    console.error('Failed to save quiz score:', err);
  }

  // Confetti if passed
  if (passed) {
    try {
      const { launchConfetti } = await import('./confetti.js');
      launchConfetti();
    } catch (err) {
      console.error('Failed to launch confetti:', err);
    }
  }
}

// ── Score animation ──────────────────────────────────────────────

function animateScoreCounter(el, target) {
  const duration = 1500;
  const start = performance.now();

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(eased * target);
    el.textContent = `${current}%`;

    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  }

  requestAnimationFrame(tick);
}
