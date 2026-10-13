#!/usr/bin/env bash
#SBATCH --job-name=vllm_pull
#SBATCH --reservation=pdl18409_oct2026
#SBATCH --output=slurm_logs/%x_%j.out
#SBATCH --error=slurm_logs/%x_%j.err
#SBATCH --nodes=1
#SBATCH --gpus-per-node=1
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=36
#SBATCH --time=00:30:00

# Pulls the arm64 vLLM image into a .sif on Lustre and checks that it sees the GPU.
# Runs on a compute node: the login node is x86_64 and would pull the wrong architecture.
# Usage: sbatch vllm_pull.sh [docker tag of vllm/vllm-openai]

set -euo pipefail

TAG="${1:-glm53-flash}"
export PROJECT_DIR=/lustre/work/pdl18409/$USER
export APPTAINER_CACHEDIR=$PROJECT_DIR/cache_apptainer
SIF=$PROJECT_DIR/vllm/vllm-$TAG.sif

uname -m
nvidia-smi --query-gpu=name,memory.total --format=csv

[ -f "$SIF" ] || apptainer pull "$SIF" "docker://vllm/vllm-openai:$TAG"
ls -la "$SIF"

apptainer exec --nv "$SIF" vllm --version
apptainer exec --nv "$SIF" python3 -c "
import torch, flashinfer
print('torch', torch.__version__, 'cuda', torch.version.cuda, torch.cuda.is_available())
print('device', torch.cuda.get_device_name(0), round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1), 'GB')
print('flashinfer', flashinfer.__version__)
"
