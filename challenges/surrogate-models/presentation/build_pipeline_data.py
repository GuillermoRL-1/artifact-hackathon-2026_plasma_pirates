"""Build the data snapshot behind the pipeline slides.

Hopsworks and W&B are read only when this builder runs. It writes

    data/pipeline_snapshot.js   window.PIPELINE = {...}: everything the pipeline charts draw
    data/status.html            the team status page (status.py) as it was at build time

so viewing the slides contacts neither service. Run it from the repository's
challenge folder (or anywhere) with the team .env available:

    .venv/bin/python presentation/build_pipeline_data.py
"""

from __future__ import annotations

import argparse
import inspect
import json
import sys
from datetime import datetime
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pallas_pipeline as pp  # noqa: E402
import status  # noqa: E402
from team_wandb import ENTITY, GROUP, PROJECT as WANDB_PROJECT  # noqa: E402

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data"
FEATURE_GROUPS = ["pallas_campaign_a", "pallas_campaign_b", "pallas_b_trajectories",
                  "pallas_b_moments"]
HPO_STUDY = ROOT / "outputs" / "hpo" / "deeponet_ood_v1"
SPLIT_VIEW = ("grl_trajectory_fv", 1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    return parser.parse_args()


def feature_groups(fs) -> list[dict]:
    """Rows, configurations and schema of every feature group of the pack."""
    out = []
    for name in FEATURE_GROUPS:
        fg = fs.get_feature_group(name, version=1)
        if fg is None:
            continue
        configs = fg.select(["config"]).read()["config"]
        out.append({"name": name, "description": fg.description or "",
                    "rows": int(len(configs)), "configs": int(configs.nunique()),
                    "columns": [{"name": f.name, "type": f.type} for f in fg.features]})
    return out


def row_filter(case) -> str:
    """The case's row filter as written in pallas_pipeline.CASES, e.g. "injected == True"."""
    if case.rows is None:
        return ""
    source = inspect.getsource(case.rows).split("lambda fg:", 1)[1].split("#", 1)[0]
    source = source.strip().rstrip(",").strip()
    while source.count(")") > source.count("("):
        source = source[:-1].rstrip()
    return source.replace("fg.", "").replace("(", "").replace(")", "")


def cases(fs) -> list[dict]:
    """What each objective reads: its feature group, row filter, inputs, targets and row count."""
    out = []
    for name, case in pp.CASES.items():
        fg = fs.get_feature_group(case.feature_group, version=1)
        query = fg.select(["config"])
        if case.rows is not None:
            query = query.filter(case.rows(fg))
        configs = query.read()["config"]
        out.append({"name": name, "feature_group": case.feature_group,
                    "inputs": [pp.fs_name(c) for c in case.inputs],
                    "targets": [pp.fs_name(c) for c in case.targets],
                    "ids": [pp.fs_name(c) for c in case.ids], "filter": row_filter(case),
                    "rows": int(len(configs)), "configs": int(configs.nunique())})
    return out


def trajectory_split(fs) -> dict:
    """One point per trajectory configuration: P_max raw and through the view, and its group."""
    case = pp.CASES["trajectory"]
    fv = fs.get_feature_view(*SPLIT_VIEW)
    td_version = pp.prepare_statistics(fv)
    rows = pp.read_rows(fv, case)
    train, _, groups = pp.split_configs(rows, case, "ood_density", 0.2, 0)
    first = rows.groupby("config", as_index=False).first()
    scaled = pp.transform(fv, first, case)
    group_of = {c: "train" for c in train}
    group_of.update({c: g for g, members in groups.items() for c in members})

    test = pd.read_parquet(pp.DATA_DIR / case.test_file).groupby("config", as_index=False).first()
    ood = pp.pack_reference()["sections"]["ood_split"]
    return {
        "feature_view": f"{SPLIT_VIEW[0]} v{SPLIT_VIEW[1]}", "td_version": td_version,
        "normalisation": pp.feature_view_normalisation(fv),
        "rows": int(len(rows)), "threshold": ood["threshold"],
        "configs": [{"config": int(c), "p_max": float(p), "p_max_scaled": float(s),
                     "group": group_of[int(c)]}
                    for c, p, s in zip(first["config"], first["P_max"],
                                       scaled["standard_scaler_p_max_"])],
        "test_p_max": [float(p) for p in test["P_max"]],
    }


def hpo_study() -> dict:
    """The Optuna search of MO_DeepOnet: every trial and the parameter importances."""
    trials = pd.read_csv(HPO_STUDY / "trials.csv")
    trials = trials[trials["state"] == "COMPLETE"]
    best = json.loads((HPO_STUDY / "best.json").read_text())
    params = [c for c in trials.columns if c.startswith("params_")]
    return {
        "study": best["study"], "split": best["split"], "best_trial": best["best_trial"],
        "best_value": best["best_validation_mean_r2"], "importance": best.get("importance", {}),
        "trials": [{"number": int(t["number"]), "value": float(t["value"]),
                    "seconds": float(t["user_attrs_train_seconds"]),
                    "params": {p.removeprefix("params_"): t[p] for p in params}}
                   for _, t in trials.iterrows()],
    }


def references() -> dict:
    """The bar of every objective (status.py) and, where the pack has it, the per-target one."""
    out = {}
    for task, title, tier, bar, note in status.OBJECTIVES:
        per_target, _ = status.reference(task)
        out[task] = {"title": title, "tier": tier, "bar": bar, "note": note,
                     "per_target": per_target}
    return out


def latest_manifest() -> dict | None:
    """The hand-in folder make_submission.py wrote last."""
    folders = sorted((ROOT / "submissions").glob("best_*/manifest.json"))
    return json.loads(folders[-1].read_text()) if folders else None


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    print("reading the registry and W&B (status.py) ...")
    cases, runs, models, errors = status.collect()
    for error in errors:
        print(f"  ! {error}")
    (args.output_dir / "status.html").write_text(
        status.page(cases, runs, models, errors, refresh=None))

    print("reading the feature store ...")
    project = pp.connect()
    fs = project.get_feature_store()

    snapshot = {
        "built": f"{datetime.now():%Y-%m-%d %H:%M}",
        "hopsworks": {"host": "aissai26.hops.live", "project": pp.PROJECT,
                      "project_url": f"https://aissai26.hops.live/p/{project.id}"},
        "wandb": {"entity": ENTITY, "project": WANDB_PROJECT, "group": GROUP,
                  "url": f"https://wandb.ai/{ENTITY}/{WANDB_PROJECT}"},
        "feature_groups": feature_groups(fs),
        "cases": cases(fs),
        "split": trajectory_split(fs),
        "hpo": hpo_study(),
        "references": references(),
        "models": [{**{k: m[k] for k in ("name", "version", "task", "author", "mean",
                                          "in_range", "gap", "description")},
                    "per_target": m["per_target"], "created": f"{m['created']:%Y-%m-%d %H:%M}"}
                   for m in models],
        "runs": [{k: r[k] for k in ("name", "url", "task", "tier", "created", "model",
                                    "model_version", "official")}
                 | {"summary": {k: v for k, v in r["summary"].items()
                                if k.startswith(("pallas/", "holdout/mean_r2",
                                                 "holdout/in_range"))}}
                 for r in runs if r["group"] == GROUP],
        "manifest": latest_manifest(),
    }
    out = args.output_dir / "pipeline_snapshot.js"
    out.write_text("// Written by build_pipeline_data.py; do not edit by hand.\n"
                   f"window.PIPELINE = {json.dumps(snapshot, default=str)};\n")
    print(f"wrote {out} and {args.output_dir / 'status.html'}")


if __name__ == "__main__":
    main()
