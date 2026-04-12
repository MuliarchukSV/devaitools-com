# Action Plan — devaitools-com.pages.dev
**Generated:** 2026-04-06
**Based on:** FULL-AUDIT-REPORT.md
**Priority scale:** P0 = blocker before domain purchase | P1 = fix in week 1 | P2 = fix in month 1 | P3 = nice-to-have

---

## P0 — BLOCKERS before domain purchase (fix these FIRST)

### P0-1. Fix the empty sitemap
**Problem:** sitemap-0.xml exists but has 0 url entries (201 bytes). Google cannot discover any pages.
**Fix:** In astro.config.mjs, set `site: 'https://devaitools.com'` and verify @astrojs/sitemap integration is enabled. Run `npm run build` and check dist/sitemap-0.xml has actual URL entries.

### P0-2. Connect devaitools.com to Cloudflare Pages
**Problem:** devaitools.com is a Hostinger parked page with noindex. All canonicals, schema URLs, og:image URLs reference this parked domain.
**Fix:** Transfer or purchase domain, add Custom Domain in Cloudflare Pages, verify HTTPS provisioned.

### P0-3. Remove FAQPage schema from all article pages
**Problem:** FAQPage is restricted to gov/healthcare since Aug 2023. Generates no rich results on a dev blog, may trigger quality signal.
**Fix:** Remove the entire FAQPage JSON-LD block from the article layout template. Keep FAQ content as HTML.

### P0-4. Add og:image to homepage
**Problem:** og:image is missing on the homepage. Social shares render as blank text cards.
**Fix:** Create `/public/og/default.png` (1200x630px). Add meta tags:
  og:image, og:image:width/height, twitter:image, change twitter:card to summary_large_image.

### P0-5. Fix Plausible analytics domain — remove example.com placeholder
**Problem:** Plausible guard `if domain !== 'example.com'` prevents analytics from firing. Zero traffic data collected.
**Fix:** Replace with: `<script defer data-domain="devaitools.com" src="https://plausible.io/js/script.js"></script>`

---

## P1 — Fix in week 1 after domain launch

### P1-1. Add image field to Article schema
Article JSON-LD is missing "image" field — required for Google Article rich results.
Add: `"image": { "@type": "ImageObject", "url": "https://devaitools.com/og/{slug}.png", "width": 1200, "height": 630 }`

### P1-2. Add WebSite + SearchAction schema to homepage
No homepage schema = no sitelinks search box candidate, no knowledge panel foundation.
Add WebSite with potentialAction SearchAction pointing to /search.

### P1-3. Add Organization schema to homepage
Add with name, url, logo, sameAs (Twitter/GitHub handles when created).

### P1-4. Add BreadcrumbList schema to article pages
Enables breadcrumb display in SERP snippets.

### P1-5. Improve homepage title tag
"Home | DevAITools.com" = 25 chars, too weak. 
Change to: "DevAITools.com — AI Tools, APIs & Developer Resources" (53 chars).

### P1-6. Add _headers file for security headers
Create /public/_headers:
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Frame-Options: SAMEORIGIN
  Permissions-Policy: camera=(), microphone=(), geolocation=()
Current security header score: 45/100.

### P1-7. Submit to Google Search Console
After DNS propagates: add property, verify via DNS TXT, submit sitemap-index.xml, manually request indexing for homepage + top 5 articles.

---

## P2 — Fix within first month

### P2-1. Fix trailing slash consistency
Currently mixed. Set trailingSlash: 'always' or 'never' in astro.config.mjs.

### P2-2. Add links to llms.txt
llms.txt score 65/100 — zero links. Add 5-10 key article URLs with descriptions.

### P2-3. Fix 35 orphan topic pages
/topics/* pages have only 1 incoming link each. Add Topics section to homepage or Related Topics sidebar to articles.

### P2-4. Add article images
Zero images on all articles. Required for Article rich results and engagement. At minimum, add featured image using existing OG image.

### P2-5. Upgrade author to Person schema
Organization author weakens E-E-A-T. Use Person with url pointing to /about page.

### P2-6. Add og:locale and og:site_name
Minor completeness: `og:locale: en_US`, `og:site_name: DevAITools.com`

---

## P3 — Post-launch optimization

- Add Applebot-Extended, CCBot, Bytespider to robots.txt explicitly
- Run PageSpeed with API key: add PAGESPEED_API_KEY env var
- Run SERP visibility check 2-4 weeks post-launch (add SERPER_API_KEY)
- Expand article word counts: current ~500-750w, target 1500-2500w for competitive dev queries

---

## Domain Purchase Readiness Checklist

- [ ] P0-3: Remove FAQPage schema from all articles
- [ ] P0-4: Create og/default.png + add og:image to homepage
- [ ] P0-5: Fix Plausible domain (remove example.com placeholder)
- [ ] P0-1: Rebuild — verify sitemap has real URL entries
- [ ] P0-2: Purchase domain + configure Cloudflare Pages custom domain
- [ ] P1-5: Fix homepage title tag
- [ ] P1-6: Add _headers file (HSTS + X-Frame-Options)
- [ ] P1-7: Submit to GSC after DNS propagates

**Target score after P0+P1 fixes: 78-82 / 100**
