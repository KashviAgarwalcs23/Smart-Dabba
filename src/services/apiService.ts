// Configuration
const P1_API_URL = 'http://localhost:5000'; 
const P2_ML_API_URL = 'http://localhost:5001'; // P2 ML API runs on 5001

// --- P1 DATA TYPES (Used by Citizen/Admin Views) ---
export interface WaterQualityData {
  area: string;
  timestamp: string;
  TDS: number;
  pH: number;
  Ca: number;
  Mg: number;
  turbidity: number;
  chlorine: number;
  // P2 Calculated fields:
  hardness: number; // total_hardness_ca_co3
  hardness_class: 'Soft' | 'Moderately Hard' | 'Hard' | 'Very Hard' | 'Unknown';
}

// Prediction result structure
export interface ForecastResult {
    area: string;
    trend_summary: string;
    predictions: { date: string; predicted_tds: number; }[];
}

// --- P2 ANALYZER DATA TYPES (COMPREHENSIVE) ---
// Type for the full payload sent from the frontend to the ML API for a manual sample
export interface ManualAnalysisPayload {
  area: string;
  TDS: number;
  pH: number;
  Ca: number;
  Mg: number;
  turbidity: number;
  chlorine: number;
}

/**
 * FIX: AnalysisResult is now a richer type that includes all input fields 
 * plus the ML model's complete output metrics.
 */
export interface AnalysisResult extends ManualAnalysisPayload {
  // Input fields (inherited from ManualAnalysisPayload)
  
  // ML Calculated fields (Used in AnalyzerPage for display)
  calculated_hardness: number; // Used in frontend to display the calculated value
  status: "Safe" | "Soft" | "Moderately Hard" | "Hard" | "Very Hard"; 
  alert_message: string;
  recommended_action: string;
}

// --- P2 API FUNCTIONS (For Admin/Citizen Views) ---

/** Fetches latest data, classification, and alerts for all areas from P2's /alerts endpoint. */
export async function fetchAllAreaStatuses(): Promise<WaterQualityData[]> {
  const response = await fetch(`${P2_ML_API_URL}/alerts`);
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`P2 API Error (${response.status}): Failed to fetch latest quality data. Response: ${errorText.substring(0, 100)}...`);
  }
  
  const rawData: any = await response.json();

  if (!Array.isArray(rawData)) {
      console.error('P2 API /alerts did not return an array. Received:', rawData);
      if (rawData && typeof rawData === 'object' && rawData.error) {
          throw new Error(`P2 ML API returned an error object: ${rawData.error}`);
      }
      return []; 
  }

  // Map the raw data keys from P2's ml_api.py output to WaterQualityData interface
  return rawData.map((item: any) => {
    // Support multiple possible field names returned by different backends
    const area = item.area || item.name || "Unknown";
    const timestamp = item.timestamp || item.time || new Date().toISOString();
    const TDS = Number(item.current_tds ?? item.TDS ?? item.tds ?? item.tds_current ?? 0);
    const pH = Number(item.current_ph ?? item.pH ?? item.ph ?? 0);
    const Ca = Number(item.Ca ?? item.calcium ?? 0);
    const Mg = Number(item.Mg ?? item.magnesium ?? 0);
    const turbidity = Number(item.turbidity ?? item.Turbidity ?? 0);
    const chlorine = Number(item.chlorine ?? item.Chlorine ?? 0);
    const hardness = Number(item.total_hardness ?? item.hardness ?? 0);
    const hardness_class = item.hardness_class ?? item.hardnessClass ?? 'Unknown';

    return {
      area,
      timestamp,
      TDS,
      pH,
      Ca,
      Mg,
      turbidity,
      chlorine,
      hardness,
      hardness_class,
    } as WaterQualityData;
  });
}

/** Fetches the 7-day TDS trend prediction for a specific area from P2's /predict endpoint. */
export async function fetchForecast(area: string): Promise<ForecastResult> {
    const response = await fetch(`${P2_ML_API_URL}/predict?area=${area}`);

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({error: 'Unknown error'}));
        throw new Error(errorData.error || `Failed to fetch forecast. Status: ${response.status}.`);
    }

    return response.json();
}

/** Fetches historical data for a specific area from P1's API. */
export async function fetchHistoricalData(area: string): Promise<WaterQualityData[]> {
  const response = await fetch(`${P1_API_URL}/get_history?area=${area}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch historical data for ${area} from P1 API.`);
  }
  const json = await response.json().catch(() => null);
  const historyArray: any[] = Array.isArray(json) ? json : (json && Array.isArray(json.data) ? json.data : []);

  return historyArray.map(d => ({
    area: d.area ?? area,
    timestamp: d.timestamp ?? d.time ?? new Date().toISOString(),
    TDS: Number(d.TDS ?? d.tds ?? d.current_tds ?? 0),
    pH: Number(d.pH ?? d.ph ?? 0),
    Ca: Number(d.Ca ?? d.calcium ?? 0),
    Mg: Number(d.Mg ?? d.magnesium ?? 0),
    turbidity: Number(d.turbidity ?? 0),
    chlorine: Number(d.chlorine ?? 0),
    // Note: Use available hardness fields or fallback
    hardness: Number(d.hardness ?? d.total_hardness ?? 150),
    hardness_class: 'Unknown',
  } as WaterQualityData));
}


// --- P2 API FUNCTIONS (For Analyzer View) ---

/** * FIX: Function signature corrected to accept a single, complete payload object.
 * This resolves the "Expected 2 arguments, but got 1" error in AnalyzerPage.tsx.
 */
export async function analyzeManualSample(payload: ManualAnalysisPayload): Promise<AnalysisResult> {
  // Assuming the ML API has a comprehensive endpoint like /analyze_sample
  const url = `${P2_ML_API_URL}/analyze_sample`; 
  
  // Add timestamp here for consistency if the ML service expects it for logging
  const fullPayload = {
    ...payload,
    timestamp: new Date().toISOString(), 
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // FIX: Send the complete payload object directly
    body: JSON.stringify(fullPayload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({error: 'Unknown error'}));
    throw new Error(errorData.error || `Failed to analyze sample. Status: ${response.status}.`);
  }

  return response.json();
}