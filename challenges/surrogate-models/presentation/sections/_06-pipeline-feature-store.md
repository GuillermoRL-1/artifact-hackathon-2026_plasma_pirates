## 1 · Pull the data from the feature store {#pipe-feature-store}

::: {.columns}
::: {.column width="60%"}

<div class="viz-switch" data-for="fg-explorer"><button class="active" data-view="trajectory">Trajectory</button><button data-view="direct_B">Direct B</button><button data-view="inverse_B">Inverse B</button><button data-view="inverse_A">Inverse A</button></div>

<div id="fg-explorer" class="viz-html" data-viz="fg-explorer" data-view="trajectory"></div>

:::
::: {.column width="38%"}

```python
project = pp.connect(pp.PROJECT)
fs = project.get_feature_store()

case = pp.CASES[CASE]
fv = pp.get_feature_view(
    fs, f"{OWNER}_{CASE}_fv", FV_VERSION)
rows = pp.read_rows(fv, case)
```

::: {.compact}
- **One name per objective.** The case fixes the feature group, the row filter, the inputs and the targets.
- **A versioned feature view.** Every experiment and every teammate reads exactly the same rows.
- **No CSV exported by hand.** The views read the groups in place, so Inverse B is simply Direct B's rows read the other way round.
:::

<a class="ext-link" data-link="hopsworks" target="_blank" rel="noopener">Open the project in Hopsworks ↗</a>

:::
:::

::: {.notes}
Pick a case: the tile shows the feature group it reads, the strip how the rows get from the group to training, and the columns are coloured by what the case does with them. The trajectories come one row per position; the campaigns one row per simulation. pallas_b_moments was published too but no objective reads it.
:::
