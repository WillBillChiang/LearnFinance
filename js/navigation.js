import { $, $$ } from './utils.js';

export function initNavigation() {
  initMobileMenu();
  initActiveLinks();
  initHeaderScroll();
  initReadingProgress();
  initAccordions();
  initConceptCards();
  initTabs();
  initThemeToggle();
  initBottomNav();
}

// Mobile hamburger menu
function initMobileMenu() {
  const toggle = $('.menu-toggle') || $('.hamburger');
  const mobileNav = $('.mobile-nav');
  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => {
    toggle.classList.toggle('active');
    mobileNav.classList.toggle('active');
    document.body.style.overflow = mobileNav.classList.contains('active') ? 'hidden' : '';
  });

  // Close on link click
  $$('.mobile-nav__link', mobileNav).forEach(link => {
    link.addEventListener('click', () => {
      toggle.classList.remove('active');
      mobileNav.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

// Highlight active nav link
function initActiveLinks() {
  const currentPath = window.location.pathname;
  $$('.nav__link, .nav-desktop__link, .mobile-nav__link, .bottom-nav__item').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;

    const linkPath = new URL(href, window.location.origin).pathname;
    if (currentPath === linkPath || (linkPath !== '/' && currentPath.startsWith(linkPath))) {
      link.classList.add('active');
    }
  });
}

// Header shadow on scroll
function initHeaderScroll() {
  const header = $('.header');
  if (!header) return;

  const onScroll = () => {
    header.classList.toggle('scrolled', window.scrollY > 10);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

// Reading progress indicator (with rAF throttle)
function initReadingProgress() {
  const bar = $('.reading-progress');
  if (!bar) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolled = (window.scrollY / docHeight) * 100;
        bar.style.width = `${Math.min(scrolled, 100)}%`;
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

// Accordion expand/collapse
function initAccordions() {
  $$('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const item = trigger.closest('.accordion-item');
      const content = item.querySelector('.accordion-content');
      const isActive = item.classList.contains('active');

      // Close siblings if in single-open mode
      const accordion = item.closest('.accordion');
      if (accordion && accordion.dataset.single !== undefined) {
        $$('.accordion-item.active', accordion).forEach(other => {
          if (other !== item) {
            other.classList.remove('active');
            other.querySelector('.accordion-content').style.maxHeight = '0px';
          }
        });
      }

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

// Expandable concept cards
function initConceptCards() {
  $$('.concept-card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('expanded');

      // Recalculate parent accordion max-height to fit expanded content
      const accordionContent = card.closest('.accordion-content');
      if (accordionContent && accordionContent.style.maxHeight) {
        // Use requestAnimationFrame to measure after the DOM updates
        requestAnimationFrame(() => {
          accordionContent.style.maxHeight = accordionContent.scrollHeight + 'px';
        });
      }
    });
  });
}

// Tabs
function initTabs() {
  $$('.tabs').forEach(tabBar => {
    const tabs = $$('.tab', tabBar);
    const container = tabBar.closest('.tabs-container') || tabBar.parentElement;
    const panels = $$('.tab-panel', container);

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const target = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        const panel = $(`[data-panel="${target}"]`, container);
        if (panel) panel.classList.add('active');
      });
    });
  });
}

// Theme toggle (dark/light mode)
function initThemeToggle() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Apply saved theme or system preference
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else if (prefersDark) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    }
  });

  // Toggle button click
  const toggleBtn = $('.theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
    });
  }
}

// Bottom navigation active state
function initBottomNav() {
  // Already handled by initActiveLinks
  // This hook is for future enhancements (e.g., hide on scroll down)
}
