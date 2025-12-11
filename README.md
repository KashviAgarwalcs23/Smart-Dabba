# Smart Dabba — Bengaluru Water Monitoring

Smart Dabba is a lightweight water-quality monitoring system for Bengaluru, consisting of a React + TypeScript + Vite frontend and a Python (Flask) backend for ML predictions and simulation.

# Repository Structure

src/ — React + TypeScript frontend

public/ — Static assets

SmartDabba/ — Python backend (ML API, modeler, simulator)

supabase/migrations/ — SQL migrations for profiles and user_history

package.json, tsconfig.json, vite.config.ts — Frontend config files

# Prerequisites

Node.js 18+

Python 3.10+

Supabase project (optional for local runs; CSV fallback supported)

# Local Setup (Windows PowerShell)
# Frontend
npm install
npm run dev

# Backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r SmartDabba/requirements.txt
python SmartDabba/ml_api.py

# Environment Variables

# Frontend (public):

VITE_SUPABASE_URL

VITE_SUPABASE_ANON_KEY

Backend (secret):

SUPABASE_SERVICE_ROLE_KEY

FIREBASE_SERVICE_ACCOUNT

Any additional keys used by SmartDabba services

Recommended .gitignore
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



# Supabase Migrations

Run SQL files in supabase/migrations/ inside Supabase SQL Editor or using the Supabase CLI.

# Push Commands (PowerShell)
# New repo
git init
git checkout -b main
git add .
git commit -m "Initial import: SmartDabba"
git remote add origin https://github.com/FriendUser/RepoName.git
git push -u origin main

# If remote already has commits
git remote add origin https://github.com/FriendUser/RepoName.git
git fetch origin
git merge origin/main --allow-unrelated-histories
git push -u origin main

# Deployment
# Frontend

Recommended: Vercel

Set VITE_* environment variables in project settings

# Backend

Hosts: Railway, Render, Heroku, or Fly.io

Provide backend secrets as environment variables
