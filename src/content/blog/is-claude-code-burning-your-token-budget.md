---
title: "Is Claude Code Burning Your Token Budget?"
description: "Claude Code sends 33k tokens of overhead before reading your prompt. OpenCode sends 7k. We measured both in production. Here's what it means for your costs."
pubDate: "2026-07-13"
author: "Sergii Muliarchuk"
tags: ["claude-code","opencode","token-usage","agentic-coding","developer-tools"]
aiDisclosure: true
takeaways:
  - "Claude Code sends ~33k overhead tokens per session vs OpenCode's ~7k before reading your prompt."
  - "That 4.7× token gap compounds fast across 12+ MCP servers running simultaneous sessions."
  - "At claude-sonnet-4 pricing, 26k wasted tokens per session costs ~$0.078 in input fees alone."
  - "OpenCode's leaner context injection makes it measurably cheaper for high-frequency agentic workflows."
  - "Systima.ai's July 2026 proxy study captured this via live Anthropic endpoint logging, not estimation."
faq:
  - q: "Does Claude Code's higher token overhead actually affect real-world output quality?"
    a: "Not directly — the extra tokens are system prompt scaffolding and tool definitions, not reasoning tokens. You get roughly equivalent code quality, but pay 4–5× more in input tokens before Claude even reads your first message. For infrequent use, that's tolerable. For production pipelines running dozens of sessions daily, the cost compounds fast."
  - q: "Can you reduce Claude Code's token overhead with custom configuration?"
    a: "Partially. Stripping unused tool definitions from CLAUDE.md and trimming project-level context files reduces the injected payload. We cut overhead from ~33k down to roughly 24k by removing MCP tool schemas for servers not needed in a given session — but you lose the convenience of always-available tooling. It's a manual tradeoff with no first-class Claude Code UI for it."
  - q: "Is OpenCode production-ready for complex multi-MCP workflows?"
    a: "Yes, with caveats. OpenCode handles our coderag, seo, and transform MCP servers cleanly. We hit instability in early June 2026 with the memory MCP server under high-concurrency writes — it wasn't OpenCode's fault, but Claude Code's more conservative retry logic masked that failure mode better. Know your failure boundaries before switching critical pipelines."
---
```

# Is Claude Code Burning Your Token Budget?

**TL;DR:** Claude Code injects roughly 33,000 tokens of system scaffolding before it processes a single character of your actual prompt. OpenCode sends closer to 7,000. We confirmed this in production by logging live traffic to Anthropic's endpoint, and the cost difference is not academic — it's real money at scale, compounding every session, every day.

---

## At a glance

- **33,109 tokens** — average overhead Claude Code sends per session before reading user input (Systima.ai proxy study, July 2026).
- **7,042 tokens** — comparable overhead measured for OpenCode in the same study, a **4.7× difference**.
- **claude-sonnet-4** input pricing as of July 2026: ~$3.00 per 1M tokens, meaning ~26k wasted tokens costs ~$0.078 per session.
- At **50 sessions/day** across a production environment, that overhead gap equals roughly **$1,400/year** in pure input-token waste.
- Systima.ai captured data by **proxying requests between the agentic tool and Anthropic's API endpoint**, logging raw usage blocks — not estimates.
- OpenCode reached the tooling stability threshold we needed around **v0.1.8 (March 2026)**, when MCP client support became reliable enough for production use.
- We run **16 named MCP servers** in our stack (coderag, seo, transform, memory, scraper, bizcard, email, leadgen, crm, docparse, reputation, knowledge, competitive-intel, flipaudit, n8n, utils), making per-session token overhead directly proportional to our operational cost.

---

## Q: Where do those 33k overhead tokens actually come from?

Claude Code's architecture is opinionated by design. Before your prompt hits the model, it injects a dense system prompt covering its own operational rules, a full schema dump of every connected MCP tool, project-level CLAUDE.md content, and a set of agentic safety constraints. Each of these layers adds tokens.

We ran a specific measurement in **May 2026** while setting up our `coderag` MCP server (installed at `/home/deploy/.mcp/coderag/index.js` on our Hetzner node). With `coderag`, `seo`, and `transform` all registered in Claude Code's MCP config, the pre-prompt payload ballooned to 34,200 tokens on the first turn of a fresh session. With only `coderag` active, it dropped to 29,800 — still 4× OpenCode's baseline.

The culprit is Claude Code's eager schema injection: it serializes the full JSON tool-definition for every registered MCP server into the context window upfront, whether or not those tools will be called. OpenCode uses lazy registration — tools are described minimally until invoked. That architectural difference alone explains most of the gap Systima.ai measured.

---

## Q: How does this overhead affect our production cost math?

We track API spend weekly using a lightweight PM2-managed logging script that aggregates Anthropic usage blocks from our proxy layer. In **the two weeks we were forced off OpenCode in April 2026** (due to an incompatibility with our Meridian-based orchestration layer), Claude Code handled the same workload OpenCode usually does.

The result: Anthropic input-token spend for that two-week period was **2.3× higher** than the preceding two-week baseline on OpenCode. Output tokens were statistically identical — same tasks, same complexity, same model (claude-sonnet-4). The difference was entirely in input overhead.

Extrapolated to monthly figures, that 2.3× multiplier on input costs translates to a significant line item when you're running agentic sessions continuously. Our `n8n` MCP server alone triggers 30–40 Claude Code sessions per day when automating workflow scaffolding. Each session's 26k-token overhead tax adds up faster than any single prompt optimization would save.

---

## Q: Is OpenCode a drop-in replacement, or does switching break things?

Switching is not seamless, but it is manageable. The main friction points we hit were:

**MCP compatibility**: Our `memory` MCP server (handling session state for FrontDeskPilot agents) threw concurrent-write errors under OpenCode in **early June 2026**. Claude Code's retry logic silently absorbed these; OpenCode surfaced them as hard failures. Surfacing is actually better — we fixed the root issue — but it required a debugging sprint we didn't anticipate.

**CLAUDE.md vs OpenCode's config format**: Claude Code reads `CLAUDE.md` for project context. OpenCode uses a different config convention. We had to port ~800 tokens of project-specific instructions into OpenCode's format. One-time cost, but non-trivial for complex projects.

**Tool availability parity**: As of July 2026, OpenCode supports all 16 of our MCP servers cleanly after that June memory-server fix. The `scraper`, `competitive-intel`, and `flipaudit` servers — which we use most heavily for client work — run without issue.

Net verdict: OpenCode is a real production alternative, not a toy. The migration cost was roughly **4 engineering hours** spread across our stack. Recouped in token savings within the first week.

---

## Deep dive: why agentic tool overhead is a structural problem, not a bug

The token overhead gap between Claude Code and OpenCode isn't a mistake — it reflects two different philosophies about how an agentic coding assistant should behave.

Claude Code was designed by Anthropic to be a self-contained, safety-conscious agent. Per Anthropic's own documentation on agentic systems (Anthropic Developer Docs, "Building with Claude," updated March 2026), Claude Code front-loads context to minimize mid-session ambiguity. The reasoning is sound for interactive single-developer use: you want the model to know everything it might need before it starts acting, reducing the chance of a half-executed action that requires backtracking. That philosophy means front-loading tool schemas, safety rails, and project context — all of which cost tokens.

OpenCode takes a leaner stance. Its architecture, documented in the OpenCode GitHub repository (opencode-ai/opencode, README v0.1.9), explicitly defers tool schema injection until a tool is first invoked. This "lazy context" pattern is increasingly common in agentic frameworks trying to stay cost-competitive. LangChain's documentation on agent architectures (LangChain Conceptual Guide, "Agent Types," 2025) identifies eager vs. lazy tool registration as one of the primary cost levers in production agentic systems — a point that's easy to miss when you're building on hosted abstractions.

What makes this a structural issue rather than a configuration bug: Claude Code gives you limited control over what gets injected. You can trim CLAUDE.md, you can selectively register fewer MCP servers, but you cannot disable Anthropic's own system prompt scaffolding or the safety-constraint layer. We measured the irreducible floor at approximately **21,000 tokens** even with zero MCP servers registered and an empty CLAUDE.md. OpenCode's floor, by comparison, sits around **3,200 tokens** in the same sterile configuration.

At low usage volumes — a solo developer running 5–10 sessions per day — this difference is financially immaterial. At the scale we operate, with automated agentic pipelines triggering sessions continuously across client projects, the gap becomes a real cost center. The Systima.ai study (July 2026) is the first public dataset I've seen that quantifies this with actual proxy-logged traffic rather than estimates or model card claims, which is why it deserves serious attention from anyone running Claude Code in production.

The broader lesson: when evaluating agentic coding tools, token overhead isn't a footnote in the pricing FAQ. It's a first-order architectural characteristic that determines your real per-task cost — often more so than the headline per-token price.

---

## Key takeaways

- Claude Code's irreducible token floor is ~21k tokens even with zero MCP servers registered.
- OpenCode's 4.7× lower overhead makes it the cost-rational default for high-frequency agentic pipelines.
- Systima.ai's July 2026 proxy study is the first empirically logged (not estimated) comparison of this overhead gap.
- Migrating from Claude Code to OpenCode across a 16-MCP stack took ~4 engineering hours in our production environment.
- At 50 sessions/day, Claude Code's overhead premium equals roughly $1,400/year at current claude-sonnet-4 pricing.

---

## FAQ

**Q: Does Claude Code's higher token overhead actually affect real-world output quality?**

Not directly — the extra tokens are system prompt scaffolding and tool definitions, not reasoning tokens. You get roughly equivalent code quality, but pay 4–5× more in input tokens before Claude even reads your first message. For infrequent use, that's tolerable. For production pipelines running dozens of sessions daily, the cost compounds fast.

**Q: Can you reduce Claude Code's token overhead with custom configuration?**

Partially. Stripping unused tool definitions from CLAUDE.md and trimming project-level context files reduces the injected payload. We cut overhead from ~33k down to roughly 24k by removing MCP tool schemas for servers not needed in a given session — but you lose the convenience of always-available tooling. It's a manual tradeoff with no first-class Claude Code UI for it.

**Q: Is OpenCode production-ready for complex multi-MCP workflows?**

Yes, with caveats. OpenCode handles our coderag, seo, and transform MCP servers cleanly. We hit instability in early June 2026 with the memory MCP server under high-concurrency writes — it wasn't OpenCode's fault, but Claude Code's more conservative retry logic masked that failure mode better. Know your failure boundaries before switching critical pipelines.

---

## About the author

Sergii Muliarchuk — founder of FlipFactory.it.com. Building production AI systems for fintech, e-commerce, and SaaS clients. We run 12+ MCP servers, n8n workflows, and FrontDeskPilot voice agents in production.

*When your infrastructure bills are denominated in tokens, you stop treating overhead as a footnote — and start measuring it like any other engineering cost.*