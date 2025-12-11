import requests
import json
import time
import os
import random
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# --- Configuration (Use your local server for testing) ---
# When deployed, change this to your Render/Heroku HTTPS URL!
API_URL = "http://127.0.0.1:5000/ingest" 
IOT_DEVICE_SECRET = os.getenv("IOT_DEVICE_SECRET") # Fetched from your .env

# --- Simulation Parameters for a single device (e.g., Whitefield Borewell) ---
DEVICE_AREA = "Whitefield"
# Simulate high TDS readings with normal sensor jitter
TDS_MEAN = 1050 
HARDNESS_JITTER = 20

def generate_sensor_reading():
    """
    Generates a realistic, jittered reading, now including all required fields
    (TDS, Ca, Mg, pH, Turbidity, Chlorine).
    """
    
    # Core Hardness Metrics
    tds = round(TDS_MEAN + random.uniform(-HARDNESS_JITTER, HARDNESS_JITTER), 2)
    ca = round(tds * 0.18 + random.uniform(-5, 5), 2)
    mg = round(tds * 0.05 + random.uniform(-2, 2), 2)
    
    # Contamination Metrics (Now Included!)
    # Whitefield (hard water area) often has high turbidity/low chlorine (borewell)
    turbidity = round(random.uniform(2.5, 4.5), 2) # High side (e.g., borewell)
    chlorine = round(random.uniform(0.01, 0.05), 2) # Very low chlorine residual

    return {
        "area": DEVICE_AREA,
        "TDS": tds,
        "Ca": ca,
        "Mg": mg,
        "pH": round(random.uniform(7.5, 7.8), 2),
        "turbidity": turbidity,      # NEW FIELD
        "chlorine": chlorine,        # NEW FIELD
    }

def send_data():
    """Sends one authenticated POST request to the API."""
    reading = generate_sensor_reading()
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {IOT_DEVICE_SECRET}"
    }

    try:
        response = requests.post(API_URL, headers=headers, data=json.dumps(reading))
        
        if response.status_code == 201:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ✅ Success (201): Ingested {reading['TDS']} TDS, {reading['turbidity']} NTU for {reading['area']}")
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ❌ Failed ({response.status_code}): {response.text}")

    except requests.exceptions.ConnectionError:
        print(f"[{datetime.now().strftime('%H:%M:%S')}] 🛑 Connection Error. Is the Flask API running?")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    print(f"Starting IoT simulation for {DEVICE_AREA}. Target API: {API_URL}")
    while True:
        send_data()
        time.sleep(15) # Send data every 15 seconds