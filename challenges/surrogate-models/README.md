# Challenge: Surrogate Models (PALLAS)

**Case holder:** Mykyta Lenivenko (IJCLab)
**Team captains:** _TBD_
**Challenge coordinator (organizing team):** Hayg Guler (backup: Damien)

## Overview

PALLAS is a laser-plasma accelerator. A high-power laser pulse is focused into a
few-millimetre gas cell holding a helium/nitrogen mixture; the pulse drives a plasma wave in
its wake, and electrons stripped from the nitrogen inner shell are injected into that wave and
accelerated to roughly 40–500 MeV in a few millimetres. A conventional accelerator needs metres
to do the same thing.

The operator sets a handful of knobs — gas pressure, nitrogen concentration, where the laser is
focused, laser intensity, the shape of the gas density profile — and one electron bunch comes
out. Predicting that bunch takes a particle-in-cell simulation, which costs hours on a cluster.
**The challenge is to replace that simulation with a model that answers in milliseconds, and to
find out honestly what such a model gives up.**

Everything in this challenge is simulation, run with Smilei. That is deliberate: it gives every
sample an exact ground-truth label, so a disagreement between a model and the data is the
model's, never the diagnostic's.

### Two teams, three questions

Team A works physics-informed or hybrid; Team B works purely data-driven. The three questions
both teams are asked to answer are the organisers' own:

1. **What accuracy is lost by removing the physics?**
2. **How much data does each approach need?** — measured as a curve, not a single score.
3. **How does each behave out of distribution?** — at plasma densities and at positions along
   the accelerator that neither team trained on.

Beating a score in-distribution is the warm-up. The three questions are the challenge, and the
dataset ships the splits that let you answer each of them in a way the other team's answer can
be compared against.

## What you get

A public data pack of about 200 MB: two simulation campaigns of the PALLAS accelerator, the
beam's trajectory along it, the bunch's full phase-space moments at twenty planes, six held-out
test files with their targets removed, and the scorer the organisers will run. See
[`data/README.md`](data/README.md) for the files, the units and the splits.

**The full data pack is not in this repository** — it is too large for git. `data/README.md` says
where to download it and where to unpack it. A **10 % random sample** (22 MB, the same tables and
columns) sits in `data/sample/`, so both notebooks run straight from a clone; train and report
on the full pack, since every number differs on the sample.

## Structure

- `scientific_case.md` — background and motivation
- `objectives.md` — easy / medium / hard objectives, short: what to predict, how it is scored
- `objectives_detailed.md` — the same objectives with the physics, the traps and the reference numbers
- `requirements.txt` — Python dependencies
- `kickoff_notebook.ipynb` — starter notebook: from the raw pack to a scored submission
- `kickoff_notebook_detailed.ipynb` — the longer starter notebook: the same path, with every step explained
- `pallas_score.py` — the scorer, imported by the kickoff notebook
- `PHYSICS.md` and `physics_formulas.py` — the physics kit: the gas density profile from the knobs for both campaigns, the laser parameters, and seven textbook formulas as functions (for the physics-informed track, and for anyone adding physics to a model)
- `data/` — dataset description and schema; `data/sample/` holds the 10 % sample
- `status.py` — the team's live status page (see below)

The kickoff notebook runs on a laptop CPU in under a minute and writes two valid submission
files (inverse and direct). Do that first; it also walks through the pack's id conventions and its single injection
flag, which are what a join or a quoted rate gets wrong.

## Team status page

`status.py` builds one HTML page with the best model of each case: the official score the
organisers published on W&B (`pallas/mean_r2` on the hidden test), the bar from `objectives.md`,
and the best holdout score among the models in the Hopsworks registry, per target. It only
reads; nothing is written to Hopsworks or W&B.

It needs the packages of `requirements.txt` and a `.env` in this folder or above it with
`HOPSWORKS_HOST`, `HOPSWORKS_API_KEY` (an account with access to `m4cast_plasma_pirates`) and
`WANDB_API_KEY` (copy `.env.example`; `python check_setup.py` checks all of it). From this folder:

```bash
python status.py                # writes outputs/status.html and opens it in the browser
python status.py --watch 300    # rebuilds every 5 minutes; the open page reloads itself
python status.py --no-open      # writes the page without opening it
```

`outputs/` is git-ignored, so the page stays local. Registry scores are each author's own
holdout, a guide for choosing what to submit; only the W&B score counts for the ranking.

The same page also runs live in Hopsworks, as the app `plasma_pirates_status` of the project
`m4cast_plasma_pirates` (Hopsworks UI → Apps; only project members can open it). `status_app.py`
is its Streamlit entry point: Hopsworks clones this repository's `master` and redeploys the app
on every push, reads the registry with the app's own session and the W&B key from the Hopsworks
secret `WANDB_API_KEY`, and the page refreshes itself every 2 minutes.

## Feature explorer app

`app.py` is the GitHub-visible Streamlit entry point for the interactive feature-store explorer.
It launches `feature_target_explorer.py`, which reads the selected feature group from Hopsworks
and displays statistics, correlations, distributions, trajectories, and candidate outliers.

Run it locally with:

```bash
.venv/bin/streamlit run app.py
```

For a Hopsworks App, create a Streamlit app from this Git repository and set the entrypoint to
`app.py`. Configure `HOPSWORKS_HOST` and `HOPSWORKS_API_KEY` as app environment variables or
secrets; never commit the API key. For Streamlit Community Cloud, select `app.py` as the main
file and add the same two values under **App settings → Secrets**.

## Getting help

Reach out to the case holder or challenge coordinator listed above, or ask during the Tuesday
hands-on session and the Wednesday mid-challenge check-in.
