"""The shared steps of surrogate_pipeline.ipynb: feature store, cases, models, submissions.

The data lives in the Hopsworks project PROJECT (the full public pack). Column names there are
the pack's names in lower case; everything this module hands back uses the pack's own names
(P_max, E_MeV, ...), which are also the names the scorer and the submission files use.

Input normalisations are model-dependent transformations stored in the feature view, so every
teammate who reads the view gets the same ones. Targets are scaled inside the model instead
(SurrogateModel), on the scorer's own scale, because a prediction has to be carried back to
physical units and Hopsworks does not invert a transformation.
"""

import importlib.util
import json
import os
import shutil
import sys
from dataclasses import dataclass
from importlib import metadata
from pathlib import Path

import numpy as np
import pandas as pd

import pallas_score

HERE = Path(__file__).resolve().parent
PROJECT = "m4cast_plasma_pirates"
DATA_DIR = Path(os.environ.get("PALLAS_DATA_DIR", HERE / "data" / "pallas_hackathon_data"))
NORMALISATIONS = ("standard", "min_max", "robust", "log10", "none")
SPLITS = ("random", "ood_density")


def fs_name(column):
    """Hopsworks stores every column name in lower case."""
    return column.lower()


@dataclass
class Case:
    """One objective of objectives.md: where its rows live and what goes in and out."""
    feature_group: str
    inputs: list
    targets: list
    test_file: str
    submission_file: str
    reference: str
    reference_note: str
    rows: object = None          # fg -> the filter of the rows the objective trains on
    log_inputs: tuple = ()       # inputs spanning decades: log10 by default

    @property
    def positional(self):
        return "z_mm" in self.inputs

    @property
    def ids(self):
        return ["config", "z_mm"] if self.positional else ["config"]

    def default_normalisation(self):
        return {c: "log10" if c in self.log_inputs else "standard" for c in self.inputs}


B_SETTINGS = ["P_max", "cN2_max", "L_inj", "dip_frac", "x_of"]
BUNCH = ["E_med_MeV", "dE_mad", "q_end", "i_peak", "n_emit_x", "sigma_z", "sigma_y", "div_rms",
         "x_of"]
BUNCH_LOGS = ("q_end", "i_peak", "n_emit_x", "sigma_y")   # as in the kickoff notebook

CASES = {
    "trajectory": Case(
        feature_group="pallas_b_trajectories", inputs=B_SETTINGS + ["z_mm"],
        targets=["E_MeV", "q_pC", "dE_pct", "emit_um", "div_mrad", "sigz_um"],
        test_file="test_trajectory.parquet", submission_file="submission_trajectory.csv",
        reference="emulator_inplasma",
        reference_note="Medium bar: the internal emulator on the hidden test, in-plasma"),
    "direct_B": Case(
        feature_group="pallas_campaign_b", inputs=B_SETTINGS,
        targets=["E_med_MeV", "dE_mad", "q_end"],
        test_file="test_direct.parquet", submission_file="submission_direct.csv",
        reference="direct_reference_emulator",
        reference_note="stretch target (internal emulator); the Easy bar is the kickoff "
                       "linear baseline, about 0.94 / 0.26 / 0.81",
        rows=lambda fg: fg.injected == True),  # noqa: E712
    "inverse_B": Case(
        feature_group="pallas_campaign_b", inputs=BUNCH,
        targets=["P_max", "cN2_max", "L_inj", "dip_frac"],
        test_file="test_inverse_B.parquet", submission_file="submission_inverse_B.csv",
        reference="inverse_B_linear_baseline",
        reference_note="Medium bar: the linear baseline, measured on the hidden test",
        rows=lambda fg: fg.injected == True,  # noqa: E712
        log_inputs=BUNCH_LOGS),
    "inverse_A": Case(
        feature_group="pallas_campaign_a", inputs=BUNCH, targets=["p_1", "a_0", "c_N2"],
        test_file="test_inverse.parquet", submission_file="submission_inverse.csv",
        reference="inverse_reference_ensemble",
        reference_note="Easy bar: the reference ensemble (measured with noise)",
        rows=lambda fg: (fg.injected == True) & (fg.q_pc >= 3),  # noqa: E712
        log_inputs=BUNCH_LOGS),
}


# ---- 1. Feature store -------------------------------------------------------------------------

def connect(project=PROJECT):
    """Log in with HOPSWORKS_HOST / HOPSWORKS_API_KEY from the environment or the nearest .env.

    Without a key (inside Hopsworks, e.g. an app or a job) the session's own client logs in,
    to the project it runs in.
    """
    import hopsworks
    from team_wandb import load_env
    load_env()
    if not os.environ.get("HOPSWORKS_API_KEY"):
        return hopsworks.login()
    return hopsworks.login(host=os.environ["HOPSWORKS_HOST"], project=project,
                           api_key_value=os.environ["HOPSWORKS_API_KEY"])


def feature_groups_overview(fs):
    """One row per feature group the cases use: size, and its description."""
    rows = []
    for name in sorted({case.feature_group for case in CASES.values()}):
        fg = fs.get_feature_group(name, version=1)
        rows.append({"feature_group": name, "features": len(fg.features),
                     "description": fg.description})
    return pd.DataFrame(rows)


def feature_group_schema(fs, name):
    """Every feature of a feature group with its type."""
    fg = fs.get_feature_group(name, version=1)
    return pd.DataFrame([{"feature": f.name, "type": f.type} for f in fg.features])


# ---- 2. Normalisations and feature views ------------------------------------------------------

def grl_log10(feature: pd.Series) -> pd.Series:
    """log10 for quantities spanning decades; values below 1e-12 are floored first."""
    return np.log10(np.maximum(feature, 1e-12))


def log10_transformation(fs):
    """The log10 transformation function, saved in the feature store on first use."""
    import hopsworks
    try:
        saved = fs.get_transformation_function("grl_log10", version=1)
    except Exception:
        saved = None
    if saved is None:   # not saved yet
        udf = hopsworks.udf(return_type=float, drop=["feature"])(grl_log10)
        fs.create_transformation_function(udf, version=1).save()
        saved = fs.get_transformation_function("grl_log10", version=1)
    return saved


def transformation_functions(fs, normalisation):
    """The model-dependent transformations for {pack column: normalisation}."""
    from hopsworks.hsfs.builtin_transformations import (min_max_scaler, robust_scaler,
                                                        standard_scaler)
    builders = {"standard": standard_scaler, "min_max": min_max_scaler, "robust": robust_scaler}
    functions = []
    for column, kind in normalisation.items():
        if kind not in NORMALISATIONS:
            raise ValueError(f"{column}: unknown normalisation {kind!r}; "
                             f"use one of {NORMALISATIONS}")
        if kind == "log10":
            functions.append(log10_transformation(fs)(fs_name(column)))
        elif kind != "none":
            functions.append(builders[kind](fs_name(column)))
    return functions


def get_feature_view(fs, name, version):
    """The feature view, or None when it does not exist."""
    try:
        return fs.get_feature_view(name, version=version)
    except Exception:
        return None


def create_feature_view(fs, case, name, version, normalisation, description=""):
    """A feature view over the case's rows: `config` for splitting, inputs, targets as labels."""
    if get_feature_view(fs, name, version) is not None:
        raise ValueError(f"{name} v{version} already exists: pick a new version to change it")
    fg = fs.get_feature_group(case.feature_group, version=1)
    query = fg.select(["config"] + [fs_name(c) for c in case.inputs + case.targets])
    if case.rows is not None:
        query = query.filter(case.rows(fg))
    return fs.create_feature_view(
        name=name, version=version, query=query, description=description,
        labels=[fs_name(t) for t in case.targets], training_helper_columns=["config"],
        transformation_functions=transformation_functions(fs, normalisation))


def feature_view_normalisation(fv):
    """{fs column: transformation name} as stored in the feature view."""
    stored = {}
    for function in fv.transformation_functions:
        udf = function.hopsworks_udf
        for feature in udf.transformation_features:
            stored[feature] = udf.function_name
    return stored


def prepare_statistics(fv, description=""):
    """The training-dataset version the normalisations take their statistics from.

    The latest one is reused; the first call computes it over every row of the view. These are
    statistics of the inputs only, so a holdout cut later does not leak its targets into them.
    """
    versions = [td.version for td in fv.get_training_datasets()]
    if not versions:
        fv.training_data(description=description or "statistics for the input normalisations")
        versions = [td.version for td in fv.get_training_datasets()]
    version = max(versions)
    if fv.transformation_functions:
        fv.init_batch_scoring(training_dataset_version=version)
    return version


def rows_file(fv_name, fv_version):
    """Where a view's rows are exported for machines that cannot read them from Hopsworks:
    DALIA's compute nodes reach the REST API, but their proxy refuses the Feature Query Service's
    Arrow Flight port (HTTP 403)."""
    return HERE / "data" / "fv_rows" / f"{fv_name}_v{fv_version}.parquet"


def read_rows(fv, case, exported=None):
    """Every row of the view, untransformed, with the pack's column names; from `exported` (a
    parquet of fv.query.read(), see rows_file) instead of the feature store when given."""
    raw = pd.read_parquet(exported) if exported else fv.query.read()
    names = {fs_name(c): c for c in ["config"] + case.inputs + case.targets}
    return raw.rename(columns=names)[list(names.values())].reset_index(drop=True)


def transform(fv, frame, case):
    """The case's inputs of `frame`, through the feature view's normalisations.

    FeatureView.transform() needs online feature groups, and ours are offline; the
    batch-scoring server applies the same transformations offline (checked against
    get_batch_data(transformed=True) on hopsworks 5.1.1). Call prepare_statistics first.
    """
    vectors = frame[case.inputs].rename(columns=fs_name).reset_index(drop=True)
    if not fv.transformation_functions:
        return vectors[sorted(vectors.columns)]
    out = fv._batch_scoring_server._transform(feature_vectors=vectors)
    return out[sorted(out.columns)]


# ---- Splits -----------------------------------------------------------------------------------

def split_configs(rows, case, strategy="random", fraction=0.2, seed=0):
    """(train configs, holdout configs, {holdout group: configs}), always whole configurations.

    random       a random `fraction` of the configurations; one group, "holdout"
    ood_density  the Hard objective (trajectory only): train inside ood_split.train of
                 pack_reference.json (P_max < 6,528.6 Pa) and score two groups -- "in_range",
                 a random `fraction` of those configurations, and "above_cut", every public
                 configuration above the cut. Their gap is the objective's deliverable.
    """
    configs = np.sort(rows["config"].unique())
    rng = np.random.default_rng(seed)
    if strategy == "random":
        holdout = rng.choice(configs, size=int(round(fraction * len(configs))), replace=False)
        groups = {"holdout": holdout}
    elif strategy == "ood_density":
        if not case.positional:
            raise ValueError("the out-of-distribution objective is the trajectory case")
        inside = set(pack_reference()["sections"]["ood_split"]["train"])
        below = np.array([c for c in configs if c in inside])
        groups = {"in_range": rng.choice(below, size=int(round(fraction * len(below))),
                                         replace=False),
                  "above_cut": [c for c in configs if c not in inside]}
    else:
        raise ValueError(f"unknown split {strategy!r}; use one of {SPLITS}")
    groups = {name: sorted(int(c) for c in members) for name, members in groups.items()}
    holdout = {c for members in groups.values() for c in members}
    return [int(c) for c in configs if c not in holdout], sorted(holdout), groups


def submission_file(case, split):
    """The CSV name the organisers expect: the Hard OOD objective has its own."""
    return "submission_ood.csv" if split == "ood_density" else case.submission_file


# ---- 3. Models --------------------------------------------------------------------------------

def load_model_file(path):
    """Import a model file as a module named after it, so a pickled model can find it again."""
    path = Path(path).resolve()
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[path.stem] = module
    spec.loader.exec_module(module)
    for name in ("build_model",):
        if not hasattr(module, name):
            raise AttributeError(f"{path.name} must define {name}(**params)")
    return module


class SurrogateModel:
    """A model file's estimator, trained on targets carried to the scorer's scale.

    target_scaling "scorer": log10 for the quantities the scorer logs (charge, spread, ...),
    unchanged otherwise -- the scale R2 is computed on. "none": physical units.
    An estimator with `accepts_dataframe = True` gets the inputs as a DataFrame, with the
    feature view's column names (e.g. to find the coordinate z_mm); others get a numpy array.
    """

    def __init__(self, estimator, targets, target_scaling="scorer"):
        if target_scaling not in ("scorer", "none"):
            raise ValueError("target_scaling must be 'scorer' or 'none'")
        self.estimator = estimator
        self.targets = list(targets)
        self.target_scaling = target_scaling

    def _inputs(self, X):
        if getattr(self.estimator, "accepts_dataframe", False):
            return pd.DataFrame(X).astype(float)
        return np.asarray(X, float)

    def fit(self, X, y):
        scaled = np.column_stack([self._to_model(t, y[t]) for t in self.targets])
        self.estimator.fit(self._inputs(X), scaled)
        return self

    def predict(self, X):
        out = np.asarray(self.estimator.predict(self._inputs(X)), float)
        out = out.reshape(len(X), len(self.targets))
        return pd.DataFrame({t: self._to_physical(t, out[:, i])
                             for i, t in enumerate(self.targets)})

    def _to_model(self, target, values):
        if self.target_scaling == "none":
            return np.asarray(values, float)
        return pallas_score.physical_to_normalised(target, values)

    def _to_physical(self, target, values):
        if self.target_scaling == "none":
            return values
        return pallas_score.normalised_to_physical(target, values)


# ---- 4. Results -------------------------------------------------------------------------------

def pack_reference():
    return json.loads((DATA_DIR / "pack_reference.json").read_text())


def reference_scores(case):
    """The reference quoted in objectives.md for this case (see reference_note), one R2 per
    target plus the mean."""
    scores = pack_reference()["scores"][case.reference]
    scores = scores.get("in_plasma", scores)
    scores = {k: v for k, v in scores.items() if isinstance(v, (int, float))}
    if "mean" not in scores:
        scores["mean"] = float(np.mean([scores[t] for t in case.targets if t in scores]))
    return scores


def predictions(case, model, X, rows):
    """A submission-shaped frame: the case's id columns, then one column per target."""
    out = rows[case.ids].reset_index(drop=True)
    return pd.concat([out, model.predict(X).reset_index(drop=True)], axis=1)


def answer_key(case, rows):
    """The true values in the shape the scorer reads; L_inj locates the plasma end."""
    extra = ["L_inj"] if case.positional and "L_inj" not in case.targets else []
    return rows[case.ids + extra + case.targets].reset_index(drop=True)


def r2_by_position(case, predicted, key):
    """R2 per target at each z, on the scorer's scale (trajectory only)."""
    merged = key.merge(predicted, on=case.ids, suffixes=("", "_pred"))
    rows = []
    for z, at in merged.groupby("z_mm"):
        row = {"z_mm": z, "n_configs": len(at)}
        for t in case.targets:
            true = pallas_score.physical_to_normalised(t, at[t])
            pred = pallas_score.physical_to_normalised(t, at[f"{t}_pred"])
            spread = np.sum((true - true.mean()) ** 2)
            row[t] = 1 - np.sum((true - pred) ** 2) / spread if spread > 0 else np.nan
        rows.append(row)
    return pd.DataFrame(rows)


# ---- 5. Model registry ------------------------------------------------------------------------

REQUIREMENTS = ("numpy", "pandas", "scikit-learn", "scipy", "joblib", "pyarrow", "hopsworks",
                "torch", "deepxde")


def requirements():
    """Pinned versions of the packages a saved model may need, as installed here."""
    lines = []
    for package in REQUIREMENTS:
        try:
            lines.append(f"{package}=={metadata.version(package)}")
        except metadata.PackageNotFoundError:
            pass
    return "\n".join(lines) + "\n"


def save_bundle(model, model_file, meta, out_dir):
    """A self-contained model folder: the fitted model, the code to unpickle it, its pins."""
    import joblib
    out_dir = Path(out_dir)
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)
    joblib.dump(model, out_dir / "model.joblib")
    for source in (Path(model_file), HERE / "pallas_pipeline.py", HERE / "pallas_score.py"):
        shutil.copy(source, out_dir / source.name)
    (out_dir / "requirements.txt").write_text(requirements())
    (out_dir / "model_meta.json").write_text(json.dumps(meta, indent=2))
    return out_dir


def register_model(project, bundle_dir, name, fv, td_version, metrics, description):
    """Upload a model folder to the registry, linked to its feature view and statistics."""
    registry = project.get_model_registry()
    model = registry.python.create_model(
        name=name, metrics={k: float(v) for k, v in metrics.items()}, description=description,
        feature_view=fv, training_dataset_version=td_version)
    model.save(str(bundle_dir), keep_original_files=True)   # the default moves them away
    return model


def model_benchmark(project, case_name):
    """Every registered model of a case (its name carries the case), best mean R2 first.

    Scores are the ones each model was registered with: models from this notebook
    (`holdout_*` metrics) on their own holdout, others on whatever split their author used,
    so read them as a guide, not a ranking. Only `from_notebook` models load in step 8.
    """
    import requests
    token = case_name.lower()
    answer = requests.get(
        f"https://{os.environ['HOPSWORKS_HOST']}/hopsworks-api/api/project/{project.id}"
        f"/modelregistries/{project.id}/models",
        headers={"Authorization": f"ApiKey {os.environ['HOPSWORKS_API_KEY']}"}, timeout=60)
    answer.raise_for_status()
    case = CASES[case_name]
    rows = []
    for entry in answer.json().get("items", []):
        if token not in entry["name"].lower():
            continue
        metrics = entry.get("metrics") or {}
        ours = "holdout_mean_r2" in metrics
        prefix = "holdout_r2_" if ours else "r2_"
        row = {"model": entry["name"], "version": entry["version"],
               "author": entry.get("userFullName", ""),
               "created": pd.to_datetime(entry["created"], unit="ms").floor("min"),
               "mean_r2": metrics.get("holdout_mean_r2", metrics.get("r2_mean")),
               "from_notebook": ours}
        row.update({t: metrics.get(prefix + fs_name(t)) for t in case.targets})
        row["description"] = entry.get("description", "")
        rows.append(row)
    table = pd.DataFrame(rows)
    if table.empty:
        return table
    return table.sort_values("mean_r2", ascending=False, na_position="last").reset_index(drop=True)


def load_registered_model(project, name, version, out_dir, own_code=False):
    """(model, meta) downloaded from the registry, ready to predict.

    own_code: always import the bundle's model file, even when a module of that name is already
    loaded (several models in one session); helper modules of the bundle become importable too.
    """
    import joblib
    entry = project.get_model_registry().get_model(name, version=version)
    if entry is None:
        raise LookupError(f"{name} v{version} is not in the model registry")
    target = Path(out_dir) / f"{name}_v{version}"
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    folder = Path(entry.download(local_path=str(target)))
    meta = json.loads((folder / "model_meta.json").read_text())
    if own_code:
        sys.path.append(str(folder))
    if own_code or meta["model_file"] not in sys.modules:   # the model's code, for unpickling
        load_model_file(folder / f"{meta['model_file']}.py")
    return joblib.load(folder / "model.joblib"), meta


# ---- 6. Submission ----------------------------------------------------------------------------

def write_submission(case, submission, test, path):
    """Check the submission against the test file, then write it the way the scorer reads it."""
    if len(submission) != len(test):
        raise ValueError(f"{len(submission)} rows for {len(test)} test rows")
    if submission[case.targets].isna().any().any():
        raise ValueError("the submission has NaN predictions")
    if submission.duplicated(case.ids).any():
        raise ValueError(f"the submission repeats rows on {case.ids}")
    if not submission[case.ids].reset_index(drop=True).equals(
            test[case.ids].reset_index(drop=True)):
        raise ValueError("the submission's id columns do not match the test file")
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    # Positions with 6 decimals (the scorer matches them at 1 um); every other column at full
    # precision -- a fixed format would round q_end, in coulombs (~1e-10), to zero.
    written = submission.copy()
    for column in pallas_score.POSITION_COLUMNS:
        if column in written.columns:
            written[column] = written[column].map("{:.6f}".format)
    written.to_csv(path, index=False)
    return path
