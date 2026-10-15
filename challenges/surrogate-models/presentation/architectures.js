// Architecture diagrams of the Trajectory B models (sections/_13-case_study.md), drawn as SVG
// from the code each model carries in the registry. A diagram is a row of columns; a column
// holds one block or several in parallel. Equal-sized neighbours connect lane to lane, any
// other pair fans out or in. The score badge is the registry's holdout mean R².
(() => {
  const P = window.PIPELINE;
  const W = 600;
  const PAD = 6;
  const GAP = 24;       // between columns, room for the arrow
  const LANE = 50;
  const LANE_GAP = 8;
  const KIND = {
    in: {stroke: '#22d3ee', fill: 'rgba(34, 211, 238, 0.10)', title: '#a5f3fc'},
    layer: {stroke: 'rgba(165, 243, 252, 0.45)', fill: '#13283b', title: '#e6edf3'},
    special: {stroke: '#e879f9', fill: 'rgba(232, 121, 249, 0.10)', title: '#f5d0fe'},
    op: {stroke: 'rgba(165, 243, 252, 0.45)', fill: '#0d1b2a', title: '#e6edf3'},
    out: {stroke: '#fbbf24', fill: 'rgba(251, 191, 36, 0.10)', title: '#fbbf24'},
  };

  const MODELS = {
    mlp: {
      model: ['grl_trajectory_torch_mlp', 1],
      columns: [
        {w: 1, blocks: [{t: '6 inputs', s: ['5 settings', '+ position z'], k: 'in'}]},
        {w: 1.5, blocks: [{t: 'Linear 256', s: ['→ SiLU'], rep: 4}]},
        {w: 1, blocks: [{t: 'Linear 6', s: ['one per target']}]},
        {w: 1, blocks: [{t: '6 targets', s: ['at this z'], k: 'out'}]},
      ],
      foot: 'One row per (settings, z) · MSE, AdamW, cosine schedule · 60 epochs',
    },
    dlinear: {
      model: ['hg_trajectory_dlinear_trajectory', 1],
      columns: [
        {w: 0.9, blocks: [{t: '5 settings', s: ['no z: the whole', 'curve at once'], k: 'in'}]},
        {w: 1.05, blocks: [{t: 'Embedding', s: ['Linear 256 → SiLU'], rep: 2}]},
        {w: 1.45, blocks: [
          {t: 'Trend', s: ['Linear → 113 z, low-pass'], k: 'special'},
          {t: 'Seasonal', s: ['Linear → 113 z, high-pass'], k: 'special'},
          {t: 'Polynomial', s: ['degree 3 in z'], k: 'special'},
        ]},
        {w: 0.35, blocks: [{t: 'Σ', k: 'op'}]},
        {w: 0.95, blocks: [{t: 'Curve', s: ['113 z × 6 targets'], k: 'out'}]},
      ],
      foot: 'Heads per target · moving average of 25 · MSE weighted ×2 on the first 40% of z',
    },
    bnn: {
      model: ['sj_trajectory_bayesian_nn', 5],
      columns: [
        {w: 0.9, blocks: [{t: '6 inputs', s: ['5 settings', '+ position z'], k: 'in'}]},
        {w: 1.35, blocks: [{t: 'Linear 512', s: ['→ SiLU → Dropout 5%'], rep: 4, k: 'special'}]},
        {w: 0.8, blocks: [{t: 'Linear 6', s: ['one per target']}]},
        {w: 0.95, blocks: [{t: '× 100 passes', s: ['dropout kept on'], k: 'op'}]},
        {w: 0.85, blocks: [{t: 'mean ± σ', s: ['6 targets'], k: 'out'}]},
      ],
      foot: 'Monte Carlo dropout: the spread of 100 random passes is the uncertainty',
    },
    mdn: {
      model: ['kkim_trajectory_hybrid_residual_mdn', 1],
      columns: [
        {w: 0.9, blocks: [{t: '6 inputs', s: ['5 settings', '+ position z'], k: 'in'}]},
        {w: 1.2, blocks: [
          {t: 'MLP anchor', s: ['3 × 128'], rep: 3},
          {t: 'Mixture trunk', s: ['Linear 128 → SiLU'], rep: 2, k: 'special'},
        ]},
        {w: 1.35, blocks: [
          {t: 'ŷ', s: ['point prediction']},
          {t: '4 Gaussians', s: ['weight, mean, covariance'], k: 'special'},
        ]},
        {w: 1.2, blocks: [{t: 'ŷ + residual', s: ['density: 90% intervals', 'conformal-calibrated'], k: 'out'}]},
      ],
      foot: 'Scored on ŷ · the mixture learns the anchor’s out-of-fold residuals (folds by configuration)',
    },
  };

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));

  function svg(spec) {
    const lanes = Math.max(...spec.columns.map((c) => c.blocks.length));
    const H = lanes * LANE + (lanes - 1) * LANE_GAP + 2 * PAD + 4;
    const unit = (W - 2 * PAD - GAP * (spec.columns.length - 1))
      / spec.columns.reduce((sum, c) => sum + c.w, 0);
    let x = PAD;
    const placed = spec.columns.map((column) => {
      const width = column.w * unit;
      const n = column.blocks.length;
      const top = (H - (n * LANE + (n - 1) * LANE_GAP)) / 2;
      const boxes = column.blocks.map((b, i) => ({...b, x, y: top + i * (LANE + LANE_GAP), w: width, h: LANE}));
      x += width + GAP;
      return boxes;
    });
    const parts = [];
    // Arrows first, under the blocks.
    placed.slice(0, -1).forEach((from, i) => {
      const to = placed[i + 1];
      const pairs = from.length === to.length ? from.map((a, j) => [a, to[j]])
        : from.flatMap((a) => to.map((b) => [a, b]));
      pairs.forEach(([a, b]) => {
        const x1 = a.x + a.w + (a.rep > 1 ? 5 : 0) + 1;
        const y1 = a.y + a.h / 2;
        const x2 = b.x - 4;
        const y2 = b.y + b.h / 2;
        const mid = (x1 + x2) / 2;
        parts.push(`<path d="M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}" fill="none"
          stroke="rgba(165, 243, 252, 0.55)" stroke-width="1.3" marker-end="url(#arch-arrow)"/>`);
      });
    });
    placed.flat().forEach((b) => {
      const kind = KIND[b.k || 'layer'];
      for (let r = Math.min(b.rep || 1, 4) - 1; r > 0; r -= 1) {   // stacked layers behind
        parts.push(`<rect x="${b.x + r * 2.5}" y="${b.y - r * 2.5}" width="${b.w}" height="${b.h}" rx="5"
          fill="${kind.fill}" stroke="${kind.stroke}" stroke-opacity="0.5"/>`);
      }
      parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5" fill="#0f2235"/>
        <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="5" fill="${kind.fill}" stroke="${kind.stroke}"/>`);
      const lines = b.s || [];
      const cx = b.x + b.w / 2;
      const titleY = b.y + b.h / 2 + (lines.length ? -lines.length * 6 + 5 : 5);
      parts.push(`<text x="${cx}" y="${titleY}" text-anchor="middle" fill="${kind.title}"
        font-size="${b.t.length <= 2 ? 19 : 14}" font-weight="650">${esc(b.t)}</text>`);
      lines.forEach((line, i) => parts.push(`<text x="${cx}" y="${titleY + 14 + i * 12}" text-anchor="middle"
        fill="#9fb0c0" font-size="11.5">${esc(line)}</text>`));
      if (b.rep > 1) {
        parts.push(`<text x="${b.x + b.w - 4}" y="${b.y + 11}" text-anchor="end" fill="#fbbf24"
          font-size="10" font-weight="700">×${b.rep}</text>`);
      }
    });
    return `<svg viewBox="0 0 ${W} ${H}" role="img" font-family="Inter, system-ui, sans-serif">
      <defs><marker id="arch-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7"
        orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="rgba(165, 243, 252, 0.75)"/></marker></defs>
      ${parts.join('')}</svg>`;
  }

  const score = ([name, version]) => {
    const m = (P?.models || []).find((x) => x.name === name && x.version === version);
    return m && m.mean ? Number(m.mean).toFixed(3) : null;
  };

  document.querySelectorAll('[data-arch]').forEach((el) => {
    const spec = MODELS[el.dataset.arch];
    if (!spec) return;
    const r2 = score(spec.model);
    el.innerHTML = `${svg(spec)}<p class="arch-foot">${esc(spec.foot)}</p>`;
    const badge = el.closest('.model-card')?.querySelector('.arch-score');
    if (badge && r2) {
      badge.textContent = `holdout R² ${r2}`;
      badge.title = `${spec.model[0]} v${spec.model[1]} in the model registry`;
    }
  });
})();
