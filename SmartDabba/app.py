from flask import Flask, jsonify, request
from firebase_admin import credentials, db
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime
import os
import firebase_admin

load_dotenv()
app = Flask(__name__)
# It's good practice to set a secret key even if not explicitly used for sessions yet
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'default-secure-key-change-me') 
CORS(app)  # Enable CORS for cross-origin requests

# --- Global Constants for Hardness Calculation ---
# Molar masses required for converting Ca/Mg (mg/L) to Hardness (mg/L as CaCO3)
# These factors are based on molar mass ratios (40/100 and 24.3/100)
CA_FACTOR = 2.497  # 1 mg/L Ca is 2.497 mg/L CaCO3
MG_FACTOR = 4.118  # 1 mg/L Mg is 4.118 mg/L CaCO3

# --- Database Initialization ---
try:
    # Use a named app instance for clean initialization
    firebase_app = None
    try:
        # Check if the app is already initialized with this name
        firebase_app = firebase_admin.get_app("api_app")
    except ValueError:
        # If not, initialize it
        cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS_PATH"))
        firebase_app = firebase_admin.initialize_app(cred, {
            'databaseURL': os.getenv("FIREBASE_DATABASE_URL")
        }, name="api_app")

    DB_REF = db.reference('water_data', app=firebase_app)
    print("✅ Firebase connection established successfully")
except Exception as e:
    print(f"❌ API Error: Firebase connection failed. {e}")
    DB_REF = None

# --- Helper Functions ---

def calculate_total_hardness(ca, mg):
    """
    Calculates Total Hardness (mg/L as CaCO3) from Calcium (Ca) and Magnesium (Mg) 
    in mg/L.
    """
    if ca is None or mg is None:
        return 0
    return round((ca * CA_FACTOR) + (mg * MG_FACTOR), 2)

def classify_water_quality(tds, total_hardness):
    """
    Provides a quick, simple classification based on standards.
    NOTE: Person 2 (AI/ML) will override and enhance this classification logic.
    """
    # Hardness classification (mg/L as CaCO3)
    if total_hardness < 60:
        hardness_class = "Soft"
    elif total_hardness < 120:
        hardness_class = "Moderately Hard"
    elif total_hardness < 180:
        hardness_class = "Hard"
    else:
        hardness_class = "Very Hard"
        
    # TDS classification (TDS max recommended limit is 500 mg/L)
    tds_status = "Safe" if tds <= 500 else "Above Recommended Limit"

    return {
        "hardness_class": hardness_class,
        "tds_status": tds_status,
        "is_safe_for_drinking": (tds <= 500 and total_hardness <= 200) # Simple combined metric
    }

# --- API Endpoints ---

@app.route('/', methods=['GET'])
def api_root_check():
    """Provides a health check and documentation index for the API."""
    
    if DB_REF is None:
        monitored_areas = ["Connection Failed: Database Not Available"]
    else:
        try:
            # Note: Using get(shallow=True) is faster for getting just the keys
            areas_keys = DB_REF.get(shallow=True)
            if areas_keys:
                monitored_areas = [key.replace("_", " ") for key in areas_keys.keys()]
            else:
                monitored_areas = ["No data ingested yet"]
        except Exception:
            monitored_areas = ["Connection Failed: Data Not Available"]
        
    return jsonify({
        "project": "Smart Hard Water Monitoring API (Data Layer)",
        "version": "1.0 - Stable",
        "status": "Operational",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S IST"),
        "documentation": {
            "description": "API Gateway providing real-time and historical water quality data for ML and Dashboard integration.",
            "available_areas": monitored_areas,
            "read_endpoints": {
                "latest_readings": "/get_latest",
                "historical_data": "/get_history?area=[e.g., Whitefield]",
                "area_list": "/get_areas",
            },
            "write_endpoint": {
                "route": "/ingest",
                "method": "POST",
                "authentication": "Bearer Token Required (IOT_DEVICE_SECRET)"
            }
        }
    })

# ... (after get_history route in app.py) ...

@app.route('/get_areas', methods=['GET'])
def get_areas():
    """
    Returns a list of all area names available in the Firebase database.
    Used by the ML API (P2) for initialization and the frontend for area selection.
    """
    if DB_REF is None:
        return jsonify({"error": "Database not initialized."}), 503
        
    try:
        # Fetch the top-level keys (which are the area names, e.g., 'Whitefield_')
        # shallow=True fetches only the keys, making it very fast.
        areas_data = DB_REF.get(shallow=True)
        
        if not areas_data:
            return jsonify({"areas": []}), 200

        # Replace underscores with spaces for clean display in the frontend
        areas = [key.replace('_', ' ') for key in areas_data.keys()]
        
        return jsonify({"areas": areas}), 200

    except Exception as e:
        print(f"🛑 Error fetching areas: {e}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

# --- Running the Server ---
# ...


@app.route('/get_latest', methods=['GET'])
def get_latest():
    """
    Returns the absolute latest record for each area using Firebase limit.
    Optimized: Fetches only the single newest record per area.
    """
    if DB_REF is None:
        return jsonify({"error": "Database connection error."}), 500

    try:
        latest_data = {}
        all_area_keys = DB_REF.get(shallow=True)

        if not all_area_keys:
            return jsonify({"message": "No data available."}), 200

        for area_key in all_area_keys.keys():
            # Query Firebase for the single newest record (since keys are reversed timestamps)
            query = DB_REF.child(area_key).order_by_key().limit_to_first(1)
            result = query.get()

            if result:
                # The single newest record is the value of the first key in the result dict
                latest_record = list(result.values())[0]
                
                # Calculate Hardness (Required by Person 2's logic)
                latest_record['total_hardness'] = calculate_total_hardness(
                    latest_record.get('Ca'), latest_record.get('Mg')
                )
                
                # Add basic classification for immediate dashboard use
                latest_record['classification'] = classify_water_quality(
                    latest_record['TDS'], latest_record['total_hardness']
                )

                latest_data[area_key.replace("_", " ")] = latest_record

        return jsonify(latest_data), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch latest data: {str(e)}"}), 500

@app.route('/get_history', methods=['GET'])
def get_history():
    """Returns historical records for a specified area (up to 100 recent records)."""
    area = request.args.get('area')
    
    if not area:
        return jsonify({"error": "Missing 'area' query parameter."}), 400

    if DB_REF is None:
        return jsonify({"error": "Database connection error."}), 500

    try:
        area_key = area.replace(" ", "_")
        
        # We will fetch up to 100 recent records for a history view for performance
        query = DB_REF.child(area_key).order_by_key().limit_to_first(100)
        data = query.get()

        if not data:
            return jsonify({"message": f"No data found for {area}."}), 404

        history = list(data.values())
        
        # Sort by timestamp ascending (oldest first) for chronological charting
        history.sort(key=lambda x: x['timestamp'])

        # Process records: calculate hardness and classify
        processed_history = []
        for record in history:
            hardness = calculate_total_hardness(record.get('Ca'), record.get('Mg'))
            record['total_hardness'] = hardness
            record['classification'] = classify_water_quality(record['TDS'], hardness)
            processed_history.append(record)

        return jsonify({
            "area": area,
            "record_count": len(processed_history),
            "data": processed_history
        }), 200
    except Exception as e:
        return jsonify({"error": f"Failed to fetch history: {str(e)}"}), 500


# --- Data Ingestion Endpoint (Security is paramount here) ---

@app.route('/ingest', methods=['POST'])
def ingest_data():
    """Accepts and authenticates real-time IoT data submission."""
    # Ensure this is the first check for security
    auth_header = request.headers.get('Authorization', '')
    expected_token = f"Bearer {os.getenv('IOT_DEVICE_SECRET')}"
    
    if auth_header != expected_token:
        return jsonify({"error": "Authentication Failed. Invalid IOT_DEVICE_SECRET."}), 401
    
    if DB_REF is None:
        return jsonify({"error": "Database connection error."}), 500

    data = request.get_json()
    
    # CRITICAL FIX FOR P2: Required fields now include turbidity and chlorine
    required_fields = ['area', 'TDS', 'Ca', 'Mg', 'pH', 'turbidity', 'chlorine'] 
    
    if not data or not all(field in data for field in required_fields):
        return jsonify({"error": f"Invalid or incomplete data payload. Requires all fields: {', '.join(required_fields)}"}), 400
    
    try:
        # Standardize and prepare data for write
        data['timestamp'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Generate the key based on time
        timestamp_key = datetime.strptime(data['timestamp'], "%Y-%m-%d %H:%M:%S").strftime("%Y%m%d%H%M%S")
        area_key = data['area'].replace(" ", "_")
        
        # Use reversed key for descending order lookup speed in Firebase
        # This allows us to easily get the 'latest' records using limit_to_first()
        reversed_key = str(99999999999999 - int(timestamp_key))

        DB_REF.child(area_key).child(reversed_key).set(data)
        
        return jsonify({"message": "Data ingested successfully", "timestamp": data['timestamp']}), 201
        
    except Exception as e:
        return jsonify({"error": f"Internal server error during write: {str(e)}"}), 500

# --- Running the Server ---
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"Flask API running on http://localhost:{port}")
    # Setting debug=True is good for development
    app.run(host='0.0.0.0', port=port, debug=True)