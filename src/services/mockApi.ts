import { WaterQualityData, AreaStatus,Forecast } from "@/types/waterQuality";

// Mock data for Bengaluru areas
const BENGALURU_AREAS = [
  "Indiranagar",
  "Koramangala",
  "Whitefield",
  "Jayanagar",
  "Malleshwaram",
  "Marathahalli",
  "Electronic City",
  "HSR Layout",
];

// Generate mock water quality data
const generateWaterQualityData = (area: string): WaterQualityData => {
  const baseHardness = Math.random() * 350;
  // FIX: Changed 'calcium' to 'Ca' and 'magnesium' to 'Mg' to match WaterQualityData type (Error 2353)
  const Ca = baseHardness / 2.5;
  const Mg = baseHardness / 4.1;

  return {
    area,
    timestamp: new Date().toISOString(),
    // Assuming pH is correctly capitalized in the type
    pH: 6.5 + Math.random() * 2,
    // Assuming TDS is correctly capitalized in the type
    TDS: 300 + Math.random() * 700,
    Ca, // FIX: Used 'Ca'
    Mg, // FIX: Used 'Mg'
    hardness: baseHardness,
    turbidity: Math.random() * 5,
    chlorine: 0.2 + Math.random() * 0.8,
  };
};

// Calculate hardness status (this is still used internally)
const getHardnessStatus = (hardness: number): AreaStatus["status"] => {
  if (hardness < 75) return "Soft";
  if (hardness < 150) return "Moderately Hard";
  if (hardness < 300) return "Hard";
  return "Very Hard";
};

// Generate a single alert message for AreaStatus
// FIX: Replaced generateAlerts function which used the undefined 'Alert' type (Error 2304)
const getAlertMessage = (data: WaterQualityData): string => {
  if (data.TDS > 1000) {
    return "Critical: TDS levels exceed safe limits. Water purification recommended.";
  }
  if (data.TDS > 800) {
    return "Warning: TDS levels are elevated. Monitor water quality.";
  }
  if (data.hardness > 300) {
    return "Warning: Water hardness is very high. Consider using a softener.";
  }
  if (data.pH < 6.5 || data.pH > 8.5) {
    return "Warning: pH levels outside optimal range.";
  }
  return "All water quality parameters within safe limits.";
};

// Mock API functions
export const mockApi = {
  // Get current status for all areas
  getAllAreasStatus: async (): Promise<AreaStatus[]> => {
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate network delay

    // FIX: Updated the returned object to match the AreaStatus type (Error 2322)
    return BENGALURU_AREAS.map((area) => {
      const data = generateWaterQualityData(area);
      return {
        area,
        status: getHardnessStatus(data.hardness),
        TDS: data.TDS, // ADDED: Required by AreaStatus
        pH: data.pH, // ADDED: Required by AreaStatus
        alert_message: getAlertMessage(data), // ADDED: Required by AreaStatus
        // REMOVED: hardness, alerts, lastUpdated
      };
    });
  },

  // Get detailed data for a specific area
  getAreaData: async (area: string): Promise<WaterQualityData> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return generateWaterQualityData(area);
  },

  // Get historical data for an area
  getHistoricalData: async (area: string, days: number = 7): Promise<WaterQualityData[]> => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const data: WaterQualityData[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayData = generateWaterQualityData(area);
      dayData.timestamp = date.toISOString();
      data.push(dayData);
    }

    return data;
  },

  // Get forecast data
  getForecast: async (area: string): Promise<Forecast> => {
    await new Promise((resolve) => setTimeout(resolve, 400));

    const predictions = [];
    const now = new Date();

    for (let i = 1; i <= 7; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + i);
      predictions.push({
        date: date.toISOString().split("T")[0],
        TDS: 400 + Math.random() * 400, // FIX: Changed 'tds' to 'TDS'
        hardness: 150 + Math.random() * 200,
      });
    }

    return { area, predictions };
  },

  // Get all available areas
  getAreas: async (): Promise<string[]> => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return BENGALURU_AREAS;
  },
};

// Helper function to replace mock API with real API
export const createApiService = (baseUrl?: string) => {
  if (!baseUrl) {
    // Use mock API if no base URL provided
    return mockApi;
  }

  // Real API implementation (to be used when backend is ready)
  return {
    getAllAreasStatus: async (): Promise<AreaStatus[]> => {
      const response = await fetch(`${baseUrl}/alerts`);
      return response.json();
    },

    getAreaData: async (area: string): Promise<WaterQualityData> => {
      const response = await fetch(`${baseUrl}/data?area=${area}`);
      return response.json();
    },

    getHistoricalData: async (area: string, days: number = 7): Promise<WaterQualityData[]> => {
      const response = await fetch(`${baseUrl}/get_history?area=${area}&days=${days}`);
      return response.json();
    },

    getForecast: async (area: string): Promise<Forecast> => {
      const response = await fetch(`${baseUrl}/predict?area=${area}`);
      return response.json();
    },

    getAreas: async (): Promise<string[]> => {
      const response = await fetch(`${baseUrl}/areas`);
      return response.json();
    },
  };
};