import React, { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Gauge, TrendingUp, AlertTriangle, Droplet, MapPin, Loader2, RefreshCw, XCircle } from 'lucide-react'; 

// --- CONFIGURATION ---
// The Flask API is configured to run on port 5001
const API_BASE_URL = 'http://127.0.0.1:5001'; 

// --- INTERFACES & API SERVICE (Self-contained for single-file deployment) ---

/** Data structure for the /alerts endpoint */
interface WaterQualityData {
  area: string;
  TDS: number;
  pH: number;
  Ca: number;
  Mg: number;
  turbidity: number;
  chlorine: number;
  hardness: number;
  // This field MUST be named 'status' in the API response (ml_api.py)
  status: 'Soft' | 'Moderately Hard' | 'Hard' | 'Very Hard' | string; 
  alert_message: string;
  timestamp: string;
  // Provided by P2: indicates whether P1 had history for this area
  history_source?: 'real' | 'mock' | 'unknown' | string;
}

/** Data structure for a single prediction point in the /predict endpoint */
interface RawPrediction {
  date: string;
  predicted_tds: number;
}

/** Data structure for the /predict endpoint response */
interface ForecastResult {
  area: string;
  predictions: RawPrediction[];
  model_used: string;
  // This field MUST be named 'trend_message' in the API response (ml_api.py)
  trend_message: string; 
  // source: 'real' when based on P1 history, 'mock' when generated locally
  source?: 'real' | 'mock' | string;
}

// API Service Implementation
const fetchAllAreaStatuses = async (): Promise<WaterQualityData[]> => {
  const response = await fetch(`${API_BASE_URL}/alerts`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown API error' }));
    throw new Error(`Failed to fetch area status: ${response.status} - ${errorBody.error || 'Server error'}`);
  }
  return response.json();
};

const fetchForecast = async (area: string): Promise<ForecastResult> => {
  const response = await fetch(`${API_BASE_URL}/predict?area=${encodeURIComponent(area)}`);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown API error' }));
    throw new Error(`Failed to fetch forecast for ${area}: ${response.status} - ${errorBody.error || 'Server error'}`);
  }
  return response.json();
};

// Lightweight check for P1 availability and history presence for an area
const fetchP1Check = async (area: string): Promise<{p1_available: boolean; history_present: boolean; error?: string}> => {
  const response = await fetch(`${API_BASE_URL}/check_p1?area=${encodeURIComponent(area)}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `P2 check failed: ${response.status}`);
  }
  return response.json();
};

// --- END INTERFACES & API SERVICE ---


// Utility component for displaying a colored chip based on hardness class
const StatusChip: React.FC<{ status: WaterQualityData['status'] }> = ({ status }) => {
  let colorClass = 'bg-gray-200 text-gray-700';
  switch (status) {
    case 'Soft':
      colorClass = 'bg-green-100 text-green-700';
      break;
    case 'Moderately Hard':
      colorClass = 'bg-yellow-100 text-yellow-700';
      break;
    case 'Hard':
      colorClass = 'bg-orange-100 text-orange-700';
      break;
    case 'Very Hard':
      colorClass = 'bg-red-100 text-red-700';
      break;
  }

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${colorClass}`}>
      {status}
    </span>
  );
};

// --- Generic Modal Wrapper ---
const ModalBase: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => (
  <div className="fixed inset-0 bg-gray-900 bg-opacity-75 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transform transition-all">
      <button 
        onClick={onClose} 
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition"
        aria-label="Close modal"
      >
        <XCircle className="h-6 w-6" />
      </button>
      {children}
    </div>
  </div>
);


// --- Prediction Modal Component ---
interface PredictionModalProps {
  area: string;
  onClose: () => void;
}

const PredictionModal: React.FC<PredictionModalProps> = ({ area, onClose }) => {
  const [forecast, setForecast] = useState<ForecastResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [p1Check, setP1Check] = useState<{p1_available: boolean; history_present: boolean; error?: string} | null>(null);

  useEffect(() => {
    const loadForecast = async () => {
      try {
        const result = await fetchForecast(area);
        
        // Transform data for recharts
        const chartData = result.predictions.map(p => ({
          date: new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          'Predicted TDS (mg/L)': Math.round(p.predicted_tds),
        }));
        setForecast({ ...result, predictions: chartData as any }); 
      } catch (err: any) {
        setError(err.message || 'Failed to fetch prediction data.');
      } finally {
        setLoading(false);
      }
    };
    loadForecast();
  }, [area]);

  const handleCheckP1 = useCallback(async () => {
    setP1Check(null);
    try {
      const r = await fetchP1Check(area);
      setP1Check(r);
    } catch (e: any) {
      setP1Check({ p1_available: false, history_present: false, error: e.message || String(e) });
    }
  }, [area]);

  if (loading) {
    return (
      <ModalBase onClose={onClose}>
        <div className="flex items-center justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-cyan-500 mr-2" /> Loading Forecast...</div>
      </ModalBase>
    );
  }

  return (
    <ModalBase onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-2xl font-bold text-gray-900 flex items-center">
            <TrendingUp className="h-6 w-6 text-cyan-600 mr-2" />
            <span>7-Day TDS Forecast for {area}</span>
          </h3>
          {forecast?.source && (
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${forecast.source === 'real' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {forecast.source === 'real' ? 'Based on real history' : 'Mock-generated prediction'}
            </span>
          )}
        </div>
            {error ? (
          <div className="text-red-600 bg-red-50 p-3 rounded-lg mt-4">{error}</div>
        ) : forecast ? (
          <>
            {/* Using the correct API field: forecast.trend_message */}
            <p className="text-sm text-gray-600 mb-4">{forecast.trend_message}</p> 
            
            <div className="h-64 w-full bg-white p-4 rounded-lg shadow-inner border border-gray-100">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={forecast.predictions}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" stroke="#6b7280" />
                        <YAxis stroke="#6b7280" domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #ccc' }} />
                        <Legend />
                        <Line type="monotone" dataKey="Predicted TDS (mg/L)" stroke="#06b6d4" strokeWidth={2} dot={true} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="mt-4">
                <h4 className="font-semibold text-gray-700 mb-2">Detailed Predictions:</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                    {forecast.predictions.map((p, index) => (
                        <div key={index} className="bg-gray-50 p-2 rounded-md border border-gray-200">
                            <span className="font-medium">{p.date}:</span> {p['Predicted TDS (mg/L)']} mg/L
                        </div>
                    ))}
                </div>
                <div className="mt-3 flex items-center space-x-3">
                  <button
                    onClick={handleCheckP1}
                    className="inline-flex items-center px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                  >Check Data Source</button>
                  {p1Check && (
                    <div className="text-sm text-gray-700 bg-gray-50 p-2 rounded-md border">
                      <div><strong>P1 Available:</strong> {String(p1Check.p1_available)}</div>
                      <div><strong>History Present:</strong> {String(p1Check.history_present)}</div>
                      {p1Check.error && <div className="text-xs text-red-600">{p1Check.error}</div>}
                    </div>
                  )}
                </div>
            </div>
          </>
        ) : null}
      </div>
    </ModalBase>
  );
};


// --- MAIN ADMIN DASHBOARD COMPONENT ---
const AdminDashboard: React.FC = () => {
  const [data, setData] = useState<WaterQualityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const latestQuality = await fetchAllAreaStatuses();
      setData(latestQuality);
    } catch (err: any) {
      console.error("Dashboard Data Fetch Error:", err);
      // The message below is what the user saw in the images. It correctly reports the backend crash.
      setError(err.message || 'Failed to load dashboard data. Check P2 ML API server (Port 5001).');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // --- Data aggregation for the overall status bar chart ---
  const initialStatusCount = {
    'Soft': 0, 'Moderately Hard': 0, 'Hard': 0, 'Very Hard': 0, 'Unknown': 0
  };
  const statusCounts = data.reduce((acc, item) => {
    // Correctly accessing the 'status' field from the API response
    acc[item.status as WaterQualityData['status']] = (acc[item.status as WaterQualityData['status']] || 0) + 1;
    return acc;
  }, initialStatusCount as Record<WaterQualityData['status'], number>);

  const chartData = Object.keys(statusCounts).map(key => ({
    name: key,
    'Total Areas': statusCounts[key as WaterQualityData['status']],
    fill: key === 'Soft' ? '#10b981' : key === 'Moderately Hard' ? '#f59e0b' : key === 'Hard' ? '#f97316' : key === 'Very Hard' ? '#ef4444' : '#9ca3af'
  }));
  const relevantChartData = chartData.filter(d => d['Total Areas'] > 0);

  // --- Rendering Functions ---
  const getAlertIcon = (status: WaterQualityData['status']) => {
    if (status === 'Very Hard') return <AlertTriangle className="h-5 w-5 text-red-500" />;
    if (status === 'Hard') return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    return <Droplet className="h-5 w-5 text-cyan-500" />;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex justify-between items-center">
          <h1 className="text-3xl font-extrabold text-gray-900 flex items-center space-x-3">
            <Gauge className="w-7 h-7 text-cyan-600" />
            <span>Water Monitoring Dashboard</span>
          </h1>
          <button 
            onClick={loadDashboardData}
            disabled={loading}
            className="flex items-center px-4 py-2 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh Data
          </button>
        </header>

        {error && (
          <div className="p-4 mb-6 bg-red-100 border border-red-400 text-red-700 rounded-xl flex items-center space-x-2 shadow-md">
            <AlertTriangle className="w-5 h-5" /> 
            <p className="font-medium">Connection Error: {error}</p>
          </div>
        )}

        {loading && !data.length ? (
          <div className="text-center p-16 text-lg text-gray-600">
            <Loader2 className="h-10 w-10 mx-auto animate-spin text-cyan-500 mb-4" />
            Loading real-time status and classifications...
          </div>
        ) : (
          <div className="space-y-8">
            {/* Hardness Status Chart (Overall View) */}
            <div className="bg-white rounded-xl shadow-2xl p-6 border-t-4 border-cyan-500">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Overall Water Hardness Status (Area Count)</h2>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={relevantChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" stroke="#6b7280" />
                    <YAxis allowDecimals={false} stroke="#6b7280" />
                    <Tooltip cursor={{ fill: 'rgba(6, 182, 212, 0.1)' }} contentStyle={{ borderRadius: '8px', border: '1px solid #ccc' }} />
                    <Legend />
                    {relevantChartData.map((entry, index) => (
                        <Bar key={`bar-${index}`} dataKey="Total Areas" fill={entry.fill} name={entry.name} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Individual Area Status Table */}
            <div className="bg-white rounded-xl shadow-2xl p-6 border-t-4 border-cyan-500">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Area Monitoring Details</h2>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Area</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Classification</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hardness (mg/L)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current TDS (mg/L)</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.map((item) => (
                      <tr key={item.area} className="hover:bg-gray-50 transition duration-150">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-red-400" />
                          <div className="flex items-center space-x-2">
                            <span>{item.area}</span>
                            {item.history_source && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${item.history_source === 'real' ? 'bg-green-100 text-green-800' : item.history_source === 'mock' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-700'}`}>
                                {item.history_source === 'real' ? 'Real history' : item.history_source === 'mock' ? 'Mock' : 'Unknown'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <StatusChip status={item.status} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="flex items-center">
                            {getAlertIcon(item.status)}
                            <span className="ml-2 font-semibold text-gray-700">{item.hardness.toFixed(2)}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {item.TDS.toFixed(0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                          <button
                            onClick={() => setSelectedArea(item.area)}
                            className="text-cyan-600 hover:text-cyan-900 font-semibold transition duration-150 p-2 rounded-lg bg-cyan-50 hover:bg-cyan-100"
                          >
                            View 7-Day Prediction
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Prediction Modal */}
      {selectedArea && (
        <PredictionModal
          area={selectedArea}
          onClose={() => setSelectedArea(null)}
        />
      )}
    </div>
  );
};

export default AdminDashboard;