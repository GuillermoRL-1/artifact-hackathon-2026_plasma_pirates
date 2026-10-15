## Trajectory · what the model listens to {#traj-explainability}

::: {.columns}
::: {.column width="56%"}

<div class="viz-card">
<div id="lime-heatmap" class="viz traj-md" data-traj="lime-heatmap"></div>
</div>

::: {.caption}
LIME weights of the six standardised inputs on each output (Sébastien Joly, `explainability_data.csv`). Blue pushes the output up, orange down. Click a column to rank its inputs.
:::

:::
::: {.column width="41%"}

<div class="traj-switch" data-for="lime-bars"><button class="active" data-view="E_MeV">E</button><button data-view="q_pC">q</button><button data-view="dE_pct">ΔE</button><button data-view="emit_um">ε</button><button data-view="div_mrad">div</button><button data-view="sigz_um">σz</button></div>
<div id="lime-bars" class="viz traj-sm" data-traj="lime-bars" data-view="E_MeV"></div>

::: {.compact}
- The **laser focus `x_of`** dominates the energy (−1.24, the largest weight on E).
- **Position `z_mm`** drives energy, emittance and divergence: the bunch evolves along the cell.
- Charge and spread depend on several knobs at once: no single input explains them.
:::

:::
:::

::: {.notes}
LIME fits a local linear model around predictions of the trajectory surrogate; the weights are on standardised inputs, so their sizes compare across inputs. The exact configurations LIME was run on are Sébastien's choice; ask him before quoting it as a global ranking.
:::
