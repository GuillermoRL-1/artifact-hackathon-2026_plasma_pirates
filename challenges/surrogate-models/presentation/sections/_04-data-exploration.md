## Data exploration {#data-exploration}

<div class="explorer-bar">
<div class="frame-switch" data-for="explorer-frame"><button class="active" data-src="data/explorer/trajectory.html">Trajectory</button><button data-src="data/explorer/direct_B.html">Direct B</button><button data-src="data/explorer/inverse_A.html">Inverse A</button><button data-src="data/explorer/inverse_B.html">Inverse B</button></div>
<a class="ext-link" href="https://aissai26.hops.live/hopsworks-api/pythonapp/m4cast_plasma_pirates/plasma_pirates_explorer/" target="_blank" rel="noopener">Live app in Hopsworks ↗</a>
<a class="ext-link" href="https://youtu.be/Bx12V2A3MlQ" target="_blank" rel="noopener">Demo video ↗</a>
</div>

<iframe id="explorer-frame" class="explorer-frame" data-src="data/explorer/trajectory.html"
        title="PALLAS data explorer: statistics, correlations, distributions, trajectories and outliers"></iframe>

::: {.notes}
The explorer of feature_target_explorer.py, frozen as one page per case by build_explorer_report.py (data read from the Hopsworks feature store when built). The live version is the Hopsworks app plasma_pirates_explorer (project members only); Hopsworks does not allow its apps inside other pages, so the slide carries the static copy.
:::
