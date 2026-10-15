## Trajectory · does the model know how wrong it is? {#traj-uncertainty}

<div class="traj-switch traj-switch-center" data-for="uncertainty-chart honesty-chart"><button data-view="E_MeV">Energy E</button><button data-view="q_pC">Charge q</button><button data-view="dE_pct">Energy spread ΔE</button><button data-view="emit_um">Emittance ε</button><button data-view="div_mrad">Divergence</button><button class="active" data-view="sigz_um">Bunch length σz</button></div>

::: {.columns}
::: {.column width="47%"}

### One simulation it never saw

<div id="uncertainty-chart" class="viz traj-md" data-traj="uncertainty-curve" data-view="sigz_um"></div>

<div class="sigma-control">
<label for="sigma-k">band</label>
<input id="sigma-k" type="range" min="1" max="3" step="0.5" value="1">
<b id="sigma-k-out">1σ</b>
<span>simulation inside the band: <b id="sigma-inside">—</b></span>
</div>

:::
::: {.column width="50%"}

### All 1,033 held-out simulations

<div id="honesty-chart" class="viz traj-md" data-traj="honesty" data-view="sigz_um"></div>

::: {.compact}
- Every prediction comes with an error bar **σ** (MC dropout). Blue is the error the model **announces**, orange the error it **makes**.
- Lines together: the error bar can be trusted. **Orange above blue: the model is over-confident.**
- For σz the error bar is honest inside the training range; past the cut the real error is about **1.7×** what the model announces (8.4 % vs 5.0 %).
:::

:::
:::

::: {.notes}
Left: Sébastien's MC-dropout curve of sj_trajectory_bayesian_nn v5 (configuration 1013, a held-out simulation), with the Smilei truth; the slider widens the band. Right: sj_trajectory_bayesian_nn_ood v1, 50 MC-dropout passes on its 1,033 holdout configurations; per configuration the RMS of sigma and of the actual error, as a relative error in %, medians per density bin. Energy spread and emittance are over-confident everywhere; energy, charge and divergence are cautious in range.
:::
