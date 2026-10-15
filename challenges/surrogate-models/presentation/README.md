# Plasma Pirates presentation

This is a deliberately lightweight Quarto RevealJS scaffold based on
`index_inspiration.md`. It contains the visual language and a suggested story
arc, but leaves the scientific figures and final results as editable placeholders.

## Local requirements

Install the [Quarto CLI](https://quarto.org/docs/get-started/) separately. From
this directory, the optional Python figure-generation dependencies can be
installed with:

```bash
python -m pip install -r requirements.txt
```

The current deck does not require Python to display the existing interactive
scatter plot: it uses Plotly.js from the CDN. Python and the packages in
`requirements.txt` are useful if you want to generate additional Plotly figures
or replace the dummy data with a data-driven workflow.

## Structure

Each slide lives in its own file under `sections/` (`_01-why-surrogates.md`,
`_02-pallas-overview.md`, …). `index.md` only holds the deck's front matter and
pulls the slides in, in order, with `{{< include sections/... >}}`. To add,
remove, or reorder slides, edit the include list in `index.md`. The leading `_`
keeps Quarto from rendering a section file on its own. Image and data paths
inside a section are relative to this directory, because the content is inlined
into `index.md`.

## Render locally

From this directory:

```bash
./preview.sh
```

This serves the deck at <http://localhost:4848/> (override with `PORT=...`)
and reloads it on every save. The script is needed because `quarto preview`
does not watch included files: it re-renders the deck whenever something in
`sections/` changes. Embedded YouTube videos and Plotly only work when the
deck is served over HTTP like this, not when `index.html` is opened directly.

To create the static HTML file:

```bash
quarto render index.md
```

`index.html` needs the files next to it (`index_files/`, `data/`, `pipeline.js`).

## A single file to share

```bash
./build_standalone.sh        # writes plasma_pirates_presentation.html (~50 MB, git-ignored)
```

Everything goes inside that one HTML: scripts, styles, images, the data snapshots,
the status page and the outlier histogram. Opened from disk it works offline except
for the CDN libraries (Plotly, MathJax) and the two YouTube videos, which need
internet. YouTube also refuses to play inside a page opened from a file (error
153), so from disk each video shows a link to YouTube instead. Served over http
(any web host or `python3 -m http.server`) the videos play in the slides.

## Rebuild the pipeline data

The pipeline slides (`sections/_05` to `_12`) draw their charts with `pipeline.js`
from `data/pipeline_snapshot.js`, and embed `data/status.html`, a copy of the team
status page. Both files are written by `build_pipeline_data.py`, which reads the
Hopsworks feature store and model registry, the W&B runs of our group, the latest
`submissions/best_*/manifest.json` and the HPO study in `outputs/hpo/`. Viewing the
slides contacts neither service. To refresh the numbers before presenting, run this
from the challenge folder with the team `.env` available:

```bash
../../../.venv/bin/python presentation/build_pipeline_data.py
```

## Rebuild the data explorer pages

The Data exploration slide embeds `data/explorer/<case>.html`, written by
`build_explorer_report.py`: the analysis and Plotly figures of `feature_target_explorer.py`
(statistics, correlations, distributions, trajectories, candidate outliers), read once from
the feature store, one dark tabbed page per case. The live version runs as the Hopsworks app
`plasma_pirates_explorer` (project members only; Hopsworks forbids showing its apps inside
other pages, hence the static copy).

```bash
../../../.venv/bin/python presentation/build_explorer_report.py
```

## Architecture diagrams

The architecture diagrams of the case-study slide (`sections/_13-case_study.md`) are
drawn by `architectures.js`, from a spec written by hand after the code each model
carries in the registry (`torch_mlp.py`, `dlinear_trajectory.py`, `bayesian_nn.py`,
`kkim_hybrid_multicase.py`). The holdout R² badges come from `data/pipeline_snapshot.js`.

## Rebuild the trajectory data

The trajectory slides (`sections/_18a` to `_18c`) draw with `trajectory.js` from
`data/trajectory_snapshot.js`, written by `build_trajectory_data.py`: Sébastien's
LIME weights (`explainability_data.csv`) and MC-dropout curve (`uncertainties_data.csv`)
with the Smilei truth, plus a calibration of `sj_trajectory_bayesian_nn_ood` v1 (MC
dropout on its in-range and above-cut holdouts; needs Hopsworks). The OOD slide reads the
official W&B scores from `data/pipeline_snapshot.js`.

```bash
../../../.venv/bin/python presentation/build_trajectory_data.py
```

## Rebuild the static outlier histogram

The outlier slide uses a local CSV/Plotly snapshot; it does not contact
Hopsworks when the presentation is viewed. To refresh that snapshot, run this
from the repository root with the usual Hopsworks credentials available:

```bash
.venv/bin/python presentation/build_outlier_histogram.py --max-rows 50000
```

This writes `presentation/data/trajectory_histogram_snapshot.csv` and
`presentation/data/trajectory_histograms.html`.
