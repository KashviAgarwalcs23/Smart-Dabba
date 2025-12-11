import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn, UserPlus, Droplets, AlertTriangle, Eye, EyeOff, User, Send, Tag } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/supabaseClient";

/**
 * Validates the password based on custom requirements.
 * @returns An array of string errors, or an empty array if valid.
 */
const validatePassword = (password: string): string[] => {
  const errors: string[] = [];
  // 1. Minimum 6 characters
  if (password.length < 6) {
    errors.push("Minimum 6 characters.");
  }
  // 2. Requires at least one special character
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(password)) {
    errors.push("Requires at least one special character.");
  }
  // 3. Requires at least one number
  if (!/\d/.test(password)) {
    errors.push("Requires at least one number.");
  }
  return errors;
};

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // Simplified to a single username field
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showResendButton, setShowResendButton] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/", { replace: true });
      }
    });
  }, [navigate]);

  // Handler to resend the confirmation email
  const handleResendConfirmation = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
          type: 'signup',
          email: email, // Use the email from the input field
      });

      if (error) throw error;

      toast({
          title: "Confirmation Sent",
          description: "A new confirmation link has been sent to your email.",
          variant: "default",
          duration: 5000,
      });
      setShowResendButton(false); // Hide the button after successful resend
    } catch (error: any) {
        console.error("Resend Error:", error);
        toast({
            title: "Error Resending Link",
            description: error.message || "Failed to resend confirmation link. Please try again later.",
            variant: "destructive",
        });
    } finally {
      setLoading(false);
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Reset resend button visibility on every auth attempt
    setShowResendButton(false); 

    if (isSignUp) {
      // Basic username validation
      if (!username) {
        toast({
          title: "Registration Error",
          description: "A Username is required for sign up.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      const errors = validatePassword(password);
      setPasswordErrors(errors);
      if (errors.length > 0) {
        setLoading(false);
        return;
      }
    }

    try {
      if (isSignUp) {
        // Sign Up Logic
        const { data, error } = await supabase.auth.signUp({ email, password });
        
        if (error) {
          console.error('SignUp Error:', error);
          toast({
            title: 'Sign Up Failed',
            description: error.message || JSON.stringify(error),
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }

        // Let the user know to confirm their email. Profile will be created either
        // by a DB trigger or when they sign in (client upsert on sign-in remains).
        toast({
          title: "Sign Up Successful!",
          description: "A confirmation link has been sent to your email. Please click the link to confirm your account, then log in.",
          variant: "default",
          duration: 8000,
        });
        // Clear fields for security and switch to login view
        setEmail(""); 
        setPassword(""); 
        setUsername("");
        setIsSignUp(false); 

      } else {
        // Sign In Logic
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) {
          // Check for specific Supabase unconfirmed email error
          if (error.message.includes("Email not confirmed")) {
             toast({
              title: "Authentication Required",
              description: "Your email is not confirmed. Please check your inbox and click the confirmation link before trying to log in.",
              variant: "destructive",
              duration: 8000,
            });
            setShowResendButton(true); // Show resend button
            return; 
          }
          throw error;
        }

        toast({
          title: "Welcome Back!",
          description: "You have successfully logged in.",
          variant: "default",
        });
        // Ensure a minimal profile row exists now that the user is authenticated.
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user?.id) {
            await supabase.from('profiles').upsert([
              { user_id: session.user.id }
            ], { onConflict: 'user_id' });
          }
        } catch (err) {
          console.error('Failed to ensure profile on sign-in:', err);
        }

        navigate("/", { replace: true }); // Redirect to home page after login
      }
    } catch (error: any) {
      // General catch-all: log full error and present informative toast
      console.error('Auth Error:', error);
      const message =
        error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
      toast({
        title: 'Authentication Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Re-validate password on change for immediate feedback
  useEffect(() => {
    if (isSignUp && password) {
      setPasswordErrors(validatePassword(password));
    } else {
      setPasswordErrors([]);
    }
  }, [password, isSignUp]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-2xl transition-all duration-300 hover:shadow-primary/40">
        <CardHeader className="space-y-1 text-center">
          <Droplets className="w-10 h-10 mx-auto text-primary" />
          <CardTitle className="text-3xl font-bold">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sign {isSignUp ? "up" : "in"} to access real-time water quality analysis.
          </p>
        </CardHeader>
        <form onSubmit={handleAuth}>
          <CardContent className="grid gap-4">
            
            {/* Username Input - Only visible on Sign Up */}
            {isSignUp && (
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="username"
                    type="text"
                    placeholder="water_watcher_42"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required={isSignUp}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {/* Email Input */}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setShowResendButton(false); // Hide resend button if email changes
                  }}
                  required
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Password Input with Visibility Toggle */}
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  // Conditionally set the input type based on showPassword state
                  type={showPassword ? "text" : "password"} 
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-10 pr-10"
                />
                {/* Visibility Toggle Button */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-1/2 transform -translate-y-1/2 h-full px-3 text-muted-foreground hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Password Validation Errors (Only on Sign Up) */}
            {isSignUp && passwordErrors.length > 0 && (
              <div className="p-3 bg-red-100 border border-red-300 rounded-md text-sm text-red-700">
                <p className="font-semibold mb-1 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1 inline" /> Password Requirements:
                </p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {passwordErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Resend Confirmation Link Button (Only on Sign In view) */}
            {!isSignUp && showResendButton && (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2 text-primary border-primary"
                onClick={handleResendConfirmation}
                disabled={loading}
              >
                <Send className="w-4 h-4 mr-2" />
                {loading ? "Sending..." : "Resend Confirmation Link"}
              </Button>
            )}
            
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={loading || (isSignUp && passwordErrors.length > 0)}>
              {loading ? (
                <span className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  {isSignUp ? "Signing Up..." : "Signing In..."}
                </span>
              ) : (
                <span className="flex items-center">
                  {isSignUp ? <UserPlus className="w-5 h-5 mr-2" /> : <LogIn className="w-5 h-5 mr-2" />}
                  {isSignUp ? "Sign Up" : "Sign In"}
                </span>
              )}
            </Button>
            
            <Button
              type="button"
              variant="link"
              className="w-full text-sm"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setShowResendButton(false); // Hide on mode switch
              }}
            >
              {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AuthPage;