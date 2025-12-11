# Create requirements.txt and other essential files

requirements_content = '''pandas==2.0.3
numpy==1.24.3
flask==2.3.3
flask-cors==4.0.0
python-dotenv==1.0.0
firebase-admin==6.2.0
gunicorn==21.2.0
requests==2.31.0
'''

# Save requirements.txt
with open('requirements.txt', 'w') as f:
    f.write(requirements_content)

# Create Procfile for deployment
procfile_content = '''web: gunicorn app:app'''

with open('Procfile', 'w') as f:
    f.write(procfile_content)

# Create .env.example file
env_example = '''# Firebase Configuration
FIREBASE_DATABASE_URL="https://your-project-id-default-rtdb.firebaseio.com"
FIREBASE_CREDENTIALS_PATH="path/to/your/firebase-key.json"

# Flask Configuration
SECRET_KEY="your_secret_key_here_make_it_long_and_random"

# Optional: Port configuration (for local development)
PORT=5000
'''

with open('.env.example', 'w') as f:
    f.write(env_example)

print("✅ Created essential files:")
print("• requirements.txt - Python dependencies")
print("• Procfile - Deployment configuration")
print("• .env.example - Environment variables template")
print("\nFiles are ready for deployment to Render/Heroku!")