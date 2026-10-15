## Summary

::: {.columns}
::: {.column width="31%"}
::: {.metric-card}
**A plain MLP is enough, mostly**

`0.98–0.99 R²`

Inverse A, Direct B, trajectory: well-trained MLPs on standardised targets beat every bar; bigger or Bayesian models add ≤ 0.003
:::
:::
::: {.column width="31%"}
::: {.metric-card}
**Out of distribution, structure helps**

`0.955 → 0.973`

Above the density cut, ensembles, FiLM and Bayesian networks hold up better than a plain MLP
:::
:::
::: {.column width="31%"}
::: {.metric-card}
**A billion times faster**

`~1 ms vs 250 core-hours`

One configuration on one CPU core; the whole 2,882-config campaign in ~3 s
:::
:::
:::

- Particles: a FiLM mixture trains in minutes and beats the reference Gaussian (1.44 vs 2.13), with error left to remove
- Hard inverse problems sometimes need several answers: a mixture recovers dip_frac (0.08 → 0.80)

## Next steps

- **Moments:** the beam's centre wiggles from side to side along the plasma (a betatron oscillation), and our models follow it only partly. Next: give the model the phase of this oscillation, computed from the physics, as an input
- **Particles:** the electron cloud shrinks and grows by a factor of up to 5,000 along the accelerator, which makes bigger models unstable to train. Next: rescale the cloud at each position separately, then train a larger model to close the gap to perfect (1.44 → 1)
- **Real-time diagnostics:** ~1 ms per prediction: fast enough to run beside the experiment and read the settings back from a measured bunch
