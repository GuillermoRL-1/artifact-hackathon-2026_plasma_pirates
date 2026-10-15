// Trajectory slides (sections/_18a-c): LIME weights, out-of-distribution scores, uncertainty.
// Data: window.TRAJECTORY (build_trajectory_data.py) and the official W&B runs in
// window.PIPELINE (build_pipeline_data.py). Same contract as pipeline.js:
//   <div data-traj="name" data-view="...">   drawn when its slide is first shown
//   <div class="traj-switch" data-for="id">  buttons with data-view="..." re-draw #id
(() => {
  const T = window.TRAJECTORY;
  const P = window.PIPELINE;
  if (typeof Reveal === 'undefined') return;

  const INK = '#e6edf3';
  const MUTED = '#9fb0c0';
  const AMBER = '#fbbf24';
  const GRID = 'rgba(165, 243, 252, 0.10)';
  const SURFACE = '#0d1b2a';
  // Validated dark-surface slots (see pipeline.js): blue / orange / aqua.
  const BLUE = '#3987e5';
  const ORANGE = '#d95926';
  const AQUA = '#199e70';
  const TARGET_LABEL = {E_MeV: 'E (MeV)', q_pC: 'q (pC)', dE_pct: 'ΔE (%)', emit_um: 'ε (µm)',
                        div_mrad: 'div (mrad)', sigz_um: 'σz (µm)'};
  const INPUT_LABEL = {cn2_max: 'cN2_max', dip_frac: 'dip_frac', l_inj: 'L_inj', p_max: 'P_max',
                       x_of: 'x_of', z_mm: 'z_mm'};
  const fmt = (v, d = 3) => (v === null || v === undefined ? '—' : Number(v).toFixed(d));

  const layout = (extra = {}) => {
    const base = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: {color: INK, size: 13, family: 'Inter, system-ui, sans-serif'},
      margin: {l: 64, r: 18, t: 30, b: 48},
      hoverlabel: {bgcolor: '#13283b', bordercolor: '#22d3ee', font: {color: INK, size: 12}},
      legend: {orientation: 'h', x: 0, y: 1.12, font: {size: 12, color: MUTED}},
      xaxis: {gridcolor: GRID, zeroline: false, linecolor: GRID, tickfont: {color: MUTED}},
      yaxis: {gridcolor: GRID, zeroline: false, linecolor: GRID, tickfont: {color: MUTED}},
    };
    for (const [k, v] of Object.entries(extra)) {
      base[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k]) ? {...base[k], ...v} : v;
    }
    return base;
  };
  const CONFIG = {displaylogo: false, responsive: true,
                  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d']};
  const plot = (el, traces, lay) => {
    if (!el._fullLayout) el.innerHTML = '';
    return Plotly.react(el, traces, lay, CONFIG);
  };
  const axisTitle = (text) => ({text, font: {size: 13, color: MUTED}});

  // ---- 1 · LIME weights ------------------------------------------------------------------
  // Diverging: orange (pushes the output down) ↔ grey midpoint ↔ blue (pushes it up).
  function limeHeatmap(el) {
    const L = T.lime;
    const peak = Math.max(...L.weights.flat().map(Math.abs));
    const inputs = L.inputs.map((i) => INPUT_LABEL[i] || i);
    const targets = L.targets.map((t) => TARGET_LABEL[t] || t);
    plot(el, [{
      type: 'heatmap', z: L.weights, x: targets, y: inputs, zmin: -peak, zmax: peak, zmid: 0,
      colorscale: [[0, ORANGE], [0.5, '#2c3440'], [1, BLUE]], xgap: 3, ygap: 3,
      text: L.weights.map((row) => row.map((v) => (v >= 0 ? '+' : '') + v.toFixed(2))),
      texttemplate: '%{text}', textfont: {color: INK, size: 13},
      colorbar: {thickness: 10, len: 0.85, tickfont: {color: MUTED, size: 11}, outlinewidth: 0,
                 title: {text: 'weight', font: {color: MUTED, size: 12}}},
      hovertemplate: '<b>%{y} → %{x}</b><br>LIME weight %{z:.3f}<extra></extra>',
    }], layout({
      margin: {l: 82, r: 10, t: 10, b: 40},
      xaxis: {side: 'bottom', tickfont: {color: INK, size: 13}},
      yaxis: {autorange: 'reversed', tickfont: {color: INK, size: 13}},
    }));
    // Clicking a column shows that target's ranking on the right.
    el.on('plotly_click', (event) => {
      const t = L.targets[targets.indexOf(event.points[0].x)];
      const bars = document.getElementById('lime-bars');
      const group = document.querySelector('.traj-switch[data-for="lime-bars"]');
      group?.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.view === t));
      if (bars) { bars.dataset.view = t; draw(bars); }
    });
  }

  function limeBars(el) {
    const L = T.lime;
    const t = el.dataset.view || 'E_MeV';
    const col = L.targets.indexOf(t);
    const items = L.inputs.map((i, r) => [INPUT_LABEL[i] || i, L.weights[r][col]])
      .sort((a, b) => Math.abs(a[1]) - Math.abs(b[1]));
    plot(el, [{
      type: 'bar', orientation: 'h', x: items.map((i) => i[1]), y: items.map((i) => i[0]),
      marker: {color: items.map((i) => (i[1] >= 0 ? BLUE : ORANGE))},
      text: items.map((i) => (i[1] >= 0 ? '+' : '') + i[1].toFixed(2)), textposition: 'outside',
      textfont: {color: MUTED, size: 12}, cliponaxis: false,
      hovertemplate: '%{y} → ' + (TARGET_LABEL[t] || t) + ': %{x:.3f}<extra></extra>',
    }], layout({
      margin: {l: 74, r: 14, t: 8, b: 40}, showlegend: false, bargap: 0.35,
      xaxis: {zeroline: true, zerolinecolor: MUTED, zerolinewidth: 1,
              range: [-1.6, 1.6], title: axisTitle(`LIME weight on ${TARGET_LABEL[t] || t}`)},
      yaxis: {tickfont: {color: INK, size: 13}},
    }));
  }

  // ---- 2 · out of distribution: official scores below and above the density cut ----------
  const oodRuns = () => (P?.runs || []).filter((r) => r.official && r.task === 'ood'
    && r.summary['pallas/in_distribution/mean_r2'] !== undefined)
    .sort((a, b) => a.created.localeCompare(b.created));

  function oodDumbbell(el) {
    const runs = oodRuns();
    const run = runs.find((r) => `${r.model} v${r.model_version}` === el.dataset.view)
      || runs[runs.length - 1];
    const S = run.summary;
    const targets = Object.keys(TARGET_LABEL);
    const labels = targets.map((t) => TARGET_LABEL[t]);
    const inDist = targets.map((t) => S[`pallas/in_distribution/r2/${t}`]);
    const above = targets.map((t) => S[`pallas/r2/${t}`]);
    const lines = targets.map((t, i) => ({
      type: 'scatter', mode: 'lines', x: [above[i], inDist[i]], y: [labels[i], labels[i]],
      line: {color: 'rgba(159, 176, 192, 0.5)', width: 3}, hoverinfo: 'skip', showlegend: false}));
    plot(el, [
      ...lines,
      {type: 'scatter', mode: 'markers', name: 'below the cut (in distribution)', x: inDist,
       y: labels, marker: {color: BLUE, size: 13, line: {color: SURFACE, width: 2}},
       hovertemplate: '%{y}: %{x:.4f} below the cut<extra></extra>'},
      {type: 'scatter', mode: 'markers', name: 'above the cut (out of distribution)', x: above,
       y: labels, marker: {color: ORANGE, size: 13, symbol: 'diamond', line: {color: SURFACE, width: 2}},
       customdata: targets.map((t) => S[`pallas/drop/${t}`]),
       hovertemplate: '%{y}: %{x:.4f} above the cut · drop %{customdata:.4f}<extra></extra>'},
    ], layout({
      margin: {l: 92, r: 18, t: 40, b: 46}, legend: {y: 1.14},
      xaxis: {range: [0.88, 1.002], title: axisTitle('official R² on the hidden test')},
      yaxis: {autorange: 'reversed', tickfont: {color: INK, size: 13}},
    }));
    const kpi = document.getElementById('ood-kpis');
    if (kpi) {
      kpi.innerHTML = `
        <div><b>${fmt(S['pallas/in_distribution/mean_r2'], 4)}</b><span>below the cut</span></div>
        <div><b>${fmt(S['pallas/mean_r2'], 4)}</b><span>above the cut</span></div>
        <div><b>${fmt(S['pallas/drop/mean'], 4)}</b><span>gap (the deliverable)</span></div>`;
    }
  }

  function oodGaps(el) {
    const runs = oodRuns();
    const labels = runs.map((r) => `${r.model.replace('_trajectory', '').replace('_two_stage', '')} v${r.model_version}`);
    plot(el, [{
      type: 'bar', orientation: 'h', x: runs.map((r) => r.summary['pallas/drop/mean']), y: labels,
      marker: {color: runs.map((r) => (r.model.startsWith('sj_') ? BLUE : '#5a6b7c'))},
      text: runs.map((r) => r.summary['pallas/drop/mean'].toFixed(4)), textposition: 'outside',
      textfont: {color: MUTED, size: 12}, cliponaxis: false,
      customdata: runs.map((r) => [r.summary['pallas/in_distribution/mean_r2'], r.summary['pallas/mean_r2']]),
      hovertemplate: '<b>%{y}</b><br>below %{customdata[0]:.4f} · above %{customdata[1]:.4f}' +
                     '<br>gap %{x:.4f}<extra></extra>',
    }], layout({
      margin: {l: 196, r: 46, t: 6, b: 40}, showlegend: false, bargap: 0.35,
      xaxis: {range: [0, 0.036], nticks: 4, tickangle: 0, title: axisTitle('gap: R² lost above the cut')},
      yaxis: {autorange: 'reversed', tickfont: {color: INK, size: 12}},
    }));
  }

  // ---- 3 · uncertainty -------------------------------------------------------------------
  function uncertaintyCurve(el) {
    const C = T.curve;
    const t = el.dataset.view || 'sigz_um';
    const k = Number(document.getElementById('sigma-k')?.value || 1);
    const d = C.targets[t];
    const upper = d.mean.map((m, i) => m + k * d.std[i]);
    const lower = d.mean.map((m, i) => m - k * d.std[i]);
    const inside = d.true.filter((v, i) => v >= lower[i] && v <= upper[i]).length / d.true.length;
    plot(el, [
      {type: 'scatter', mode: 'lines', x: C.z_mm, y: upper, line: {width: 0}, hoverinfo: 'skip',
       showlegend: false},
      {type: 'scatter', mode: 'lines', x: C.z_mm, y: lower, fill: 'tonexty',
       fillcolor: 'rgba(57, 135, 229, 0.25)', line: {width: 0}, name: `prediction ± ${k}σ`,
       hoverinfo: 'skip'},
      {type: 'scatter', mode: 'lines', x: C.z_mm, y: d.mean, name: 'prediction (MC-dropout mean)',
       line: {color: BLUE, width: 2},
       customdata: d.std, hovertemplate: 'z %{x:.2f} mm<br>%{y:.3g} ± %{customdata:.2g}<extra></extra>'},
      {type: 'scatter', mode: 'markers', x: C.z_mm, y: d.true, name: 'simulation (Smilei)',
       marker: {color: AMBER, size: 5},
       hovertemplate: 'z %{x:.2f} mm<br>simulation %{y:.3g}<extra></extra>'},
    ], layout({
      margin: {l: 64, r: 14, t: 40, b: 48}, legend: {y: 1.16},
      xaxis: {title: axisTitle('z along the accelerator (mm)')},
      yaxis: {title: axisTitle(TARGET_LABEL[t] || t)},
    }));
    const out = document.getElementById('sigma-inside');
    if (out) out.textContent = `${Math.round(inside * 100)} %`;
    const kOut = document.getElementById('sigma-k-out');
    if (kOut) kOut.textContent = `${k}σ`;
  }

  // Does the model know how wrong it is? Per configuration: its own typical uncertainty
  // (RMS of sigma) and its actual typical error, both in %, binned along the gas density.
  function honesty(el) {
    const Cal = T.calibration;
    const t = el.dataset.view || 'sigz_um';
    const pc = Cal.per_config;
    const pts = pc.P_max.map((p, i) => ({p, err: pc[`err_${t}`][i], sig: pc[`sigma_${t}`][i]}));
    const lo = Math.min(...pc.P_max);
    const hi = Math.max(...pc.P_max);
    const cut = Cal.threshold;
    // Bins whose edges fall on the cut, so no bin mixes the two sides.
    const size = (hi - lo) / 12;
    const first = cut - Math.ceil((cut - lo) / size) * size;
    const median = (a) => { const b = [...a].sort((x, y) => x - y); const m = b.length >> 1;
                            return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
    const bins = [];
    for (let x = first; x < hi; x += size) {
      const inBin = pts.filter((q) => q.p >= x && q.p < x + size);
      if (inBin.length >= 5) {
        bins.push({x: x + size / 2, err: median(inBin.map((q) => q.err)),
                   sig: median(inBin.map((q) => q.sig)), n: inBin.length});
      }
    }
    const xs = bins.map((b) => b.x);
    const top = Math.max(...bins.map((b) => Math.max(b.err, b.sig))) * 1.25;
    plot(el, [
      // Shade the gap where the real error is larger than what the model admits.
      {type: 'scatter', mode: 'lines', x: xs, y: bins.map((b) => b.sig), line: {width: 0},
       hoverinfo: 'skip', showlegend: false},
      {type: 'scatter', mode: 'lines', x: xs, y: bins.map((b) => Math.max(b.err, b.sig)),
       fill: 'tonexty', fillcolor: 'rgba(217, 89, 38, 0.22)', line: {width: 0},
       name: 'over-confident: error larger than it says', hoverinfo: 'skip'},
      {type: 'scatter', mode: 'lines+markers', x: xs, y: bins.map((b) => b.sig),
       name: 'what the model says (± σ)', line: {color: BLUE, width: 3},
       marker: {color: BLUE, size: 8, line: {color: SURFACE, width: 2}},
       customdata: bins.map((b) => b.n),
       hovertemplate: 'P_max ≈ %{x:.0f} Pa<br>model says ±%{y:.1f} %<br>%{customdata} configurations<extra></extra>'},
      {type: 'scatter', mode: 'lines+markers', x: xs, y: bins.map((b) => b.err),
       name: 'what it really gets wrong', line: {color: ORANGE, width: 3},
       marker: {color: ORANGE, size: 8, symbol: 'diamond', line: {color: SURFACE, width: 2}},
       hovertemplate: 'P_max ≈ %{x:.0f} Pa<br>actual error %{y:.1f} %<extra></extra>'},
    ], layout({
      margin: {l: 58, r: 14, t: 46, b: 48}, legend: {y: 1.2, traceorder: 'normal'},
      xaxis: {title: axisTitle('gas density P_max (Pa)')},
      yaxis: {range: [0, top], ticksuffix: ' %', title: axisTitle(`typical error on ${(TARGET_LABEL[t] || t).replace(/ \(.*\)/, '')}, in %`)},
      shapes: [{type: 'line', xref: 'x', yref: 'paper', x0: cut, x1: cut, y0: 0, y1: 1,
                line: {color: AMBER, width: 2, dash: 'dash'}},
               {type: 'rect', xref: 'x', yref: 'paper', x0: cut, x1: hi + size, y0: 0, y1: 1,
                fillcolor: 'rgba(251, 191, 36, 0.06)', line: {width: 0}, layer: 'below'}],
      annotations: [
        {xref: 'x', yref: 'paper', x: cut, y: 1, xanchor: 'right', yanchor: 'bottom', showarrow: false,
         text: 'trained here ', font: {color: MUTED, size: 12}},
        {xref: 'x', yref: 'paper', x: cut, y: 1, xanchor: 'left', yanchor: 'bottom', showarrow: false,
         text: ' never seen', font: {color: AMBER, size: 12}},
      ],
    }));
  }

  // ---- wiring ----------------------------------------------------------------------------
  const VIZ = {'lime-heatmap': limeHeatmap, 'lime-bars': limeBars, 'ood-dumbbell': oodDumbbell,
               'ood-gaps': oodGaps, 'uncertainty-curve': uncertaintyCurve, honesty};
  function draw(el) {
    const fn = VIZ[el.dataset.traj];
    if (!fn) return;
    if (!T || typeof Plotly === 'undefined') {
      el.innerHTML = '<p class="viz-empty">No data: run presentation/build_trajectory_data.py.</p>';
      return;
    }
    fn(el);
    el.dataset.drawn = '1';
  }
  const showSlide = (slide) => {
    slide?.querySelectorAll('[data-traj]').forEach((el) => {
      if (!el.dataset.drawn) draw(el);
      else Plotly.Plots.resize(el);
    });
  };
  const init = () => {
    document.querySelectorAll('.traj-switch').forEach((group) => {
      group.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
        group.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === button));
        group.dataset.for.split(' ').forEach((id) => {
          const target = document.getElementById(id);
          target.dataset.view = button.dataset.view;
          draw(target);
        });
      }));
    });
    // The OOD model buttons come from the W&B runs, newest last.
    const oodSwitch = document.querySelector('.traj-switch[data-for="ood-chart"]');
    if (oodSwitch && P) {
      oodSwitch.innerHTML = oodRuns().map((r, i, all) => `<button class="${i === all.length - 1 ? 'active' : ''}"
        data-view="${r.model} v${r.model_version}">${r.model.replace('_trajectory', '')} v${r.model_version}</button>`).join('');
      oodSwitch.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => {
        oodSwitch.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === button));
        const target = document.getElementById('ood-chart');
        target.dataset.view = button.dataset.view;
        draw(target);
      }));
    }
    const k = document.getElementById('sigma-k');
    if (k) {
      k.addEventListener('input', () => draw(document.getElementById('uncertainty-chart')));
      k.addEventListener('change', () => k.blur());   // arrows back to the deck
    }
    showSlide(Reveal.getCurrentSlide());
    Reveal.on('slidechanged', (event) => showSlide(event.currentSlide));
  };
  if (Reveal.isReady()) init();
  else Reveal.on('ready', init);
})();
