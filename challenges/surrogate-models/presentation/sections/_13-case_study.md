## Case study: TrajectoryB

_TrajectoryB_ predicts the evolution of the beam parameters along the longitudinal direction for various settings.

The case was modelled using four different neural-network architectures:

::: {.cards}

::: {.model-card}

<div class="card-title">Multilayer Perceptron</div>

4 $\times$ 256 neurons.

##![](/data/MLP.png){width=50%}

:::

::: {.model-card}

<div class="card-title">DLinear</div>

Trend + Seasonal decomposition, linear projection

:::

::: {.model-card}

<div class="card-title">Bayesian Neural Network</div>

4 $\times$ 256 neurons, SiLU, 5% droptout

![](/data/BNN.png){width=50%}

:::

::: {.model-card}

<div class="card-title">Residual Mixture Density Network</div>

Residual-based MLP, 4 $\times$ 256 neurons

![](/data/BNN.png){width=50%}

:::