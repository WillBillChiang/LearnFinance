/**
 * Licensing Pathway Visualization
 * Renders an interactive career pathway diagram with track highlighting.
 */

export async function initPathway() {
  const tracksContainer = document.getElementById('pathway-tracks');
  const diagramContainer = document.getElementById('pathway-diagram');
  const descriptionPanel = document.getElementById('track-description');

  if (!tracksContainer || !diagramContainer) return;

  // Fetch pathway data
  let data;
  try {
    const resp = await fetch('../data/pathways.json');
    data = await resp.json();
  } catch (err) {
    console.error('Failed to load pathways data:', err);
    return;
  }

  // Build lookup maps
  const nodeMap = {};
  data.nodes.forEach(n => { nodeMap[n.id] = n; });

  // ---- Render track buttons ----
  renderTrackButtons(data.tracks, tracksContainer, diagramContainer, descriptionPanel, data);

  // ---- Render diagram ----
  renderDiagram(data, diagramContainer);

  // ---- Resize handler ----
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      renderDiagram(data, diagramContainer);
      // Reapply active track if any
      const activeBtn = tracksContainer.querySelector('.track-btn.active');
      if (activeBtn) {
        const trackId = activeBtn.dataset.track;
        const track = data.tracks.find(t => t.id === trackId);
        if (track) highlightTrack(track, diagramContainer);
      }
    }, 250);
  });
}


/* ============================================================
   Track Buttons
   ============================================================ */

function renderTrackButtons(tracks, container, diagramContainer, descriptionPanel, data) {
  // "All" button
  const allBtn = document.createElement('button');
  allBtn.className = 'track-btn active';
  allBtn.textContent = 'All Paths';
  allBtn.setAttribute('aria-pressed', 'true');
  allBtn.addEventListener('click', () => {
    container.querySelectorAll('.track-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    allBtn.classList.add('active');
    allBtn.setAttribute('aria-pressed', 'true');
    clearHighlight(diagramContainer);
    descriptionPanel.hidden = true;
  });
  container.appendChild(allBtn);

  tracks.forEach(track => {
    const btn = document.createElement('button');
    btn.className = 'track-btn';
    btn.textContent = track.name;
    btn.dataset.track = track.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.style.setProperty('--track-color', track.color);

    btn.addEventListener('click', () => {
      container.querySelectorAll('.track-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      btn.style.borderColor = track.color;
      btn.style.color = track.color;
      btn.style.backgroundColor = track.color + '14';

      highlightTrack(track, diagramContainer);
      showTrackDescription(track, descriptionPanel);
    });

    container.appendChild(btn);
  });
}


/* ============================================================
   Diagram Rendering
   ============================================================ */

function renderDiagram(data, container) {
  container.innerHTML = '';

  const width = container.offsetWidth;
  const nodeW = 130;
  const nodeH = 64;

  // Layout rows
  const entryNodes = data.nodes.filter(n => n.category === 'entry');
  const repNodes = data.nodes.filter(n => n.category === 'representative');
  const principalNodes = data.nodes.filter(n => n.category === 'principal');

  // Vertical positions
  const rowY = { entry: 30, representative: 180, principal: 380 };

  // Calculate positions for each node
  const positions = {};

  // Entry row (SIE centered)
  entryNodes.forEach((node, i) => {
    positions[node.id] = {
      x: (width / 2) - (nodeW / 2),
      y: rowY.entry
    };
  });

  // Representative row - spread evenly
  const repCount = repNodes.length;
  const repTotalWidth = Math.min(width - 40, repCount * (nodeW + 16));
  const repStartX = (width - repTotalWidth) / 2;
  const repSpacing = repCount > 1 ? repTotalWidth / (repCount - 1) : 0;

  repNodes.forEach((node, i) => {
    positions[node.id] = {
      x: repCount > 1 ? repStartX + (i * repSpacing) - (nodeW / 2) : (width / 2) - (nodeW / 2),
      y: rowY.representative
    };
  });

  // Principal row - spread evenly
  const prinCount = principalNodes.length;
  const prinTotalWidth = Math.min(width - 40, prinCount * (nodeW + 40));
  const prinStartX = (width - prinTotalWidth) / 2;
  const prinSpacing = prinCount > 1 ? prinTotalWidth / (prinCount - 1) : 0;

  principalNodes.forEach((node, i) => {
    positions[node.id] = {
      x: prinCount > 1 ? prinStartX + (i * prinSpacing) - (nodeW / 2) : (width / 2) - (nodeW / 2),
      y: rowY.principal
    };
  });

  // Determine diagram height
  const maxY = Math.max(...Object.values(positions).map(p => p.y)) + nodeH + 60;
  container.style.minHeight = maxY + 'px';

  // Draw SVG arrows first (below nodes)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'pathway-svg');
  svg.style.position = 'absolute';
  svg.style.top = '0';
  svg.style.left = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';
  svg.style.zIndex = '0';

  // Arrow marker definition
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', 'arrowhead');
  marker.setAttribute('markerWidth', '10');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('refX', '10');
  marker.setAttribute('refY', '3.5');
  marker.setAttribute('orient', 'auto');
  const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
  polygon.setAttribute('fill', '#cbd5e1');
  marker.appendChild(polygon);
  defs.appendChild(marker);
  svg.appendChild(defs);

  // Draw edges
  data.edges.forEach(edge => {
    const fromPos = positions[edge.from];
    const toPos = positions[edge.to];
    if (!fromPos || !toPos) return;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', fromPos.x + nodeW / 2);
    line.setAttribute('y1', fromPos.y + nodeH);
    line.setAttribute('x2', toPos.x + nodeW / 2);
    line.setAttribute('y2', toPos.y);
    line.setAttribute('stroke', '#cbd5e1');
    line.setAttribute('stroke-width', '2');
    line.setAttribute('marker-end', 'url(#arrowhead)');
    line.dataset.from = edge.from;
    line.dataset.to = edge.to;
    svg.appendChild(line);
  });

  container.appendChild(svg);

  // Draw nodes
  data.nodes.forEach(node => {
    const pos = positions[node.id];
    if (!pos) return;

    const el = document.createElement('div');
    el.className = `pathway-node ${node.category}`;
    el.dataset.nodeId = node.id;
    el.style.left = pos.x + 'px';
    el.style.top = pos.y + 'px';
    el.style.width = nodeW + 'px';
    el.style.height = nodeH + 'px';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';

    el.innerHTML = `
      <span class="pathway-node__label">${node.label}</span>
      <span class="pathway-node__name">${node.name}</span>
    `;

    // Tooltip on hover
    el.setAttribute('title', `${node.label} - ${node.name}`);
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${node.label}: ${node.name}`);

    // Click to navigate to exam page
    el.addEventListener('click', () => {
      navigateToExam(node.id);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToExam(node.id);
      }
    });

    container.appendChild(el);
  });
}


/* ============================================================
   Track Highlighting
   ============================================================ */

function highlightTrack(track, container) {
  const nodes = container.querySelectorAll('.pathway-node');
  const lines = container.querySelectorAll('line');

  // Dim all nodes and lines
  nodes.forEach(node => {
    node.classList.remove('highlighted', 'pulse-highlight');
    node.style.opacity = '0.25';
    node.style.boxShadow = '';
    node.style.borderColor = '';
  });
  lines.forEach(line => {
    line.setAttribute('stroke', '#cbd5e1');
    line.setAttribute('stroke-width', '2');
    line.style.opacity = '0.15';
  });

  // Highlight track nodes
  track.exams.forEach(examId => {
    const node = container.querySelector(`[data-node-id="${examId}"]`);
    if (node) {
      node.classList.add('highlighted', 'pulse-highlight');
      node.style.opacity = '1';
      node.style.boxShadow = `0 0 0 3px ${track.color}, 0 10px 15px -3px rgba(0,0,0,0.1)`;
      node.style.borderColor = track.color;
    }
  });

  // Highlight connecting edges between track exams
  lines.forEach(line => {
    const from = line.dataset.from;
    const to = line.dataset.to;
    if (track.exams.includes(from) && track.exams.includes(to)) {
      line.setAttribute('stroke', track.color);
      line.setAttribute('stroke-width', '3');
      line.style.opacity = '1';
    }
  });
}

function clearHighlight(container) {
  const nodes = container.querySelectorAll('.pathway-node');
  const lines = container.querySelectorAll('line');

  nodes.forEach(node => {
    node.classList.remove('highlighted', 'pulse-highlight');
    node.style.opacity = '1';
    node.style.boxShadow = '';
    node.style.borderColor = '';
  });
  lines.forEach(line => {
    line.setAttribute('stroke', '#cbd5e1');
    line.setAttribute('stroke-width', '2');
    line.style.opacity = '1';
  });
}


/* ============================================================
   Track Description Panel
   ============================================================ */

function showTrackDescription(track, panel) {
  panel.hidden = false;
  panel.innerHTML = `
    <div class="track-description__inner" style="border-left: 4px solid ${track.color}; padding: var(--space-md) var(--space-lg); background: var(--color-surface); border-radius: var(--radius-lg); box-shadow: var(--shadow-md);">
      <h3 style="margin: 0 0 var(--space-sm); color: ${track.color};">${track.name}</h3>
      <p style="margin: 0 0 var(--space-sm); color: var(--color-text-secondary); font-size: var(--text-sm);">${track.description}</p>
      <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
        ${track.exams.map(id => `<span style="background: ${track.color}14; color: ${track.color}; padding: 0.2em 0.6em; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600;">${getLabel(id)}</span>`).join('')}
      </div>
    </div>
  `;
  panel.style.animation = 'fadeSlideUp 0.3s ease';
}


/* ============================================================
   Helpers
   ============================================================ */

function getLabel(id) {
  const labels = {
    sie: 'SIE',
    series7: 'Series 7',
    series6: 'Series 6',
    series63: 'Series 63',
    series65: 'Series 65',
    series66: 'Series 66',
    series79: 'Series 79',
    series82: 'Series 82',
    series86: 'Series 86/87',
    series99: 'Series 99',
    series52: 'Series 52',
    series50: 'Series 50',
    series3: 'Series 3',
    series24: 'Series 24',
    series27: 'Series 27',
    series53: 'Series 53',
    series4: 'Series 4',
    series9: 'Series 9/10'
  };
  return labels[id] || id;
}

function navigateToExam(id) {
  const fileMap = {
    sie: 'sie.html',
    series7: 'series7.html',
    series6: 'series6.html',
    series63: 'series63.html',
    series65: 'series65.html',
    series66: 'series66.html',
    series79: 'series79.html',
    series82: 'series82.html',
    series86: 'series86-87.html',
    series99: 'series99.html',
    series52: 'series52.html',
    series50: 'series50.html',
    series3: 'series3.html',
    series24: 'series24.html',
    series27: 'series27.html',
    series53: 'series53.html',
    series4: 'series4.html',
    series9: 'series9-10.html'
  };
  const file = fileMap[id];
  if (file) {
    window.location.href = `../exams/${file}`;
  }
}
