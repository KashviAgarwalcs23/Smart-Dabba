from flask import Flask, jsonify, request
from flask_cors import CORS

import pandas as pd
import requests
import os
import json
import time
import logging

# Import the core logic class from your modeling file
from water_modeler import WaterQualityModeler, BASE_API_URL
import numpy as np
import threading
import uuid
from time import sleep


# --- FLASK APP INITIALIZATION ---
app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def get_mock_recommendation(chore, volume_liters, data_source):
    """
    Simulates the recommendation logic based on chore type.
    """
    if chore == 'Dishwashing (Machine)':
        # Dishwashers need soft water to prevent scale buildup
        optimal_tds = "50 - 150"
        optimal_hardness = "0 - 50" # Very soft
        optimal_ph = "6.5 - 7.5"
        ideal_hardness_target = 30.0
        advice = (
            f"For automated dishwashing, very soft water (Hardness: < 50 mg/L) is crucial to prevent mineral scaling and ensure detergent effectiveness. "
            f"Since your current data source is '{data_source}', consider adding salt or a water softener to your dishwasher if your source water is hard. "
            f"Based on your requested volume of {volume_liters}L, maintaining water purity is highly recommended for appliance longevity."
        )
    elif chore == 'Laundry (Dark Clothes)':
        # Moderate water quality prevents dye bleed and detergent residue
        optimal_tds = "100 - 300"
        optimal_hardness = "60 - 100" # Soft to moderately hard
        optimal_ph = "6.8 - 8.0"
        ideal_hardness_target = 80.0
        advice = (
            f"For dark clothes, water should be moderately soft to prevent detergent residue which can leave white streaks. "
            f"If your water is too hard, use a softening agent or increase detergent amount slightly. "
            f"The recommended ideal hardness for optimal color retention is {ideal_hardness_target} mg/L CaCO3."
        )
    elif chore == 'Making Tea/Coffee':
        # Specific hardness and TDS needed for flavor extraction
        optimal_tds = "120 - 200"
        optimal_hardness = "50 - 100" # Soft to moderately hard
        optimal_ph = "7.0 - 7.2"
        ideal_hardness_target = 75.0
        advice = (
            f"Optimal flavor extraction requires a balanced mineral profile. Hardness should be moderate ({optimal_hardness} mg/L) "
            f"and pH near neutral to avoid sour or flat tastes. Use filtered water if your source has high TDS (> 300 mg/L) "
            f"to ensure the best taste for your beverage."
        )
    elif chore == 'Watering Plants':
        # Generally needs low TDS and near-neutral pH to prevent soil salt build-up
        optimal_tds = "50 - 300"
        optimal_hardness = "80 - 150" # Neutral to slightly hard
        optimal_ph = "6.0 - 7.5"
        ideal_hardness_target = 100.0
        advice = (
            f"Most household plants thrive with near-neutral pH water. The TDS should be kept low (< 300 mg/L) to prevent "
            f"salt accumulation in the soil, which can damage roots. If using tap water, let it sit for 24 hours to allow "
            f"chlorine to dissipate."
        )
    else:
        # Default or fallback advice
        optimal_tds = "N/A"
        optimal_hardness = "N/A"
        optimal_ph = "N/A"
        ideal_hardness_target = 0.0
        advice = "No specific recommendation model found for this chore. General municipal standards apply."


    return {
        "optimal_tds_range": f"{optimal_tds} mg/L",
        "optimal_hardness_range": f"{optimal_hardness} mg/L",
        "optimal_ph_range": optimal_ph,
        "conversion_advice": advice,
        "ideal_hardness_mg_l": ideal_hardness_target
    }


def _get_latest_hardness_for_area(area: str) -> float | None:
    """
    Try to get the latest hardness measurement for an area.
    Priority: CSV file in the repo -> MODELER.get_latest_data() fallback.
    Returns hardness (mg/L) or None if unavailable.
    """
    try:
        csv_path = os.path.join(os.path.dirname(__file__), 'bengaluru_water_quality_ranges.csv')
        if os.path.exists(csv_path):
            df = pd.read_csv(csv_path, parse_dates=['timestamp'])
            # Normalize area matching
            df['area_norm'] = df['area'].str.strip().str.lower()
            mask = df['area_norm'] == area.strip().lower()
            if mask.any():
                latest = df[mask].sort_values('timestamp').iloc[-1]
                return float(latest['hardness'])
    except Exception as e:
        print(f"Warning: failed to read CSV for latest hardness: {e}")

    # Fallback: try to use MODELER to fetch latest data
    try:
        df_latest = MODELER.get_latest_data()
        if not df_latest.empty and 'area_id' in df_latest.columns:
            # area_id in modeler is area
            match = df_latest[df_latest['area_id'].str.strip().str.lower() == area.strip().lower()]
            if not match.empty:
                # Return the last recorded hardness
                return float(match.iloc[-1].get('hardness', np.nan))
    except Exception as e:
        print(f"Warning: MODELER fallback failed to provide latest hardness: {e}")

    return None
# --- MODEL INITIALIZATION ---
try:
    MODELER = WaterQualityModeler()
    logging.info("WaterQualityModeler initialized successfully.")
except Exception as e:
    logging.error(f"⚠️ Modeler initialization failed (P1 API offline or error): {e}")
    # Initialize a fallback instance
    MODELER = WaterQualityModeler()


# --- API Endpoints ---


@app.route('/', methods=['GET'])
def home():
    """API health check and documentation."""
    return jsonify({
        "message": "Smart Hard Water Monitoring API (AI/ML Layer)",
        "version": "1.0",
        "status": "active",
        "endpoints": [
            "/alerts (GET) - Current status and contamination alerts for all areas.",
            "/predict?area=... (GET) - 7-day TDS trend prediction for a specific area.",
            "/analyze_sample (POST) - Analyze a manual water sample.",
            "/recommend_chore_water (POST) - Get chore-specific recommendations."
        ],
        "monitored_areas": MODELER.areas
    }), 200


@app.route('/alerts', methods=['GET'])
def get_alerts():
    """
    Fetches the latest water quality data from the core API and processes it
    to generate current alerts and status for all monitored areas.
    """
    try:
        # 1. Fetch latest data for all areas using the core modeler method
        # df_latest now contains columns like 'area_id', 'hardness', 'status', 'alert_message'
        df_latest = MODELER.get_latest_data()
        
        if df_latest is None or df_latest.empty:
            logging.warning("P1 API returned no latest data. Returning 503.")
            return jsonify({"error": "No data available from core API to generate alerts."}), 503
        
        # 2. Convert the processed DataFrame directly to a list of dicts.
        results = df_latest.to_dict('records')

        # 3. Clean up the final results to rename 'area_id' back to 'area' for the frontend
        final_results = []
        for record in results:
            # Create a copy to modify
            clean_record = record.copy()
            # Rename 'area_id' to 'area' and ensure the required fields are present
            clean_record['area'] = clean_record.pop('area_id', clean_record.get('area', 'Unknown'))
            # Add history source availability per-area by checking modeler's history quick call
            try:
                hist_res = MODELER._get_history_df(clean_record['area'], limit=1)
                if isinstance(hist_res, dict):
                    clean_record['history_source'] = hist_res.get('source', 'unknown')
                else:
                    clean_record['history_source'] = 'unknown'
            except Exception as e:
                logging.debug(f"Could not determine history source for {clean_record.get('area')}: {e}")
                clean_record['history_source'] = 'unknown'
            final_results.append(clean_record)

        logging.info(f"Alerts successfully generated for {len(final_results)} areas.")
        return jsonify(final_results), 200

    except Exception as e:
        logging.error(f"🛑 Error processing /alerts request: {e}", exc_info=True)
        return jsonify({"error": f"Internal ML service error during alert processing: {type(e).__name__}: {str(e)}"}), 500


@app.route('/analyze_sample', methods=['POST'])
def analyze_sample():
    """
    Receives manual input data, calculates hardness, classifies, and provides a
    specific analysis based on the optional 'target_chore' input.
    """
    data = request.get_json()
    
    # 1. Input Validation
    required_fields = ['area', 'TDS', 'pH', 'Ca', 'Mg', 'turbidity', 'chlorine']
    if not data or not all(field in data for field in required_fields):
        return jsonify({"error": f"Invalid payload. Missing fields: {', '.join(required_fields)}"}), 400

    try:
        # Extract and convert input data
        input_data = {key: float(data[key]) for key in required_fields if key != 'area'}
        input_data['area'] = data['area']
        
        target_chore = data.get('target_chore')
        
        # 2. Hardness Calculation
        total_hardness = MODELER.calculate_total_hardness(input_data['Ca'], input_data['Mg'])
        
        # 3. Classification and Alerts (based on general health)
        status = MODELER.classify_hardness(total_hardness)
        alert_message = MODELER.generate_alerts(
            input_data['TDS'],
            input_data['pH'],
            input_data['turbidity'],
            input_data['chlorine']
        )
        
        # 4. Determine Household Suitability (specific to the chore if provided)
        household_suitability = MODELER.determine_suitability(
            input_data['TDS'],
            total_hardness,
            input_data['pH'],
            input_data['chlorine'],
            target_chore
        )
        
        # 5. General Recommended Action Logic (Used for the top-level suggestion)
        recommended_action = "Water quality is acceptable, but regular monitoring is advised. No immediate treatment needed."
        if status in ["Very Hard", "Hard"]:
            recommended_action = "High hardness detected. Recommend a **Water Softener** or Reverse Osmosis (RO) system to prevent scaling."
        elif input_data['TDS'] > 500:
            recommended_action = "High TDS level. Recommend **Reverse Osmosis (RO)** system."
        elif input_data['turbidity'] > 5.0:
            recommended_action = "High turbidity indicates suspended solids. Recommend a **Sediment Filter**."


        # 6. Structure and Return the full AnalysisResult
        result = {
            # Echo input data
            "area": input_data['area'],
            "TDS": input_data['TDS'],
            "pH": input_data['pH'],
            "Ca": input_data['Ca'],
            "Mg": input_data['Mg'],
            "turbidity": input_data['turbidity'],
            "chlorine": input_data['chlorine'],
            
            # ML Calculated fields (used by frontend to display result)
            "calculated_hardness": total_hardness,
            "status": status,
            "alert_message": alert_message,
            "recommended_action": recommended_action,
            "target_chore": target_chore or "General Analysis",
            "household_suitability": household_suitability
        }
        
        logging.info(f"ML Analysis Complete for {input_data['area']}. Status: {status}")
        return jsonify(result), 200

    except Exception as e:
        logging.error(f"🛑 Error during /analyze_sample processing: {e}", exc_info=True)
        return jsonify({"error": f"Internal ML analysis failed: {type(e).__name__}: {str(e)}"}), 500


@app.route('/predict', methods=['GET'])
def get_forecast():
    """
    Provides a 7-day TDS trend forecast for a specific area using the
    WaterQualityModeler's internal prediction logic.
    """
    area = request.args.get('area')
    
    if not area:
        return jsonify({"error": "Missing 'area' query parameter. Example: /predict?area=Whitefield"}), 400

    if area not in MODELER.areas:
          return jsonify({"error": f"Area '{area}' not monitored. Available areas: {', '.join(MODELER.areas)}"}), 404
          
    try:
        prediction_result = MODELER.predict_area_trend(area, future_steps=7)
        
        if prediction_result and "predictions" in prediction_result:
            logging.info(f"Prediction generated for {area}.")
            return jsonify(prediction_result), 200
        else:
            return jsonify({"error": prediction_result.get("message", "Prediction model failed due to unknown error.")}), 500

    except Exception as e:
        logging.error(f"🛑 Error processing /predict request: {e}", exc_info=True)
        return jsonify({"error": f"Internal ML service error during prediction: {type(e).__name__}: {str(e)}"}), 500


@app.route('/check_p1', methods=['GET'])
def check_p1():
    """Lightweight health check for P1 and whether recent history exists for an area.

    Returns JSON: { p1_available: bool, history_present: bool, error: str|null }
    """
    area = request.args.get('area')
    result = { 'p1_available': False, 'history_present': False, 'error': None }
    try:
        # 1) Check P1 /get_areas
        try:
            resp = requests.get(f"{BASE_API_URL}/get_areas", timeout=3)
            if resp.ok:
                result['p1_available'] = True
        except Exception as e:
            logging.info(f"P1 /get_areas check failed: {e}")

        # 2) If area provided, check whether P1 has recent history
        if area and result['p1_available']:
            try:
                resp2 = requests.get(f"{BASE_API_URL}/get_history?area={area.replace(' ', '_')}&limit=1", timeout=3)
                if resp2.ok:
                    payload = resp2.json()
                    # Support either {data:[...]} or direct array
                    candidates = []
                    if isinstance(payload, dict) and 'data' in payload and isinstance(payload['data'], list):
                        candidates = payload['data']
                    elif isinstance(payload, list):
                        candidates = payload
                    result['history_present'] = len(candidates) > 0
            except Exception as e:
                logging.info(f"P1 /get_history check failed for area {area}: {e}")

    except Exception as e:
        result['error'] = str(e)

    return jsonify(result), 200

@app.route('/recommend_chore_water', methods=['POST'])
def recommend_chore_water():
    """
    Endpoint to receive chore details and return water quality recommendations.
    """
    try:
        # Simulate network latency (useful for showing the loading state)
        # time.sleep(1.5)

        data = request.get_json()
        chore = data.get('chore')
        volume_liters = data.get('volume_liters')
        data_source = data.get('data_source')

        if not all([chore, volume_liters, data_source]):
            return jsonify({
                "success": False, 
                "error": "Missing input parameters (chore, volume_liters, or data_source)."
            }), 400

        # Run the mock recommendation logic
        recommendation = get_mock_recommendation(chore, volume_liters, data_source)

        # Try to obtain the current hardness for the provided area (if given)
        area = data.get('area')
        current_hardness = None
        if area:
            current_hardness = _get_latest_hardness_for_area(area)

        # If mock recommendation contains a numeric ideal target, use it
        target_hardness = recommendation.get('ideal_hardness_mg_l') if isinstance(recommendation, dict) else None

        # Device profiles (defaults). These are conservative, configurable estimates.
        device_profiles = [
            {"name": "Household RO (small)", "flow_L_per_min": 0.05, "removal_efficiency": 0.95},  # ~3 L/hr
            {"name": "Household RO (medium)", "flow_L_per_min": 0.166, "removal_efficiency": 0.98}, # ~10 L/hr
            {"name": "Portable Softener (point-of-use)", "flow_L_per_min": 10.0, "removal_efficiency": 0.99},
            {"name": "Whole-house Water Softener", "flow_L_per_min": 30.0, "removal_efficiency": 1.0},
        ]

        conversion_estimates = []
        if current_hardness is not None and target_hardness is not None and current_hardness > 0:
            needed_reduction = max(0.0, current_hardness - float(target_hardness))
            needed_fraction = 0.0 if current_hardness == 0 else (1.0 - float(target_hardness) / float(current_hardness))

            for dev in device_profiles:
                E = float(dev['removal_efficiency'])
                flow = float(dev['flow_L_per_min'])
                # Time to process the requested volume (minutes)
                time_minutes = None
                can_reach = E >= needed_fraction - 1e-6
                # If device can provide required reduction in a single pass
                if can_reach:
                    time_minutes = (float(volume_liters) / flow) if flow > 0 else None
                    final_hardness = max(0.0, (1.0 - E) * float(current_hardness))
                    conversion_estimates.append({
                        "device": dev['name'],
                        "can_reach_target": True,
                        "time_minutes": round(time_minutes, 2) if time_minutes is not None else None,
                        "time_h_m": (None if time_minutes is None else f"{int(time_minutes // 60)} h {int(round(time_minutes % 60))} m" if time_minutes >= 1 else "<1 m"),
                        "final_hardness_mg_l": round(final_hardness, 2),
                        "notes": "Single-pass treatment expected to meet target hardness."
                    })
                else:
                    # Device cannot reach the target in a single pass; compute expected final hardness after one pass
                    final_hardness = max(0.0, (1.0 - E) * float(current_hardness))
                    time_minutes = (float(volume_liters) / flow) if flow > 0 else None
                    conversion_estimates.append({
                        "device": dev['name'],
                        "can_reach_target": False,
                        "time_minutes": round(time_minutes, 2) if time_minutes is not None else None,
                        "time_h_m": (None if time_minutes is None else f"{int(time_minutes // 60)} h {int(round(time_minutes % 60))} m" if time_minutes >= 1 else "<1 m"),
                        "expected_final_hardness_mg_l": round(final_hardness, 2),
                        "notes": "Device single-pass cannot reach target. Consider higher-efficiency device or combining treatments."
                    })

        # Attach the computed values to recommendation for the frontend to display
        try:
            if isinstance(recommendation, dict):
                recommendation['current_hardness_mg_l'] = current_hardness
                recommendation['target_hardness_mg_l'] = target_hardness
                recommendation['needed_reduction_mg_l'] = (None if current_hardness is None or target_hardness is None else round(max(0.0, float(current_hardness) - float(target_hardness)), 2))
                recommendation['conversion_time_estimates'] = conversion_estimates
        except Exception:
            pass

        return jsonify({
            "success": True,
            "chore": chore,
            "volume_liters": volume_liters,
            "area": area,
            "data_source": data_source,
            "recommendation": recommendation
        })

    except Exception as e:
        # Log the error for debugging
        print(f"An error occurred: {e}")
        return jsonify({
            "success": False, 
            "error": f"Internal server error: {str(e)}"
        }), 500


# --- Simple Background Job System for Treatment Operations ---
# This is an in-memory job store intended for demo/dev usage.
JOBS = {}
JOBS_LOCK = threading.Lock()

def _run_treatment_job(job_id: str, duration_minutes: float, device: str, area: str, volume_liters: float, current_hardness: float, removal_efficiency: float):
    """Background thread function: simulates treatment progress and completes job."""
    try:
        with JOBS_LOCK:
            JOBS[job_id]['status'] = 'running'
            JOBS[job_id]['progress'] = 0

        # For responsiveness in demo, scale down realtime: 1 minute -> 1 second
        # Use scale factor to avoid long sleeps during testing
        scale = float(os.environ.get('TREATMENT_TIME_SCALE', '1'))
        sleep_seconds = max(0.1, (duration_minutes / scale))

        # Simulate progress updates in steps
        steps = 10
        step_sleep = sleep_seconds / steps if steps > 0 else sleep_seconds
        for i in range(steps):
            sleep(step_sleep)
            with JOBS_LOCK:
                JOBS[job_id]['progress'] = int(((i + 1) / steps) * 100)

        # Compute final hardness after single-pass (approx)
        final_hardness = max(0.0, (1.0 - removal_efficiency) * float(current_hardness)) if current_hardness is not None else None

        with JOBS_LOCK:
            JOBS[job_id]['status'] = 'completed'
            JOBS[job_id]['progress'] = 100
            JOBS[job_id]['result'] = {
                'final_hardness_mg_l': round(final_hardness, 2) if final_hardness is not None else None,
                'device': device,
                'area': area,
                'volume_liters': volume_liters
            }
    except Exception as e:
        with JOBS_LOCK:
            JOBS[job_id]['status'] = 'failed'
            JOBS[job_id]['error'] = str(e)


@app.route('/start_treatment', methods=['POST'])
def start_treatment():
    """Start a background treatment job for a chosen device and area.

    Expected JSON: { area, device, volume_liters, device_profile_name }
    Returns: { job_id, estimated_minutes }
    """
    try:
        data = request.get_json() or {}
        area = data.get('area')
        device = data.get('device')
        volume_liters = float(data.get('volume_liters', 0))
        # Optionally client may pass removal_efficiency and flow
        removal_efficiency = float(data.get('removal_efficiency', 0.95))
        flow_L_per_min = float(data.get('flow_L_per_min', 0.166))

        if not all([area, device, volume_liters > 0]):
            return jsonify({'error': 'Missing parameters (area, device, volume_liters)'}), 400

        # Obtain current hardness to compute final expected hardness; fallback to CSV/modeler
        current_hardness = _get_latest_hardness_for_area(area)

        # Compute estimated time (minutes)
        est_minutes = (volume_liters / flow_L_per_min) if flow_L_per_min > 0 else None

        job_id = str(uuid.uuid4())
        job = {
            'job_id': job_id,
            'status': 'queued',
            'progress': 0,
            'area': area,
            'device': device,
            'volume_liters': volume_liters,
            'estimated_minutes': est_minutes,
            'result': None,
            'error': None
        }

        with JOBS_LOCK:
            JOBS[job_id] = job

        # Start worker thread
        t = threading.Thread(target=_run_treatment_job, args=(job_id, est_minutes or 0.0, device, area, volume_liters, current_hardness or 0.0, removal_efficiency), daemon=True)
        t.start()

        return jsonify({'job_id': job_id, 'estimated_minutes': est_minutes, 'status': 'started'})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/job_status/<job_id>', methods=['GET'])
def job_status(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify(job)



# --- RUNNING THE SERVER ---

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print("-----------------------------------------------------------------")
    print(f"Flask API running on http://0.0.0.0:{port}")
    print("-----------------------------------------------------------------")
    app.run(host='0.0.0.0', port=port, debug=True, use_reloader=False) # use_reloader=False prevents double logging