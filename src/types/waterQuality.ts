// src/types/waterQuality.ts

// Matches the structure of a single data record from Person 1's /get_history API
export interface WaterQualityData {
  timestamp: string; // e.g., "2025-09-28 10:00:00"
  area: string;      // e.g., "Whitefield"
  pH: number;
  TDS: number;
  Ca: number;
  Mg: number;
  turbidity: number;
  chlorine: number;
  hardness: number; // Calculated by the simulator/P1 API
}

// Matches the JSON payload from Person 2's /alerts API
// Used by Admin Dashboard (Table) and Citizen View (StatusBadge)
export interface AreaStatus {
  area: string;
  status: "Safe" | "Soft" | "Moderately Hard" | "Hard" | "Very Hard"; // 'Soft' added
  alert_message: string;
  // Optional additional metrics that may be included by mock or real APIs
  TDS?: number;
  pH?: number;
}

// Matches the JSON payload from Person 2's /predict API
// Used by Admin Dashboard (Forecast Chart)
export interface Forecast {
  area: string;
  predictions: {
    date: string; // Forecast date
    hardness: number;
    tds: number;
  }[];
}

// ----------------------------------------------------------------
// --- Types for Analyzer Page (Person 1 Input to Person 2 ML Output) ---
// ----------------------------------------------------------------

// Type for the Analyzer Page form input state (kept as strings for easy form handling)
export interface AnalysisInput {
  area: string;
  TDS: string;
  pH: string;
  Ca: string;
  Mg: string;
  turbidity: string;
  chlorine: string;
}

// Type for the numerical payload sent to the ML API
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
 * Type for the full analysis result from Person 2's ML API (POST /analyze_sample).
 * It includes all input fields plus the ML model's output metrics.
 */
export interface AnalysisResult extends ManualAnalysisPayload {
  // Input fields (inherited from ManualAnalysisPayload)
  
  // ML Calculated fields (Used in AnalyzerPage for display)
  calculated_hardness: number; 
  status: "Safe" | "Soft" | "Moderately Hard" | "Hard" | "Very Hard"; 
  alert_message: string;
  recommended_action: string;
}