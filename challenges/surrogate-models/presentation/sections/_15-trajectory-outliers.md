## Bonus: Identifying possible outliers in trajectories

::: {.columns}
::: {.column width="58%"}

<iframe
  class="plotly-frame outlier-histogram-frame"
  src="data/trajectory_histograms.html"
  title="Interactive trajectory feature histograms"
  loading="lazy">
</iframe>

::: {.caption}
Static Hopsworks snapshot: use the dropdown to inspect one trajectory feature at a time.
:::

:::
::: {.column width="38%"}

### How the method works

For every numeric trajectory input and target, the explorer applies two complementary univariate tests:

```python
q1, q3 = values.quantile([0.25, 0.75])
iqr = q3 - q1
iqr_flag = (values < q1 - 1.5 * iqr) | \
           (values > q3 + 1.5 * iqr)

median = values.median()
MAD = abs(values - median).median()
robust_z = abs(values - median) / (1.4826 * MAD)
robust_flag = robust_z > 3.5
```

The two flags are combined with an **OR**. A row becomes a candidate outlier when at least one selected feature is flagged. The method identifies candidates; it does not delete rows automatically.

:::
:::
