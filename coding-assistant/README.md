# A coding model on DALIA for Claude Code

GLM-5.3-Flash runs on two GB200 of the hackathon reservation. It is reachable only through ssh, with the accounts from the [access guide](../access-guide.md): your CC-IN2P3 login and your DALIA login, with the DALIA key on `cca`.

## 1. Install Claude Code

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

Other systems: https://code.claude.com/docs/en/setup. No Anthropic account is needed.

## 2. Read the node and the key

On `cca`:

```bash
ssh -i ~/.ssh/<dalia_login>-DALIA <dalia_login>@dalia.idris.fr \
  'cat /lustre/work/pdl18409/shared/vllm/node /lustre/work/pdl18409/shared/vllm/api_key'
```

The first line is the node (for example `dalianvl13`), the second is the key.

## 3. Open the tunnel

On your laptop. Pick any number between 20000 and 60000 as `<port>`. Leave it running.

```bash
ssh -t -L 8000:localhost:<port> <cc_login>@cca.in2p3.fr \
  ssh -N -i ~/.ssh/<dalia_login>-DALIA -L <port>:<node>:8000 <dalia_login>@dalia.idris.fr
```

## 4. Start Claude Code

In another terminal, in your project folder:

```bash
ANTHROPIC_BASE_URL=http://localhost:8000 \
ANTHROPIC_API_KEY=<key> ANTHROPIC_AUTH_TOKEN=<key> \
ANTHROPIC_DEFAULT_OPUS_MODEL=glm-5.3-flash \
ANTHROPIC_DEFAULT_SONNET_MODEL=glm-5.3-flash \
ANTHROPIC_DEFAULT_HAIKU_MODEL=glm-5.3-flash \
claude
```

Any OpenAI client works too: base URL `http://localhost:8000/v1`, the same key, model `glm-5.3-flash`.

## What you get

| | |
|---|---|
| Context | 1,048,576 tokens |
| One request alone | first token in 0.3 s, 180 tokens/s |
| 16 requests at once | 85 tokens/s each |
| 64 requests at once | 48 tokens/s each, first token in 2.5 s |
| Memory for conversations | 9.9M tokens shared by everyone |

Measured with a 33,000-token conversation per request.

## Limits

- The server stops at the end of its job. After a restart the node can change: read it again and reopen the tunnel.
- The model thinks before every answer, at full depth. Long thinking is normal.
- The weights are a 4-bit version (`RedHatAI/GLM-5.3-Flash-NVFP4`). Its coding scores are not published.
- `setsockopt TCP_NODELAY: Invalid argument` in the tunnel terminal is harmless.

## Running the server

One server runs for everyone. Do not start a second one: it takes two more of the 12 hackathon GPUs.

From `/lustre/work/pdl18409/<login>/vllm` on DALIA, with a `slurm_logs` folder next to the scripts:

```bash
sbatch vllm_pull.sh                    # arm64 vLLM image to a .sif, 7 min, 1 GPU
sbatch vllm_download.sh                # 198 GB of weights to Lustre, 3 min, no GPU
sbatch --time=04:00:00 vllm_serve.sh   # 2 GPUs, ready after 11 min
```

`vllm_serve.sh` writes the node and the key to `/lustre/work/pdl18409/shared/vllm`, readable by the hackathon group. The official FP8 weights (`zai-org/GLM-5.3-Flash`) do not start on two GB200: they take 158 of the 184 GiB of each GPU.
