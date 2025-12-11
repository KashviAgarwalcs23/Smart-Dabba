import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Shield } from "lucide-react";

const SafetyStandards: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="shadow-2xl border">
          <CardHeader className="p-6 bg-emerald-50 border-b">
            <div className="flex items-center space-x-3">
              <Shield className="w-6 h-6 text-emerald-600" />
              <CardTitle className="text-2xl font-bold">Safety Standards & Guidelines</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Reference BIS / WHO thresholds and local recommendations for safe consumption.</p>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <section>
              <h3 className="text-lg font-semibold">Hardness (as CaCO₃)</h3>
              <p className="text-sm text-muted-foreground mt-2">
                - Soft: 0–60 mg/L
                <br />- Moderately hard: 61–120 mg/L
                <br />- Hard: 121–180 mg/L
                <br />- Very hard: &gt;180 mg/L
              </p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">pH</h3>
              <p className="text-sm text-muted-foreground mt-2">Recommended safe range: 6.5 – 8.5 (WHO/BIS guidance may vary)</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold">TDS</h3>
              <p className="text-sm text-muted-foreground mt-2">Acceptable TDS varies by use case; <strong>consult local authorities</strong> for drinking-water limits.</p>
            </section>

            <div className="flex justify-end">
              <Button asChild>
                <Link to="/analyzer">Open Analyzer</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SafetyStandards;
