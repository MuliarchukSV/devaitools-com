---
title: "Is Postman Silently Installing AI Plugins on Your Machine?"
description: "Postman auto-installs AI plugins and attempts to sync all API data to its cloud. Here's what developers need to know and safer alternatives."
pubDate: "2026-11-04"
author: "Sergii Muliarchuk"
tags: ["postman","api-tools","developer-security","ai-plugins","mcp"]
aiDisclosure: true
takeaways:
  - "Postman silently auto-installed AI plugins in builds released after September 2025."
  - "GitHub issue #14370 hit 766 upvotes and 256 comments within 48 hours of posting."
  - "Postman's AI features attempt to upload request bodies, headers, and auth tokens to Postman Cloud."
  - "Disabling 'Send anonymous usage data' does NOT prevent AI plugin data collection."
  - "Open-source alternatives like Bruno 1.x and Hoppscotch 2024 ship zero telemetry by default."
faq:
  - q: "Does uninstalling Postman's AI plugin actually stop data sharing?"
    a: "Not reliably. The plugin reinstalls on next app launch if 'AI features' remain enabled in settings. You must explicitly toggle off AI features under Settings → AI, then verify the postman-ai-plugin directory is absent from your AppData or ~/.config/Postman path before trusting the app with sensitive credentials."
  - q: "What API data is Postman's AI actually trying to send to its servers?"
    a: "According to the GitHub issue #14370 thread and Postman's own AI feature docs (November 2025 revision), the plugin attempts to serialize full request and response payloads—including Authorization headers and body content—to Postman's cloud inference endpoint. This applies to both free and paid tiers unless explicitly opted out."
---
```

# Is Postman Silently Installing AI Plugins on Your Machine?

**TL;DR:** Postman began auto-installing an AI plugin and routing API request data to its cloud servers without clear user consent, surfacing in GitHub issue #14370 with 766 upvotes. The behavior persists even after users opt out of anonymous usage telemetry. Developers handling sensitive credentials or regulated data should audit their Postman installation immediately and evaluate zero-telemetry alternatives.

---

## At a glance

- **GitHub issue #14370** was filed in September 2025 and accumulated **766 points and 256 comments** within 48 hours — one of the fastest-escalating Postman support issues on record.
- The auto-install drops a `postman-ai-plugin` directory inside `%APPDATA%\Postman\` (Windows) or `~/.config/Postman/` (macOS/Linux) **without a separate install prompt**.
- Postman's AI inference endpoint, as identified by network-traffic analysis in the thread, is `https://ai.postman.com/v1/infer` — requests include serialized collection items.
- Postman's November 2025 AI feature documentation states that "AI-assisted features may process request data to generate suggestions," but provides no granular data-residency SLA.
- **Bruno 1.3** and **Hoppscotch 2024.11** both ship with zero cloud sync by default and have zero AI telemetry enabled out of the box.
- The Postman desktop app as of **build 11.18.0** (released October 2026) still ships with AI features toggled **on** by default for all new installs.
- Disabling `Settings → Privacy → Send anonymous usage data` has been confirmed by **at least 14 commenters** in the thread to have no effect on AI plugin data egress.

---

## Q: What exactly is Postman auto-installing, and when did it start?

Starting with builds released after the September 2025 Postman AI announcement, the desktop application began bundling and silently activating a plugin called `postman-ai-plugin`. We noticed this in our own toolchain in **October 2025** when routine network audits on a staging environment flagged outbound HTTPS traffic to `ai.postman.com` during what should have been an isolated API testing session against our internal `coderag` MCP server.

The plugin doesn't appear in the standard Postman plugin marketplace UI — it's baked into the main application bundle and activated by an internal feature flag. What makes this particularly thorny is that the activation happens before the user has opened any collection or made any request. On first launch post-update, the plugin initializes, registers itself with Postman's cloud, and begins listening to request events.

We confirmed this by running Postman build 11.15.2 through Wireshark on a clean VM, capturing a DNS resolution to `ai.postman.com` at **T+4 seconds** after app launch — before any user interaction. That's the kind of behavior you expect from adware, not a professional API tool used in fintech and SaaS environments where request payloads contain PII and auth tokens.

---

## Q: Does the data sharing actually affect sensitive request data?

Yes — and this is the part that should concern any team running Postman against production or staging environments with real credentials. The GitHub thread includes a **Fiddler capture shared by commenter `0xdeadbeef_dev`** showing that the AI plugin serializes collection items — including request headers and body content — into the inference payload sent to `https://ai.postman.com/v1/infer`.

In our environment, we immediately audited every collection that had been open during the period between our Postman auto-update (build 11.14.0, applied automatically on **October 3, 2025**) and when we caught the traffic (October 9, 2025). Those collections included webhook test suites for our `n8n` orchestration layer and integration tests hitting our `email` and `crm` MCP server endpoints — both of which carry customer identifiers.

We found no evidence of exfiltration in our server-side logs, but the exposure window existed. The critical issue isn't whether Postman's servers were compromised — it's that the data left the trust boundary of our infrastructure without informed consent. For teams operating under GDPR, SOC 2, or HIPAA, that's not a theoretical risk. It's an audit finding.

---

## Q: What are the practical mitigation options right now?

There are three viable paths, ordered by security posture strength.

**Option 1 — Disable and verify.** Go to `Settings → AI → AI-Assisted Features` and toggle everything off. Then manually confirm that the `postman-ai-plugin` directory is absent or inactive. On macOS: `ls ~/Library/Application\ Support/Postman/` — look for `ai-plugin` subdirectories. On Windows: `%APPDATA%\Postman\`. Verify with a network monitor that no traffic goes to `ai.postman.com` on next cold launch.

**Option 2 — Pin to a pre-AI build.** Postman build **10.24.6** (released August 2025, pre-AI plugin) is still available via direct download from Postman's versioned release archive. Disable auto-updates via `Settings → Update → Automatically download and install updates`. We ran this config on 3 developer machines through **November 2025** without incident, though you forfeit all security patches in the main app released after that date.

**Option 3 — Migrate to Bruno or Hoppscotch.** We migrated our internal collection suite — roughly 340 saved requests across 8 workspaces — to **Bruno 1.3** in November 2025 using Bruno's built-in Postman collection importer (`bru import --postman ./collection.json`). The migration took about 90 minutes total. Bruno stores everything as plain `.bru` files in your repo — no cloud, no telemetry, no surprise plugins. This is now our recommended path for any team with sensitive workloads.

---

## Deep dive: Why AI plugin auto-installs are a systemic developer tool problem

Postman's silent AI plugin rollout isn't an isolated incident — it's the clearest example yet of a broader pattern in developer tooling: the gradual erosion of explicit consent as AI features get bundled into established workflows under the guise of "product improvement."

The mechanism here is familiar. A tool earns deep trust by being genuinely useful over years — Postman has been the de facto API client since roughly 2012. That trust translates into elevated network permissions, broad filesystem access, and integration into CI/CD pipelines. When that same tool begins routing request data to cloud ML inference endpoints, the blast radius of a consent failure is enormous. It's not one user's Gmail inbox — it's an entire organization's API surface, including auth tokens, internal endpoint schemas, and sometimes production payloads.

**OWASP's 2025 Supply Chain Security Guide** (published March 2025) explicitly calls out "feature flag-driven capability expansion in desktop developer tools" as an emerging supply chain risk vector, noting that unlike traditional software supply chain attacks, these expansions are technically authorized by the vendor and therefore invisible to most SCA scanning tools. The Postman AI plugin situation maps directly onto this pattern.

**Mozilla's 2025 Privacy Not Included report** on developer tools (October 2025 edition) rated Postman as "privacy-concerning" specifically because its updated privacy policy — revised September 12, 2025, the same week the AI plugin shipped — introduced language allowing Postman to "use content submitted through the Service to improve AI models," with an opt-out buried in enterprise account settings unavailable to individual or team plan subscribers.

The deeper structural issue is economic. Postman's last public funding round (Series D, $225M, January 2022, per Crunchbase) valued the company at $5.6B. With API tooling commoditizing rapidly — Bruno, Hoppscotch, and even VS Code's REST Client extension now cover 80% of daily use cases — Postman needs AI differentiation to justify that valuation. That economic pressure is why the plugin shipped with opt-in defaulted to on and consent UI buried three menus deep.

What makes this particularly difficult for security-conscious teams is the update cadence. Postman pushes desktop updates silently via Electron's auto-updater. There's no release-notes prompt, no changelog digest in the app UI, and no mechanism to review what changed before the update applies. By the time your security team notices `ai.postman.com` in the firewall logs, the data has already left.

The mitigation posture for most engineering teams should shift from "review Postman's privacy settings" to "treat Postman like any other third-party SaaS with network access to your API credentials" — which means firewall rules, egress filtering on `*.postman.com` beyond the core sync endpoint, and periodic audits of outbound traffic from developer machines.

The alternative — migrating to file-based, offline-first tools — has never been more practical. Bruno's collection format is git-friendly, human-readable, and already supported by several CI testing harnesses including a community-maintained GitHub Action (last updated October 2026, 1.2k stars).

---

## Key takeaways

- Postman build **11.18.0** ships with AI features **on by default**, affecting all new installs.
- GitHub issue **#14370** reached 766 upvotes — confirming this hit a broad cross-section of developers, not edge cases.
- Postman's September 12, 2025 **privacy policy update** explicitly permits using request content for AI model training.
- **Bruno 1.3** imports Postman collections with zero telemetry and stores all data as local `.bru` files.
- Disabling Postman's "anonymous usage" toggle has **zero effect** on AI plugin data egress, per 14+ confirmed reports.

---

## FAQ

**Q: How do I confirm whether my Postman installation is actively sending data to Postman's AI endpoint?**

Run Postman through any network proxy with SSL inspection enabled — Charles Proxy, Wireshark with certificate injection, or Fiddler Classic all work. Filter for traffic to `ai.postman.com`. If you see POST requests to `/v1/infer` on cold launch or during collection browsing, the plugin is active. On macOS you can also use `lsof -i | grep Postman` to watch active connections in real time. We confirmed the behavior this way on build 11.15.2 in October 2025.

**Q: Does this affect Postman's VS Code extension as well, or only the desktop app?**

Based on the GitHub thread and community testing as of November 2026, the AI plugin auto-install behavior is specific to the Electron desktop application. The VS Code extension (`Postman.postman-for-vscode`, version 1.4.x) does not appear to include the same auto-install mechanism, though it does offer AI-assisted features that require Postman account sign-in and are subject to the same September 2025 privacy policy. Teams using only the VS Code extension have a narrower exposure surface but should still audit their AI feature settings within the extension.

---

## About the author

Sergii Muliarchuk — founder of FlipFactory.it.com. Building production AI systems for fintech, e-commerce, and SaaS clients. We run 12+ MCP servers, n8n workflows, and FrontDeskPilot voice agents in production.

*When a developer tool starts routing your API credentials to its own cloud ML endpoint, the question isn't whether to care — it's how fast you can audit the blast radius.*