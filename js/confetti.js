// Confetti celebration effect

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function launchConfetti(duration = 3000) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const container = document.createElement('div');
  container.className = 'confetti-container';
  document.body.appendChild(container);

  const count = 80;
  for (let i = 0; i < count; i++) {
    setTimeout(() => createPiece(container), Math.random() * duration * 0.3);
  }

  setTimeout(() => container.remove(), duration + 1000);
}

function createPiece(container) {
  const piece = document.createElement('div');
  piece.className = 'confetti-piece';

  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  const left = Math.random() * 100;
  const size = Math.random() * 8 + 6;
  const animDuration = Math.random() * 2 + 2;
  const shape = Math.random() > 0.5 ? '50%' : '0';

  Object.assign(piece.style, {
    left: `${left}%`,
    width: `${size}px`,
    height: `${size}px`,
    backgroundColor: color,
    borderRadius: shape,
    animationDuration: `${animDuration}s`,
    animationDelay: `${Math.random() * 0.5}s`,
    transform: `rotate(${Math.random() * 360}deg)`
  });

  container.appendChild(piece);

  setTimeout(() => piece.remove(), animDuration * 1000 + 1000);
}
