import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Droplets, BarChart3, Shield, Beaker } from "lucide-react"; 
import { Link } from "react-router-dom";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { supabase } from "@/supabaseClient";

const Home = () => {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) {
        supabase
          .from("profiles")
          .select("role")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data, error }) => {
            if (!mounted) return;
            setIsAdmin(Boolean(data?.role === "admin"));
          })
          .catch(() => setIsAdmin(false));
      } else {
        setIsAdmin(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-water opacity-5" />
        <div className="container mx-auto relative">
          <div className="max-w-4xl mx-auto text-center animate-fade-in">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-water bg-clip-text text-transparent">
              Bengaluru Water Quality Monitoring
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Real-time water quality monitoring across Bengaluru. Track hardness levels,
              contamination, and get AI-powered predictions for safe water consumption.
            </p>
            {/* The main buttons now lead to protected content */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" asChild className="bg-gradient-primary shadow-elevated">
                <Link to="/citizen">
                  Check Your Area
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/admin">Admin Dashboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Key Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* 1. SMART DABBA ANALYZER FEATURE CARD - Style refined */}
            <Card className="p-6 hover:shadow-elevated transition-all animate-slide-up bg-card/90">
              <div className="p-3 rounded-xl bg-primary w-fit mb-4">
                <Beaker className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Dabba Analyzer</h3>
              <p className="text-muted-foreground mb-4">
                Test your water pH level and get personalized recommendations.
              </p>
              <Button size="sm" asChild className="w-full bg-primary hover:bg-primary/90">
                <Link to="/analyzer">Analyze Water</Link>
              </Button>
            </Card>

            <Card className="p-6 hover:shadow-elevated transition-all animate-slide-up">
              <div className="p-3 rounded-xl bg-gradient-primary w-fit mb-4">
                <Droplets className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Real-Time Monitoring</h3>
              <p className="text-muted-foreground">
                Live water quality data from sensors across all major areas in Bengaluru.
              </p>
              <div className="mt-4">
                <Button size="sm" asChild variant="outline" className="w-full">
                  <Link to="/citizen">View Live Data</Link>
                </Button>
              </div>
            </Card>

            <Card className="p-6 hover:shadow-elevated transition-all animate-slide-up" style={{ animationDelay: "0.1s" }}>
              <div className="p-3 rounded-xl bg-gradient-primary w-fit mb-4">
                <BarChart3 className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Predictions</h3>
              <p className="text-muted-foreground">
                Machine learning models predict water quality trends for the next 7 days.
              </p>
                <div className="mt-4">
                  {isAdmin === null ? (
                    <Button size="sm" className="w-full" disabled>Loading...</Button>
                  ) : isAdmin ? (
                    <Button size="sm" asChild className="w-full bg-primary/80 hover:bg-primary/90">
                      <Link to="/admin">View Predictions</Link>
                    </Button>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" className="w-full" disabled>View Predictions</Button>
                      </TooltipTrigger>
                      <TooltipContent>Admin access required — contact site admin to request access.</TooltipContent>
                    </Tooltip>
                  )}
                </div>
            </Card>

            <Card className="p-6 hover:shadow-elevated transition-all animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <div className="p-3 rounded-xl bg-gradient-primary w-fit mb-4">
                <Shield className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Safety Standards</h3>
              <p className="text-muted-foreground">
                Water quality assessed against BIS and WHO standards for public safety.
              </p>
              <div className="mt-4">
                <Button size="sm" asChild variant="ghost" className="w-full">
                  <Link to="/standards">View Standards</Link>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="animate-fade-in">
              <div className="text-5xl font-bold bg-gradient-water bg-clip-text text-transparent mb-2">
                5
              </div>
              <p className="text-muted-foreground">Areas Monitored</p>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
              <div className="text-5xl font-bold bg-gradient-water bg-clip-text text-transparent mb-2">
                24/7
              </div>
              <p className="text-muted-foreground">Real-Time Updates</p>
            </div>
            <div className="animate-fade-in" style={{ animationDelay: "0.2s" }}>
              <div className="text-5xl font-bold bg-gradient-water bg-clip-text text-transparent mb-2">
                7-Day
              </div>
              <p className="text-muted-foreground">Forecast Predictions</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-gradient-water">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Start Monitoring Your Water Quality Today
          </h2>
          <p className="text-white/90 mb-8 max-w-2xl mx-auto">
            Access real-time water quality data for your area and make informed decisions about
            water consumption.
          </p>
          <Button size="lg" variant="secondary" asChild className="shadow-elevated">
            <Link to="/citizen">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Home;