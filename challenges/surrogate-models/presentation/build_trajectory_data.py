"""Build the data snapshot behind the trajectory slides (explainability, OOD, uncertainty).

Reads Sébastien Joly's analysis files (explainability_data.csv: LIME weights;
uncertainties_data.csv: MC-dropout mean and std for one held-out configuration), the
simulation truth from the public pack, and runs his OOD model (sj_trajectory_bayesian_nn_ood)
with MC dropout on its two holdout groups, to measure whether the predicted uncertainty
covers the truth as well above the density cut as below it. Writes

    data/trajectory_snapshot.js   window.TRAJECTORY = {...}

so viewing the slides contacts no service. From the challenge folder, with the team .env:

    ../../../.venv/bin/python presentation/build_trajectory_data.py
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import pallas_pipeline as pp  # noqa: E402
import pallas_score  # noqa: E402

DEFAULT_OUTPUT_DIR = Path(__file__).resolve().parent / "data"
OOD_MODEL = ("sj_trajectory_bayesian_nn_ood", 1)
MC_SAMPLES = 50
SEED = 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--output-dir", type=Path, default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--mc-samples", type=int, default=MC_SAMPLES)
    return parser.parse_args()


def lime_weights() -> dict:
    """Sébastien's LIME weights: one row per (standardised) input, one column per target."""
    frame = pd.read_csv(ROOT / "explainability_data.csv", sep="\t", index_col=0)
    inputs = [i.removeprefix("standard_scaler_").rstrip("_") for i in frame.index]
    return {"inputs": inputs, "targets": list(frame.columns),
            "weights": frame.to_numpy().round(4).tolist()}


def uncertainty_curve(case) -> dict:
    """Sébastien's MC-dropout curve for one held-out configuration, with the simulation."""
    curve = pd.read_csv(ROOT / "uncertainties_data.csv", sep="\t", index_col=0)
    config = int(curve["config"].iloc[0])
    truth = pd.read_parquet(pp.DATA_DIR / "campaign_B_trajectories.parquet")
    truth = truth[truth["config"] == config].sort_values("z_mm")
    # Match positions to the micrometre (the two files print z_mm with different precision).
    key = lambda frame: (frame["z_mm"] * 1000).round().astype(int)
    truth_at = truth.assign(key=key(truth)).set_index("key")[case.targets]
    merged = truth_at.reindex(key(curve)).add_suffix("_true").reset_index(drop=True)
    if merged.isna().any().any():
        raise ValueError(f"config {config}: some positions have no simulation value")
    settings = truth.iloc[0]
    return {
        "config": config, "model": "sj_trajectory_bayesian_nn v5",
        "settings": {k: float(settings[k]) for k in ("P_max", "cN2_max", "L_inj", "dip_frac",
                                                     "x_of")},
        "z_mm": curve["z_mm"].round(4).tolist(),
        "targets": {t: {"mean": curve[t].round(5).tolist(), "std": curve[f"{t}_std"].round(5).tolist(),
                        "true": merged[f"{t}_true"].round(5).tolist()}
                    for t in case.targets},
    }


def ood_calibration(n_samples: int) -> dict:
    """MC dropout of the OOD model on its in-range and above-cut holdouts, on the scorer scale."""
    project = pp.connect()
    fs = project.get_feature_store()
    out_dir = ROOT / "outputs" / "downloaded"
    model, meta = pp.load_registered_model(project, *OOD_MODEL, out_dir, own_code=True)
    case = dataclasses.replace(pp.CASES[meta["case"]], inputs=meta["inputs"])
    fv = fs.get_feature_view(meta["feature_view"], meta["feature_view_version"])
    fv.init_batch_scoring(training_dataset_version=meta["td_version"])
    rows = pp.read_rows(fv, case)
    groups = {g: set(c) for g, c in meta["holdout_groups"].items()}
    rows = rows[rows["config"].isin(set().union(*groups.values()))].reset_index(drop=True)
    X = pp.transform(fv, rows, case)[meta["feature_columns"]]

    import torch
    torch.manual_seed(SEED)
    mean, std = model.estimator.predict_with_uncertainty(np.asarray(X, np.float32),
                                                         n_samples=n_samples)
    truth = np.column_stack([pallas_score.physical_to_normalised(t, rows[t]) for t in case.targets])
    z = np.abs(truth - mean) / np.maximum(std, 1e-12)

    group_of = rows["config"].map({c: g for g, members in groups.items() for c in members})
    summary = {}
    for g in groups:
        mask = (group_of == g).to_numpy()
        summary[g] = {"configs": len(groups[g]), "rows": int(mask.sum()), "targets": {}}
        for i, t in enumerate(case.targets):
            err = truth[mask, i] - mean[mask, i]
            ss = ((truth[mask, i] - truth[mask, i].mean()) ** 2).sum()
            summary[g]["targets"][t] = {
                "r2_pooled": float(1 - (err ** 2).sum() / ss),
                "cover_1sigma": float((z[mask, i] <= 1).mean()),
                "cover_2sigma": float((z[mask, i] <= 2).mean()),
                "rmse": float(np.sqrt((err ** 2).mean())),
                "mean_std": float(std[mask, i].mean()),
            }
    # One point per configuration, as a typical relative error in %: what the model says
    # (RMS of its sigma) and what it really gets wrong (RMS of truth - prediction). On the
    # log10 scale of the scorer an error d is a factor 10**d, i.e. (10**d - 1) * 100 %;
    # E (linear, MeV) is divided by the configuration's mean energy.
    frame = pd.DataFrame({"config": rows["config"], "group": group_of, "P_max": rows["P_max"]})
    for i, t in enumerate(case.targets):
        frame[f"err2_{t}"] = (truth[:, i] - mean[:, i]) ** 2
        frame[f"std2_{t}"] = std[:, i] ** 2
        frame[f"abs_{t}"] = np.abs(rows[t].to_numpy())
    per = frame.groupby(["config", "group"], as_index=False).mean()
    per_config = per[["config", "group", "P_max"]].copy()
    for t in case.targets:
        rms_err, rms_std = np.sqrt(per[f"err2_{t}"]), np.sqrt(per[f"std2_{t}"])
        if pallas_score.SCALES.get(t, pallas_score.LINEAR).log10:
            per_config[f"err_{t}"] = (10 ** rms_err - 1) * 100
            per_config[f"sigma_{t}"] = (10 ** rms_std - 1) * 100
        else:
            per_config[f"err_{t}"] = rms_err / per[f"abs_{t}"] * 100
            per_config[f"sigma_{t}"] = rms_std / per[f"abs_{t}"] * 100
    return {
        "model": f"{OOD_MODEL[0]} v{OOD_MODEL[1]}", "mc_samples": n_samples,
        "threshold": pp.pack_reference()["sections"]["ood_split"]["threshold"],
        "targets": case.targets, "groups": summary,
        "per_config": per_config.round(6).to_dict(orient="list"),
    }


def main() -> None:
    args = parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)
    case = pp.CASES["trajectory"]
    snapshot = {
        "built": f"{datetime.now():%Y-%m-%d %H:%M}",
        "lime": lime_weights(),
        "curve": uncertainty_curve(case),
        "calibration": ood_calibration(args.mc_samples),
    }
    out = args.output_dir / "trajectory_snapshot.js"
    out.write_text("// Written by build_trajectory_data.py; do not edit by hand.\n"
                   f"window.TRAJECTORY = {json.dumps(snapshot)};\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
