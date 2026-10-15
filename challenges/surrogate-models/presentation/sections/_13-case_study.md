## Case study: TrajectoryB

TrajectoryB predicts the evolution of key beam properties along the plasma trajectory from the simulation settings and longitudinal position.

The case was modelled using three different neural-network architectures:

::: {.cards}

::: {.model-card}

<div class="card-title">Multilayer Perceptron</div>

4 $\times$ 256 neurons.

<!-- ![](data/MLP.png){width=50%}: add the image to presentation/data/ -->

:::

::: {.model-card}

<div class="card-title">DLinear</div>

Trend + Seasonal decomposition, linear projection

:::

::: {.model-card}

<div class="card-title">Bayesian Neural Network</div>

4 $\times$ 256 neurons, SiLU, 5% dropout

<!-- ![](data/BNN.png){width=50%}: add the image to presentation/data/ -->

:::

::: {.model-card}

<div class="card-title">Residual Mixture Density Network</div>

Residual-based MLP, 4 $\times$ 256 neurons

<!-- ![](data/BNN.png){width=50%}: add the image to presentation/data/ -->

:::

:::
