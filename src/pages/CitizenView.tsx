import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/supabaseClient';
import { Lightbulb, Droplet, Loader2, AlertTriangle, CheckCircle, FlaskConical, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// --- CONFIGURATION ---
const API_BASE_URL = 'http://127.0.0.1:5001'; 
const DEFAULT_DATA_SOURCE = 'Citizen_General_View'; // Hardcoded default, as the control is removed

// --- INTERFACES & Types ---

// The list of household chores the system can recommend for
const HOUSEHOLD_CHORES = [
    'Dishwashing (Machine)',
    'Laundry (Dark Clothes)',
    'Making Tea/Coffee',
    'Watering Plants',
];

interface RecommendationResult {
    optimal_tds_range: string;
    optimal_hardness_range: string;
    optimal_ph_range: string;
    conversion_advice: string;
    ideal_hardness_mg_l: number;
    // Added fields returned by backend
    current_hardness_mg_l?: number | null;
    target_hardness_mg_l?: number | null;
    needed_reduction_mg_l?: number | null;
    conversion_time_estimates?: Array<{
        device: string;
        can_reach_target: boolean;
        time_minutes?: number | null;
        time_h_m?: string | null;
        final_hardness_mg_l?: number | null;
        expected_final_hardness_mg_l?: number | null;
        notes?: string;
    }>;
}

interface ChoreRecommendationResponse {
    success: boolean;
    chore: string;
    volume_liters: number;
    data_source: string;
    recommendation: RecommendationResult;
}

// --- API Service ---

const fetchRecommendation = async (chore: string, volume: number, source: string, area?: string): Promise<ChoreRecommendationResponse> => {
    // The source parameter is included in the payload but is now hardcoded in the component state.
    const payload = {
        chore: chore,
        volume_liters: volume,
        data_source: source,
        area: area,
    };

    const response = await fetch(`${API_BASE_URL}/recommend_chore_water`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        // Handle non-2xx status codes (e.g., 400, 500)
        let errorMsg = `Server error: ${response.status} ${response.statusText}.`;
        try {
            const errorBody = await response.json();
            errorMsg = errorBody.error || errorMsg;
        } catch {}
        
        throw new Error(`Failed to fetch recommendation: ${errorMsg}`);
    }

    return response.json();
};

// Start a treatment job (background) and return a job id
const startTreatmentJob = async (area: string, device: string, volume_liters: number, flow_L_per_min?: number, removal_efficiency?: number) => {
    const payload: any = { area, device, volume_liters };
    if (flow_L_per_min) payload.flow_L_per_min = flow_L_per_min;
    if (removal_efficiency) payload.removal_efficiency = removal_efficiency;

    const resp = await fetch(`${API_BASE_URL}/start_treatment`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!resp.ok) throw new Error(`Start job failed: ${resp.status}`);
    return resp.json();
};

const getJobStatus = async (job_id: string) => {
    const resp = await fetch(`${API_BASE_URL}/job_status/${job_id}`);
    if (!resp.ok) throw new Error(`Job status fetch failed: ${resp.status}`);
    return resp.json();
};

// Fetch list of monitored areas from backend and set default area
const fetchMonitoredAreas = async (setAreas: (a: string[]) => void, setArea: (s: string) => void, currArea?: string) => {
    // Try multiple fallbacks so the dropdown is populated even if one service is down
    const fallbacks = async () => {
        // 1) Ask P2 root endpoint
        try {
            const resp = await fetch(`${API_BASE_URL}/`);
            if (resp.ok) {
                const json = await resp.json();
                let monitored: any = json.monitored_areas ?? json.areas ?? json;
                // normalize if server returned a comma-separated string
                if (typeof monitored === 'string') monitored = monitored.split(',').map((s: string) => s.trim()).filter(Boolean);
                if (Array.isArray(monitored) && monitored.length > 0) return monitored;
            }
        } catch (e) {
            // ignore and try next
        }

        // 2) Try P1 get_areas
        try {
            const resp = await fetch('http://127.0.0.1:5000/get_areas');
            if (resp.ok) {
                let json = await resp.json();
                let monitored = json.areas ?? json;
                if (typeof monitored === 'string') monitored = monitored.split(',').map((s: string) => s.trim()).filter(Boolean);
                if (Array.isArray(monitored) && monitored.length > 0) return monitored;
            }
        } catch (e) {}

        // 3) Fallback hardcoded list (matching water_modeler default)
        return ['MG Road', 'Jayanagar', 'HSR Layout', 'Whitefield', 'Sarjapur', 'Electronics City'];
    };

    try {
        const monitored = await fallbacks();
        // Deduplicate and trim
        const normalized = Array.from(new Set(monitored.map((s: any) => String(s).trim())));
        setAreas(normalized);
        // Only set default area if user hasn't already selected one
        if ((!currArea || currArea === '') && normalized.length > 0) setArea(normalized[0]);
    } catch (e) {
        console.warn('Could not determine monitored areas', e);
    }
};

// --- Component: CitizenView ---

const CitizenView: React.FC = () => {
    // --- State Management ---
    const [chore, setChore] = useState<string>(HOUSEHOLD_CHORES[0]);
    const [volume, setVolume] = useState<number>(10);
    const [areas, setAreas] = useState<string[]>([]);
    const [area, setArea] = useState<string>('');
    // Data source is now fixed/internal, but kept in state for API payload dependency
    const [dataSource] = useState<string>(DEFAULT_DATA_SOURCE); 
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<RecommendationResult | null>(null);
    const { toast } = useToast();

    // --- Recommendation Fetching Logic ---
    useEffect(() => {
        // Load available areas on mount; pass current `area` so we don't overwrite a user selection
        fetchMonitoredAreas(setAreas, setArea, area);
    }, []);

    const handleGetRecommendation = useCallback(async () => {
        setError(null);
        setResult(null);

        // Basic validation
        if (!chore || volume <= 0) {
            setError("Please select a chore and enter a valid water volume.");
            return;
        }
        
        setLoading(true);

        try {
            // Note: dataSource is passed but is fixed at the default value
            const apiResponse = await fetchRecommendation(chore, volume, dataSource, area);
            
            if (apiResponse.success) {
                setResult(apiResponse.recommendation);
                // Log this action into user_history for the signed-in user (best-effort)
                (async () => {
                    try {
                        const { data: { session } } = await supabase.auth.getSession();
                        const uid = session?.user?.id ?? null;
                        if (uid) {
                            await supabase.from('user_history').insert([
                                {
                                    user_id: uid,
                                    action: 'recommendation',
                                    payload: apiResponse,
                                    area: area || null
                                }
                            ]);
                        }
                    } catch (e) {
                        // don't block UI if logging fails
                        console.warn('Failed to log user history (recommendation):', e);
                    }
                })();
            } else {
                // Handle success=false if the API supports it
                setError("Recommendation failed due to internal logic.");
            }
        } catch (err: any) {
            console.error("Fetch Error:", err);
            // Provide a clear hint for the user based on the common failure mode
            setError(err.message || 'Error fetching recommendation. Check if the backend server (Port 5001) is running and the /recommend_chore_water route is correct.');
        } finally {
            setLoading(false);
        }
    }, [chore, volume, dataSource, area]); // include `area` so the latest selection is sent

    // --- Utility Component: Stat Card ---
    const StatCard = ({ icon, title, value, colorClass }: { icon: React.ReactNode, title: string, value: string, colorClass: string }) => (
        <div className={`p-4 rounded-xl shadow-lg border-t-4 ${colorClass} bg-white transition hover:shadow-xl`}>
            <div className={`text-xl font-bold ${colorClass.replace('border-', 'text-')}`}>{icon}</div>
            <p className="text-sm font-medium text-gray-500 mt-1">{title}</p>
            <p className="text-2xl font-extrabold text-gray-800 mt-1">{value}</p>
        </div>
    );
    
    return (
        <div className="min-h-screen bg-gray-50 p-4 sm:p-8 font-sans">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <header className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-indigo-700 flex items-center justify-center space-x-3">
                        <Droplet className="w-8 h-8" />
                        <span>Smart Water Advisor</span>
                    </h1>
                    <p className="text-gray-500 mt-2">
                        Get optimal water quality recommendations for your household tasks.
                    </p>
                </header>

                {/* Input Parameters Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 mb-10 border-t-8 border-indigo-500">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center space-x-2">
                        <Lightbulb className="w-5 h-5 text-indigo-500" />
                        <span>Input Parameters</span>
                    </h2>
                    
                    {/* Updated grid to 2 columns instead of 3 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        {/* Area Selector */}
                        <div>
                            <label htmlFor="area" className="block text-sm font-medium text-gray-700 mb-1">Area</label>
                            <select
                                id="area"
                                value={area}
                                onChange={(e) => setArea(e.target.value)}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-gray-50 border"
                            >
                                {areas.length === 0 ? (
                                    <option key="_none" value="">Select area</option>
                                ) : (
                                    areas.map(a => <option key={a} value={a}>{a}</option>)
                                )}
                            </select>
                        </div>

                        {/* Household Chore Selection */}
                        <div>
                            <label htmlFor="chore" className="block text-sm font-medium text-gray-700 mb-1">Household Chore</label>
                            <select
                                id="chore"
                                value={chore}
                                onChange={(e) => setChore(e.target.value)}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-gray-50 border"
                            >
                                {HOUSEHOLD_CHORES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        {/* Water Volume Input */}
                        <div>
                            <label htmlFor="volume" className="block text-sm font-medium text-gray-700 mb-1">Water Volume (Liters)</label>
                            <input
                                id="volume"
                                type="number"
                                value={volume}
                                min="1"
                                onChange={(e) => setVolume(Number(e.target.value))}
                                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2.5 bg-gray-50 border"
                                placeholder="e.g., 10"
                            />
                        </div>
                        
                        {/* Water Data Source input removed as requested */}
                        
                    </div>

                    {/* Submit Button */}
                    <button
                        onClick={handleGetRecommendation}
                        disabled={loading}
                        className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl shadow-md text-white bg-indigo-600 hover:bg-indigo-700 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.01]"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        ) : (
                            <CheckCircle className="h-5 w-5 mr-2" />
                        )}
                        {loading ? 'Getting Recommendation...' : 'Get Recommendation'}
                    </button>
                </div>

                {/* Status/Error Message */}
                {error && (
                    <div className="p-4 mb-6 bg-red-100 border-l-4 border-red-500 text-red-700 rounded-lg shadow-md flex items-center space-x-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                        <p className="font-medium">System Error: {error}</p>
                    </div>
                )}
                
                {/* Results Display */}
                {result && (
                    <div className="bg-white rounded-2xl shadow-2xl p-6 md:p-8 border-t-8 border-green-500 animate-fadeIn">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                            <FlaskConical className="w-6 h-6 text-green-600" />
                            <span>Optimal Water Parameters for {chore} ({volume}L)</span>
                        </h2>

                        {/* Parameter Stat Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                            <StatCard 
                                icon={<Droplet />} 
                                title="Optimal Hardness" 
                                value={result.optimal_hardness_range} 
                                colorClass="border-cyan-500" 
                            />
                            <StatCard 
                                icon={<Droplet />} 
                                title="Optimal TDS" 
                                value={result.optimal_tds_range} 
                                colorClass="border-orange-500" 
                            />
                            <StatCard 
                                icon={<Droplet />} 
                                title="Optimal pH" 
                                value={result.optimal_ph_range} 
                                colorClass="border-fuchsia-500" 
                            />
                        </div>

                        {/* Conversion and Advice */}
                        <div className="p-6 bg-gray-50 rounded-xl border border-gray-200">
                            <h3 className="text-xl font-semibold text-gray-800 mb-3 flex items-center space-x-2">
                                <Wrench className="w-5 h-5 text-gray-600" />
                                <span>Water Conversion Advice</span>
                            </h3>
                            <p className="text-gray-700 leading-relaxed">
                                {result.conversion_advice}
                            </p>
                            {/* Conversion time estimates */}
                            {result.conversion_time_estimates && result.conversion_time_estimates.length > 0 && (
                                <div className="mt-4">
                                    <h4 className="font-semibold text-gray-800 mb-2">Estimated Conversion Times</h4>
                                    <ul className="space-y-2">
                                        {result.conversion_time_estimates.map((est, idx) => (
                                            <li key={idx} className="p-3 bg-white rounded-lg border shadow-sm">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-sm font-medium text-gray-700">{est.device}</p>
                                                        <p className="text-xs text-gray-500">{est.notes}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        {est.can_reach_target ? (
                                                            <p className="text-green-600 font-semibold">Approximately {est.time_h_m ?? (est.time_minutes ? `${Math.floor((est.time_minutes||0) / 60)} h ${Math.round((est.time_minutes||0) % 60)} m` : `${est.time_minutes} minutes`)}</p>
                                                        ) : (
                                                            <p className="text-yellow-700 font-medium">Single-pass won't reach target. Expected: {est.expected_final_hardness_mg_l ?? est.final_hardness_mg_l} mg/L — {est.time_h_m ?? (est.time_minutes ? `${Math.floor((est.time_minutes||0) / 60)} h ${Math.round((est.time_minutes||0) % 60)} m` : (est.time_minutes ? `${est.time_minutes} minutes` : 'N/A'))}</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex justify-end">
                                                    <button
                                                        onClick={async () => {
                                                            try {
                                                                toast({ title: 'Starting treatment...', description: `Device: ${est.device}`, });
                                                                const jobResp = await startTreatmentJob(area || areas[0], est.device, volume, undefined, undefined);
                                                                const jobId = jobResp.job_id;

                                                                    // Log start_treatment action for user
                                                                    (async () => {
                                                                        try {
                                                                            const { data: { session } } = await supabase.auth.getSession();
                                                                            const uid = session?.user?.id ?? null;
                                                                            if (uid) {
                                                                                await supabase.from('user_history').insert([
                                                                                    {
                                                                                        user_id: uid,
                                                                                        action: 'start_treatment',
                                                                                        payload: jobResp,
                                                                                        area: area || areas[0]
                                                                                    }
                                                                                ]);
                                                                            }
                                                                        } catch (e) {
                                                                            console.warn('Failed to log user history (start_treatment):', e);
                                                                        }
                                                                    })();

                                                                // Poll status
                                                                const poll = async () => {
                                                                    try {
                                                                        const s = await getJobStatus(jobId);
                                                                        if (s.status === 'completed') {
                                                                            toast({ title: 'Treatment complete', description: `Final hardness: ${s.result?.final_hardness_mg_l ?? 'N/A'} mg/L`, });
                                                                                // Log treatment_completed for the user
                                                                                (async () => {
                                                                                    try {
                                                                                        const { data: { session } } = await supabase.auth.getSession();
                                                                                        const uid = session?.user?.id ?? null;
                                                                                        if (uid) {
                                                                                            await supabase.from('user_history').insert([
                                                                                                {
                                                                                                    user_id: uid,
                                                                                                    action: 'treatment_completed',
                                                                                                    payload: s,
                                                                                                    area: area || areas[0]
                                                                                                }
                                                                                            ]);
                                                                                        }
                                                                                    } catch (e) {
                                                                                        console.warn('Failed to log user history (treatment_completed):', e);
                                                                                    }
                                                                                })();
                                                                                return;
                                                                        }
                                                                        if (s.status === 'failed') {
                                                                            toast({ title: 'Treatment failed', description: s.error || 'Unknown error', variant: 'destructive' });
                                                                            return;
                                                                        }
                                                                        // otherwise continue polling
                                                                        setTimeout(poll, 2000);
                                                                    } catch (e: any) {
                                                                        toast({ title: 'Error polling job', description: e.message || String(e), variant: 'destructive' });
                                                                    }
                                                                };
                                                                setTimeout(poll, 1000);
                                                            } catch (e: any) {
                                                                toast({ title: 'Failed to start treatment', description: e.message || String(e), variant: 'destructive' });
                                                            }
                                                        }}
                                                        className="ml-3 px-3 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                                                    >Start Treatment</button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            <p className="text-xs text-gray-500 mt-3">
                                *Advice based on general water quality models and is not a substitute for professional analysis.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CitizenView;