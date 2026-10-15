// Interactive pieces of the pipeline slides, drawn from window.PIPELINE
// (data/pipeline_snapshot.js, written by build_pipeline_data.py).
//
// Markup contract:
//   <span data-kpi="name"></span>          filled with a number from the snapshot
//   <div data-viz="name"></div>            drawn the first time its slide is shown
//   <div class="viz-switch" data-for="id"> buttons with data-view="..." re-draw #id
(() => {
  const P = window.PIPELINE;

  // Categorical slots validated on the deck surface #0d1b2a (dataviz validate_palette.js,
  // dark mode: adjacent CVD >= 8.4, normal-vision >= 19.3, all >= 3:1).
  const SLOTS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9'];
  const SYMBOLS = ['circle', 'diamond', 'square', 'triangle-up', 'x', 'star', 'hexagon'];
  const INK = '#e6edf3';
  const MUTED = '#9fb0c0';
  const AMBER = '#fbbf24';
  const GRID = 'rgba(165, 243, 252, 0.10)';
  const SURFACE = '#0d1b2a';

  // Colour follows the person, in the order of the title slide (by surname).
  const AUTHORS = [
    ['hayg', 'Hayg Guler'], ['ahill', 'Alexander Hill'], ['sebastien', 'Sébastien Joly'],
    ['keon', 'Keon Hee Kim'], ['mykyta', 'Mykyta Lenivenko'], ['guillermo', 'Guillermo Rodríguez'],
  ];
  const TASKS = [
    ['trajectory', 'Trajectory'], ['ood', 'OOD in density'], ['direct_B', 'Direct B'],
    ['inverse_A', 'Inverse A'], ['inverse_B', 'Inverse B'], ['moments', 'Moments'],
  ];
  const taskLabel = Object.fromEntries(TASKS);
  const taskColour = Object.fromEntries(TASKS.map(([t], i) => [t, SLOTS[i]]));

  const authorName = (raw) => {
    const key = (raw || '').toLowerCase();
    const hit = AUTHORS.find(([k]) => key.includes(k));
    return hit ? hit[1] : raw || 'unknown';
  };
  // Models carry their author's prefix (grl_, sj_, ...); the registry only knows who uploaded
  // them, which is not always the same person.
  const PREFIX = {grl: 'Guillermo Rodríguez', sj: 'Sébastien Joly', kkim: 'Keon Hee Kim',
                  m: 'Mykyta Lenivenko', hg: 'Hayg Guler', adh: 'Alexander Hill'};
  const modelAuthor = (m) => PREFIX[m.name.split('_')[0]] || authorName(m.author);
  const authorIndex = (name) => {
    const i = AUTHORS.findIndex(([, n]) => n === name);
    return i < 0 ? AUTHORS.length : i;
  };

  const fmt = (n) => Number(n).toLocaleString('en-US');
  const r2 = (v) => (v === null || v === undefined ? '—' : Number(v).toFixed(4));
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => (
    {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const short = (s, n = 110) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s || '');

  const layout = (extra = {}) => {
    const base = {
      paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
      font: {color: INK, size: 13, family: 'Inter, system-ui, sans-serif'},
      margin: {l: 64, r: 18, t: 36, b: 50},
      hoverlabel: {bgcolor: '#13283b', bordercolor: '#22d3ee', font: {color: INK, size: 12}},
      legend: {orientation: 'h', x: 0, y: 1.12, font: {size: 12, color: MUTED}},
      xaxis: {gridcolor: GRID, zeroline: false, linecolor: GRID, tickfont: {color: MUTED}},
      yaxis: {gridcolor: GRID, zeroline: false, linecolor: GRID, tickfont: {color: MUTED}},
    };
    for (const [k, v] of Object.entries(extra)) {
      base[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k])
        ? {...base[k], ...v} : v;
    }
    return base;
  };
  const CONFIG = {displaylogo: false, responsive: true,
                  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d']};
  const plot = (el, traces, lay) => {
    if (!el._fullLayout) el.innerHTML = '';   // drop a table or message shown before
    return Plotly.react(el, traces, lay, CONFIG);
  };

  // ---- KPIs --------------------------------------------------------------------------------
  const officialRuns = () => (P.runs || []).filter((r) => r.official);
  const KPI = {
    built: () => P.built,
    fg_count: () => P.feature_groups.length,
    fg_rows: () => fmt(P.feature_groups.reduce((s, g) => s + g.rows, 0)),
    split_train: () => fmt(P.split.configs.filter((c) => c.group === 'train').length),
    split_in_range: () => fmt(P.split.configs.filter((c) => c.group === 'in_range').length),
    split_above_cut: () => fmt(P.split.configs.filter((c) => c.group === 'above_cut').length),
    n_inputs: () => Object.keys(P.split.normalisation).length,
    td_version: () => P.split.td_version,
    hpo_trials: () => P.hpo.trials.length,
    hpo_best: () => r2(P.hpo.best_value),
    models: () => P.models.length,
    model_names: () => new Set(P.models.map((m) => m.name)).size,
    authors: () => new Set(P.models.map(modelAuthor)).size,
    tasks: () => new Set(P.models.map((m) => m.task).filter(Boolean)).size,
    official: () => officialRuns().length,
    handed_in: () => Object.keys(P.manifest?.files || {}).length,
  };

  // ---- 1 · feature groups (HTML) ------------------------------------------------------------
  // A case picks a feature group, filters its rows and reads some columns as inputs, some as
  // targets: the tiles, the lineage strip and the coloured columns all follow the chosen case.
  const CASE_LABEL = {trajectory: 'Trajectory', direct_B: 'Direct B', inverse_A: 'Inverse A',
                      inverse_B: 'Inverse B'};
  function fgExplorer(el) {
    const groups = P.feature_groups;
    const cases = P.cases || [];
    const c = cases.find((x) => x.name === el.dataset.view) || cases[0];
    if (!c) return;
    const g = groups.find((x) => x.name === c.feature_group);
    const usedBy = (name) => cases.filter((x) => x.feature_group === name);
    const role = (col) => (c.ids.includes(col) ? 'id' : c.inputs.includes(col) ? 'input'
      : c.targets.includes(col) ? 'target' : 'unused');
    const order = {id: 0, input: 1, target: 2, unused: 3};
    const columns = [...g.columns].sort((a, b) => order[role(a.name)] - order[role(b.name)]);
    const twin = usedBy(g.name).find((x) => x.name !== c.name);
    const dropped = g.rows - c.rows;
    el.innerHTML = `
      <div class="fg-tiles">${groups.map((x) => {
        const users = usedBy(x.name);
        return `
        <button class="fg-tile${x.name === g.name ? ' active' : ''}${users.length ? '' : ' idle'}"
                data-case="${esc(users[0]?.name || '')}"${users.length ? '' : ' disabled'}>
          <span class="fg-name">${esc(x.name)}</span>
          <span class="fg-num">${fmt(x.rows)}</span>
          <span class="fg-sub">rows · ${x.columns.length} columns</span>
          <span class="fg-use">${users.length ? users.map((u) => CASE_LABEL[u.name]).join(' · ')
                                             : 'no case reads it'}</span>
        </button>`;
      }).join('')}
      </div>
      <div class="fg-lineage">
        <div class="lin-step"><span class="lin-k">feature group</span>
          <b>${fmt(g.rows)} rows</b><span>${fmt(g.configs)} simulations</span></div>
        <span class="lin-arrow">→</span>
        <div class="lin-step"><span class="lin-k">row filter</span>
          <b>${esc(c.filter || 'none')}</b>
          <span>${dropped ? `${fmt(dropped)} rows left out` : 'every row'}</span></div>
        <span class="lin-arrow">→</span>
        <div class="lin-step lin-fv"><span class="lin-k">feature view</span>
          <b>${esc(c.name)}_fv</b><span>owner prefix · versioned</span></div>
        <span class="lin-arrow">→</span>
        <div class="lin-step lin-out"><span class="lin-k">training rows</span>
          <b>${fmt(c.rows)}</b><span>${c.inputs.length} inputs → ${c.targets.length} targets</span></div>
      </div>
      <div class="fg-detail">
        <div class="fg-legend"><span class="role-id">id</span><span class="role-input">input</span>
          <span class="role-target">target</span><span class="role-unused">not read</span>
          ${twin ? `<em>Same rows as ${CASE_LABEL[twin.name]}, with inputs and targets swapped.</em>` : ''}
        </div>
        <div class="chips">${columns.map((col) => `
          <span class="chip role-${role(col.name)}" title="${esc(col.type)}">${esc(col.name)}</span>`).join('')}
        </div>
      </div>`;
    el.querySelectorAll('.fg-tile[data-case]').forEach((tile) => tile.addEventListener('click', () => {
      const button = document.querySelector(
        `.viz-switch[data-for="${el.id}"] button[data-view="${tile.dataset.case}"]`);
      if (button) button.click();
      else { el.dataset.view = tile.dataset.case; fgExplorer(el); }
    }));
  }

  // ---- 2 · split and normalisation ----------------------------------------------------------
  function normalisationChips(el) {
    el.innerHTML = Object.entries(P.split.normalisation).map(([col, fn]) => `
      <span class="chip chip-pair"><b>${esc(col)}</b> → ${esc(fn)}</span>`).join('');
  }

  function splitHistogram(el) {
    const scaled = el.dataset.view === 'scaled';
    const S = P.split;
    const value = (c) => (scaled ? c.p_max_scaled : c.p_max);
    // standard_scaler is affine: recover it from two configurations to place the test points.
    const [a, b] = [S.configs[0], S.configs.find((c) => c.p_max !== S.configs[0].p_max)];
    const slope = (b.p_max_scaled - a.p_max_scaled) / (b.p_max - a.p_max);
    const toScaled = (p) => a.p_max_scaled + slope * (p - a.p_max);
    const cut = scaled ? toScaled(S.threshold) : S.threshold;
    const all = S.configs.map(value);
    const lo = Math.min(...all);
    const hi = Math.max(...all);
    // Bin edges fall on the cut, so no bar straddles it.
    const size = (hi - lo) / 36;
    const xbins = {start: cut - Math.ceil((cut - lo) / size) * size, end: hi + size, size};
    const groups = [
      ['train', 'train', SLOTS[0]],
      ['in_range', 'in-range holdout', SLOTS[2]],
      ['above_cut', 'above-cut holdout', SLOTS[1]],
    ];
    const traces = groups.map(([g, label, colour]) => {
      const xs = S.configs.filter((c) => c.group === g).map(value);
      return {type: 'histogram', x: xs, xbins, name: `${label} (${fmt(xs.length)})`,
              marker: {color: colour, line: {color: SURFACE, width: 1}},
              hovertemplate: `${label}<br>%{y} configurations<extra></extra>`};
    });
    const test = S.test_p_max.map((p) => (scaled ? toScaled(p) : p));
    const above = S.test_p_max.filter((p) => p > S.threshold).length / S.test_p_max.length;
    traces.push({
      type: 'scatter', mode: 'markers', x: test, yaxis: 'y2',
      y: test.map((_, i) => ((i * 0.6180339887) % 1)),
      name: `hidden test (${fmt(test.length)})`,
      marker: {symbol: 'line-ns-open', size: 11, color: INK, opacity: 0.7, line: {width: 1.5}},
      hovertemplate: `hidden test configuration<br>P_max %{x:.4g}<extra></extra>`,
    });
    plot(el, traces, layout({
      barmode: 'stack', bargap: 0.04,
      margin: {l: 64, r: 18, t: 44, b: 54},
      legend: {traceorder: 'normal'},
      xaxis: {anchor: 'y2', title: {text: scaled ? 'P_max after standard_scaler (what the model sees)'
                                   : 'P_max, peak plasma pressure (Pa)',
                      font: {size: 13, color: MUTED}}},
      yaxis: {domain: [0.24, 1], title: {text: 'configurations', font: {size: 13, color: MUTED}}},
      yaxis2: {domain: [0, 0.14], showticklabels: false, showgrid: false, zeroline: false,
               range: [-0.1, 1.1]},
      shapes: [{type: 'line', xref: 'x', yref: 'paper', x0: cut, x1: cut, y0: 0, y1: 1,
                line: {color: AMBER, width: 2, dash: 'dash'}}],
      annotations: [
        {xref: 'x', yref: 'paper', x: cut, y: 1, yanchor: 'bottom', xanchor: 'left',
         text: ` density cut ${scaled ? cut.toFixed(2) : fmt(Math.round(S.threshold)) + ' Pa'}`,
         showarrow: false, font: {color: AMBER, size: 12}},
        {xref: 'paper', yref: 'paper', x: 0, y: 0.15, xanchor: 'left', yanchor: 'bottom',
         showarrow: false,
         text: `hidden test: ${Math.round(above * 100)} % above the cut`,
         font: {color: MUTED, size: 12}},
      ],
    }));
  }

  // ---- 3 · hyperparameter search ------------------------------------------------------------
  function hpo(el) {
    const H = P.hpo;
    if (el.dataset.view === 'importance') {
      const items = Object.entries(H.importance).sort((x, y) => x[1] - y[1]);
      plot(el, [{
        type: 'bar', orientation: 'h', x: items.map((i) => i[1]), y: items.map((i) => i[0]),
        marker: {color: SLOTS[0]}, text: items.map((i) => i[1].toFixed(2)),
        textposition: 'outside', textfont: {color: MUTED, size: 12}, cliponaxis: false,
        hovertemplate: '%{y}: %{x:.3f}<extra></extra>', name: 'importance',
      }], layout({
        margin: {l: 120, r: 40, t: 20, b: 50}, showlegend: false, bargap: 0.35,
        xaxis: {title: {text: 'fANOVA importance for the validation mean R²',
                        font: {size: 13, color: MUTED}}},
      }));
      return;
    }
    const trials = [...H.trials].sort((x, y) => x.number - y.number);
    let running = -Infinity;
    const best = trials.map((t) => (running = Math.max(running, t.value)));
    const shown = ['strategy', 'branch_depth', 'trunk_depth', 'width', 'latent', 'activation',
                   'baseline', 'lr'];
    const describe = (t) => shown.filter((k) => k in t.params).map((k) => {
      const v = t.params[k];
      return `${k}: ${typeof v === 'number' && !Number.isInteger(v) ? v.toPrecision(3) : v}`;
    }).join('<br>');
    const top = trials.find((t) => t.number === H.best_trial);
    const FLOOR = 0.965;
    plot(el, [
      {type: 'scatter', mode: 'markers', name: 'trial', x: trials.map((t) => t.number),
       y: trials.map((t) => Math.max(t.value, FLOOR)), customdata: trials.map(describe),
       text: trials.map((t) => `R² ${r2(t.value)} · ${Math.round(t.seconds)} s`),
       marker: {color: SLOTS[0], size: 9, line: {color: SURFACE, width: 2}},
       hovertemplate: 'trial %{x} · %{text}<br>%{customdata}<extra></extra>'},
      {type: 'scatter', mode: 'lines', name: 'best so far', x: trials.map((t) => t.number),
       y: best, line: {color: SLOTS[1], width: 2, shape: 'hv'}, hoverinfo: 'skip'},
    ], layout({
      margin: {l: 64, r: 18, t: 40, b: 50},
      xaxis: {title: {text: 'trial', font: {size: 13, color: MUTED}}},
      // A few failed trials would flatten the rest: clip them and say so.
      yaxis: {title: {text: 'validation mean R²', font: {size: 13, color: MUTED}},
              range: [FLOOR, Math.max(...best) + 0.002]},
      annotations: [
        ...(top ? [{x: top.number, y: top.value, text: `best ${r2(top.value)}`,
                    ax: -50, ay: -26, arrowcolor: AMBER, font: {color: AMBER, size: 12}}] : []),
        ...trials.filter((t) => t.value < FLOOR).map((t) => ({
          x: t.number, y: FLOOR, yanchor: 'bottom', showarrow: false,
          text: `▼ trial ${t.number}: ${r2(t.value)}`, font: {color: MUTED, size: 11}})),
      ],
    }));
  }

  // ---- 4 · registry growth, animated ---------------------------------------------------------
  // Models uploaded per day (stacked by author) and per author, hour by hour. Plotly frames:
  // the slider can be dragged, Play/Pause drive it, and the slide replays it on every visit.
  function registryGrowth(el) {
    const models = P.models.map((m) => ({...m, who: modelAuthor(m), day: m.created.slice(0, 10),
                                         hour: m.created.slice(0, 13)}))
      .sort((x, y) => x.created.localeCompare(y.created));
    const days = [...new Set(models.map((m) => m.day))];
    const dayLabel = (d) => new Date(`${d}T12:00Z`).toLocaleDateString('en-GB',
      {weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC'});
    const xDays = days.map(dayLabel);
    const authors = AUTHORS.map(([, n]) => n).filter((n) => models.some((m) => m.who === n));
    const colour = (who) => SLOTS[authorIndex(who) % SLOTS.length];
    const hours = [...new Set(models.map((m) => m.hour))];
    const steps = ['start', ...hours];
    const stepLabel = (h) => (h === 'start' ? 'before the first upload'
      : `${dayLabel(h.slice(0, 10))}, ${h.slice(11)}:59`);
    const upTo = (h) => models.filter((m) => h !== 'start' && m.hour <= h);
    const names = (ms) => (ms.length ? ms.slice(-6).map((m) => `${m.name} v${m.version}`)
      .join('<br>') + (ms.length > 6 ? `<br>… and ${ms.length - 6} more` : '') : 'none yet');

    const dataAt = (h) => {
      const shown = upTo(h);
      const stacks = authors.map((who) => {
        const mine = shown.filter((m) => m.who === who);
        const perDay = days.map((d) => mine.filter((m) => m.day === d));
        return {y: perDay.map((ms) => ms.length), customdata: perDay.map(names)};
      });
      const dayTotals = days.map((d) => shown.filter((m) => m.day === d).length);
      const authorTotals = authors.map((who) => shown.filter((m) => m.who === who).length);
      return {data: [...stacks, {x: authorTotals, text: authorTotals.map(String)}],
              dayTotals};
    };
    // Per-day totals as annotations: text traces jump around while bars transition.
    const annotationsAt = (dayTotals) => [
      ...xDays.map((x, i) => ({xref: 'x', yref: 'y', x, y: dayTotals[i], yanchor: 'bottom',
                               showarrow: false, text: dayTotals[i] ? `<b>${dayTotals[i]}</b>` : '',
                               font: {color: INK, size: 14}})),
      {xref: 'paper', yref: 'paper', x: 1, y: 1.02, xanchor: 'right', yanchor: 'bottom',
       showarrow: false, text: 'models per author', font: {color: MUTED, size: 13}},
      {xref: 'paper', yref: 'paper', x: 0, y: 1.02, xanchor: 'left', yanchor: 'bottom',
       showarrow: false, text: 'models per day, by author', font: {color: MUTED, size: 13}},
    ];

    const final = dataAt(hours[hours.length - 1]);
    const dayMax = Math.max(...final.dayTotals);
    const authorMax = Math.max(...final.data[authors.length].x);
    const first = dataAt('start').data;
    const traces = [
      ...authors.map((who, i) => ({
        type: 'bar', name: who, x: xDays, ...first[i],
        marker: {color: colour(who), line: {color: SURFACE, width: 1}},
        hovertemplate: `<b>${esc(who)}</b> · %{x}: %{y} models<br>%{customdata}<extra></extra>`,
      })),
      {type: 'bar', orientation: 'h', y: authors, ...first[authors.length], xaxis: 'x2',
       yaxis: 'y2', showlegend: false, marker: {color: authors.map(colour)},
       textposition: 'outside', textfont: {color: INK, size: 12}, cliponaxis: false,
       hovertemplate: '%{y}: %{x} models<extra></extra>'},
    ];
    const frames = steps.map((h) => {
      const {data, dayTotals} = dataAt(h);
      return {name: h, data, layout: {annotations: annotationsAt(dayTotals)}};
    });
    // redraw: the annotations of each frame are layout, which only a redraw applies.
    const animation = (duration) => ({mode: 'immediate', fromcurrent: true,
      frame: {duration, redraw: true}, transition: {duration: duration * 0.6,
                                                     easing: 'cubic-in-out'}});
    const axisTitle = (text) => ({text, font: {size: 13, color: MUTED}});

    const ready = Plotly.newPlot(el, traces, layout({
      barmode: 'stack', bargap: 0.35,
      // No legend box: the per-author panel names every colour next to its bar.
      margin: {l: 48, r: 34, t: 26, b: 96}, showlegend: false,
      xaxis: {domain: [0, 0.5], fixedrange: true},
      yaxis: {range: [0, dayMax * 1.15], title: axisTitle('models uploaded that day'),
              fixedrange: true},
      xaxis2: {domain: [0.7, 1], anchor: 'y2', range: [0, authorMax * 1.25], fixedrange: true,
               gridcolor: GRID, zeroline: false, tickfont: {color: MUTED}},
      yaxis2: {anchor: 'x2', autorange: 'reversed', fixedrange: true, tickfont: {color: INK},
               gridcolor: 'rgba(0,0,0,0)'},
      annotations: annotationsAt(dataAt('start').dayTotals),
      updatemenus: [{
        type: 'buttons', direction: 'left', showactive: false, x: 0, y: -0.2, xanchor: 'left',
        yanchor: 'top', pad: {t: 0, r: 8}, bgcolor: '#13283b', bordercolor: GRID,
        font: {color: INK, size: 12},
        buttons: [
          {label: '▶ Play', method: 'animate', args: [null, animation(650)]},
          {label: '❚❚ Pause', method: 'animate',
           args: [[null], {mode: 'immediate', frame: {duration: 0, redraw: true},
                           transition: {duration: 0}}]},
        ],
      }],
      sliders: [{
        active: 0, x: 0.2, len: 0.8, y: -0.13, xanchor: 'left', yanchor: 'top',
        pad: {t: 0}, bgcolor: '#13283b', activebgcolor: '#22d3ee', bordercolor: GRID,
        tickcolor: GRID, font: {color: 'rgba(0,0,0,0)', size: 1},
        currentvalue: {prefix: 'uploaded until ', xanchor: 'left', offset: 6,
                       font: {color: MUTED, size: 12}},
        transition: {duration: 300},
        steps: steps.map((h) => ({label: stepLabel(h), method: 'animate',
                                  args: [[h], animation(300)]})),
      }],
    }), CONFIG).then(() => Plotly.addFrames(el, frames));

    // Plotly's Play resumes from the current frame, so at the last one it does nothing:
    // there it starts over instead.
    let current = steps[0];
    ready.then(() => {
      el.on('plotly_animatingframe', (event) => { current = event.name; });
      el.on('plotly_sliderchange', (event) => { current = event.step.args[0][0]; });
      el.on('plotly_buttonclicked', (event) => {
        if (event.button.label.includes('Play') && current === steps[steps.length - 1]) {
          Plotly.animate(el, [steps[0]], animation(0)).then(() => Plotly.animate(el, steps, {
            ...animation(650), fromcurrent: false}));
        }
      });
    });

    // The frames are added asynchronously: every animation waits for them.
    el._controller = {
      show: () => ready.then(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          return Plotly.animate(el, [steps[steps.length - 1]], animation(0));
        }
        return Plotly.animate(el, [steps[0]], animation(0)).then(() => Plotly.animate(el, steps, {
          ...animation(650), fromcurrent: false}));
      }),
      hide: () => ready.then(() => Plotly.animate(el, [null], {
        mode: 'immediate', frame: {duration: 0}, transition: {duration: 0}})),
      resize: () => Plotly.Plots.resize(el),
    };
  }

  // ---- 5 · benchmark of the registered models ----------------------------------------------
  function benchmark(el) {
    const task = el.dataset.view || 'trajectory';
    const ref = P.references[task] || {};
    const submitted = new Map(officialRuns().filter((r) => r.task === task)
      .map((r) => [`${r.model} v${r.model_version}`, r.summary['pallas/mean_r2']]));
    const bestOf = {};
    P.models.filter((m) => m.task === task && m.mean !== null).forEach((m) => {
      const label = `${m.name} v${m.version}`;
      const keep = bestOf[m.name];
      const sent = submitted.has(label);
      // A version that was handed in wins over the others of its name.
      if (!keep || (sent && !keep.sent) || (sent === keep.sent && m.mean > keep.mean)) {
        bestOf[m.name] = {...m, label, sent, versions: (keep?.versions || 0) + 1};
      } else {
        keep.versions += 1;
      }
    });
    const models = Object.values(bestOf).sort((x, y) => x.mean - y.mean);
    if (!models.length) {
      Plotly.purge(el);
      el.innerHTML = '<p class="viz-empty">No registered model with a holdout score.</p>';
      return;
    }
    const clip = (s) => (s.length > 40 ? `${s.slice(0, 39)}…` : s);
    const labels = models.map((m) => (m.sent ? `★ ${clip(m.label)}` : clip(m.label)));
    const hover = (m) => {
      const targets = Object.entries(m.per_target || {}).filter(([, v]) => v !== null)
        .map(([t, v]) => `${t} ${r2(v)}`).join(' · ');
      const official = m.sent ? `<br>official (hidden test) ${r2(submitted.get(m.label))}` : '';
      return `${targets}${official}<br>${m.versions} version${m.versions > 1 ? 's' : ''}`;
    };
    const byAuthor = {};
    models.forEach((m, i) => (byAuthor[modelAuthor(m)] ||= []).push([m, labels[i]]));
    const traces = Object.entries(byAuthor)
      .sort((x, y) => authorIndex(x[0]) - authorIndex(y[0]))
      .map(([who, items]) => ({
        type: 'bar', orientation: 'h', name: who,
        x: items.map(([m]) => m.mean), y: items.map(([, l]) => l),
        customdata: items.map(([m]) => [hover(m), m.label]),
        marker: {color: SLOTS[authorIndex(who) % SLOTS.length], line: {color: SURFACE, width: 1}},
        hovertemplate: `<b>%{customdata[1]}</b> · ${esc(who)}<br>holdout mean R² %{x:.4f}<br>` +
                       '%{customdata[0]}<extra></extra>',
      }));
    if (task === 'ood') {
      const withRange = models.filter((m) => m.in_range !== null && m.in_range !== undefined);
      traces.push({
        type: 'scatter', mode: 'markers', name: 'in-range holdout',
        x: withRange.map((m) => m.in_range),
        y: withRange.map((m) => labels[models.indexOf(m)]),
        marker: {symbol: 'line-ns-open', size: 16, color: INK, line: {width: 2.5}},
        hovertemplate: 'in-range %{x:.4f}<extra></extra>',
      });
    }
    const values = models.map((m) => m.mean).concat(ref.bar ?? []);
    const xmin = Math.max(0, Math.floor((Math.min(...values) - 0.04) * 20) / 20);
    const shapes = [];
    const annotations = [];
    if (ref.bar) {
      shapes.push({type: 'line', xref: 'x', yref: 'paper', x0: ref.bar, x1: ref.bar, y0: 0, y1: 1,
                   line: {color: AMBER, width: 2, dash: 'dash'}});
      annotations.push({xref: 'x', yref: 'paper', x: ref.bar, y: 1, yanchor: 'bottom',
                        showarrow: false, text: `bar ${ref.bar.toFixed(3)}`,
                        font: {color: AMBER, size: 12}});
    }
    plot(el, traces, layout({
      barmode: 'overlay', bargap: 0.28,
      margin: {l: 290, r: 24, t: 40, b: 44},
      legend: {y: 1.14},
      xaxis: {range: [xmin, 1.002], title: {text: task === 'ood'
        ? 'above-cut holdout mean R² (│ = in-range: the gap is the deliverable)'
        : 'holdout mean R², each author\'s own split', font: {size: 13, color: MUTED}}},
      yaxis: {categoryorder: 'array', categoryarray: labels,
              tickfont: {size: labels.length > 12 ? 10 : 12, color: INK}},
      shapes, annotations,
    }));
  }

  // ---- 6 · hand-in --------------------------------------------------------------------------
  function handin(el) {
    const view = el.dataset.view || 'time';
    const runs = officialRuns().map((r) => {
      const model = P.models.find((m) => m.name === r.model && m.version === r.model_version);
      return {...r, score: r.summary['pallas/mean_r2'],
              holdout: r.summary['holdout/mean_r2'] ?? model?.mean ?? null,
              label: `${r.model} v${r.model_version}`};
    }).sort((x, y) => x.created.localeCompare(y.created));
    if (view === 'manifest') {
      Plotly.purge(el);
      const files = Object.entries(P.manifest?.files || {});
      const scoreOf = (f) => runs.find((r) => r.model === f.model && r.model_version === f.version);
      el.innerHTML = `
        <table class="viz-table"><thead><tr><th>CSV</th><th>model</th><th>rows</th>
        <th>md5</th><th>official</th></tr></thead><tbody>${files.map(([name, f]) => `
          <tr><td>${esc(name)}</td><td>${esc(f.model)} v${f.version}</td>
          <td>${fmt(f.rows)}</td><td><code>${esc(f.md5.slice(0, 10))}</code></td>
          <td>${r2(scoreOf(f)?.score)}</td></tr>`).join('')}
        </tbody></table>
        <p class="viz-note">make_submission.py · built ${esc(P.manifest?.built || '')} ·
        every file loaded back from the registry, checked, and fingerprinted</p>`;
      return;
    }
    const byTask = {};
    runs.forEach((r) => (byTask[r.task] ||= []).push(r));
    const ordered = TASKS.filter(([t]) => byTask[t]);
    if (view === 'calibration') {
      const traces = ordered.map(([t, label]) => ({
        type: 'scatter', mode: 'markers', name: label,
        x: byTask[t].map((r) => r.holdout), y: byTask[t].map((r) => r.score),
        customdata: byTask[t].map((r) => r.label),
        marker: {color: taskColour[t], size: 12, line: {color: SURFACE, width: 2}},
        hovertemplate: '<b>%{customdata}</b><br>holdout %{x:.4f} → official %{y:.4f}' +
                       '<extra></extra>',
      }));
      plot(el, traces, layout({
        margin: {l: 64, r: 18, t: 54, b: 54}, legend: {y: 1.18},
        xaxis: {range: [0.78, 1], title: {text: 'our holdout mean R² (registry)',
                                          font: {size: 13, color: MUTED}}},
        yaxis: {range: [0.78, 1], title: {text: 'official mean R² (hidden test)',
                                          font: {size: 13, color: MUTED}}},
        shapes: [{type: 'line', x0: 0.78, y0: 0.78, x1: 1, y1: 1,
                  line: {color: MUTED, width: 1, dash: 'dot'}}],
        annotations: [{x: 0.8, y: 0.985, xanchor: 'left', showarrow: false,
                       text: 'above the diagonal: the hidden test was kinder',
                       font: {color: MUTED, size: 12}}],
      }));
      return;
    }
    const traces = ordered.map(([t, label]) => ({
      type: 'scatter', mode: 'lines+markers', name: label,
      x: byTask[t].map((r) => r.created), y: byTask[t].map((r) => r.score),
      customdata: byTask[t].map((r) => [r.label, r2(r.holdout)]),
      line: {color: taskColour[t], width: 2},
      marker: {color: taskColour[t], size: 10, line: {color: SURFACE, width: 2}},
      hovertemplate: '<b>%{customdata[0]}</b><br>official %{y:.4f} · holdout %{customdata[1]}' +
                     '<br>%{x}<extra></extra>',
    }));
    plot(el, traces, layout({
      margin: {l: 64, r: 18, t: 54, b: 46}, legend: {y: 1.18},
      xaxis: {type: 'date', tickformat: '%a %H:%M'},
      yaxis: {title: {text: 'official mean R² (hidden test)', font: {size: 13, color: MUTED}}},
    }));
  }

  // ---- wiring -------------------------------------------------------------------------------
  const VIZ = {
    'fg-explorer': fgExplorer, 'normalisation-chips': normalisationChips,
    'split-hist': splitHistogram, hpo, 'registry-growth': registryGrowth, benchmark, handin,
  };

  const draw = (el) => {
    const fn = VIZ[el.dataset.viz];
    if (!fn) return;
    if (!P) {
      el.innerHTML = '<p class="viz-empty">No data: run presentation/build_pipeline_data.py.</p>';
      return;
    }
    if (el.dataset.viz !== 'fg-explorer' && el.dataset.viz !== 'normalisation-chips'
        && typeof Plotly === 'undefined') {
      el.innerHTML = '<p class="viz-empty">Plotly did not load (offline?).</p>';
      return;
    }
    fn(el);
    el.dataset.drawn = '1';
  };

  // Reveal can announce the same slide twice (load, then hash); animations start once a visit.
  let shownSlide = null;
  const showSlide = (slide) => {
    if (!slide) return;
    const arrived = slide !== shownSlide;
    shownSlide = slide;
    slide.querySelectorAll('[data-viz]').forEach((el) => {
      if (!el.dataset.drawn) draw(el);
      else if (el._controller) el._controller.resize();
      else if (el.classList.contains('js-plotly-plot')) Plotly.Plots.resize(el);
      if (arrived) el._controller?.show();   // animations restart on every visit
    });
  };

  const init = () => {
    if (P) {
      document.querySelectorAll('[data-kpi]').forEach((el) => {
        const fn = KPI[el.dataset.kpi];
        if (fn) el.textContent = fn();
      });
      document.querySelectorAll('a[data-link]').forEach((a) => {
        const href = {hopsworks: P.hopsworks.project_url, wandb: P.wandb.url}[a.dataset.link];
        if (href) a.href = href;
      });
    }
    document.querySelectorAll('.viz-switch').forEach((group) => {
      group.querySelectorAll('button').forEach((button) => {
        button.addEventListener('click', () => {
          const target = document.getElementById(group.dataset.for);
          group.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b === button));
          target.dataset.view = button.dataset.view;
          draw(target);
        });
      });
    });
    showSlide(Reveal.getCurrentSlide());
    Reveal.on('slidechanged', (event) => {
      if (event.previousSlide !== event.currentSlide) {
        event.previousSlide?.querySelectorAll('[data-viz]').forEach((el) => el._controller?.hide());
      }
      showSlide(event.currentSlide);
    });
    Reveal.on('resize', () => showSlide(Reveal.getCurrentSlide()));
  };

  if (typeof Reveal === 'undefined') return;
  if (Reveal.isReady()) init();
  else Reveal.on('ready', init);
})();
