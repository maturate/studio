# Dev runbook: add a model, deploy, push to git

Practical steps for the three things you do most often in this repo. See
`docs/technical/README.md` for architecture; this is just the how-to.

## 1. Add a model

**Never wire in a model id from memory or a doc — verify it live first.**
This project has been burned by assumed model ids before. Steps:

1. **Confirm the model actually works** with a real API call before writing
   any code. For a Vertex/Gemini model:
   ```bash
   TOKEN=$(gcloud auth application-default print-access-token)
   curl -s "https://aiplatform.googleapis.com/v1/projects/$PROJECT/locations/global/publishers/google/models/<model-id>:generateContent" \
     -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"contents":[{"role":"user","parts":[{"text":"say hi"}]}]}'
   ```
   A `404` means the model id is wrong. A `403` can mean the model is real
   but access-gated (check IAM, or it needs a separate product entitlement —
   this has happened with preview models before). Only proceed once you get
   a real `200`/`completed` response.
2. **Add the registry entry** in `packages/model-registry/src/models.ts`:
   `id`, `provider`, `label`, `category` (`image`/`audio`/`video`),
   `outputTypes`, `inputTypes` (test each input type live too — don't assume
   a model takes image/video/audio just because a sibling model does),
   `pricing` (leave `estimatedUsd: null, verified: false` if you don't have
   a confirmed real number — never guess a price).
3. **Add advanced settings** (if the model has real configurable options) in
   `packages/model-registry/src/settings-schema.ts` — a `SettingField[]`
   keyed by the model id. Only expose options you've confirmed the API
   actually accepts; enum values from a shared/generic schema doc aren't
   necessarily valid for every specific model (e.g. Omni 1.1 rejects
   `thinking_level: "medium"` even though it's a documented generic value).
4. **Write the provider adapter** in
   `packages/workflow-engine/src/generation/providers/<provider>.ts` —
   implements `GenerationAdapter`: takes a `GenerationInput`, returns
   `GenerationResult`. Copy the calling pattern from a sibling model on the
   same API surface if one exists.
5. **Register the adapter** in
   `packages/workflow-engine/src/generation/registry.ts`'s `ADAPTERS` map,
   keyed by the exact model id string used in step 2.
6. Build and typecheck (see step 2 of Deploy) before shipping.

## 2. Deploy code (to the `superos-studio` GCP VM)

```bash
# 1. Build + typecheck locally — fix errors before packaging.
rm -rf apps/web/.next
npm run build --workspace=@superos/web

# 2. Package a tarball, excluding node_modules/.next/.git/logs/.env files.
tar czf /tmp/deploy.tar.gz \
  --exclude='node_modules' --exclude='.next' --exclude='.git' \
  --exclude='*.log' --exclude='.env' --exclude='.env.*' .

# 3. Sanity-check no .env leaked into the tarball (must print 0).
tar -tzf /tmp/deploy.tar.gz | grep -c "^\./\.env"

# 4. Copy it to the VM.
gcloud compute scp /tmp/deploy.tar.gz superos-studio:/tmp/superos-deploy.tar.gz --zone=us-central1-a

# 5. Run the redeploy script on the VM (extracts over /opt/superos-studio,
#    preserves the VM's own docker-compose.yml and .env, rebuilds, restarts pm2).
gcloud compute ssh superos-studio --zone=us-central1-a --command='bash -s' < redeploy.sh
```

`redeploy.sh` (keep a copy handy — it lives in the session scratchpad, which
gets wiped between sessions, so recreate it if missing):

```bash
#!/bin/bash
set -e
cd /opt/superos-studio
cp docker-compose.yml /tmp/docker-compose.yml.bak
sudo tar -xzf /tmp/superos-deploy.tar.gz -C /opt/superos-studio
sudo chown -R $(whoami):$(whoami) /opt/superos-studio
cp /tmp/docker-compose.yml.bak docker-compose.yml
npm install
npm run build --workspace=@superos/web
pm2 restart all
pm2 save
echo "DEPLOY_DONE"
```

**Always verify after deploying:**
```bash
# pm2 all "online", restart count (↺) bumped by exactly 1 — confirms it actually redeployed.
gcloud compute ssh superos-studio --zone=us-central1-a --command='pm2 list'

# .env untouched (spot-check a couple of real values).
gcloud compute ssh superos-studio --zone=us-central1-a --command='grep "^AUTH_URL\|^STORAGE_ENDPOINT" /opt/superos-studio/.env'
```
The VM's own `.env` (real prod secrets) is separate from the repo's
`.env`/`.env.example` — it's never overwritten by a deploy, but a new env var
(new API key, etc.) needs to be added to it manually via SSH, then
`pm2 restart all --update-env` to pick it up.

## 3. Push to git

```bash
git status                 # review what actually changed
git add -A                 # or add specific files if some changes shouldn't ship
git commit -m "$(cat <<'EOF'
Short summary of the change

Longer explanation of why, if not obvious.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push origin main
```

Remote is `https://github.com/maturate/studio.git`. This repo has no CI/CD
tied to the push — pushing to GitHub and deploying to the VM are two
separate, manual steps (do both; one doesn't trigger the other).
