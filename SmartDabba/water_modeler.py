import requests

import pandas as pd

from datetime import datetime, timedelta
import time as _time_module

from sklearn.linear_model import LinearRegression

import numpy as np

from flask import Flask, jsonify, request

from flask_cors import CORS

import logging

import random # For mock data generation



# Set up logging for better error handling

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')



# --- CONFIGURATION (Change this to the live URL when deployed) ---

BASE_API_URL = "http://127.0.0.1:5000"

CA_FACTOR = 2.497

MG_FACTOR = 4.118

HARDNESS_STANDARDS = {

    "Soft": 75, # < 75

    "Moderately Hard": 150, # 75 - 150

    "Hard": 300 # 150 - 300

}

# --- END CONFIGURATION ---



class WaterQualityModeler:

    """

    Handles data fetching, quality classification, alert generation, and TDS trend prediction.

    """

    def __init__(self, api_base_url=BASE_API_URL):

        self.api_base_url = api_base_url

        self.areas = self._fetch_areas()

        # Initialize the prediction model (Linear Regression is simple and effective for time series basics)

        self.tds_predictor = LinearRegression()



    def _fetch_areas(self):
        """Fetches the list of all monitored areas from P1's API."""
        print(f"Attempting to fetch areas from {self.api_base_url}/get_areas")
        try:
            response = requests.get(f"{self.api_base_url}/get_areas", timeout=5)
            response.raise_for_status()
            return response.json().get('areas', [])
        except requests.exceptions.RequestException as e:
            print(f"🛑 Connection Error. Using fallback areas: {e}")
            return ['MG Road', 'Jayanagar', 'HSR Layout', 'Whitefield', 'Sarjapur', 'Electronics City']



    def calculate_total_hardness(self, ca_mg_l, mg_mg_l):

        """Calculates total hardness in mg/L as CaCO3."""

        return (ca_mg_l * CA_FACTOR) + (mg_mg_l * MG_FACTOR)



    def classify_hardness(self, hardness):

        """Classifies water hardness based on WHO standards (approximate)."""

        if hardness < HARDNESS_STANDARDS["Soft"]:

            return "Soft"

        elif hardness < HARDNESS_STANDARDS["Moderately Hard"]:

            return "Moderately Hard"

        elif hardness < HARDNESS_STANDARDS["Hard"]:

            return "Hard"

        else:

            return "Very Hard"
    
    def _get_optimal_parameters_and_conversion(self, chore: str, volume: float) -> dict:
        """
        Defines optimal water parameters and estimated required Ca/Mg for a given chore.
        The volume parameter is included for future, more precise calculations.
        """
        # Define the optimal range (min, max) for each parameter based on chore
        optimal_map = {
            "Drinking/Cooking": {"TDS": (100, 300), "Hardness": (50, 100), "pH": (7.0, 7.5)},
            "Washing/Laundry": {"TDS": (0, 300), "Hardness": (0, 60), "pH": (6.5, 8.5)}, # Soft water ideal
            "Gardening": {"TDS": (50, 500), "Hardness": (50, 150), "pH": (6.0, 7.5)},
            "Dishwashing (Machine)": {"TDS": (0, 100), "Hardness": (0, 15), "pH": (7.0, 8.0)}, # Very soft required
        }
        
        params = optimal_map.get(chore, {"TDS": (100, 500), "Hardness": (50, 150), "pH": (6.5, 8.5)})
        
        target_hardness_max = params["Hardness"][1]
        
        # Calculate advisory maximums for Ca and Mg based on the target maximum hardness (mg/L CaCO3)
        # Assuming the entire hardness comes from that one element for a maximum advisory
        max_Ca_mg_l = target_hardness_max / 2.5
        max_Mg_mg_l = target_hardness_max / 4.1 
        
        # Suggesting a healthy Ca:Mg ratio for drinking/cooking
        if chore == "Drinking/Cooking":
            notes = (
                f"For the best taste and health, the target Hardness is {target_hardness_max} mg/L. "
                f"Aim for a final water concentration of **Ca: 20-50 mg/L** and **Mg: 10-30 mg/L** "
                f"(maintaining a roughly 2:1 ratio for optimal intake)."
            )
        else:
            notes = (
                f"For {chore}, the target maximum Hardness is {target_hardness_max} mg/L. "
                f"This implies Calcium (Ca) should be less than {max_Ca_mg_l:.1f} mg/L "
                f"and Magnesium (Mg) less than {max_Mg_mg_l:.1f} mg/L in the final water "
                f"to prevent scaling and residue. Conversion via Softener or RO is recommended."
            )

        return {
            "optimal_hardness": params["Hardness"],
            "optimal_tds": params["TDS"],
            "optimal_ph": params["pH"],
            "conversion_advice": {
                "ca_target": f"Max {max_Ca_mg_l:.1f} mg/L (as CaCO3 equiv.)",
                "mg_target": f"Max {max_Mg_mg_l:.1f} mg/L (as CaCO3 equiv.)",
                "notes": notes
            }
        }

           

    def _get_chore_specific_analysis(self, chore: str, tds: float, hardness: float, ph: float, chlorine: float) -> str:
        """Provides a detailed analysis for a single, specific household chore."""
        analysis = []
        recommendation = ""

        if chore == "Drinking/Cooking":
            analysis.append("--- FOCUSED ANALYSIS: Drinking & Cooking ---")
            if tds <= 300:
                recommendation = "Excellent for drinking. Low TDS suggests minimal processing is needed."
                analysis.append(f"💧 **TDS ({tds:.0f} mg/L):** Ideal. Excellent taste and mineral balance.")
            elif tds <= 500:
                recommendation = "Good for drinking. Acceptable under WHO limits."
                analysis.append(f"👍 **TDS ({tds:.0f} mg/L):** Good. Within WHO limits, but may have a noticeable taste.")
            else:
                recommendation = "Not recommended for drinking. Requires RO/advanced filtration to reduce dissolved solids."
                analysis.append(f"❌ **TDS ({tds:.0f} mg/L):** Poor. High TDS, risk of bad taste/digestive issues.")
            
            if 6.5 <= ph <= 8.5:
                analysis.append(f"⚖️ **pH ({ph:.1f}):** Optimal. Perfectly balanced.")
            else:
                analysis.append(f"⚠️ **pH ({ph:.1f}):** Suboptimal. May cause digestive or metallic taste issues.")

        elif chore == "Washing/Laundry" or chore == "Dishwashing (Machine)":
            analysis.append("--- FOCUSED ANALYSIS: Washing & Laundry ---")
            if hardness <= 75:
                recommendation = "Excellent for washing. Soft water prevents scaling and requires less detergent."
                analysis.append(f"🧺 **Hardness ({hardness:.0f} mg/L):** Soft. Ideal for all cleaning tasks.")
            elif hardness <= 150:
                recommendation = "Acceptable for washing. May notice minor scale or need slightly more detergent."
                analysis.append(f"🧼 **Hardness ({hardness:.0f} mg/L):** Moderately Hard. Acceptable, but scale may form.")
            else:
                recommendation = "Poor for washing. Highly recommend a **Water Softener** to protect appliances and clothes."
                analysis.append(f"🧽 **Hardness ({hardness:.0f} mg/L):** Hard/Very Hard. Causes severe scale, soap curd, and damage to heating elements.")
            
            if tds > 800 and hardness <= 150:
                 analysis.append(f"✨ **TDS ({tds:.0f} mg/L):** Very High. Can leave white residue on surfaces and clothes.")

        elif chore == "Gardening":
            analysis.append("--- FOCUSED ANALYSIS: Gardening & Plants ---")
            if tds <= 300:
                recommendation = "Excellent for all plants, including sensitive varieties."
                analysis.append(f"🌿 **TDS ({tds:.0f} mg/L):** Ideal. Prevents nutrient lock-out.")
            elif tds <= 800:
                recommendation = "Good for general landscaping and hardy plants. Monitor for salt buildup."
                analysis.append(f"🌻 **TDS ({tds:.0f} mg/L):** Acceptable. Suitable for most plants, but avoid prolonged use on sensitive types.")
            else:
                recommendation = "Use with caution. High TDS can burn sensitive plants or prevent water uptake (osmotic stress)."
                analysis.append(f"🌵 **TDS ({tds:.0f} mg/L):** High. Only suitable for salt-tolerant plants. Not recommended for vegetables/ornamentals.")
            
            if chlorine < 0.5:
                 analysis.append(f"🧪 **Chlorine ({chlorine:.2f} mg/L):** Low/Optimal. Safe for plants.")
            else:
                 analysis.append(f"⚠️ **Chlorine ({chlorine:.2f} mg/L):** High. Consider letting water sit overnight or using a de-chlorinator before use.")
        
        else:
            return "Task not recognized. Please choose from: Drinking/Cooking, Washing/Laundry, Gardening, Dishwashing (Machine)."

        return "\n".join(analysis) + "\n\n**OVERALL RECOMMENDATION:** " + recommendation




    def determine_suitability(self, tds: float, hardness: float, ph: float, chlorine: float, target_chore: str = None, volume: float = 1.0) -> dict | str:
        """
        Determines suitability for household chores.
        Returns a structured dictionary when target_chore is set, otherwise a    general string.
        """
        if target_chore:
            # 1. Get detailed current water analysis string
            analysis_string = self._get_chore_specific_analysis(target_chore, tds, hardness, ph, chlorine)
            
            # 2. Get optimal target parameters and conversion advice
            optimal_data = self._get_optimal_parameters_and_conversion(target_chore, volume)
            
            # 3. Combine into a structured response object
            return {
                "current_analysis": analysis_string,
                "optimal_parameters": {
                    # Format as strings for the frontend
                    "hardness": f"{optimal_data['optimal_hardness'][0]} - {optimal_data['optimal_hardness'][1]} mg/L",
                    "tds": f"{optimal_data['optimal_tds'][0]} - {optimal_data['optimal_tds'][1]} mg/L",
                    "ph": f"{optimal_data['optimal_ph'][0]} - {optimal_data['optimal_ph'][1]}",
                },
                "conversion_advice": optimal_data['conversion_advice']
            }

        # Original logic for general suitability check (if no target_chore)
        recommendations = ["--- GENERAL HOUSEHOLD SUITABILITY ---"]
        if tds <= 500:
            recommendations.append("💧 **Drinking/Cooking:** Good (Within WHO limit).")
        else:
            recommendations.append("❌ **Drinking/Cooking:** Not recommended (High TDS). Requires RO/filtration.")
        
        if hardness <= 150:
            recommendations.append("🧼 **Washing/Laundry:** Acceptable (Moderately hard or softer).")
        else:
            recommendations.append("🧽 **Washing/Laundry:** Poor (Hard water, causes scale build-up and requires extra detergent).")
        
        return "\n".join(recommendations)


    def generate_alerts(self, tds: float, ph: float, turbidity: float, chlorine: float) -> str:

        """Generates a text alert message based on contamination metrics."""

        alerts = []

        if tds > 500:

            alerts.append(f"High TDS ({tds:.0f} mg/L) detected.")

        if ph < 6.5:

            alerts.append(f"Low pH ({ph:.1f}). Water is acidic.")

        elif ph > 8.5:

            alerts.append(f"High pH ({ph:.1f}). Water is too alkaline.")

        if turbidity > 5.0:

            alerts.append(f"Critical Turbidity ({turbidity:.1f} NTU) detected.")

        if chlorine < 0.2 and tds < 500:

            alerts.append(f"Low Chlorine residual ({chlorine:.2f} mg/L).")

       

        if alerts:

            return "⚠️ ALERT: " + " | ".join(alerts)

        else:

            return "✅ All contamination metrics are within acceptable limits."

           

    def _process_data(self, df):

        """

        Private method to run all classification and alert generation logic on a DataFrame.

        """

        # Ensure 'Ca' and 'Mg' exist and are numbers

        for col in ['Ca', 'Mg', 'TDS', 'pH', 'turbidity', 'chlorine']:

            if col not in df.columns:

                print(f"Error: Missing column {col} for processing.")

                return df

            df[col] = pd.to_numeric(df[col], errors='coerce')

           

        # Calculate Hardness

        df['total_hardness'] = df.apply(

            lambda row: self.calculate_total_hardness(row['Ca'], row['Mg']), axis=1

          )

       

        # Classify Hardness

        df['hardness_class'] = df['total_hardness'].apply(self.classify_hardness)

       

        # Generate Alerts

        df['alert_message'] = df.apply(

            lambda row: self.generate_alerts(row['TDS'], row['pH'], row['turbidity'], row['chlorine']),

            axis=1

        )

       

        # FINAL CLEANUP/RENAME: Ensure unique column names for the API response

        df.rename(columns={'total_hardness': 'hardness', 'hardness_class': 'status', 'area': 'area_id'}, inplace=True)

       

        # Select only the columns needed for the API to reduce payload size

        final_cols = ['area_id', 'timestamp', 'TDS', 'pH', 'Ca', 'Mg', 'turbidity', 'chlorine', 'hardness', 'status', 'alert_message']

       

        # Filter the DataFrame to the final set of columns

        df = df[[col for col in final_cols if col in df.columns]]



        return df



    def get_latest_data(self):

        """

        Fetches the latest record for ALL areas from P1 API, processes it, and returns a DataFrame.

        """

        logging.info("Fetching latest data from P1 API for all areas...")

        df_list = []

       

        for area in self.areas:

            try:

                # Assuming P1's /get_history supports limit=1 for the latest record

                response = requests.get(

                    f"{self.api_base_url}/get_history?area={area.replace(' ', '_')}&limit=1",

                    timeout=10

                )

                response.raise_for_status()

                data = response.json().get('data', [])

               

                if data:

                    # Append the single latest record as a DataFrame

                    df_list.append(pd.DataFrame([data[0]]))

               

            except requests.exceptions.RequestException as e:

                logging.warning(f"⚠️ Could not fetch latest data for {area}: {e}")

                continue

       

        if not df_list:

            logging.error("No data frames collected.")

            return pd.DataFrame()

           

        # Concatenate all single-row DataFrames (ignore_index=True ensures the index is not duplicated)

        df_latest = pd.concat(df_list, ignore_index=True)

       

        # Apply the processing steps (hardness, class, alerts, renaming)

        return self._process_data(df_latest)



    def _get_history_df(self, area, limit=30):

        """

        Helper function to fetch historical data for a specific area (used for prediction).

        Returns a dict: { 'df': DataFrame, 'source': 'real'|'mock' }

        If real P1 history is available, returns source='real'. Otherwise returns generated mock data with source='mock'.

        """

        logging.info(f"Fetching {limit} historical records for {area} from P1 API...")

        # Try fetching real history with retries/backoff in case P1 is temporarily unavailable
        max_retries = 3
        base_delay = 0.5  # seconds
        for attempt in range(1, max_retries + 1):
            try:
                logging.info(f"Attempt {attempt}/{max_retries} fetching history for '{area}' from P1")
                response = requests.get(
                    f"{self.api_base_url}/get_history?area={area.replace(' ', '_')}&limit={limit}",
                    timeout=10
                )
                response.raise_for_status()
                data = response.json().get('data', [])

                if data:
                    logging.info(f"Using real history for area '{area}' (records: {len(data)})")
                    return {'df': pd.DataFrame(data), 'source': 'real'}
                else:
                    logging.info(f"P1 returned no history for '{area}' on attempt {attempt}")
                    # treat as a temporary miss; retry
            except Exception as e:
                logging.warning(f"P1 request attempt {attempt} failed for area '{area}': {e}")

            # exponential backoff before next attempt
            if attempt < max_retries:
                sleep_time = base_delay * (2 ** (attempt - 1))
                logging.info(f"Waiting {sleep_time}s before next attempt for area '{area}'")
                _time_module.sleep(sleep_time)

        # After retries, fall back to mock data and log it explicitly
        logging.info(f"Falling back to mock-generated history for area '{area}' after {max_retries} attempts")
        mock_data = []
        base_tds = 350 + (self.areas.index(area) * 50) % 200

        for i in range(limit):
            tds_value = base_tds + random.uniform(-10, 10) + (i / 10) * 5  # Slight upward trend
            mock_data.append({
                'area': area,
                'timestamp': (datetime.now() - timedelta(days=limit - 1 - i)).isoformat(),
                'TDS': round(tds_value, 2)
            })

        return {'df': pd.DataFrame(mock_data), 'source': 'mock'}



    def predict_area_trend(self, area, future_steps=7):

        """

        🎯 FIX for AttributeError: This is the missing method.

        Trains a simple Linear Regression model on historical TDS data and predicts the next N days.

        """

        # _get_history_df returns {'df': DataFrame, 'source': 'real'|'mock'}
        res = self._get_history_df(area, limit=30)
        if isinstance(res, dict):
            df_history = res.get('df')
            source = res.get('source', 'unknown')
        else:
            df_history = res
            source = 'unknown'

       

        if df_history is None or df_history.empty or 'TDS' not in df_history.columns:
            return {
                "area": area,
                "predictions": [],
                "model_used": "None",
                "trend_message": "Insufficient historical data to generate a reliable forecast.",
                "source": source
            }



        # 1. Prepare data: Convert timestamp to a numerical time index (days since first reading)

        df_history['timestamp'] = pd.to_datetime(df_history['timestamp'])

        df_history = df_history.sort_values(by='timestamp')

        df_history['time_index'] = (df_history['timestamp'] - df_history['timestamp'].min()).dt.days



        X = df_history[['time_index']].values

        y = df_history['TDS'].values



        # 2. Train the model

        try:

            self.tds_predictor.fit(X, y)

        except ValueError as e:

            logging.error(f"Error training model for {area}: {e}")

            return {

                "area": area,

                "predictions": [],

                "model_used": "LinearRegression",

                "trend_message": "Prediction failed due to model training error."

            }



        # 3. Generate future time indices for prediction

        last_index = df_history['time_index'].max()

        future_indices = np.arange(last_index + 1, last_index + future_steps + 1).reshape(-1, 1)



        # 4. Predict

        predicted_tds = self.tds_predictor.predict(future_indices)



        # 5. Format results

        predictions = []

        is_increasing = False

        if len(predicted_tds) > 1 and predicted_tds[-1] > predicted_tds[0]:

            is_increasing = True



        for i, tds in enumerate(predicted_tds):

            future_date = df_history['timestamp'].max() + timedelta(days=i + 1)

            predictions.append({

                "date": future_date.isoformat(),

                "predicted_tds": float(tds)

            })



        # 6. Generate a trend message for the frontend

        current_tds = y[-1]

        final_predicted_tds = predicted_tds[-1]

        tds_change = final_predicted_tds - current_tds

       

        if abs(tds_change) < 5:

            trend_message = f"TDS levels are predicted to remain **stable** over the next 7 days (Change: {tds_change:+.1f} mg/L)."

        elif tds_change > 0:

            trend_message = f"TDS levels show a slight **increasing trend** (rising by {tds_change:+.1f} mg/L). Monitor closely."

        else:

            trend_message = f"TDS levels show a slight **decreasing trend** (dropping by {tds_change:+.1f} mg/L). Overall quality is improving."





        return {
            "area": area,
            "predictions": predictions,
            "model_used": "LinearRegression",
            "trend_message": trend_message,
            "source": source
        }





# --- FLASK APPLICATION SETUP ---



# Initialize Flask App

app = Flask(__name__)

# Enable CORS for the frontend (P3) to access the API (P2)

CORS(app)



# Initialize the Modeler (This will attempt to fetch areas on startup)

MODELER = WaterQualityModeler()



# --- FLASK ROUTES ---



@app.route('/alerts', methods=['GET'])

def get_alerts():

    """Endpoint for the P3 dashboard to get real-time water quality statuses for all areas."""

    logging.info("Request received for /alerts")

    df_latest = MODELER.get_latest_data()

   

    if df_latest.empty:

        logging.error("Returning 500: No data fetched from P1 API.")

        return jsonify({"error": "No data fetched from P1 API. Check P1 server health."}), 500

   

    # Convert DataFrame to a list of dicts for JSON response

    df_latest.rename(columns={'area_id': 'area'}, inplace=True)

    results = df_latest.to_dict('records')

   

    # Ensure numerical types are handled properly for JSON serialization

    for result in results:

        for key in ['TDS', 'pH', 'Ca', 'Mg', 'turbidity', 'chlorine', 'hardness']:

            if key in result and pd.notna(result[key]):

                result[key] = float(result[key])

               

    logging.info(f"Successfully returned {len(results)} alerts.")

    return jsonify(results)



@app.route('/predict', methods=['GET'])

def get_forecast():

    """Endpoint to get the 7-day TDS forecast for a single specified area."""

    area = request.args.get('area')

    logging.info(f"Request received for /predict (area: {area})")



    if not area:

        return jsonify({"error": "Missing 'area' parameter."}), 400

       

    try:

        # Calls the newly implemented/fixed method: predict_area_trend

        prediction_result = MODELER.predict_area_trend(area, future_steps=7)

       

        return jsonify(prediction_result)

       

    except Exception as e:

        logging.error(f"Error in prediction for {area}: {e}", exc_info=True)

        return jsonify({"error": f"Failed to get prediction: {type(e).__name__}: {str(e)}"}), 500





if __name__ == '__main__':

    logging.info("Starting P2 ML API server on http://127.0.0.1:5001")

    # Start the Flask app

    app.run(debug=True, port=5001)