# Sportfolio deployment

## Recommended pilot deployment

Deploy the `main` branch to Vercel as a Next.js project.

### Required environment variables

Set these in Vercel for Production and Preview:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Use the values from `.env.example`.

### Supabase Auth redirects

After Vercel assigns the production URL, add these URLs to the Supabase Auth URL configuration:

- Site URL: `https://<your-vercel-domain>`
- Redirect URL: `https://<your-vercel-domain>/auth/callback`

If a custom Sportfolio domain is later attached, add the equivalent custom-domain callback as well.

The login page builds its magic-link redirect from `window.location.origin`, so preview and production deployments will use their own callback domain automatically, provided that domain is allowlisted in Supabase Auth.

### Pilot routes

- `/` current interactive prototype
- `/login` secure teacher magic-link sign in
- `/live` live Supabase-backed teacher capture workspace
- `/student` pupil reflection experience

### Verification after deploy

1. Open `/login` and request a magic link using a registered pilot email.
2. Confirm the email link returns to `/auth/callback` on the Sportfolio deployment, never another project domain.
3. Confirm `/live` loads Grade 5A and the real pupil/tag data.
4. Capture or select a small photo/video file, select one pilot pupil and one tag, and save evidence.
5. Verify the evidence row and private media object were created in Supabase.
6. Test the same flow on iPad landscape and iPad portrait.

Do not enable public sign-up or make the `sportfolio-media` storage bucket public for the pilot.
