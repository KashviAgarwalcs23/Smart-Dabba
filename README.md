# Smart-Dabba
# Node
node_modules/
dist/
.vite/

# Editor / OS
.vscode/
.DS_Store
Thumbs.db

# Env / Secrets
.env
.env.local
.env.*.local
*.secret
*.key
*.pem
smart-water-bms-firebase-adminsdk-*.json

# Python
venv/
__pycache__/
*.pyc
.venv/

Project overview
Local setup (Windows PowerShell)
Frontend:
npm install
npm run dev
Backend:
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r SmartDabba/requirements.txt
python SmartDabba/ml_api.py (or gunicorn per production)
Required env vars (for GitHub Secrets & deployment):
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY (server only — keep secret)
FIREBASE_SERVICE_ACCOUNT (or store JSON as secret)
Any other API keys used by SmartDabba services
PowerShell commands to push to your friend's GitHub repo

If the remote repo already has files (not empty), fetch & rebase first:

git remote add origin https://github.com/FriendUser/RepoName.git
git fetch origin
git merge origin/main --allow-unrelated-histories
# resolve conflicts if any, then
git push -u origin main

Set up GitHub repository settings (recommendations)

Add a short LICENSE (MIT if permissive sharing is fine).
Create repository Description + README.
Protect main branch if you want (Settings → Branch protection).
Enable Issues/Discussions if you want collaborators to track work.
Add sensitive environment variables (GitHub Secrets / Deploy service)

In GitHub repo → Settings → Secrets and variables → Actions (or Environments), add:
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY (public key; safe but better to inject at deploy time)
SUPABASE_SERVICE_ROLE_KEY (server-only: DO NOT expose to frontend)
FIREBASE_SERVICE_ACCOUNT (store full JSON as single secret; your backend can read it and write a file at runtime)
For Vercel/Netlify you can set the same env vars in project settings (these services inject env vars into builds and runtime).
Run Supabase migrations (must be executed in Supabase)

The SQL files in supabase/migrations/*.sql must be applied in your Supabase project:
Open Supabase dashboard → SQL Editor → run the profiles trigger SQL and 0002_create_user_history.sql migrations.
Alternatively use supabase CLI to push migrations if configured.
Deploy options (brief)

Frontend
Vercel: connect GitHub repo, set env vars in Project Settings, it auto-deploys Vite apps.
Netlify: same workflow.
GitHub Pages: possible but Vite + client routing needs special handling — Vercel is simplest.
Backend (Python Flask)
Railway, Heroku, Render, or Fly are good choices. Use requirements.txt and Procfile.
Ensure SUPABASE_SERVICE_ROLE_KEY and Firebase JSON are set as env vars/secrets on the host.
For Heroku: set Procfile, requirements.txt; on deploy, set config vars in Heroku dashboard.
Run & verify locally (PowerShell)

Frontend:

cd "c:\Users\Shaurya Sharma\Desktop\Mini Project"
npm install
npm run dev
# open http://localhost:5173 (or as Vite prints)

Backend (SmartDabba):

cd "c:\Users\Shaurya Sharma\Desktop\Mini Project\SmartDabba"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# run server (example)
python ml_api.py

Security notes (important)

NEVER commit smart-water-bms-firebase-adminsdk-*.json or any private key to GitHub. If it was already committed, rotate credentials immediately and remove the file from history (git rm --cached ... and use git filter-repo or bfg to purge history).
Keep SUPABASE_SERVICE_ROLE_KEY server-only; never embed it in client code.
Add Dependabot and vulnerability alerts in repo Settings.
Optional automation (recommended)

Add a GitHub Actions workflow to run npm ci + npx tsc --noEmit and pip install -r SmartDabba/requirements.txt + unit tests for CI on PRs. I can scaffold a simple .github/workflows/ci.yml if you want.




