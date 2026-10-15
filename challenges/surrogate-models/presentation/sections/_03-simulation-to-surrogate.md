## From simulation to surrogate

::: {.columns .simulation-columns}
::: {.column .simulation-summary}
**Prediction tasks**

- **Campaign A:** varying laser and gas settings
  - Inverse: bunch properties → settings
  - Direct prediction as a warm-up
- **Campaign B:** fixed laser parameters, varying gas profile and focus
  - Direct: settings → final bunch properties
  - Inverse: bunch properties → gas-profile settings
  - Trajectories: bunch evolution along the accelerator
  - Moments: bunch centroids, widths and charge at observation planes

**Key questions:** accuracy, data efficiency and generalisation beyond training conditions.
:::

::: {.column .simulation-diagram}
::: {.pipeline}
::: {.pipeline-step .fragment .step-in}
**01**  
Accelerator settings

Laser, gas profile and focus position
:::
::: {.pipeline-step .fragment .step-in}
**02**  
PALLAS simulations

Particle-in-cell simulations with Smilei
:::
::: {.pipeline-step .fragment .step-in}
**03**  
Training and validation

Bunch properties, trajectories and moments
:::
::: {.pipeline-step .highlight .fragment .step-in}
**04**  
Surrogate models

Fast predictions for R&D
:::
:::
:::
:::

::: {.notes}
Replace the labels above with the final data flow once the presentation narrative is settled.
:::
