## Trajectory · beyond the training density {#traj-ood}

::: {.columns}
::: {.column width="62%"}

<div class="viz-card">
<div class="traj-switch" data-for="ood-chart"></div>
<div id="ood-chart" class="viz traj-md" data-traj="ood-dumbbell"></div>
</div>

::: {.caption}
Official scores on the hidden test, per output: trained below P_max = 6 529 Pa, scored below (●) and above (◆) the cut. Pick a submission.
:::

:::
::: {.column width="35%"}

<div id="ood-kpis" class="kpi-row kpi-3"></div>

<div id="ood-gaps" class="viz traj-sm" data-traj="ood-gaps"></div>

::: {.compact}
- The Bayesian MLP retrained on the Hard split loses **0.012 R²** above the cut, the smallest gap of our four submissions.
- The bunch length **σz** is the output that suffers most out of distribution, for every model.
:::

:::
:::
