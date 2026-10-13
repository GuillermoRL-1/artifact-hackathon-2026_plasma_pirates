# Operations

## What runs

One Slurm job in the reservation `pdl18409_oct2026`: vLLM in an Apptainer image, serving `RedHatAI/GLM-5.3-Flash-NVFP4` on two GB200 as `glm-5.3-flash`, port 8000 on the compute node. Compute nodes are reachable only from inside the cluster, so access goes through ssh and an API key.

| | Path on DALIA |
|---|---|
| Scripts, image, logs | `/lustre/work/pdl18409/<login>/vllm` |
| Weights (185 GiB) | `/lustre/work/pdl18409/<login>/cache_huggingface` |
| Node name and key, group-readable | `/lustre/work/pdl18409/shared/vllm` |

## Schedule

A job is capped at 2 days, so the server is a chain of jobs, each starting when the previous one ends.

| Job | From | To |
|---|---|---|
| 151655 | Tue 13 Oct, 17:35 | Thu 15 Oct, 17:35 |
| 151656 | Thu 15 Oct, 17:35 | Fri 16 Oct, 15:35 |

Each start takes 11 minutes before the model answers. The node can change at each start; the job rewrites `shared/vllm/node`. The key is kept.

## Commands

From `/lustre/work/pdl18409/<login>/vllm`:

```bash
squeue -u $USER                                  # state, node, time left
tail -f slurm_logs/vllm_serve_<job>.err          # startup and requests
scancel <job>                                    # stop
sbatch --time=2-00:00:00 vllm_serve.sh           # start
sbatch --dependency=afterany:<job> --time=22:00:00 vllm_serve.sh   # chain the next one
rm /lustre/work/pdl18409/shared/vllm/api_key     # new key at the next start
```

First install, once:

```bash
mkdir -p slurm_logs
sbatch vllm_pull.sh        # arm64 vLLM image to a .sif, 7 min, 1 GPU
sbatch vllm_download.sh    # 198 GB of weights, 3 min, no GPU
```

## To know

- Nothing restarts a crashed job. If one dies, the next in the chain starts early and the chain ends sooner.
- The server holds two of the 12 hackathon GPUs day and night, about 140 GPU-hours until Friday.
- The official FP8 weights (`zai-org/GLM-5.3-Flash`) do not start on two GB200: they take 158 of the 184 GiB of each GPU.
- The reservation ends Fri 16 Oct, 16:00.
