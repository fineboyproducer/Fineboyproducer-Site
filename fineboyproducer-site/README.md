# Fineboy Producer — Homepage

Single-file static site for fineboyproducer.com.ng. No build step — plain HTML/CSS/JS.

## Structure

```
index.html          the whole homepage
assets/portrait.jpg  hero + about portrait
CNAME                custom domain for GitHub Pages
```

## Deploy on GitHub Pages

1. Push this repo to GitHub (as the repo root, or into a `docs/` folder — either works, just match it in step 2).
2. In the repo: **Settings → Pages → Build and deployment → Source: Deploy from a branch**. Pick the branch and `/ (root)` folder.
3. Under **Settings → Pages → Custom domain**, enter `fineboyproducer.com.ng` and save — this uses the `CNAME` file already in the repo.
4. At your domain registrar, point DNS at GitHub Pages:
   - `A` records for the apex domain (`fineboyproducer.com.ng`) → GitHub's Pages IPs (185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153)
   - or a `CNAME` record for `www` → `<your-github-username>.github.io`
5. Wait for DNS to propagate, then check "Enforce HTTPS" in the Pages settings once the certificate is issued.

## Adding more images later

Drop new files into `assets/` and reference them as `assets/filename.jpg` in `index.html` — same pattern as the portrait. Keeps the HTML small and images easy to swap without touching code.

## Placeholder routes

These links exist in the nav/CTAs but don't have pages yet — build them as `/about/index.html`, `/beats/index.html`, etc. when ready, or point them elsewhere:

- `/work-with-me`
- `/about`
- `/beats`
- `/contact`
- `/privacy`, `/terms`
