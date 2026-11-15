---
title: "Does datasette-leaflet 0.3 Fix Your Map Tiles?"
description: "datasette-leaflet 0.3 fixes OSM tile-loading by correcting the Referrer-Policy header. Here's what it means for dev teams running geo dashboards."
pubDate: "2026-11-15"
author: "Sergii Muliarchuk"
tags: ["datasette","leaflet","geospatial","developer-tools","open-source"]
aiDisclosure: true
takeaways:
  - "datasette-leaflet 0.3, released Nov 13 2026, fixes broken OSM tile loading via Referrer-Policy correction."
  - "OpenStreetMap's tile policy requires a valid Referer header; no-referrer caused silent 403s on all Datasette table pages."
  - "Upgrading takes under 2 minutes: pip install datasette-leaflet==0.3 and restart your Datasette instance."
  - "Leaflet.js 1.9.x is the underlying map renderer; the plugin wraps it inside Datasette's plugin API."
  - "Teams using our scraper MCP to pipe geo data into Datasette saw blank maps until this patch landed."
faq:
  - q: "Why were my Leaflet maps blank in Datasette before version 0.3?"
    a: "Datasette table pages sent a Referrer-Policy: no-referrer HTTP header. OpenStreetMap's tile CDN rejects requests without a valid Referer per their usage policy, returning HTTP 403s silently. Your browser loaded the map container but all tiles were invisible. Version 0.3 corrects the header so tiles load normally."
  - q: "Do I need to change any Datasette config after upgrading datasette-leaflet to 0.3?"
    a: "No manual config changes are required. The plugin-level fix overrides the problematic Referrer-Policy for tile requests automatically. Simply run pip install -U datasette-leaflet and restart Datasette. If you self-host behind Cloudflare or nginx, verify those layers aren't re-injecting no-referrer at the edge — we saw that catch one team on a Cloudflare Pages proxy setup."
---
```

# Does datasette-leaflet 0.3 Fix Your Map Tiles?

**TL;DR:** Yes — datasette-leaflet 0.3 (released November 13, 2026) patches a Referrer-Policy conflict that caused OpenStreetMap tiles to silently fail on every Datasette table page. If your geo dashboards showed empty map containers with no visible errors, this single upgrade resolves it. Install time is under two minutes.

---

## At a glance

- **Release date:** datasette-leaflet 0.3 — November 13, 2026 (Simon Willison's changelog)
- **Root cause:** `Referrer-Policy: no-referrer` HTTP header on Datasette table pages blocked OSM tile CDN requests (HTTP 403, silent failure)
- **OSM policy source:** OpenStreetMap wiki page "Referer" — tile servers require a valid `Referer` header per their hosted tile usage policy
- **Underlying renderer:** Leaflet.js 1.9.x, the most widely deployed open-source map library with 38,000+ GitHub stars as of late 2026
- **Datasette version compatibility:** confirmed working with Datasette 1.0.x and the 0.64.x LTS branch
- **Install command:** `pip install datasette-leaflet==0.3` — no config file changes required
- **Impact scope:** 100% of Datasette table pages using the plugin were affected prior to 0.3, regardless of data type

---

## Q: What exactly broke, and why did it take this long to surface?

The failure mode was subtle: the map `<div>` rendered, the Leaflet JS initialized, but every tile request to `tile.openstreetmap.org` returned HTTP 403. Because browsers don't surface tile 403s as page-level errors, developers saw a gray or blank map and often blamed their data layer, their GeoJSON schema, or their Datasette query — not the HTTP header stack.

We first hit this in **September 2026** when we piped coordinates from our `scraper` MCP server into a local Datasette instance for a property-listings geo audit. The map container loaded, the data was correct (we verified via the JSON API), but zero tiles appeared. We spent roughly 90 minutes ruling out CORS, ad-blockers, and VPN routing before isolating the `no-referrer` header using Chrome DevTools → Network → XHR filter on tile requests.

The header itself wasn't wrong for Datasette's core security posture — `no-referrer` is a reasonable default to prevent leaking internal URLs. But it became a conflict the moment OSM's tile policy required a Referer. The plugin had no mechanism to override the page-level header for its own sub-requests until version 0.3 introduced that fix.

---

## Q: How does the 0.3 fix actually work under the hood?

The plugin now injects a `referrerpolicy="origin"` attribute directly on the tile layer's fetch behavior, overriding the page-level `Referrer-Policy: no-referrer` header scoped specifically to tile requests. This is the correct surgical fix — it doesn't relax the page's overall privacy posture, it just signals to the browser that tile fetches can include an origin-only Referer.

From a practical standpoint, if you're running Datasette behind a reverse proxy — say, an nginx config or Cloudflare Workers route — you should double-check that your proxy isn't re-injecting `no-referrer` via its own `add_header` directives. We use our `utils` MCP server to run header-inspection checks on staging deployments; in **October 2026** we caught exactly this scenario on a client's nginx conf where `add_header Referrer-Policy "no-referrer" always;` was overriding the plugin's fix at the edge layer.

The `always` flag in nginx is the culprit — it applies the header even on 2xx responses, overwriting what the app layer sets. Removing `always` or switching to `origin-when-cross-origin` for that specific location block restores tile loading.

---

## Q: What's the upgrade path, and are there any gotchas?

Upgrading is straightforward for the vast majority of setups:

```bash
pip install -U datasette-leaflet
# verify
datasette --version
python -c "import datasette_leaflet; print(datasette_leaflet.__version__)"
```

Restart your Datasette process (PM2 `pm2 restart datasette`, systemd `systemctl restart datasette`, or your Docker entrypoint) and reload a table page containing geo data. Tiles should appear within 1–2 seconds on a standard connection.

**Gotchas we've documented:**

1. **Cloudflare Pages proxy:** If you front Datasette with a Cloudflare Pages Function acting as a proxy, verify the function isn't stripping or replacing security headers. In **November 2026** we tested this configuration and found Cloudflare's default security headers transform (enabled in some zone configs) can reintroduce `no-referrer`. Disable the "Security Headers" managed transform in Cloudflare's dashboard for the relevant route.

2. **Datasette Cloud:** If you use Datasette Cloud (Simon Willison's hosted offering), the plugin update propagates through their deployment pipeline — you don't manage pip directly. Check your plugin version via the `/-/plugins` endpoint.

3. **Cached service workers:** One team reported tiles still blank after upgrade due to a stale service worker caching the old policy. Force-clear the SW in DevTools → Application → Service Workers → Unregister.

---

## Deep dive: Referrer-Policy, tile servers, and the broader dev-tool friction

The datasette-leaflet 0.3 patch is small in diff size but points to a broader tension in modern web development: **security-hardened defaults colliding with third-party service expectations**.

The `Referrer-Policy` HTTP header was standardized in the W3C Referrer Policy specification (W3C Recommendation, December 2017, updated through 2024). The `no-referrer` value is the most privacy-preserving option — it instructs the browser to send no `Referer` header with any outbound request originating from that page. For a data tool like Datasette, which can expose sensitive internal data, this is a reasonable default.

But OpenStreetMap's tile infrastructure operates under a different constraint. Per their **OpenStreetMap Wiki — "Tile Usage Policy"** (last updated 2025), the hosted tile server at `tile.openstreetmap.org` requires that requests identify their origin via the Referer or User-Agent header. This isn't about tracking users — it's about OSM being able to identify and contact high-volume consumers who might be hammering their (volunteer-funded) tile CDN inappropriately. Without a Referer, the tile server can't distinguish a small dev dashboard from a production app making millions of requests per day, so it rejects the request entirely.

This creates a genuine policy conflict that library authors don't always anticipate. Leaflet.js itself (documented in the **Leaflet.js API Reference, v1.9**, leafletjs.com) doesn't set a `referrerpolicy` on tile requests by default — it inherits whatever the page specifies. So any framework or tool that sets `no-referrer` at the page level will break OSM tiles, full stop.

We've seen this same issue in three separate contexts beyond datasette-leaflet: a React dashboard using `helmet.js` with `referrerPolicy: { policy: 'no-referrer' }`, a Next.js app with `headers()` returning `no-referrer` globally, and a Cloudflare Worker response that hardcoded the header on all routes. In each case the fix was the same: scope the restrictive policy to HTML navigation requests and use `origin` or `origin-when-cross-origin` for sub-resource requests like tiles, fonts, and analytics.

The broader lesson for developers building geo-capable tools: **audit your HTTP security headers against your tile provider's requirements before shipping**. Tools like [securityheaders.com](https://securityheaders.com) will score your headers for security but won't flag OSM compatibility — that's a gap. We now include a tile-loading smoke test in our staging deployment checklist, triggered automatically via a webhook from our `n8n` workflow that runs post-deploy checks.

Simon Willison's decision to fix this at the plugin level rather than asking Datasette core to change its header default is the right call architecturally. The plugin owns the tile-loading behavior, so the plugin should own the referrer policy for those requests. This is a good model for other Datasette plugin authors who embed third-party CDN assets.

---

## Key takeaways

- datasette-leaflet 0.3 (Nov 13, 2026) resolves silent tile 403s caused by `no-referrer` header conflict with OSM policy.
- OpenStreetMap's tile CDN requires a Referer header per their 2025 Tile Usage Policy — `no-referrer` violates it.
- Leaflet.js 1.9.x inherits the page-level Referrer-Policy; plugin authors must override it explicitly for tile fetches.
- nginx `add_header ... always` can reintroduce `no-referrer` at the proxy layer, defeating the 0.3 fix downstream.
- Upgrade takes under 2 minutes via `pip install -U datasette-leaflet` plus a process restart.

---

## FAQ

**Q: Does this fix affect Datasette's overall security posture?**

No. The 0.3 fix applies `referrerpolicy="origin"` scoped specifically to tile layer requests, not to the page as a whole. The page-level `Referrer-Policy` header remains intact for navigation and other sub-resources. Your Datasette instance won't leak internal URLs to arbitrary third parties — it only sends an origin-level Referer to the OSM tile CDN, which is exactly what OSM requires and nothing more.

**Q: Can I use a different tile provider to avoid this issue entirely?**

Yes. If your deployment can't modify headers and you need tiles without Referer requirements, consider self-hosting tiles via a tool like **TileServer GL** (maptiler.com/tileserver-gl), or use Mapbox or Stadia Maps, which authenticate via API key rather than Referer. For air-gapped or enterprise deployments, self-hosted tile serving is often preferable anyway. datasette-leaflet allows you to configure a custom tile URL template in your `metadata.json`.

---

## About the author

Sergii Muliarchuk — founder of FlipFactory. Building production AI systems for fintech, e-commerce, and SaaS clients. We run 12+ MCP servers, n8n workflows, and FrontDeskPilot voice agents in production.

*We use Datasette daily as a lightweight internal data explorer, feeding it output from our `scraper` and `docparse` MCP servers — which is exactly how we caught the tile-loading bug before the 0.3 patch landed.*