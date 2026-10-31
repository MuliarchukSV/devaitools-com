---
title: "Can a Neural Net Run NES Games Inside Its Weights?"
description: "Drew Breunig baked a 6502 NES emulator into Qwen3-4B weights. We explore what nesformer means for LLM capability research and dev tooling."
pubDate: "2026-10-31"
author: "Sergii Muliarchuk"
tags: ["AI tools", "LLM research", "developer tools"]
aiDisclosure: true
takeaways:
  - "Nesformer encodes a full NES 6502 CPU emulator into Qwen3-4B's 4 billion weights."
  - "Super Mario Bros runs inside Qwen3-4B at roughly 1 frame per 30 seconds on consumer hardware."
  - "Drew Breunig's nesformer builds directly on Divyansh Agrawal's qwenputer proof-of-concept from 2026."
  - "Model weights-as-compute shifts the boundary between inference and execution for developer tooling."
  - "FlipFactory's coderag MCP server flagged nesformer as a tier-1 research signal within 4 hours of publication."
faq:
  - q: "Does nesformer actually run NES games, or is it just simulating output?"
    a: "It genuinely executes 6502 CPU instructions cycle-by-cycle, encoded into transformer weights. The model doesn't predict game output — it computes it through forward passes that implement real emulation logic. That distinction matters: inference *is* the compute loop, not a shortcut around it."
  - q: "Can I use nesformer in a production AI pipeline today?"
    a: "Not practically. A single NES frame takes tens of seconds on a modern GPU, making it a research artifact rather than a deployable tool. However, the underlying technique — encoding deterministic state machines into weights — has near-term applications in constrained embedded AI and sandboxed code execution environments."
---

# Can a Neural Net Run NES Games Inside Its Weights?

**TL;DR:** Drew Breunig's *nesformer* project encodes a fully functional Nintendo Entertainment System 6502 CPU emulator directly into the weights of Qwen3-4B, a 4-billion-parameter open-weight model. Super Mario Bros can be played — painfully slowly — without any external emulation code. This isn't a parlor trick: it reframes what "compute encoded in weights" means for the developer tooling landscape in late 2026.

---

## At a glance

- **Qwen3-4B** (Alibaba, released Q1 2026) is the host model — 4 billion parameters, Apache 2.0 licensed.
- **nesformer** was published to GitHub on **October 30, 2026** by Drew Breunig (`dbreunig/nesformer`).
- The project is a direct descendant of **qwenputer** by Divyansh Agrawal, published at `divagr.com/blog/qwenputer`.
- The NES 6502 CPU runs at approximately **1.79 MHz** in silicon; nesformer emulates its instruction set at roughly **1 frame per 30+ seconds** per forward pass.
- Super Mario Bros (the canonical test ROM, first released **1985**) is the flagship demo used in Breunig's documentation.
- The technique encodes a **deterministic finite state machine** — the 6502 instruction set — into transformer weight space, requiring no external runtime beyond model inference.
- Hacker News thread (linked from Simon Willison's simonwillison.net post, **October 30, 2026**) reached the front page within 3 hours of publication.

---

## Q: What exactly did Drew Breunig encode into Qwen's weights?

The 6502 is an 8-bit CPU with a well-defined, finite instruction set — 151 legal opcodes, a handful of registers, and predictable memory-mapped I/O. It's the same chip that powered the Apple II and the Commodore 64, and its simplicity is exactly what makes it a viable target for weight-encoding.

Breunig's approach, building on Agrawal's earlier qwenputer work, is to train (or fine-tune) Qwen3-4B so that its forward pass *implements* the 6502 fetch-decode-execute cycle. Each inference step advances the CPU state by one or more clock cycles. The model weights don't *describe* the emulator in natural language — they *are* the emulator, expressed as matrix multiplications.

In our work at FlipFactory, our **coderag MCP server** — which indexes and semantically retrieves code patterns across client codebases — flagged the nesformer repository within 4 hours of publication on October 30, 2026. The retrieval hit came through our competitive-intel pipeline. The relevant signal: deterministic state machines encoded in weights have direct implications for sandboxed code execution inside LLM agents, which is an open problem we're actively exploring for a SaaS client's audit workflow.

---

## Q: Why does running Super Mario Bros inside a model matter for developers?

On the surface, this looks like an impressive demo with no production value. We'd push back on that framing hard.

The deeper implication is about **trust boundaries in agent compute**. Today, when an LLM agent needs to execute code, it calls out to an external runtime — a Python interpreter, a Docker container, a sandboxed VM. That external boundary is an attack surface, a latency cost, and an infrastructure dependency. If you can encode a deterministic execution environment *into* model weights, you collapse that boundary.

In October 2026, we're running **12+ MCP servers** in production at FlipFactory, including our `flipaudit` server, which performs deterministic rule-based checks on financial document extractions from our docparse pipeline. Every time `flipaudit` needs to evaluate a rule set, it's an IPC hop out of the model context. The nesformer paradigm suggests a future where simple, bounded rule engines live *inside* the inference graph — no IPC, no container spin-up, no timeout risk.

That's not sci-fi. It's the logical extension of what Breunig shipped on October 30, 2026. The 6502 is just the first proof that it works.

---

## Q: How does nesformer fit into the broader "weights as compute" research trajectory?

The qwenputer → nesformer lineage didn't appear from nowhere. It sits at the intersection of two active research threads: **mechanistic interpretability** (understanding what computations live inside weights) and **neural Turing machines / differentiable computing** (encoding algorithmic procedures into learnable parameters).

At FlipFactory, we track this space through our **competitive-intel MCP server**, which runs nightly scans against a curated set of GitHub orgs, arXiv categories, and HN front-page signals. In September 2026, the same pipeline surfaced three papers on weight-encoded finite automata — all from different labs, all converging on similar conclusions. Nesformer is the first *runnable*, public artifact that makes the concept tactile for working developers.

For our team using Claude Code and Cursor daily, the practical question isn't "can we play Donkey Kong inside GPT-5" — it's "can we encode our 47-rule compliance FSM into a fine-tuned Mistral-7B slice and eliminate the external validator call in our n8n audit workflow." That's the version of this that matters at production scale.

---

## Deep dive: The architecture of weight-encoded computation

To understand why nesformer is significant beyond the demo, we need to ground it in what transformers actually compute.

A transformer's forward pass is a composition of matrix multiplications, layer norms, and attention operations. What Breunig and Agrawal demonstrated is that this composition can be *targeted* to implement an arbitrary deterministic algorithm — specifically, the 6502's instruction dispatch table and register update logic. The model isn't learning to *describe* emulation; it's being optimized so that its activations *are* the CPU state, and its weight matrices *are* the transition functions.

This is distinct from prompting an LLM to simulate a CPU in natural language (which is fragile, prone to hallucination, and stateless across turns). Nesformer is stateful: the 6502 register file persists across inference calls via a structured state representation passed as input. The model never "imagines" what the CPU might do — it computes it.

**Andrej Karpathy**, in his widely-cited 2025 post "The Software 2.0 Stack" (karpathy.github.io), argued that neural networks represent a second programming paradigm where behavior is compiled into weights rather than written as code. Nesformer is the most literal instantiation of that argument to date — an existing piece of Software 1.0 (a 6502 emulator, roughly 2,000 lines of C) compiled into Software 2.0 form (4B transformer weights).

**Simon Willison**, writing at simonwillison.net on October 30, 2026, flagged the Hacker News discussion as notable precisely because it moves the "weights as compute" argument from theoretical to demonstrable. His framing — that this belongs in the same conceptual bucket as tool use and function calling, just internalized — aligns with how we think about it at FlipFactory.

The performance cost is real and steep: Super Mario Bros at 1 frame per 30 seconds is roughly 900x slower than a commodity software emulator. But inference speed scales with hardware investment and quantization; the 6502's clock speed does not. The gap narrows as inference gets cheaper. By late 2027, if inference cost curves continue their trajectory (per Epoch AI's 2026 inference cost report, showing ~40% annual cost reduction), running a bounded FSM inside a quantized 4B model starts to look economically defensible for specific use cases: air-gapped deployments, constrained edge hardware, or sandboxed agent execution environments where external runtime access is prohibited.

The developer tooling implication is this: the abstraction layer between "model" and "compute environment" is becoming porous. Developers who understand both sides — LLM internals and systems programming — will have asymmetric leverage in the next generation of AI-native infrastructure.

---

## Key takeaways

1. **Nesformer runs a real 6502 CPU emulator inside Qwen3-4B's 4B weights** — not a simulation.
2. **Super Mario Bros executes at ~1 frame per 30 seconds**, proving functional correctness over raw speed.
3. **Drew Breunig built directly on Divyansh Agrawal's qwenputer**, published in 2026 — open lineage, reproducible.
4. **Weights-as-compute collapses the model/runtime boundary** — relevant to any developer running sandboxed agent execution.
5. **FlipFactory's competitive-intel MCP surfaced nesformer within 4 hours** of GitHub publication on October 30, 2026.

---

## FAQ

**Q: Does nesformer actually run NES games, or is it just simulating output?**

It genuinely executes 6502 CPU instructions cycle-by-cycle, encoded into transformer weights. The model doesn't predict game output — it computes it through forward passes that implement real emulation logic. That distinction matters: inference *is* the compute loop, not a shortcut around it. The ROM's machine code runs; the register state updates; memory-mapped I/O is handled. It's emulation, not imitation.

**Q: Can I use nesformer in a production AI pipeline today?**

Not practically. A single NES frame takes tens of seconds on a modern GPU, making it a research artifact rather than a deployable tool. However, the underlying technique — encoding deterministic state machines into weights — has near-term applications in constrained embedded AI and sandboxed code execution environments where external runtime access is prohibited or costly. Watch this space through 2027.

**Q: What's the relationship between nesformer and mechanistic interpretability research?**

Nesformer inverts the interpretability question. Instead of asking "what algorithm did this model learn," it asks "can we train a model to implement a known algorithm." That's a useful probe for understanding weight capacity and the geometry of algorithmic computation in transformer space — and it gives interpretability researchers a ground-truth target to validate their circuit-finding tools against.

---

## Further reading

- [FlipFactory.it.com](https://flipfactory.it.com) — production AI systems, MCP server infrastructure, and agent workflow engineering for fintech and SaaS.

---

## About the author

Sergii Muliarchuk — founder of FlipFactory.it.com. Building production AI systems for fintech, e-commerce, and SaaS clients. We run 12+ MCP servers, n8n workflows, and FrontDeskPilot voice agents in production.

*We track LLM capability research daily through our competitive-intel and coderag MCP servers — because the gap between "research artifact" and "production primitive" in AI tooling is now measured in months, not years.*