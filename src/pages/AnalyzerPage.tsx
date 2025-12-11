import { useState, FormEvent } from "react";
import { Beaker, Search, Droplets, Info, AlertTriangle, ShieldCheck, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/StatusBadge"; // Assumed path
import { AnalysisInput, AnalysisResult, ManualAnalysisPayload } from "@/types/waterQuality"; 
import { analyzeManualSample } from "@/services/apiService"; 

// --- Configuration ---
const MOCK_AREAS = ["Whitefield", "Jayanagar", "Sarjapur", "MG Road", "Electronics City", "HSR Layout"];
const defaultInput: AnalysisInput = {
    area: MOCK_AREAS[0], // Whitefield borewell area for a good test
    TDS: "450", 
    pH: "7.5",
    Ca: "50",
    Mg: "30",
    turbidity: "1.5",
    chlorine: "0.2",
};
// --- End Configuration ---

const AnalyzerPage = () => {
    const [input, setInput] = useState<AnalysisInput>(defaultInput);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        setInput(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setResult(null);

        // Prepare payload by converting string inputs to numbers
        const payload: ManualAnalysisPayload = {
            area: input.area,
            TDS: parseFloat(input.TDS),
            pH: parseFloat(input.pH),
            Ca: parseFloat(input.Ca),
            Mg: parseFloat(input.Mg),
            turbidity: parseFloat(input.turbidity),
            chlorine: parseFloat(input.chlorine),
        };

        try {
            // FIX: Ensure the API service function is updated to accept the full payload
            const data = await analyzeManualSample(payload);
            
            setResult(data);
            toast({
                title: "✅ Analysis Complete",
                description: `Water sample classified as ${data.status}.`,
            });
        } catch (error) {
            console.error("Analysis Error:", error);
            toast({
                title: "❌ Analysis Failed",
                description: error instanceof Error ? error.message : "An unknown error occurred during analysis.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex justify-center min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
            <div className={`w-full max-w-6xl ${result ? 'lg:grid lg:grid-cols-2 lg:items-start gap-12' : 'max-w-2xl'}`}>

                {/* Input Form Card */}
                <Card className="w-full shadow-2xl border-2 border-cyan-100 dark:border-cyan-900 animate-fade-in">
                    <CardHeader className="bg-cyan-50 dark:bg-cyan-950/50 p-6 border-b">
                        <CardTitle className="text-3xl font-extrabold flex items-center text-cyan-700 dark:text-cyan-400">
                            <Zap className="w-7 h-7 mr-3 fill-cyan-400 text-cyan-700 dark:text-cyan-200" />
                            Smart Dabba Analyzer
                        </CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Enter parameters to classify the water and get instant, AI-powered recommendations.
                        </p>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                            
                                {/* Area Selector (Full Width for better display) */}
                                <div className="space-y-2 col-span-full">
                                    <Label htmlFor="area" className="text-base font-semibold text-gray-700 dark:text-gray-300">Monitored Area</Label>
                                    <select 
                                        id="area" 
                                        value={input.area} 
                                        onChange={handleChange} 
                                        required 
                                        className="flex h-10 w-full rounded-lg border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 px-3 py-2 text-base text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {MOCK_AREAS.map(area => (
                                            <option key={area} value={area}>{area}</option>
                                        ))}
                                    </select>
                                </div>

                                <Separator className="col-span-full mt-2 mb-2"/>
                                
                                {/* Core Parameters */}
                                <div className="space-y-2">
                                    <Label htmlFor="TDS">TDS (Total Dissolved Solids) <span className="text-sm font-normal text-muted-foreground">(mg/L)</span></Label>
                                    <Input id="TDS" type="number" step="1" value={input.TDS} onChange={handleChange} required className="text-base" />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="pH">pH Level</Label>
                                    <Input id="pH" type="number" step="0.1" value={input.pH} onChange={handleChange} required className="text-base" />
                                </div>
                                
                                {/* Hardness & Contaminant */}
                                <div className="space-y-2">
                                    <Label htmlFor="Ca">Calcium (Ca) <span className="text-sm font-normal text-muted-foreground">(mg/L)</span></Label>
                                    <Input id="Ca" type="number" step="0.1" value={input.Ca} onChange={handleChange} required className="text-base" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="Mg">Magnesium (Mg) <span className="text-sm font-normal text-muted-foreground">(mg/L)</span></Label>
                                    <Input id="Mg" type="number" step="0.1" value={input.Mg} onChange={handleChange} required className="text-base" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="turbidity">Turbidity <span className="text-sm font-normal text-muted-foreground">(NTU)</span></Label>
                                    <Input id="turbidity" type="number" step="0.1" value={input.turbidity} onChange={handleChange} required className="text-base" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="chlorine">Chlorine <span className="text-sm font-normal text-muted-foreground">(mg/L)</span></Label>
                                    <Input id="chlorine" type="number" step="0.01" value={input.chlorine} onChange={handleChange} required className="text-base" />
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter className="p-6 pt-0">
                            <Button type="submit" className="w-full text-lg h-12 bg-cyan-600 hover:bg-cyan-700 shadow-lg shadow-cyan-500/50 transition-all duration-200" disabled={loading}>
                            {loading ? (
                                <div className="flex items-center">
                                    <Droplets className="w-5 h-5 mr-2 animate-pulse" /> Analyzing Sample...
                                </div>
                            ) : (
                                <div className="flex items-center">
                                    <Search className="w-5 h-5 mr-2" /> Run ML Classification
                                </div>
                            )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            
                {/* Analysis Result Display */}
                {result && (
                    <Card className="w-full mt-10 lg:mt-0 shadow-2xl border-2 border-emerald-100 dark:border-emerald-900 animate-fade-in-up"> 
                        <CardHeader className="bg-emerald-50 dark:bg-emerald-950/50 p-6 border-b">
                            <CardTitle className="text-3xl font-extrabold flex items-center text-emerald-700 dark:text-emerald-400">
                                <Beaker className="w-7 h-7 mr-3" />
                                Water Classification
                            </CardTitle>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Results calculated using **WHO/BIS** standards and custom ML models.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            
                            {/* 1. STATUS & CALCULATED HARDNESS */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white dark:bg-gray-800 rounded-xl shadow-inner border border-gray-200 dark:border-gray-700">
                                <div className="flex items-center space-x-3">
                                    {/* Dynamic Icon based on status */}
                                    {result.status === 'Safe' || result.status === 'Soft' || result.status === 'Moderately Hard' ? (
                                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                                    ) : (
                                        <AlertTriangle className="w-8 h-8 text-red-500" />
                                    )}
                                    <div>
                                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Overall Classification</p>
                                        <StatusBadge status={result.status} />
                                    </div>
                                </div>
                                <div className="mt-3 sm:mt-0 text-right">
                                    <p className="text-3xl font-extrabold text-gray-900 dark:text-gray-50">
                                        {result.calculated_hardness.toFixed(1)} <span className="text-lg font-medium text-cyan-600 dark:text-cyan-400">mg/L</span>
                                    </p>
                                    <p className="text-xs text-muted-foreground dark:text-gray-400">Total Hardness (as CaCO₃)</p>
                                </div>
                            </div>

                            <Separator className="bg-gray-200 dark:bg-gray-700" />
                            
                            {/* 2. MESSAGES & RECOMMENDATIONS (Using Conditional Colors) */}
                            <div className="space-y-4">
                                {/* Alert Message Display */}
                                <div className={`p-4 rounded-lg ${result.status === 'Safe' || result.status === 'Soft' ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'} border-l-4 dark:bg-opacity-20`}>
                                    <p className={`font-bold flex items-center mb-1 ${result.status === 'Safe' || result.status === 'Soft' ? 'text-green-700' : 'text-red-700'}`}>
                                        <AlertTriangle className="w-4 h-4 mr-2" /> Key Alert
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{result.alert_message}</p>
                                </div>

                                {/* Recommended Action Display */}
                                <div className="p-4 bg-blue-50 border-l-4 border-blue-400 rounded-lg dark:bg-opacity-20">
                                    <p className="font-bold text-blue-700 flex items-center mb-1">
                                        <Info className="w-4 h-4 mr-2" /> Recommended Action
                                    </p>
                                    <p className="text-sm text-gray-700 dark:text-gray-300">{result.recommended_action}</p>
                                </div>
                            </div>

                            <Separator className="bg-gray-200 dark:bg-gray-700" />

                            {/* 3. INPUT PARAMETERS SUMMARY (More tabular/metric look) */}
                            <div>
                                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-gray-200">Input Parameters Summary</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {/* TDS */}
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">TDS (mg/L)</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.TDS}</p>
                                    </div>
                                    {/* pH */}
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">pH</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.pH}</p>
                                    </div>
                                    {/* Calcium (Ca) */}
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Calcium (mg/L)</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.Ca}</p>
                                    </div>
                                    {/* Magnesium (Mg) */}
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Magnesium (mg/L)</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.Mg}</p>
                                    </div>
                                    {/* Turbidity */}
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Turbidity (NTU)</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.turbidity}</p>
                                    </div>
                                    {/* Chlorine */}
                                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                        <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Chlorine (mg/L)</p>
                                        <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{result.chlorine}</p>
                                    </div>
                                </div>
                            </div>
                            
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default AnalyzerPage;