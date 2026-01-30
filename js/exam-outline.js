// Dynamic exam content outline and study tips generator
import { $, $$, fetchJSON, getBasePath } from './utils.js';

/**
 * Initialize the exam outline by fetching data from exams.json
 * and rendering the content outline + study tips dynamically.
 */
export async function initExamOutline() {
  const examId = document.body.dataset.exam;
  if (!examId) return;

  const outlineContainer = $('#exam-outline');
  const tipsContainer = $('#exam-tips');
  if (!outlineContainer && !tipsContainer) return;

  const basePath = getBasePath();
  const exams = await fetchJSON(`${basePath}data/exams.json`);
  if (!exams || !Array.isArray(exams)) return;

  const exam = exams.find(e => e.id === examId);
  if (!exam) return;

  if (outlineContainer && exam.topics) {
    renderOutline(outlineContainer, exam, examId);
  }

  if (tipsContainer && exam.studyTips) {
    renderStudyTips(tipsContainer, exam);
  }
}

// ── Content Outline ─────────────────────────────────────────────

function renderOutline(container, exam, examId) {
  const accordion = document.createElement('div');

  exam.topics.forEach((topic, i) => {
    const sectionNum = i + 1;
    const item = document.createElement('div');
    item.className = 'accordion-item';
    item.id = `section-${sectionNum}`;

    const triggerId = `section-${sectionNum}-trigger`;
    const contentId = `section-${sectionNum}-content`;
    const weight = topic.weight;
    const questions = topic.questions;
    const questionsText = questions ? ` (~${questions} questions)` : '';

    item.innerHTML = `
      <button class="accordion-trigger" aria-expanded="false" aria-controls="${contentId}" id="${triggerId}">
        <span>
          <strong>Section ${sectionNum}:</strong> ${escapeHtml(topic.name)}
          <span class="topic-weight">&mdash; ${weight}%${questionsText}</span>
        </span>
        <svg class="accordion-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="5 8 10 13 15 8"></polyline>
        </svg>
      </button>
      <div class="accordion-content" id="${contentId}" role="region" aria-labelledby="${triggerId}">
        <div class="accordion-body">
          ${renderWeightBar(weight)}
          ${renderSubtopics(topic, examId, sectionNum)}
          ${renderConcepts(topic)}
        </div>
      </div>
    `;

    accordion.appendChild(item);
  });

  container.innerHTML = '';
  while (accordion.firstChild) {
    container.appendChild(accordion.firstChild);
  }

  // Bind accordion and concept card interactions
  bindAccordions(container);
  bindConceptCards(container);
}

function renderWeightBar(weight) {
  return `
    <div class="weight-bar mb-3">
      <div class="weight-bar__track">
        <div class="weight-bar__fill" style="width: ${weight}%; background: var(--color-primary);"></div>
      </div>
      <span class="weight-bar__label">${weight}%</span>
    </div>
  `;
}

function renderSubtopics(topic, examId, sectionNum) {
  if (!topic.subtopics || topic.subtopics.length === 0) return '';

  const prefix = examId.replace('series', 's');
  const items = topic.subtopics.map((sub, j) => {
    const topicId = topic.id ? `${topic.id}-s${j + 1}` : `${prefix}-s${sectionNum}-st${j + 1}`;
    return `
      <li class="subtopic-item">
        <label class="checkbox">
          <input type="checkbox" data-topic="${topicId}" aria-label="Mark as studied: ${escapeHtml(sub)}">
          <span>${escapeHtml(sub)}</span>
        </label>
      </li>
    `;
  }).join('');

  return `
    <h4 class="mb-2">Subtopics</h4>
    <ul class="subtopic-list mb-4">${items}</ul>
  `;
}

function renderConcepts(topic) {
  if (!topic.concepts || topic.concepts.length === 0) return '';

  const cards = topic.concepts.map(concept => `
    <div class="concept-card" role="button" tabindex="0" aria-expanded="false">
      <div class="concept-card__title">
        <span>${escapeHtml(concept.title)}</span>
        <svg class="accordion-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" width="16" height="16">
          <polyline points="5 8 10 13 15 8"></polyline>
        </svg>
      </div>
      <div class="concept-card__body">${concept.body}</div>
    </div>
  `).join('');

  return `<h4 class="mb-2">Key Concepts</h4>${cards}`;
}

// ── Study Tips ──────────────────────────────────────────────────

function renderStudyTips(container, exam) {
  const items = exam.studyTips.map(tip => `
    <li class="subtopic-item" style="padding: var(--space-md) 0;">
      <strong style="color: var(--color-primary);">${escapeHtml(tip.title)}</strong>
      <span>${escapeHtml(tip.body)}</span>
    </li>
  `).join('');

  container.innerHTML = `
    <div class="card card--flat" style="transform: none;">
      <ul style="list-style: none; padding: 0;">${items}</ul>
    </div>
  `;
}

// ── Event Binding ───────────────────────────────────────────────

function bindAccordions(container) {
  container.querySelectorAll('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion-item');
      const content = item.querySelector('.accordion-content');
      const isActive = item.classList.contains('active');

      if (isActive) {
        item.classList.remove('active');
        content.style.maxHeight = '0px';
      } else {
        item.classList.add('active');
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    });
  });
}

function bindConceptCards(container) {
  container.querySelectorAll('.concept-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');

      // Recalculate parent accordion max-height to fit expanded content
      const accordionContent = card.closest('.accordion-content');
      if (accordionContent && accordionContent.style.maxHeight) {
        requestAnimationFrame(() => {
          accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
        });
      }
    });
  });
}

// ── Utilities ───────────────────────────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
