# The admin page

`/admin` edits the site's content: projects, experience, achievements, skills, socials, and the pitch and trail text. Saving commits `site/data.js` (and any uploaded image) to this repo, so Vercel redeploys within about a minute and every change stays in the git history.

## How it's protected

- **Password.** Only a slow scrypt hash of it is stored, never the password itself.
- **Authenticator code (optional).** A 6-digit code from an app on your phone, so a stolen password alone isn't enough.
- **Brute-force limits.**
  - 5 wrong tries from one address locks that address out for 15 minutes.
  - 20 wrong tries from anywhere in an hour locks sign-in for an hour.
  - A wrong email takes as long as a wrong password, so neither gives anything away.
- **Sessions.** They're random, stored on the server, and last 2 hours. The cookie is `HttpOnly`, `Secure` and `SameSite=Strict`, and signing out ends the session on the server too.
- **Change requests.** Every change must come from the site's own page as JSON, so another site can't post a form at it.
- **Content limits.** Every field is checked on the server: lengths, word counts, item counts, https-only links and YouTube ids. Unknown fields are dropped, and the content is capped at 64 KB.
- **Uploads.** Only PNG, JPG, WebP or a PDF, identified by the file's bytes rather than its name, and under 300 KB each.
- **Fails closed.** If anything below is missing on Vercel, sign-in stays off.

## Setup (once)

1. **Make the password hash** (on your machine; the password is typed hidden and never saved):
   ```
   node tools/admin-password.js --code
   ```
   It prints `ADMIN_PASSWORD_HASH` and `ADMIN_TOTP_SECRET`. Add the secret to Google Authenticator or 1Password. Leave out `--code` to skip the authenticator step.
2. **A GitHub token that can only edit this repo.**
   - Go to GitHub → Settings → Developer settings → Fine-grained tokens.
   - Set *Repository access* to only `dhruv457457/portfolio`.
   - Set *Permissions → Contents* to Read and write. Nothing else.
3. **The rate-limit store.** Go to Vercel → your project → Storage → add **Upstash Redis** (the free plan is enough). This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
4. **Environment variables** (Vercel → Settings → Environment Variables, Production):

   | Name | Value |
   |---|---|
   | `ADMIN_EMAIL` | the email you'll sign in with |
   | `ADMIN_PASSWORD_HASH` | from step 1 |
   | `ADMIN_TOTP_SECRET` | from step 1 (optional) |
   | `GITHUB_TOKEN` | from step 2 |
   | `GITHUB_REPO` | `dhruv457457/portfolio` (the default) |
   | `GITHUB_BRANCH` | `main` (the default) |
   | `SITE_DIR` | `site` (the default; the folder Vercel serves) |

5. **Redeploy**, then open `https://<your-site>/admin`.

To change the password later, run step 1 again, replace `ADMIN_PASSWORD_HASH`, and redeploy.

## Trying it locally

```
node tools/dev-server.js
```

This serves the site and the admin on http://localhost:5180 using `.env.local` (gitignored). With no `GITHUB_TOKEN` set, saves write straight to `site/` on disk and the limits are kept in memory.

## Files

- **`site/admin/`:** the page (`index.html`, `admin.js`, `admin.css`) and `schema.js`, the field limits used by both the browser and the server.
- **`site/api/admin/`:** the endpoints (`login`, `logout`, `me`, `content`, `upload`). Shared code lives in `site/api/_lib/`.
- **`site/vercel.json`:** a strict Content-Security-Policy and no indexing for `/admin`.
