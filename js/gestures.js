// Touch swipe gesture handling for flashcards

export function initSwipeGesture(element, { onSwipeLeft, onSwipeRight, threshold = 80 }) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;

  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = startX;
    isDragging = true;
    element.style.transition = 'none';
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
    const diffX = currentX - startX;
    const diffY = e.touches[0].clientY - startY;

    // Only handle horizontal swipes
    if (Math.abs(diffX) > Math.abs(diffY)) {
      const rotation = diffX * 0.05;
      const opacity = 1 - Math.abs(diffX) / 400;
      element.style.transform = `translateX(${diffX}px) rotate(${rotation}deg)`;
      element.style.opacity = Math.max(opacity, 0.5);
    }
  }, { passive: true });

  element.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const diffX = currentX - startX;
    element.style.transition = '';

    if (diffX > threshold) {
      element.classList.add('swipe-right');
      setTimeout(() => onSwipeRight?.(), 300);
    } else if (diffX < -threshold) {
      element.classList.add('swipe-left');
      setTimeout(() => onSwipeLeft?.(), 300);
    } else {
      // Snap back
      element.style.transform = '';
      element.style.opacity = '';
    }
  });

  // Mouse support
  element.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    isDragging = true;
    element.style.transition = 'none';
    element.style.cursor = 'grabbing';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX;
    const diffX = currentX - startX;
    const rotation = diffX * 0.05;
    element.style.transform = `translateX(${diffX}px) rotate(${rotation}deg)`;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    element.style.transition = '';
    element.style.cursor = '';
    const diffX = currentX - startX;

    if (diffX > threshold) {
      element.classList.add('swipe-right');
      setTimeout(() => onSwipeRight?.(), 300);
    } else if (diffX < -threshold) {
      element.classList.add('swipe-left');
      setTimeout(() => onSwipeLeft?.(), 300);
    } else {
      element.style.transform = '';
    }
  });
}
