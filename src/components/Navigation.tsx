import { useState, useEffect } from 'react';
import { Link, useLocation } from "react-router-dom";
import { Droplets, LogOut, User, Menu, X } from "lucide-react"; 
import { Button } from "@/components/ui/button";
import { supabase } from "@/supabaseClient"; 
import { Session } from '@supabase/supabase-js';

const Navigation = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [userName, setUserName] = useState<string>(""); // State for user name
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();

  const fetchProfile = async (userId: string) => {
    // Fetch the username and role from the 'profiles' table
    const { data, error } = await supabase
      .from('profiles')
      .select('username, role')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      setUserName('User'); // Fallback name
      setUserRole(null);
    } else if (data) {
      setUserName(data.username || 'User');
      setUserRole(data.role ?? null);
    }
  };

  useEffect(() => {
    const handleAuthStateChange = async (session: Session | null) => {
      setSession(session);
      if (session) {
        // If a session exists, fetch the user's name
        await fetchProfile(session.user.id);
      } else {
        setUserName(""); // Clear name on logout
      }
    };

    // 1. Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleAuthStateChange(session);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthStateChange(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error('Logout error:', error.message);
  };

  // Build nav items dynamically based on role
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Citizen View', path: '/citizen' },
    { name: 'Analyzer', path: '/analyzer' },
    { name: 'Profile', path: '/profile' },
  ];

  if (userRole === 'admin') {
    navItems.push({ name: 'Admin Dashboard', path: '/admin' });
  }

  // Logic to only show Logout if a session exists
  const getAuthButton = () => {
    if (session) {
      return (
        <Button onClick={handleLogout} variant="destructive" size="sm" className="space-x-2 shrink-0">
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      );
    }
    
    return null;
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-sm">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo and App Title */}
        <Link to="/" className="flex items-center space-x-2">
          <Droplets className="h-6 w-6 text-primary" />
          <span className="hidden font-bold sm:inline-block text-lg">
            BQM
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          {session && navItems.map((item) => ( // Only show nav items if logged in
            <Link
              key={item.path}
              to={item.path}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.pathname === item.path ? "text-primary border-b-2 border-primary pb-1" : "text-muted-foreground"
              }`}
            >
              {item.name}
            </Link>
          ))}
          
        </nav>

        {/* User Info and Auth Buttons */}
        <div className="flex items-center space-x-3">
          {/* Display the username */}
          {userName && (
            <div className="hidden lg:flex items-center text-sm font-medium text-gray-700 space-x-1">
                <User className="h-4 w-4 mr-1 text-primary" />
                <span>{userName}</span> 
            </div>
          )}
          {getAuthButton()}

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            className="md:hidden"
            size="icon"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Content */}
      {isMenuOpen && (
        <div className="md:hidden border-t bg-background shadow-lg absolute w-full top-16 left-0">
          <nav className="flex flex-col p-4 space-y-2">
            {session && navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMenuOpen(false)}
                className="text-base font-medium py-2 px-3 rounded-md hover:bg-muted"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
};

export default Navigation;