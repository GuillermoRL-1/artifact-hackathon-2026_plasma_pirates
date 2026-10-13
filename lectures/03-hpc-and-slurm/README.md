# HPC and Slurm

**Speaker:** Stéphane Ilic (IDRIS)  
**Slot:** Monday, October 12 — early afternoon  

## 👉 ACCESS TO A JUPYTER NOTEBOOK ON DALIA 👈 

* **Step 0:** Make sure you have your SSH key (both private and public) on your machine in your `.ssh` folder (retrieve it from CC-IN2P3 if needed)
* **Step 1:** Set up your `.ssh/config` file as is described in Section 2 (step 1) of the present README 
* **Step 2:** In a terminal on your machine, type the following command (**do not forget to change `udlXXXXXX` by your own DALIA username**):
  ```
  ssh -vvv -i ~/.ssh/udlXXXXXX-DALIA -N -L 8891:dalianvl13:8888 udlXXXXXX@dalia
  ```
  ⚠️ **Leave the terminal open and running**

* **Step 3:** Open a web browser on your machine, and type the following URL, but **change `INSERT_YOUR_NAME_HERE` beforehand into whatever your want (make it unique!)**:
  ```
  http://127.0.0.1:8891/lab/workspaces/INSERT_YOUR_NAME_HERE?token=f0cd505f14117b5405648280c9955d706d7f145daf0b87e4
  ```
* **Step 4:** Navigate to any folder you want on DALIA, starting from `/workspace` which leads to the root `/` of DALIA. For example, the Hackathon shared folder can be reached via:
  ```
  /workspace/lustre/work/pdl18409/shared 
  ```

## ⚠️ BREAKING NEWS ⚠️ (TUESDAY 2026/10/13)

1. Two env variables (`$APPTAINER_TMPDIR` and `$TMPDIR`) have been removed from the example `.bashrc` file, due to causing errors when building containers with `apptainer build`
2. Read/write rights in the **Hackathon shared folder** (`/lustre/work/pdl18409/shared`) are a bit more tricky than expected; **every time you create a subdirectory in that specific folder, a procedure has to be followed in order for all the other Hackathon members to be able to write inside this folder**. The typical sequence is as follows:
```bash
cd /lustre/work/pdl18409/shared    # navigate to shared folder
mkdir some_folder                  # create a subdirectory
# Set the correct rights
chmod -R g+s some_folder
setfacl -R -d -m g::rwx some_folder
setfacl -R -m g::rwx some_folder
```
3. The `module load slurm/slurm/24.11` command has been removed from the example `.bashrc` file because it is already present by default. 

## Abstract

Introduction to DALIA at IDRIS (CNRS National Supercomputing Center, Orsay, France) — Europe's first NVIDIA GB200 NVL72 system. This guide covers connecting to the cluster, managing the x86/ARM architecture difference, setting up Apptainer containers, redirecting caches to avoid Lustre/home quotas, launching interactive debugging sessions (`srun`), and submitting multi-GPU batch jobs (`sbatch`).

---

## 1. System Overview & Architecture

- **Machine:** DALIA (18 compute nodes, 72 NVIDIA GB200 GPUs, NVLink-72 liquid-cooled rack).
- **Compute node specs:** Dual ARM Neoverse-V2 (Grace) CPUs (144 cores, 1.7 TB RAM), 4x NVIDIA GB200 GPUs (186 GB HBM3e VRAM each).
- **Storage:** 500 TB Lustre parallel storage (`DDN AI400X2 Turbo` on 200 GbE).
- **Non-ZRR status:** Simplified access compared to Jean Zay for international research collaborations.
- **Compute nodes have direct outbound internet:** Services like Hugging Face, GitHub, pip, and Weights & Biases (WandB) work directly inside compute jobs.

> ⚠️ **CRITICAL PITFALL — Architecture Mismatch:**  
> - **Login node (`dalia.idris.fr`):** Intel Xeon Gold (x86_64).  
> - **Compute nodes:** ARM Grace (aarch64).  
> **Never compile or build binaries on the login node for compute jobs.** Binaries compiled on x86 will fail on compute nodes with `Illegal instruction (core dumped)`. Always use ARM64 Apptainer containers or compile inside an interactive compute node session.

---

## 2. SSH Connection Setup

Access requires an **Ed25519 SSH key** registered during onboarding and an authorized/whitelisted IP (or institutional jump host such as CC-IN2P3).

### Step 1: Configure `~/.ssh/config` on your laptop or jump host
```ssh-config
Host dalia
    Hostname dalia.idris.fr
    User udlxxxxxx                       # replace by your login
    ForwardX11 yes
    ForwardAgent yes
    IdentityFile ~/.ssh/id_ed25519_dalia # replace by appropriate key file name

    # Optional: If routing via CC-IN2P3 jump host:
    # ProxyJump my_cc_login@cca.in2p3.fr
    # Or another gateway:
    # ProxyJump my_jump_login@jump.machine.address
```

### Step 2: Set permissions and connect
```bash
chmod 600 ~/.ssh/id_ed25519_dalia
ssh dalia
```

---

## 3. Environment & Storage Configuration (Mandatory)

The `$HOME` directory (`~`) has a strict quota (**3 GB, 12,000 inodes**). **Do not store conda environments, datasets, or caches in `$HOME`** or your account will block.

Add the following configuration to your `~/.bashrc` on DALIA:

```bash
# Set base project directory on Lustre
export PROJECT_DIR=/lustre/work/pdl18409/$USER

# Redirect Apptainer caches and temporary files to Lustre
export APPTAINER_CACHEDIR=$PROJECT_DIR/cache_apptainer
mkdir -p $APPTAINER_CACHEDIR

# Redirect AI framework caches to Lustre
export HF_HOME=$PROJECT_DIR/cache_huggingface
export TRITON_HOME=$PROJECT_DIR/cache_triton

# Handy aliases
alias sq='squeue -u $USER'
```

Apply changes:
```bash
source ~/.bashrc
```

Check your `$HOME` usage anytime with:
```bash
df -h $HOME
```

### Shared Storage Locations
- **User Work space:** `/lustre/work/pdl18409/<login>`
- **Shared Containers:** `/lustre/work/pdl18409/shared/containers/*.sif` (or `/lustre/work/shared/containers/*.sif`)
- **Shared Datasets:** `/lustre/work/pdl18409/shared/data` *(Pre-loaded, no need to re-download)*

---

## 4. Slurm Basics

Ensure the Slurm module is loaded:
```bash
module load slurm/slurm/24.11
```

| Command | Usage | Description |
| :--- | :--- | :--- |
| `sinfo` | `sinfo -o '%20P %5D %14F %8T'` | View partitions and node status (idle, alloc, down) |
| `squeue` | `squeue -u $USER` | Check job queue (`PD`: Pending, `R`: Running, `CG`: Completing) |
| `scancel` | `scancel <job_id>` | Terminate a running or queued job |
| `seff` | `seff <job_id>` | Inspect CPU & memory efficiency of a finished job |

---

## 5. Interactive Prototyping (`srun`)

Always validate code interactively on a GPU before queuing batch jobs.

### Step 1: Allocate 1 GPU interactively for 1 hour
```bash
srun --reservation=pdl18409_oct2026 \
     --nodes=1 \
     --ntasks-per-node=1 \
     --gpus-per-node=1 \
     --cpus-per-task=36 \
     --time=01:00:00 \
     --pty bash
```
*(Rule: 36 ARM physical cores per GPU).*

### Step 2: Open an Apptainer shell inside the container
```bash
apptainer shell --nv \
  --bind $PROJECT_DIR:/workspace \
  /lustre/work/pdl18409/shared/containers/surrogate_models.sif
```

### Step 3: Verify GPU detection & memory
```python
python3 -c "import torch; print('Device:', torch.cuda.get_device_name(0)); print('Memory:', torch.cuda.get_device_properties(0).total_memory / 1e9, 'GB')"
```
*Expected Output:* `Device: NVIDIA GB200 | Memory: ~199.8 GB`

When finished, type `exit` to exit the container, and `exit` again to release the node reservation.

---

## 6. Batch Training Runs (`sbatch`)

### Submission Script Template: `train_model.sh`
Create a script in your working folder:

```bash
#!/usr/bin/env bash
#SBATCH --job-name=aissai_hackathon
#SBATCH --reservation=pdl18409_oct2026
#SBATCH --output=slurm_logs/%x_%j.out
#SBATCH --error=slurm_logs/%x_%j.err
#SBATCH --nodes=1
#SBATCH --gpus-per-node=4
#SBATCH --ntasks-per-node=4
#SBATCH --cpus-per-task=36
#SBATCH --time=02:00:00

set -x

# Fix Linux stack size to prevent NCCL communication segfaults
ulimit -s 8192

# Ensure log directory exists (Slurm fails if the folder does not exist)
mkdir -p slurm_logs

# Execute code inside Apptainer container
srun apptainer exec --nv \
  --bind $PROJECT_DIR:/workspace \
  /lustre/work/shared/containers/aissai_pytorch_2026.sif \
  python some_script.py --some-argument=something
```

Submit with:
```bash
sbatch train_model.sh
```

---

## 7. Scaling Up & Distributed Training

- **Single node (4x GB200):** Communicates via 5th-Gen NVLink interconnect. 4 GPUs provide ~744 GB of high-speed aggregated VRAM, sufficient for 90% of hackathon workloads.
- **PyTorch DDP (Distributed Data Parallel):**
  ```bash
  torchrun --nproc_per_node=4 train_ddp.py
  ```
- **Multi-Node NCCL Stack Fix:**
  Default Linux stack size (2 MB) causes segmentation faults during large NCCL multi-node handshakes. Always include:
  ```bash
  ulimit -s 8192
  ```
  at the top of your batch scripts.

---

## 8. Monitoring & Inspection

1. **Watch live logs:**
   ```bash
   tail -f slurm_logs/aissai_hackathon_<job_id>.out
   ```
2. **Inspect live GPU status on the compute node:**
   ```bash
   ssh <assigned_node_name>   # e.g., ssh dalianvl04
   nvidia-smi
   exit                       # Always exit when inspection is done
   ```
   *Tip:* Aim for `GPU-Util > 80%`. If `< 20%`, your PyTorch DataLoader is CPU-bottlenecked (increase `num_workers`).
3. **Weights & Biases (WandB):**
   Compute nodes have internet access, allowing live logging:
   ```python
   import wandb
   wandb.init(project="hackathon_2026")
   ```

---

## 9. Troubleshooting & FAQ

| Error / Issue | Cause | Solution |
| :--- | :--- | :--- |
| `command not found: sbatch / srun` | Slurm module is not loaded | Run `module load slurm/slurm/24.11` |
| `Illegal instruction (core dumped)` | x86 vs ARM64 mismatch | Code was compiled on the login node. Execute inside an ARM64 Apptainer container or compile on an interactive compute node. |
| `Disk quota exceeded` | `$HOME` quota exceeded (3 GB limit) | Check `df -h $HOME`. Clear `~/.cache` and make sure `APPTAINER_CACHEDIR` and `HF_HOME` point to `$PROJECT_DIR` on Lustre. |
| `CUDA Out of Memory (OOM)` | Batch size too large | Reduce batch size, use `torch.amp` (bfloat16), or enable gradient checkpointing. |
| `NCCL Segfault across nodes` | Linux stack size too small | Add `ulimit -s 8192` to your submission script. |
| SSH `Permission Denied` | Bad SSH key permissions | Run `chmod 600 ~/.ssh/id_ed25519_dalia`. |

---

## 10. Additional Resources & Support

- **Official IDRIS DALIA Documentation:** [http://www.idris.fr/en/docs/dalia/dalia-presentation](http://www.idris.fr/en/docs/dalia/dalia-presentation)
- **IDRIS Helpdesk:** `assist@idris.fr`  
  ⚠️ **Important:** You must include `[Dalia]` in the email subject line.
- **Hackathon Agora:** Post logs and questions to the hackathon channel for on-site mentor support.
