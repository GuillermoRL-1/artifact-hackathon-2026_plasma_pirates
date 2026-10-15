---
title: "Plasma Pirates: Surrogate Models of PALLAS Simulations"
author: "Hayg Guler · Alexander Hill · Sébastien Joly · Keon Hee Kim · Mykyta Lenivenko · Guillermo Rodrîguez Llorente"
format:
  revealjs:
    theme: [default, custom.scss]
    slide-number: c/t
    show-slide-number: all
    hash: true
    controls: true
    progress: true
    transition: slide
    background-transition: fade
    width: 1280
    height: 720
    margin: 0.05
    center: false
    footer: "AISSAI Hackathon 2026 · Plasma Pirates"
    include-after-body:
      - _afterbody.html
      - _pipeline.html
execute:
  echo: false
  eval: false
  warning: false
  message: false
---
{{< include sections/_01-why-surrogates.md >}}

[comment]: <> ({{< include sections/_02-kaldera-animation.md >}})

{{< include sections/_02-pallas-overview.md >}}

{{< include sections/_03-simulation-to-surrogate.md >}}

{{< include sections/_04-data-exploration.md >}}

{{< include sections/_05-pipeline-overview.md >}}

{{< include sections/_06-pipeline-feature-store.md >}}

{{< include sections/_07-pipeline-transformations.md >}}

{{< include sections/_08-pipeline-training.md >}}

{{< include sections/_09-pipeline-registry.md >}}

{{< include sections/_10-pipeline-benchmark.md >}}

{{< include sections/_11-pipeline-status.md >}}

{{< include sections/_12-pipeline-handin.md >}}

[comment]: <> ({{< include sections/_13-modelling-directions.md >}})

[comment]: <> ({{< include sections/_14-data-quality.md >}})

[comment]: <> ({{< include sections/_16-plotly-scatter.md >}})

[comment]: <> ({{< include sections/_17-model-experiments.md >}})

[comment]: <> ({{< include sections/_18-results.md >}})

[comment]: <> ({{< include sections/_19-takeaways.md >}})

{{< include sections/_13-case_study.md >}}

{{< include sections/_18a-trajectory-explainability.md >}}

{{< include sections/_18b-trajectory-ood.md >}}

{{< include sections/_18c-trajectory-uncertainty.md >}}

{{< include sections/_19a-summary-next.md >}}

{{< include sections/_20-questions.md >}}

{{< include sections/_15-trajectory-outliers.md >}}