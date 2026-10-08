# orcid-south-dashboard

A [SvelteKit](https://svelte.dev/docs/kit) app deployed to [Cloudflare Pages](https://developers.cloudflare.com/pages/) by GitHub Actions.

## Development

Opening the repo in GitHub Codespaces (or a VS Code dev container) installs dependencies automatically. Otherwise run `npm install` first. You need Node 22 or later.

```sh
npm run dev          # Vite dev server on http://localhost:5173
npm run check        # type-check
npm run build        # production build into .svelte-kit/cloudflare
npm run preview:cf   # build, then serve with the Cloudflare runtime on http://localhost:8788
```

## Deployment

[.github/workflows/deploy.yml](.github/workflows/deploy.yml) builds and deploys on every push to `main` (production) and every pull request (preview deployment).

One-time setup:

1. Create the Pages project:
   ```sh
   npx wrangler login
   npx wrangler pages project create orcid-south-dashboard --production-branch main
   ```
2. In the Cloudflare dashboard, create an API token with the **Account → Cloudflare Pages → Edit** permission.
3. In the GitHub repo, open **Settings → Secrets and variables → Actions** and add:
   - `CLOUDFLARE_API_TOKEN`: the token from step 2
   - `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID

Cloudflare bindings (KV, D1, environment variables, ...) go in [wrangler.toml](wrangler.toml). Declare their types on `Env` in [src/app.d.ts](src/app.d.ts), and read them in server code through `platform.env`.
