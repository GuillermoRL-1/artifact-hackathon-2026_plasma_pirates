"""Streamlit entrypoint for the PALLAS Hopsworks feature explorer.

This thin wrapper keeps ``feature_target_explorer.py`` usable as both a CLI
report generator and the application implementation. Credentials can be
provided by Hopsworks app environment variables or Streamlit secrets.
"""

import os

import streamlit as st


def _load_streamlit_secrets() -> None:
    """Expose Hopsworks secrets through the environment used by the pipeline."""
    # Without a secrets.toml (inside Hopsworks, or locally with a .env) reading st.secrets
    # raises; pallas_pipeline.connect() then uses the .env or the Hopsworks session.
    try:
        secrets = st.secrets
        for name in ("HOPSWORKS_HOST", "HOPSWORKS_API_KEY"):
            if not os.environ.get(name) and name in secrets:
                os.environ[name] = str(secrets[name])
    except Exception:
        return


_load_streamlit_secrets()

from feature_target_explorer import streamlit_app  # noqa: E402


streamlit_app()
