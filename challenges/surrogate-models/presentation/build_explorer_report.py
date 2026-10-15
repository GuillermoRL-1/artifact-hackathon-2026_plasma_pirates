"""Build the static data-explorer pages embedded in the Data exploration slide.

A presentation version of feature_target_explorer.py (the Hopsworks/Streamlit explorer):
the same analysis and Plotly figures, read once from the feature store, written as one
dark, tabbed page per case under data/explorer/<case>.html. Viewing the slides contacts
no service; Plotly.js comes from its CDN. From the challenge folder, with the team .env:

    ../../../.venv/bin/python presentation/build_explorer_report.py
"""

from __future__ import annotations

import argparse
import html
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import feature_target_explorer as explorer  # noqa: E402
import pallas_pipeline as pp  # noqa: E402

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data" / "explorer"
CASES = ["trajectory", "direct_B", "inverse_A", "inverse_B"]
# Tabs of the app, minus the heavy corner plot and histogram grid.
TABS = [
    ("Relationships", ["Pearson correlation", "Spearman correlation", "Interactive relationship"]),
    ("Distributions", ["Interactive distributions"]),
    ("Trajectories", ["Trajectories"]),
    ("Outliers", ["Outlier counts"]),
]
INK, MUTED, LINE, NAVY = "#e6edf3", "#9fb0c0", "rgba(165, 243, 252, 0.22)", "#0d1b2a"

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PALLAS data explorer · {case}</title>
<script src="https://cdn.plot.ly/plotly-{plotlyjs}.min.js"></script>
<style>
  :root {{ color-scheme: dark; }}
  body {{ margin: 0; background: {navy}; color: {ink}; font: 14px/1.4 Inter, system-ui, sans-serif; }}
  header {{ display: flex; gap: 10px; align-items: stretch; padding: 10px 12px 6px; }}
  .kpi {{ flex: 1; border: 1px solid {line}; border-radius: 6px; padding: 6px 10px; background: #13283b; }}
  .kpi b {{ display: block; color: #fbbf24; font-size: 20px; }}
  .kpi span {{ color: {muted}; font-size: 12px; }}
  .io {{ flex: 2.2; font-size: 12px; color: {muted}; }}
  .io code {{ color: #a5f3fc; }}
  nav {{ display: flex; gap: 6px; padding: 4px 12px 8px; border-bottom: 1px solid {line}; }}
  nav button {{ font: inherit; font-size: 13px; color: {muted}; background: transparent; cursor: pointer;
               border: 1px solid {line}; border-radius: 999px; padding: 3px 12px; }}
  nav button.active {{ color: {navy}; background: #22d3ee; border-color: #22d3ee; font-weight: 600; }}
  section {{ display: none; padding: 8px 12px 16px; }}
  section.active {{ display: block; }}
  .note {{ color: {muted}; font-size: 12px; margin: 0 0 6px; }}
  .grid2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }}
  table {{ border-collapse: collapse; width: 100%; font-size: 12px; }}
  th {{ color: {muted}; font-weight: 500; text-align: right; border-bottom: 1px solid {line}; padding: 4px 6px; }}
  td {{ text-align: right; border-bottom: 1px solid rgba(165,243,252,0.08); padding: 3px 6px; }}
  th:first-child, td:first-child {{ text-align: left; color: {ink}; }}
</style></head><body>
<header>
  <div class="kpi"><b>{rows}</b><span>rows</span></div>
  <div class="kpi"><b>{features}</b><span>numeric features</span></div>
  <div class="kpi"><b>{outliers}</b><span>candidate outliers</span></div>
  <div class="kpi"><b>{missing}</b><span>missing cells</span></div>
  <div class="kpi io">feature group <code>{group}</code><br>inputs <code>{inputs}</code><br>targets <code>{targets}</code></div>
</header>
<nav>{nav}</nav>
{sections}
<script>
  // Plotly cannot size a chart inside a hidden tab: resize it when its tab is shown.
  document.querySelectorAll('nav button').forEach((button) => button.addEventListener('click', () => {{
    document.querySelectorAll('nav button, section').forEach((el) =>
      el.classList.toggle('active', el.dataset.tab === button.dataset.tab));
    document.querySelectorAll(`section[data-tab="${{button.dataset.tab}}"] .js-plotly-plot`)
      .forEach((plot) => Plotly.Plots.resize(plot));
  }}));
</script>
</body></html>
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--cases", nargs="+", default=CASES, choices=sorted(pp.CASES))
    parser.add_argument("--max-points", type=int, default=3000,
                        help="Points in the interactive scatter (and configurations in trajectories).")
    parser.add_argument("--max-plot-rows", type=int, default=20_000,
                        help="Rows sent to the distribution figures; statistics use all rows.")
    return parser.parse_args()


def dark(figure, height: int):
    """The deck's look: transparent background, light text, compact margins."""
    figure.update_layout(template="plotly_dark", paper_bgcolor="rgba(0,0,0,0)",
                         plot_bgcolor="rgba(0,0,0,0)", font={"color": INK, "size": 12},
                         height=height, margin={"l": 60, "r": 20, "t": 60, "b": 50},
                         title={"font": {"size": 14}})
    return figure


def build_case(fs, case_name: str, args, plotlyjs: str) -> str:
    import plotly.io as pio

    case = pp.CASES[case_name]
    frame, columns, stats, pearson, spearman, row_flags, feature_outliers = explorer.analyse_case(
        fs, case, all_rows=False)
    plot_frame = explorer.downsample_for_plots(frame, case, args.max_plot_rows)
    plot_flags = row_flags.loc[plot_frame.index]
    max_points = min(args.max_points, 60) if case.positional else args.max_points
    figures = explorer.plotly_figures(plot_frame, columns, plot_flags, pearson, spearman,
                                      max_points, case)
    # Counted on every row (the script counts the plotting sample), so it matches the KPI.
    import plotly.express as px
    counts = row_flags["outlier_count"].value_counts().sort_index()
    figures["Outlier counts"] = px.bar(x=counts.index, y=counts.values,
                                       labels={"x": "features flagged in the row", "y": "rows"},
                                       title=f"Rows by number of flagged features ({len(frame):,} rows)")
    if "Trajectories" in figures:
        # Each target on its own scale (energy is in the hundreds, emittance below one).
        figures["Trajectories"].update_yaxes(matches=None, showticklabels=True)
        figures["Trajectories"].update_layout(showlegend=False)
        figures["Trajectories"].for_each_annotation(lambda a: a.update(text=a.text.split("=")[-1]))

    heights = {"Pearson correlation": 420, "Spearman correlation": 420,
               "Interactive relationship": 520, "Interactive distributions": 480,
               "Trajectories": 900, "Outlier counts": 360}
    def chart(name):
        return pio.to_html(dark(figures[name], heights[name]), full_html=False,
                           include_plotlyjs=False, config={"displaylogo": False, "responsive": True})

    tabs, nav = [], []
    for title, names in TABS:
        names = [n for n in names if n in figures]
        if not names:
            continue
        if title == "Relationships":
            body = (f"<div class='grid2'>{chart(names[0])}{chart(names[1])}</div>"
                    + "".join(chart(n) for n in names[2:]))
        elif title == "Trajectories":
            body = ("<p class='note'>One line per configuration (a sample), coloured by configuration.</p>"
                    + chart(names[0]))
        elif title == "Outliers":
            body = ("<p class='note'>IQR (1.5×) or robust z-score (&gt; 3.5) on each feature: "
                    "candidates for review, never removed automatically.</p>" + chart(names[0])
                    + feature_outliers.to_html(index=False, float_format="{:.4g}".format, border=0))
        else:
            body = "".join(chart(n) for n in names)
        tabs.append((title, body))
    tabs.append(("Statistics", stats.to_html(index=False, float_format="{:.4g}".format, border=0)))
    nav = "".join(f"<button data-tab='{t}' class='{'active' if i == 0 else ''}'>{t}</button>"
                  for i, (t, _) in enumerate(tabs))
    sections = "".join(f"<section data-tab='{t}' class='{'active' if i == 0 else ''}'>{b}</section>"
                       for i, (t, b) in enumerate(tabs))
    return PAGE.format(
        case=html.escape(case_name), plotlyjs=plotlyjs, navy=NAVY, ink=INK, muted=MUTED, line=LINE,
        rows=f"{len(frame):,}", features=len(columns),
        outliers=f"{int(row_flags['candidate_outlier'].sum()):,}",
        missing=f"{int(frame[columns].isna().sum().sum()):,}",
        group=html.escape(case.feature_group), inputs=html.escape(", ".join(case.inputs)),
        targets=html.escape(", ".join(case.targets)), nav=nav, sections=sections)


def main() -> None:
    import plotly.offline as po

    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    project = pp.connect(pp.PROJECT)
    fs = project.get_feature_store()
    for case_name in args.cases:
        page = build_case(fs, case_name, args, po.get_plotlyjs_version())
        out = args.output_dir / f"{case_name}.html"
        out.write_text(page, encoding="utf-8")
        print(f"wrote {out} ({out.stat().st_size / 1e6:.1f} MB)")
    (args.output_dir / "built.txt").write_text(f"{datetime.now():%Y-%m-%d %H:%M}\n")


if __name__ == "__main__":
    main()
