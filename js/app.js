import { initNavigation } from './navigation.js';
import { initAnimations, animateProgressBars, animateWeightBars } from './animations.js';

// Consent banner
function initConsentBanner() {
  if (localStorage.getItem('consent-accepted')) return;

  const banner = document.createElement('div');
  banner.className = 'consent-banner';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Terms and privacy consent');
  banner.innerHTML = `
    <div class="consent-banner__inner">
      <p class="consent-banner__text">
        By continuing to use this site, you agree to our
        <a href="/terms.html">Terms of Service</a> and
        <a href="/privacy.html">Privacy Policy</a>.
      </p>
      <button class="btn btn-primary consent-banner__btn" type="button">Agree</button>
    </div>
  `;

  document.body.appendChild(banner);

  banner.querySelector('.consent-banner__btn').addEventListener('click', () => {
    localStorage.setItem('consent-accepted', 'true');
    banner.classList.add('consent-banner--exit');
    banner.addEventListener('animationend', () => banner.remove());
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Always initialize
  initNavigation();
  initAnimations();
  animateProgressBars();
  animateWeightBars();
  initConsentBanner();

  // Page-specific initialization
  const page = document.body.dataset.page;

  if (page === 'quiz') {
    import('./quiz.js').then(m => m.initQuiz());
  }

  if (page === 'flashcards') {
    import('./flashcards.js').then(m => m.initFlashcards());
  }

  if (page === 'pathways') {
    import('./pathway.js').then(m => m.initPathway());
  }

  if (page === 'catalog' || page === 'home') {
    import('./search.js').then(m => m.initSearch());
  }

  if (page === 'progress') {
    import('./progress.js').then(m => m.initProgressDashboard());
  }

  if (page === 'exam') {
    // Outline must render first so checkboxes exist for progress tracking
    import('./exam-outline.js')
      .then(m => m.initExamOutline())
      .then(() => import('./progress.js'))
      .then(m => {
        m.initExamProgress();
        m.initPracticeQuiz();
      });
  }

  if (page === 'learn-catalog') {
    import('./learn.js').then(m => m.initCourseCatalog());
  }

  if (page === 'learn-overview') {
    import('./learn.js').then(m => m.initCourseOverview());
  }

  if (page === 'learn-chapter') {
    import('./learn.js').then(m => {
      m.initTableOfContents();
      m.initChapterProgress();
      m.initLessonQuiz();
      m.initProcessAnimations();
      m.initCompareTables();
      m.initCalculators();
    });
  }
});
