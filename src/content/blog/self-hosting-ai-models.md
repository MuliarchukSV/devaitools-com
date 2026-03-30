---
title: "Self-Hosting AI Models: When It Makes Sense"
description: "Practical guide to self-hosting LLMs. Covers hardware requirements, cost analysis, Ollama and vLLM setup, and when to use APIs instead."
pubDate: "2026-03-30"
author: "FlipFactory Editorial Team"
tags: ["self-hosting", "llm", "ollama", "ai-infrastructure"]
aiDisclosure: true
faq:
  - q: "How much does it cost to self-host an AI model?"
    a: "Hardware costs range from $800 (Mac Mini M4 with 24GB for 7B models) to $15,000+ (dual GPU server for 70B models). Running costs are $50-200/month for electricity and cooling. For most teams, self-hosting only makes economic sense above 50,000 API calls per month."
  - q: "Can self-hosted models match GPT-4 or Claude quality?"
    a: "Not for general reasoning. The best open models (Llama 3.1 70B, Mixtral 8x22B, DeepSeek-V3) approach GPT-4 on coding and factual tasks but trail on complex reasoning, instruction following, and safety. For specific tasks like code completion, classification, or extraction, fine-tuned open models can match or exceed API models."
---

## TLDR

Self-hosting AI models is not for everyone, but for the right use cases it offers significant advantages: zero data leaving your network, predictable costs at scale, no rate limits, and complete control over model behavior. This guide cuts through the hype and provides a practical framework for deciding when self-hosting makes sense, what hardware you need, how to set it up, and what it actually costs. We have been running self-hosted models for internal tools since mid-2025 and share real performance data and cost comparisons. The breakeven point is roughly 50,000 inference requests per month -- below that, API services are cheaper and simpler.

## When Self-Hosting Makes Sense

Self-hosting is the right choice in four scenarios:

**Data privacy requirements.** Regulated industries (healthcare, finance, legal) often cannot send data to third-party APIs. Self-hosted models keep everything on-premises. GDPR compliance becomes simpler when no data crosses organizational boundaries.

**High volume, predictable workloads.** If you process 100,000+ requests daily with consistent patterns, self-hosting costs 60-80% less than API pricing. A 70B parameter model running on a dual A100 server handles 50-100 requests per minute and costs approximately $2,000/month in hardware amortization plus electricity -- equivalent to $300-500/month in API calls at current Sonnet pricing.

**Low-latency requirements.** Self-hosted models eliminate network round-trips. Local inference on a 7B model delivers first-token latency under 50ms, compared to 200-500ms for cloud APIs. Critical for real-time applications like code completion and autocomplete.

**Fine-tuning and customization.** Self-hosted models can be fine-tuned on proprietary data. A model fine-tuned on your codebase, documentation, or domain knowledge outperforms general-purpose models for narrow tasks.

## Hardware Requirements

| Model Size | VRAM Needed | Recommended Hardware | Cost |
|-----------|-------------|---------------------|------|
| 7B (Llama 3.1, Mistral) | 8-16 GB | Mac Mini M4 24GB or RTX 4090 | $800-1,600 |
| 13B (CodeLlama, Nous) | 16-24 GB | Mac Studio M4 Max 64GB | $2,000-3,000 |
| 34B (DeepSeek Coder) | 24-48 GB | 2x RTX 4090 or A6000 | $3,000-6,000 |
| 70B (Llama 3.1) | 48-80 GB | A100 80GB or 2x A6000 48GB | $8,000-15,000 |

For Apple Silicon, quantized models (Q4_K_M) run efficiently on unified memory. A Mac Mini M4 Pro with 24GB RAM runs Llama 3.1 8B at 40 tokens/second -- fast enough for production code completion.

For NVIDIA GPUs, the RTX 4090 offers the best price-to-performance ratio at $1,600 with 24GB VRAM. The A100 80GB ($10,000-15,000) is the production standard for 70B models.

## Setting Up with Ollama

Ollama is the fastest path to running models locally. Install and start serving in under 5 minutes:

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Pull a model
ollama pull llama3.1:8b

# Start the API server (default port 11434)
ollama serve

# Test
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.1:8b",
  "prompt": "Write a Python function to validate email addresses",
  "stream": false
}'
```

Ollama handles model management, quantization, and serving with a simple API. It supports 100+ models from the Ollama library and custom GGUF files.

For production deployments, add a reverse proxy and basic auth:

```nginx
server {
    listen 443 ssl;
    server_name llm.internal.company.com;

    location / {
        auth_basic "LLM API";
        auth_basic_user_file /etc/nginx/.htpasswd;
        proxy_pass http://localhost:11434;
        proxy_read_timeout 300s;
    }
}
```

## Production Setup with vLLM

For high-throughput production workloads, vLLM is the industry standard. It uses PagedAttention to achieve 2-4x higher throughput than naive inference:

```bash
pip install vllm

# Start the server (OpenAI-compatible API)
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --tensor-parallel-size 2 \
  --max-model-len 8192 \
  --port 8000
```

vLLM provides an OpenAI-compatible API, meaning existing code that calls OpenAI or Claude can be pointed at your self-hosted endpoint with minimal changes:

```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "http://llm.internal:8000/v1",
  apiKey: "not-needed",
});

const response = await client.chat.completions.create({
  model: "meta-llama/Llama-3.1-70B-Instruct",
  messages: [{ role: "user", content: "Review this code..." }],
});
```

vLLM handles batching, KV-cache management, and continuous batching automatically. On a dual A100 setup, it processes 80-120 requests per minute for the 70B model.

## Cost Comparison: Self-Hosted vs API

For a workload of 100,000 requests/month with average 500 input + 200 output tokens:

**API costs (Claude 3.5 Sonnet):**
- Input: 100K x 500 tokens = 50M tokens x $3/MTok = $150
- Output: 100K x 200 tokens = 20M tokens x $15/MTok = $300
- **Total: $450/month**

**Self-hosted (Llama 3.1 70B on dual A100 server):**
- Server amortization: $15,000 / 36 months = $417/month
- Electricity: ~$100/month (600W x 24h x $0.12/kWh)
- Maintenance/admin: ~$100/month estimated
- **Total: $617/month** (but no per-request cost for additional volume)

The breakeven is around 140,000 requests/month at this tier. Above that, self-hosting wins economically. Below 50,000 requests/month, APIs are almost always cheaper when factoring in operational overhead.

## When to Stick with APIs

API services remain the better choice when:

- **Volume is low or unpredictable** -- you only pay for what you use
- **You need frontier model quality** -- GPT-4o and Claude Sonnet still outperform all open models on complex reasoning
- **Team lacks ML ops expertise** -- model serving, monitoring, and updates require ongoing attention
- **Rapid model iteration matters** -- API providers ship improvements weekly; self-hosted models are static
- **Compliance is handled by the provider** -- SOC 2, HIPAA BAA, and other certifications

The pragmatic approach: use APIs as default, self-host specific models for specific use cases where the economics or privacy requirements demand it. Many teams run a small local model for code completion and classification while using Claude or GPT-4o via API for complex reasoning tasks.
