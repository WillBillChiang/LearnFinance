// SVG Chart utilities

const CHART_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
];

/**
 * Create an SVG donut chart
 * @param {Array} segments - [{label, value, color?}]
 * @param {number} size - SVG size in px
 * @param {number} strokeWidth - ring thickness
 * @returns {SVGElement}
 */
export function createDonutChart(segments, size = 200, strokeWidth = 30) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('donut-chart');

  let offset = 0;

  segments.forEach((seg, i) => {
    const ratio = seg.value / total;
    const dashLength = circumference * ratio;
    const dashOffset = circumference * offset;
    const color = seg.color || CHART_COLORS[i % CHART_COLORS.length];

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', center);
    circle.setAttribute('cy', center);
    circle.setAttribute('r', radius);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', color);
    circle.setAttribute('stroke-width', strokeWidth);
    circle.setAttribute('stroke-dasharray', `${dashLength} ${circumference - dashLength}`);
    circle.setAttribute('stroke-dashoffset', -dashOffset);
    circle.setAttribute('transform', `rotate(-90 ${center} ${center})`);
    circle.style.transition = 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1)';

    // Tooltip on hover
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${seg.label}: ${seg.value}%`;
    circle.appendChild(title);

    circle.addEventListener('mouseenter', () => {
      circle.setAttribute('stroke-width', strokeWidth + 4);
      circle.style.filter = 'brightness(1.1)';
    });
    circle.addEventListener('mouseleave', () => {
      circle.setAttribute('stroke-width', strokeWidth);
      circle.style.filter = '';
    });

    svg.appendChild(circle);
    offset += ratio;
  });

  return svg;
}

/**
 * Create a donut chart legend
 * @param {Array} segments - [{label, value, color?}]
 * @returns {HTMLElement}
 */
export function createDonutLegend(segments) {
  const legend = document.createElement('div');
  legend.className = 'donut-legend';

  segments.forEach((seg, i) => {
    const color = seg.color || CHART_COLORS[i % CHART_COLORS.length];
    const item = document.createElement('div');
    item.className = 'donut-legend__item';
    item.innerHTML = `
      <span class="donut-legend__color" style="background:${color}"></span>
      <span>${seg.label} (${seg.value}%)</span>
    `;
    legend.appendChild(item);
  });

  return legend;
}

/**
 * Create an SVG progress ring
 * @param {number} percent - 0 to 100
 * @param {number} size - SVG size
 * @param {number} strokeWidth
 * @param {string} color
 * @returns {SVGElement}
 */
export function createProgressRing(percent, size = 80, strokeWidth = 6, color = '#3b82f6') {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const center = size / 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('progress-ring');

  // Background circle
  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', center);
  bgCircle.setAttribute('cy', center);
  bgCircle.setAttribute('r', radius);
  bgCircle.setAttribute('fill', 'none');
  bgCircle.setAttribute('stroke', '#e2e8f0');
  bgCircle.setAttribute('stroke-width', strokeWidth);

  // Progress circle
  const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progressCircle.setAttribute('cx', center);
  progressCircle.setAttribute('cy', center);
  progressCircle.setAttribute('r', radius);
  progressCircle.setAttribute('fill', 'none');
  progressCircle.setAttribute('stroke', color);
  progressCircle.setAttribute('stroke-width', strokeWidth);
  progressCircle.setAttribute('stroke-linecap', 'round');
  progressCircle.setAttribute('stroke-dasharray', circumference);
  progressCircle.setAttribute('stroke-dashoffset', circumference); // Start at 0
  progressCircle.classList.add('progress-ring__circle');
  progressCircle.setAttribute('transform', `rotate(-90 ${center} ${center})`);

  // Text in center
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', center);
  text.setAttribute('y', center);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('font-size', size * 0.22);
  text.setAttribute('font-weight', '600');
  text.setAttribute('fill', '#1e293b');
  text.textContent = `${Math.round(percent)}%`;

  svg.appendChild(bgCircle);
  svg.appendChild(progressCircle);
  svg.appendChild(text);

  // Animate after a brief delay
  requestAnimationFrame(() => {
    setTimeout(() => {
      progressCircle.setAttribute('stroke-dashoffset', offset);
    }, 100);
  });

  return svg;
}

/**
 * Create horizontal bar chart for quiz results
 * @param {Array} data - [{label, value, max}]
 * @returns {HTMLElement}
 */
export function createBarChart(data) {
  const container = document.createElement('div');
  container.className = 'topic-breakdown';

  data.forEach((item, i) => {
    const percent = item.max > 0 ? Math.round((item.value / item.max) * 100) : 0;
    const quality = percent >= 70 ? 'good' : percent >= 50 ? 'ok' : 'poor';

    const row = document.createElement('div');
    row.className = 'topic-row';
    row.innerHTML = `
      <span class="topic-row__name">${item.label}</span>
      <div class="topic-row__bar">
        <div class="topic-row__fill ${quality}" style="width: 0%">
          <span class="topic-row__score">${percent}%</span>
        </div>
      </div>
    `;
    container.appendChild(row);

    // Animate bar
    setTimeout(() => {
      const fill = row.querySelector('.topic-row__fill');
      fill.style.width = `${Math.max(percent, 8)}%`;
    }, 200 + i * 100);
  });

  return container;
}

/**
 * Create timer ring SVG for quiz
 * @param {number} size
 * @returns {{svg: SVGElement, update: Function}}
 */
export function createTimerRing(size = 48) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.classList.add('timer-ring');

  const bgCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  bgCircle.setAttribute('cx', center);
  bgCircle.setAttribute('cy', center);
  bgCircle.setAttribute('r', radius);
  bgCircle.classList.add('timer-ring__bg');

  const progressCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progressCircle.setAttribute('cx', center);
  progressCircle.setAttribute('cy', center);
  progressCircle.setAttribute('r', radius);
  progressCircle.setAttribute('stroke-dasharray', circumference);
  progressCircle.setAttribute('stroke-dashoffset', '0');
  progressCircle.classList.add('timer-ring__progress');
  progressCircle.setAttribute('transform', `rotate(-90 ${center} ${center})`);

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', center);
  text.setAttribute('y', center);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('dominant-baseline', 'central');
  text.setAttribute('font-size', '11');
  text.setAttribute('font-weight', '600');
  text.setAttribute('fill', '#1e293b');

  svg.appendChild(bgCircle);
  svg.appendChild(progressCircle);
  svg.appendChild(text);

  function update(percent, timeText) {
    const offset = circumference * (1 - percent / 100);
    progressCircle.setAttribute('stroke-dashoffset', offset);
    text.textContent = timeText;

    progressCircle.classList.remove('warning', 'danger');
    if (percent < 10) progressCircle.classList.add('danger');
    else if (percent < 25) progressCircle.classList.add('warning');
  }

  return { svg, update };
}
