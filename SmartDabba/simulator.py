import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import firebase_admin
from firebase_admin import credentials, db
from dotenv import load_dotenv
import os

load_dotenv()

# --- 1. Define Area Parameters Based on Real Bengaluru Data ---
# Hard water areas (high TDS, Ca, Mg) - Based on DrinkPrime study and government reports

HARD_AREAS = {
    "Whitefield": {
        "TDS": (192, 1002),        # Based on DrinkPrime study: 192-1002 PPM
        "Ca": (80, 200),           # High calcium from borewell sources
        "Mg": (40, 120),           # High magnesium from groundwater
        "pH": (7.0, 8.4),          # Slightly alkaline borewell water
        "turbidity": (1.0, 4.5),   # Moderate to high turbidity
        "chlorine": (0.0, 0.05),   # No chlorination in borewells
        "hardness": (96, 492)      # Based on DrinkPrime study: 96-492 PPM
    },
    "Electronics_City": {
        "TDS": (68, 1236),         # Based on DrinkPrime study: 68-1236 PPM (highest recorded)
        "Ca": (100, 250),          # Very high calcium
        "Mg": (50, 140),           # Very high magnesium  
        "pH": (7.2, 8.5),          # High pH from mineral content
        "turbidity": (1.5, 5.0),   # High turbidity
        "chlorine": (0.0, 0.03),   # Minimal chlorine
        "hardness": (8, 580)       # Based on DrinkPrime study: 8-580 PPM (wide range)
    },
    "Sarjapur": {
        "TDS": (200, 1100),        # Similar to Whitefield, borewell dependent
        "Ca": (90, 220),           # High calcium
        "Mg": (45, 110),           # High magnesium
        "pH": (7.1, 8.3),          # Alkaline groundwater
        "turbidity": (1.2, 4.2),   # Moderate turbidity
        "chlorine": (0.0, 0.04),   # No chlorination
        "hardness": (85, 450)      # Estimated based on Ca/Mg content
    }
}

# Soft water areas (Cauvery water - treated municipal supply)
SOFT_AREAS = {
    "Jayanagar": {  # Central area with good Cauvery water supply
        "TDS": (150, 400),         # Treated water, controlled TDS
        "Ca": (20, 60),            # Lower calcium after treatment
        "Mg": (8, 25),             # Lower magnesium
        "pH": (6.5, 7.8),          # pH controlled in treatment
        "turbidity": (0.2, 2.0),   # Good filtration
        "chlorine": (0.2, 0.5),    # Chlorine residual for disinfection
        "hardness": (60, 180)      # Moderate hardness
    },
    "HSR_Layout": {    # Mixed supply - some Cauvery, some borewell
        "TDS": (142, 646),         # Based on DrinkPrime study: 142-646 PPM
        "Ca": (30, 80),            # Mixed sources
        "Mg": (15, 40),            # Mixed sources
        "pH": (6.8, 7.9),          # Variable pH
        "turbidity": (0.5, 3.0),   # Variable turbidity
        "chlorine": (0.1, 0.4),    # Some chlorination
        "hardness": (68, 276)      # Based on DrinkPrime study: 68-276 PPM
    },
    "MG_Road": {      # Central Bangalore - good municipal supply
        "TDS": (120, 350),         # Good quality municipal water
        "Ca": (15, 50),            # Low calcium
        "Mg": (5, 20),             # Low magnesium
        "pH": (6.6, 7.6),          # Well-controlled pH
        "turbidity": (0.3, 1.8),   # Good filtration
        "chlorine": (0.3, 0.6),    # Standard chlorination
        "hardness": (40, 150)      # Soft to moderate
    }
}

ALL_AREAS = {**HARD_AREAS, **SOFT_AREAS}
N_RECORDS_PER_AREA = 200  # Total records will be 6 * 200 = 1200

# --- 2. Initialize Firebase ---
try:
    cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS_PATH"))
    firebase_admin.initialize_app(cred, {
        'databaseURL': os.getenv("FIREBASE_DATABASE_URL")
    })
    ref = db.reference('water_data')
except Exception as e:
    print(f"Error initializing Firebase. Check your .env and key file path. {e}")
    exit()

# --- 3. Enhanced Simulation Function ---
def generate_realistic_data():
    all_data = []
    end_time = datetime.now()
    # Simulate data over ~2 weeks (200 records * 1.5 hour interval)
    start_time = end_time - timedelta(hours=N_RECORDS_PER_AREA * 1.5)

    for area, ranges in ALL_AREAS.items():
        current_time = start_time

        for i in range(N_RECORDS_PER_AREA):
            # Generate correlated values (TDS correlates with hardness, Ca, Mg)
            tds = round(random.uniform(*ranges["TDS"]), 2)

            # Calculate realistic Ca and Mg based on TDS and hardness
            hardness = round(random.uniform(*ranges["hardness"]), 2)

            # Ca and Mg should correlate with hardness
            # Hardness (as CaCO3) = 2.5 * Ca + 4.1 * Mg (approximate)
            ca_contribution = random.uniform(0.6, 0.8)  # Ca contributes 60-80% of hardness
            ca = round((hardness * ca_contribution) / 2.5, 2)
            mg = round((hardness * (1 - ca_contribution)) / 4.1, 2)

            # Ensure Ca and Mg are within realistic bounds
            ca = max(ranges["Ca"][0], min(ranges["Ca"][1], ca))
            mg = max(ranges["Mg"][0], min(ranges["Mg"][1], mg))

            # Other parameters
            ph = round(random.uniform(*ranges["pH"]), 2)
            turbidity = round(random.uniform(*ranges["turbidity"]), 2)
            chlorine = round(random.uniform(*ranges["chlorine"]), 3)

            record = {
                "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
                "area": area.replace("_", " "),  # Convert back to readable name
                "pH": ph,
                "TDS": tds,
                "Ca": ca,
                "Mg": mg,
                "turbidity": turbidity,
                "chlorine": chlorine,
                "hardness": hardness  # Include calculated hardness
            }
            all_data.append(record)
            current_time += timedelta(minutes=random.randint(80, 100))  # Variable interval

    return pd.DataFrame(all_data)

# --- 4. Store Data in Firebase ---
def push_to_firebase(df):
    print("Starting to clear previous data and push new records...")
    ref.delete()  # Clear existing data

    for _, row in df.iterrows():
        # Firebase key must be a valid path string
        timestamp_key = datetime.strptime(row['timestamp'], "%Y-%m-%d %H:%M:%S").strftime("%Y%m%d%H%M%S")

        # Structure data as: water_data / AreaName / UniqueTimestampKey / RecordDetails
        area_ref = ref.child(row['area'].replace(" ", "_"))
        area_ref.child(timestamp_key).set(row.to_dict())

    print(f"Successfully pushed {len(df)} records across all areas.")

if __name__ == "__main__":
    df_simulated = generate_realistic_data()
    print(f"Generated {len(df_simulated)} records")
    print("Sample data:")
    print(df_simulated.head())
    print("\nData summary by area:")
    print(df_simulated.groupby('area')[['TDS', 'hardness', 'pH']].agg(['mean', 'min', 'max']))

    # Uncomment the line below when ready to push to Firebase
    push_to_firebase(df_simulated)
    print("\nSimulation complete. Uncomment push_to_firebase() call when ready to upload.")
