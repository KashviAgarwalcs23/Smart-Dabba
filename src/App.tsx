import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import ProtectedRoute from "./components/ProtectedRoute"; // NEW IMPORT
import Home from "./pages/Home";
import CitizenView from "./pages/CitizenView";
import AdminDashboard from "./pages/AdminDashboard";
import ProfilePage from "./pages/ProfilePage";
import AdminUsers from "./pages/AdminUsers";
import NotFound from "./pages/NotFound";
import AuthPage from "./pages/AuthPage"; 
import AnalyzerPage from "./pages/AnalyzerPage";
import SafetyStandards from "./pages/SafetyStandards";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Navigation />
        <Routes>
          {/* Unprotected Route: The Authentication page */}
          <Route path="/auth" element={<AuthPage />} /> 
          
          {/* Protected Routes Wrapper: All pages must be accessed via a valid session */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
            <Route path="/citizen" element={<CitizenView />} />
            <Route path="/analyzer" element={<AnalyzerPage />} /> 
            <Route path="/standards" element={<SafetyStandards />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          {/* Admin-only protected wrapper: only users with role 'admin' can access */}
          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;