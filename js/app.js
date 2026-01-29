import { initNavigation } from './navigation.js';
import { initAnimations, animateProgressBars, animateWeightBars } from './animations.js';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Always initialize
  initNavigation();
  initAnimations();
  animateProgressBars();
  animateWeightBars();

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
    import('./progress.js').then(m => m.initExamProgress());
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
