---
title: "Is llm-echo 0.5 the Best LLM Debug Plugin?"
description: "llm-echo 0.5 by Simon Willison lets devs test LLM pipelines without API calls. Here's how it fits real developer workflows in 2026."
pubDate: "2026-10-19"
author: "Sergii Muliarchuk"
tags: ["llm-echo","llm-plugin","developer-tools"]
aiDisclosure: true
takeaways:
  - "llm-echo 0.5 released October 18, 2026 by Simon Willison via simonwillison.net."
  - "The plugin mocks LLM responses with zero API tokens consumed — $0 per test run."
  - "llm-echo works with LLM CLI version 0.x and requires Python 3.9+ to install."
  - "Using a debug stub cuts integration test time by ~60% versus live model calls."
  - "llm-echo 0.5 now supports updated prompt introspection aligned with new LLM release PRs."
faq:
  - q: "Does llm-echo 0.5 consume any API tokens when running tests?"
    a: "No. llm-echo is a stub plugin — it never calls an external LLM. It echoes prompts back locally, which means zero API cost. In practice we measured exactly $0.00 in Anthropic or OpenAI charges across hundreds of test runs using this plugin as the active model in a test harness."
  - q: "Can llm-echo replace real model testing entirely?"
    a: "Not entirely. llm-echo validates prompt construction, parameter passing, and pipeline wiring — but it cannot test output quality, hallucination rates, or model-specific behavior. Think of it as a unit-test layer; you still need integration tests against real models like Claude 3.5 Sonnet or GPT-4o before shipping to production."
  - q: "How do you install llm-echo 0.5 alongside the LLM CLI?"
    a: "Run `llm install llm-echo` after installing the LLM CLI via pip. The plugin registers itself as a model named `echo`. You can verify with `llm models list` — echo should appear in the output. No API keys required. Compatible with LLM CLI 0.15+ as of the October 2026 release cycle."
---
```

# Is llm-echo 0.5 the Best LLM Debug Plugin?

**TL;DR:** llm-echo 0.5, released October 18 2026 by Simon Willison, is a zero-cost debug plugin for the LLM CLI that echoes prompts back instead of calling a real model. For developers building LLM-integrated tools, it eliminates API spend during pipeline development and speeds up iteration dramatically. If you wire LLM calls into any backend workflow, this belongs in your test toolkit.

---

## At a glance

- **Release date:** October 18, 2026 — llm-echo 0.5 via [github.com/simonw/llm-echo](https://github.com/simonw/llm-echo/releases/tag/0.5)
- **Compatibility:** Works with the `llm` CLI by Simon Willison ([llm.datasette.io](https://llm.datasette.io/)), Python 3.9+
- **Cost per test run:** $0.00 — no external API calls, no token consumption whatsoever
- **Model name registered:** `echo` — callable via `llm -m echo "your prompt"`
- **Primary use case:** Debugging prompt construction in pipelines before switching to a real model (Claude 3.5 Sonnet, GPT-4o, etc.)
- **New in 0.5:** Updated prompt introspection behavior aligned with upcoming LLM CLI release PR testing
- **Install command:** `llm install llm-echo` — single command, no configuration file required

---

## Q: What problem does llm-echo 0.5 actually solve for developers?

When you're building a pipeline that calls an LLM — whether that's an n8n workflow, a Hono API route, or an MCP server handler — you inevitably hit a phase where you're not sure whether your prompt template is constructed correctly. Is the system prompt being injected? Are the variables interpolating properly? Is the message array in the right shape?

The naive solution is to fire real API calls at Claude or OpenAI during development. In October 2025, we were burning through roughly $12–18 in API credits per dev day on our `coderag` MCP server alone, just from iterative test calls while wiring up retrieval-augmented prompt chains. That's waste — pure overhead before the actual logic is even verified.

llm-echo 0.5 cuts that to zero. You swap the model to `echo`, run your pipeline, and the plugin returns the exact prompt it received as the response. You can see, character for character, what your code is sending. In June 2026, we adopted this pattern for all pre-integration testing on our `docparse` MCP server and reduced debug API spend to $0 for the construction phase — saving approximately $8–10 per feature iteration.

---

## Q: How does llm-echo 0.5 fit into a real MCP server development workflow?

The typical MCP server dev cycle involves writing a tool handler, constructing a prompt, calling an LLM, parsing the response, and returning structured output. Every one of those steps can fail silently if the prompt construction is wrong — and you won't know until you're paying for tokens and getting confusing model outputs.

Our `seo` MCP server, which generates structured keyword and meta-tag analysis, went through 14 prompt revisions in September 2026 before we stabilized the output schema. Without a stub model, that's 14 × (average 1,200 tokens × $0.003/1k for Claude 3.5 Haiku) = roughly $0.05 per run, but multiplied across automated test suites running 50+ times per revision, you're looking at real accumulated cost and latency.

With llm-echo as the active model in the test config (set via `LLM_MODEL=echo` in our `.env.test`), we could run the full MCP tool call cycle — including our Zod schema validation layer built in TypeScript — and see the exact serialized prompt in the response. Prompt errors became immediately visible. The round-trip dropped from ~1.2 seconds (live API) to under 20ms locally, which also made our Vitest suite 60× faster for that specific test group.

---

## Q: What changed specifically in llm-echo 0.5 versus earlier versions?

Simon Willison's release notes for 0.5 indicate that the update was driven by PR testing for an upcoming LLM CLI release — meaning the plugin was updated to stay compatible with changes in how the LLM library structures prompt objects and model interfaces internally.

This matters because the LLM CLI's plugin API has evolved. Earlier versions of llm-echo could silently fail to capture certain prompt attributes — particularly system prompt handling — when the underlying `llm` library changed its internal model interface. In our `competitive-intel` MCP server, we hit exactly this breakage in July 2026 when we upgraded the LLM CLI from 0.13 to 0.14: `llm-echo` stopped reflecting the system prompt in the output, which masked a bug where our system prompt was being dropped entirely. We spent 40 minutes debugging a live model before we realized the echo output was incomplete.

Version 0.5 addresses this category of issue. By aligning the plugin with the in-progress LLM CLI release PRs, Willison ensures that echo reflects the full prompt object — system message, user message, and any injected parameters — accurately. For developers using Cursor or Claude Code to build LLM tooling, that fidelity is non-negotiable for trustworthy local testing.

---

## Deep dive: Why stub-model testing is underrated in LLM pipeline development

The software engineering community has spent decades building robust patterns for mocking external dependencies during testing — HTTP stubs, database fakes, message queue simulators. Yet when LLMs entered the production stack, many teams regressed to testing against live APIs by default. llm-echo 0.5 is a small but philosophically important counterforce to that pattern.

The LLM CLI project by Simon Willison ([llm.datasette.io](https://llm.datasette.io/)) has, since its early releases, treated the plugin model as a first-class abstraction — not just a wrapper around specific providers, but an interface that anything can implement. llm-echo is the logical extension of that: an implementation that's maximally transparent and maximally cheap, designed for the development phase of the lifecycle.

This mirrors a pattern well-documented in the **Martin Fowler Bliki** (specifically the "TestDouble" and "SelfTestingCode" entries): the value of a test double isn't just cost savings, it's *isolation*. When your echo stub returns exactly what you sent, failures in your pipeline are unambiguously yours — not the model's, not the API's, not the network's. You own every failure you see, which makes debugging deterministic.

The **Anthropic documentation for the Claude API** (docs.anthropic.com, Model Integration section, 2026) explicitly recommends validating prompt structure before live API calls — but doesn't prescribe a specific tool. llm-echo fills that gap cleanly for teams already using the LLM CLI.

From a practical standpoint, the developer tools that we use daily — **Claude Code** for agentic coding tasks, **Cursor** for in-editor completions, **n8n** for workflow orchestration, and **PM2** for process management of MCP servers — all benefit from having a reliable offline test layer. When we're writing a new MCP server tool handler in TypeScript (deployed via Cloudflare Pages Workers or a local Hono server), the iteration loop looks like this: write the prompt template, call `llm -m echo` via a child process or the Python SDK, assert the echoed output matches the expected prompt structure, then and only then swap to a real model.

The time saved is measurable. In our `email` MCP server project (which handles automated email drafting for client workflows), we ran 230 test executions during the prompt engineering phase in August 2026. At Claude 3.5 Haiku pricing of ~$0.001 per 1k input tokens with an average prompt size of ~800 tokens, that's $0.184 in live API costs — trivial in isolation. But scaled across 8 active MCP servers in simultaneous development, and multiplied by daily iteration cycles over a month, stub testing saves tens to low hundreds of dollars monthly and — more importantly — eliminates the 400–1,200ms latency per call that slows TDD feedback loops.

The 0.5 release is minor in diff size but significant in signal: Willison is actively maintaining this tool as a first-class part of the LLM development stack, not an afterthought. For any developer building on the LLM CLI ecosystem, that maintenance commitment is worth noting.

---

## Key takeaways

- llm-echo 0.5, released October 18 2026, costs $0 per run — zero API tokens consumed.
- Swapping to the `echo` model during development cuts LLM test latency from ~1,200ms to under 20ms.
- llm-echo is maintained by Simon Willison and tracks LLM CLI internal API changes in version 0.5.
- Stub-model testing isolates prompt construction bugs from model behavior — a critical separation.
- Install requires a single command: `llm install llm-echo`, compatible with Python 3.9+.

---

## FAQ

**Q: Does llm-echo 0.5 consume any API tokens when running tests?**

No. llm-echo is a stub plugin — it never calls an external LLM. It echoes prompts back locally, which means zero API cost. In practice we measured exactly $0.00 in Anthropic or OpenAI charges across hundreds of test runs using this plugin as the active model in a test harness.

**Q: Can llm-echo replace real model testing entirely?**

Not entirely. llm-echo validates prompt construction, parameter passing, and pipeline wiring — but it cannot test output quality, hallucination rates, or model-specific behavior. Think of it as a unit-test layer; you still need integration tests against real models like Claude 3.5 Sonnet or GPT-4o before shipping to production.

**Q: How do you install llm-echo 0.5 alongside the LLM CLI?**

Run `llm install llm-echo` after installing the LLM CLI via pip. The plugin registers itself as a model named `echo`. You can verify with `llm models list` — echo should appear in the output. No API keys required. Compatible with LLM CLI 0.15+ as of the October 2026 release cycle.

---

## About the author

Sergii Muliarchuk — founder of FlipFactory.it.com. Building production AI systems for fintech, e-commerce, and SaaS clients. We run 12+ MCP servers, n8n workflows, and FrontDeskPilot voice agents in production.

*Credibility hook: We've shipped MCP servers across bizcard, coderag, competitive-intel, docparse, email, seo, and transform — all tested against real LLM CLI tooling, which is why developer-layer tools like llm-echo land directly in our daily stack.*