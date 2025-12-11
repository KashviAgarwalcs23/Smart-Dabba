# Create Flask API code
flask_api_code = '''
from flask import Flask, jsonify, request
from firebase_admin import credentials, db
from flask_cors import CORS
from dotenv import load_dotenv
from datetime import datetime, timedelta
import os
import firebase_admin

load_dotenv()
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
CORS(app)  # Enable CORS for all routes

# --- Database Initialization ---
try:
    # Check if Firebase app is already initialized
    firebase_app = None
    try:
        firebase_app = firebase_admin.get_app("api_app")
    except ValueError:
        # App doesn't exist, create it
        cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS_PATH"))
        firebase_app = firebase_admin.initialize_app(cred, {
            'databaseURL': os.getenv("FIREBASE_DATABASE_URL")
        }, name="api_app")
    
    DB_REF = db.reference('water_data', app=firebase_app)
    print("✅ Firebase connection established successfully")
except Exception as e:
    print(f"❌ API Error: Firebase connection failed. {e}")
    DB_REF = None

# --- Helper Function to Fetch Data from Firebase ---
def get_records_by_area(area_name, hours=None):
    if DB_REF is None:
        return []
        
    # Replace spaces with underscores, as used in simulator.py
    area_key = area_name.replace(" ", "_")
    area_data = DB_REF.child(area_key).get()
    
    if not area_data:
        return []
        
    records = list(area_data.values())
    
    # Sort by timestamp (newest first)
    records.sort(key=lambda x: x['timestamp'], reverse=True)
    
    if hours:
        # Filter for last N hours
        cutoff_time = datetime.now() - timedelta(hours=hours)
        filtered_records = [
            r for r in records 
            if datetime.strptime(r['timestamp'], "%Y-%m-%d %H:%M:%S") >= cutoff_time
        ]
        return filtered_records
    
    return records

# --- API Endpoints ---

@app.route('/', methods=['GET'])
def home():
    """API health check"""
    return jsonify({
        "message": "Smart Hard Water Monitoring API",
        "version": "1.0",
        "status": "active",
        "endpoints": ["/get_latest", "/get_history?area=AreaName"]
    })

@app.route('/get_latest', methods=['GET'])
def get_latest():
    """Returns the latest record for each area."""
    if DB_REF is None:
        return jsonify({"error": "Database connection error."}), 500

    try:
        latest_data = {}
        all_areas = DB_REF.get()
        
        if not all_areas:
            return jsonify({"message": "No data available."}), 200

        for area_key, area_records in all_areas.items():
            # Get all records for the area, sort them, and take the first one
            records = list(area_records.values())
            records.sort(key=lambda x: x['timestamp'], reverse=True)
            if records:
                latest_record = records[0]
                # Add water quality classification
                latest_record['water_classification'] = classify_water_quality(
                    latest_record.get('TDS', 0), 
                    latest_record.get('hardness', 0)
                )
                latest_data[area_key.replace("_", " ")] = latest_record

        return jsonify(latest_data)
    except Exception as e:
        return jsonify({"error": f"Failed to fetch latest data: {str(e)}"}), 500

@app.route('/get_history', methods=['GET'])
def get_history():
    """Returns last 24 hours of records for a specified area."""
    area = request.args.get('area')
    hours = request.args.get('hours', 24, type=int)  # Default 24 hours
    
    if not area:
        return jsonify({"error": "Missing 'area' query parameter."}), 400
    
    try:
        history = get_records_by_area(area, hours=hours)
        
        if not history:
            return jsonify({
                "message": f"No history found for {area} in the last {hours} hours.",
                "area": area,
                "hours_requested": hours
            }), 404
            
        # Sort by timestamp ascending for history view
        history.sort(key=lambda x: x['timestamp'])
        
        # Add water quality classifications to historical data
        for record in history:
            record['water_classification'] = classify_water_quality(
                record.get('TDS', 0), 
                record.get('hardness', 0)
            )

        return jsonify({
            "area": area,
            "hours_requested": hours,
            "record_count": len(history),
            "data": history
        })
    except Exception as e:
        return jsonify({"error": f"Failed to fetch history: {str(e)}"}), 500

@app.route('/get_areas', methods=['GET'])
def get_areas():
    """Returns list of available areas"""
    if DB_REF is None:
        return jsonify({"error": "Database connection error."}), 500
    
    try:
        all_areas = DB_REF.get()
        if not all_areas:
            return jsonify({"areas": []})
        
        areas = [area_key.replace("_", " ") for area_key in all_areas.keys()]
        return jsonify({"areas": areas})
    except Exception as e:
        return jsonify({"error": f"Failed to fetch areas: {str(e)}"}), 500

# --- Helper Functions ---
def classify_water_quality(tds, hardness):
    """Classify water quality based on TDS and hardness"""
    # TDS classification (WHO/BIS standards)
    if tds < 300:
        tds_class = "Excellent"
    elif tds < 600:
        tds_class = "Good"
    elif tds < 900:
        tds_class = "Fair"
    elif tds < 1200:
        tds_class = "Poor"
    else:
        tds_class = "Unacceptable"
    
    # Hardness classification (WHO standards)
    if hardness < 60:
        hardness_class = "Soft"
    elif hardness < 120:
        hardness_class = "Moderately Hard"
    elif hardness < 180:
        hardness_class = "Hard"
    else:
        hardness_class = "Very Hard"
    
    return {
        "tds_class": tds_class,
        "hardness_class": hardness_class,
        "overall_quality": "Good" if tds < 600 and hardness < 180 else "Needs Treatment"
    }

# --- Error Handlers ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Endpoint not found"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error"}), 500

# --- Running the Server ---
if __name__ == '__main__':
    # Use a port compatible with free tier hosting
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
'''

# Save the Flask API code
with open('app.py', 'w') as f:
    f.write(flask_api_code)

print("✅ Created app.py with Flask API")
print("\nAPI endpoints implemented:")
print("• GET / - Health check and API info")
print("• GET /get_latest - Latest readings for all areas")
print("• GET /get_history?area=AreaName&hours=24 - Historical data")
print("• GET /get_areas - List of available areas")
print("• Includes water quality classification (Soft/Hard, Good/Poor)")