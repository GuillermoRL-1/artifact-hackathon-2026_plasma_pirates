## Case study: TrajectoryB

_TrajectoryB_ predicts the evolution of the beam parameters along the longitudinal direction for various settings.

The case was modelled using four different neural-network architectures:

::: {.cards .arch-cards}

::: {.model-card}
<div class="card-title">Multilayer Perceptron <span class="arch-score"></span></div>
<div class="arch" data-arch="mlp"></div>
:::

::: {.model-card}
<div class="card-title">Bayesian Neural Network <span class="arch-score"></span></div>
<div class="arch" data-arch="bnn"></div>
:::

::: {.model-card}
<div class="card-title">DLinear <span class="arch-score"></span></div>
<div class="arch" data-arch="dlinear"></div>
:::

::: {.model-card}
<div class="card-title">Residual Mixture Density Network <span class="arch-score"></span></div>
<div class="arch" data-arch="mdn"></div>
:::
:::

::: {.notes}
Diagrams drawn from the code each model carries in the registry: grl_trajectory_torch_mlp v1, hg_trajectory_dlinear_trajectory v1, sj_trajectory_bayesian_nn v5 and kkim_trajectory_hybrid_residual_mdn v1. The MLP and the BNN predict one position at a time; DLinear writes the whole 113-point curve from the settings alone. The BNN and the MDN also give an uncertainty: the BNN from dropout kept on at prediction, the MDN from a mixture of Gaussians fitted to the anchor MLP's residuals.
:::
