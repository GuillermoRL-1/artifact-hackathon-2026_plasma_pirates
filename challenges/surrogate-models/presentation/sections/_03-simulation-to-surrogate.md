## From simulation to surrogate

::: {.columns .simulation-columns}
::: {.column .simulation-summary}
**Challenges**

- Campaign A (varying gas and laser properties)
    - Direct and inverse
- Campaign B (fixing laser, inputting gas density curve)
    - Direct and inverse
    - Trajectory prediction (+ out of range)
    - Moments of the plain
:::

::: {.column .fragment .custom .simulation-diagram}
::: {.pipeline}
::: {.pipeline-step}
**01**  
Simulation settings

Beam, target, and machine parameters
:::
::: {.pipeline-step}
**02**  
PALLAS simulation

High-fidelity trajectories and fields
:::
::: {.pipeline-step}
**03**  
Training data

Features, targets, and quality checks
:::
::: {.pipeline-step .highlight}
**04**  
Surrogate model

Fast predictions for R&D
:::
:::
:::
:::

::: {.notes}
Replace the labels above with the final data flow once the presentation narrative is settled.
:::
