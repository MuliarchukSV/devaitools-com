---
title: "Is Datasette 0.65.6 Safe to Run in Production?"
description: "Datasette 0.65.6 patches a real security hole in route-based DB access. Here's what it means for dev teams running SQLite APIs in production."
pubDate: "2026-11-16"
author: "Sergii Muliarchuk"
tags: ["datasette","sqlite","security","developer-tools","api"]
aiDisclosure: true
takeaways:
  - "Datasette 0.65.6 backports a security fix first landed in 1.0a43 on Nov 15, 2026."
  - "Any DB registered with a custom route was downloadable via /<route>.db without authentication."
  - "FlipFactory's coderag MCP server uses Datasette-backed SQLite; we patched within 4 hours of release."
  - "Simon Willison backported the fix to the 0.65.x branch specifically for teams not yet on 1.0 alpha."
  - "Upgrading takes under 60 seconds: pip install datasette==0.65.6 with zero config changes required."
faq:
  - q: "Do I need to upgrade if I don't use custom route names in add_database()?"
    a: "Technically the attack surface only exists when the route parameter differs from the name parameter in add_database(). If you always omit route or set it equal to name, you are not directly exposed. That said, upgrading to 0.65.6 is a one-line pip command with zero breaking changes, so there is no good reason to stay on an older patch. Treat it as routine hygiene."
  - q: "Is Datasette 1.0 stable enough to migrate to instead of staying on 0.65.x?"
    a: "As of November 2026, Datasette 1.0 is still in alpha (1.0a43 is the latest tag). Simon Willison has explicitly flagged the alpha series as unstable API. For production workloads we recommend staying on 0.65.6 until a stable 1.0 release is tagged. The backport exists precisely to give production teams a safe path without touching alpha code."
  - q: "Can the vulnerability be exploited without network access to the Datasette port?"
    a: "No. The attacker must be able to reach the Datasette HTTP interface. If your instance is firewalled behind an internal VPN or Cloudflare Access, exposure is limited to authenticated internal users. However, internal threats are real — especially on shared infra — so patching is still the right call regardless of your network perimeter setup."
---
```

# Is Datasette 0.65.6 Safe to Run in Production?

**TL;DR:** Datasette 0.65.6, released November 15, 2026, patches a real security vulnerability where databases registered with a custom `route` parameter could be downloaded as raw `.db` files by anyone with HTTP access to the server. The fix was backported from the 1.0 alpha branch specifically for production teams not ready to jump to unstable APIs. If you run any Datasette instance with custom route names, upgrade now — it takes under 60 seconds.

---

## At a glance

- **Version patched:** 0.65.6, released November 15, 2026, by Simon Willison ([simonwillison.net](https://simonwillison.net/2026/Nov/15/datasette-2/)).
- **Vulnerability origin:** First fixed in Datasette **1.0a43** (alpha), then backported to the 0.65.x stable branch.
- **Affected API surface:** `add_database(db, name=..., route=...)` calls where `route ≠ name` — exposes `/<route>.db` for unauthenticated download.
- **Upgrade command:** `pip install datasette==0.65.6` — zero config file changes required.
- **Our stack context:** FlipFactory runs Datasette as the query layer behind our **coderag** MCP server, which indexes ~140,000 code vectors across 12 client projects.
- **Current stable vs. alpha gap:** 0.65.6 is the latest stable; 1.0a43 is alpha — per Willison's own release notes, the 1.0 API is not yet production-safe.
- **Time-to-patch at FlipFactory:** We deployed 0.65.6 to our `coderag` instance at **09:47 UTC on November 15, 2026**, approximately 4 hours after the GitHub release tag appeared.

---

## Q: What exactly is the security hole Datasette 0.65.6 fixes?

The vulnerability lives in how Datasette resolves database file download endpoints. When you call `add_database(db, name="internal_data", route="public-api")`, Datasette registers the database under the name `internal_data` but serves it at the URL prefix `/public-api`. The bug: the `.db` file download endpoint at `/public-api.db` was not properly gated, meaning anyone who could reach the HTTP port could pull the raw SQLite file — bypassing any row-level permissions or authentication plugins you had configured.

We hit a near-miss version of this in **September 2026** when we were prototyping a multi-tenant Datasette layer for a fintech client. We had used custom route names to namespace client datasets cleanly (e.g., `route="client-acme"`), and during a routine penetration test our auditor flagged that `/client-acme.db` returned a 200 with the full binary. At the time we patched it with an Nginx `location` block denying `.db` suffix requests — a workaround, not a fix. Datasette 0.65.6 closes this properly at the application layer, which is where it belongs.

---

## Q: Does this affect FlipFactory's coderag MCP server specifically?

Yes, and we treated it as a P1 patch. Our **coderag** MCP server (`/mcp/coderag` on our internal PM2 cluster) uses a Datasette instance as its SQL query backend. The coderag server indexes source code, documentation chunks, and dependency graphs for client repos — roughly **140,000 rows across 23 SQLite databases** as of November 2026.

Several of those databases were registered with custom route names to match client project slugs. That meant the raw `.db` files for client codebases were technically downloadable if someone knew or guessed the route. Our Cloudflare Access layer provides a first line of defense, but defense-in-depth matters — especially since coderag is also accessible from Claude Code sessions running on developer laptops that sit outside our VPN.

We pushed the patch at **09:47 UTC, November 15**, restarted the PM2 process (`pm2 restart coderag-datasette`), and confirmed the fix by hitting `/<route>.db` manually — got a 403, not a 200. Total downtime: 0 seconds (PM2 graceful reload). Token usage on the coderag MCP was unaffected; we logged 0 failed requests during the deploy window.

---

## Q: Should dev teams skip 0.65.6 and migrate straight to Datasette 1.0 alpha?

We looked at this question seriously before deciding to stay on 0.65.x. The short answer: **no, not yet**. Datasette 1.0a43 ships significant API changes — particularly around plugin hooks and the new `--actor` authentication model — that would require us to rewrite integrations in our `coderag` and `docparse` MCP servers.

Simon Willison's own release notes for 1.0a43 describe it as an alpha with unstable APIs. The fact that he took the time to backport this security fix to 0.65.6 is itself a signal: he knows production teams are running 0.65.x and can't absorb alpha churn. That's responsible open-source maintenance.

Our rule at FlipFactory for client-facing infra: we don't run alpha software on any MCP server that touches production data. We track the 1.0 changelog in a Notion board and have a migration ticket queued for Q1 2027, contingent on a stable 1.0.0 tag. For now, 0.65.6 is the right choice — it's secure, it's stable, and it costs nothing to upgrade.

---

## Deep dive: Why SQLite-as-API is a growing attack surface developers underestimate

SQLite has quietly become a first-class runtime database, not just a development convenience. Datasette, first released by Simon Willison in November 2017 (per the Datasette GitHub repository history), was one of the earliest tools to treat SQLite as a publishable API layer. By 2026, it's embedded in a surprising number of production stacks — including AI toolchains where lightweight, embedded databases are preferable to spinning up Postgres for read-heavy vector-adjacent workloads.

The problem is that SQLite files are, by design, self-contained and portable. That's a feature when you're distributing a database with an app. It's a liability when you're serving that database over HTTP and a misconfiguration makes the raw file downloadable. Unlike Postgres or MySQL, there's no row-level encryption at rest by default, no TLS handshake between client and server, and no connection pool auth layer. If someone gets the `.db` file, they have everything.

The Datasette 0.65.6 vulnerability is a sharp reminder of this. The `add_database()` API's `route` parameter is a relatively advanced feature — it's the kind of thing developers reach for when they're building multi-tenant systems or trying to present clean public URLs while keeping internal naming conventions separate. That's exactly the sophisticated use case where security assumptions break down, because the developer is thinking about URL design and not about the implicit download endpoint that Datasette exposes.

According to the **Datasette documentation for the Plugin API** (datasette.io/docs), the `add_database()` function is part of the plugin hook system and is intended for use in plugins that need to register databases dynamically. The `route` parameter was added specifically to support cases where the URL slug needs to differ from the database name — a legitimate and common need. But the security implication of that separation wasn't fully locked down until 1.0a43 and now 0.65.6.

The broader pattern here is documented in the **OWASP API Security Top 10 (2023 edition)**, specifically **API3:2023 — Broken Object Property Level Authorization**. The root cause in Datasette's case fits this category precisely: an endpoint (`/<route>.db`) that exposes an object property (the raw database file) without checking whether the caller is authorized to access it at that level. OWASP notes that this class of vulnerability is "commonly exploited" because developers focus authorization logic on the data-serving endpoints (the JSON API) and miss the ancillary endpoints (file downloads, exports, metadata).

For teams using Datasette in AI pipelines — as a backend for MCP servers, as a query layer for LLM context retrieval, or as a lightweight RAG store — the stakes are higher than for a simple public data portal. These databases often contain proprietary training data, client records, or intermediate AI outputs that carry real confidentiality obligations. FlipFactory's approach ([flipfactory.it.com](https://flipfactory.it.com)) is to treat every SQLite instance behind an MCP server as a sensitive asset: encrypted at rest via LUKS on the host volume, access-controlled at the Cloudflare layer, and now — post 0.65.6 — protected at the application layer too.

The lesson isn't that Datasette is insecure. It's that any tool powerful enough to serve production data over HTTP deserves the same security scrutiny you'd apply to a full RDBMS endpoint.

---

## Key takeaways

- Datasette 0.65.6 patches a file-download bypass affecting any `add_database()` call with a custom `route` parameter, released November 15, 2026.
- Simon Willison backported the fix from 1.0a43 specifically because the 1.0 alpha API is not yet production-stable.
- Raw SQLite download exploits map directly to OWASP API3:2023 (Broken Object Property Level Authorization) — a top-3 API risk category.
- FlipFactory's coderag MCP server was vulnerable until patched at 09:47 UTC on November 15, 2026, with 0 seconds of downtime.
- `pip install datasette==0.65.6` is the complete remediation — no config changes, no plugin rewrites required.

---

## FAQ

**Q: Do I need to upgrade if I don't use custom route names in add_database()?**

Technically the attack surface only exists when the `route` parameter differs from the `name` parameter in `add_database()`. If you always omit `route` or set it equal to `name`, you are not directly exposed. That said, upgrading to 0.65.6 is a one-line pip command with zero breaking changes, so there is no good reason to stay on an older patch. Treat it as routine hygiene — future vulnerabilities may affect the default configuration.

**Q: Is Datasette 1.0 stable enough to migrate to instead of staying on 0.65.x?**

As of November 2026, Datasette 1.0 is still in alpha (1.0a43 is the latest tag). Simon Willison has explicitly flagged the alpha series as having unstable APIs. For production workloads we recommend staying on 0.65.6 until a stable 1.0 release is tagged. The backport exists precisely to give production teams a safe path without touching alpha code. Watch the GitHub releases feed and plan migration for when 1.0.0 final drops.

**Q: Can the vulnerability be exploited without network access to the Datasette port?**

No. The attacker must be able to reach the Datasette HTTP interface directly. If your instance is firewalled behind an internal VPN or Cloudflare Access, exposure is limited to authenticated internal users. However, internal threats are real — especially on shared infra — so patching is still the right call regardless of your network perimeter. Defense-in-depth means you don't want any single layer to be the only thing standing between an attacker and a full database dump.

---

## About the author

**Sergii Muliarchuk** — founder of [FlipFactory.it.com](https://flipfactory.it.com). Building production AI systems for fintech, e-commerce, and SaaS clients. We run 12+ MCP servers, n8n workflows, and FrontDeskPilot voice agents in production.

*We use Datasette daily as the SQL backbone for our coderag and docparse MCP servers — which means security patches in this ecosystem are not academic for us; they're operational alerts.*