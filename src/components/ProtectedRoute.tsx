import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '@/supabaseClient'; // Assuming this import path is correct

type Props = {
  // If provided, only allow users who have one of these roles
  allowedRoles?: string[];
};

const ProtectedRoute = ({ allowedRoles }: Props) => {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(session);

        // If role restriction is requested and we have a session, fetch profile
        if (session && allowedRoles && allowedRoles.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (!mounted) return;
          if (error) {
            console.error('Error fetching profile role:', error);
            setProfileRole(null);
          } else {
            setProfileRole(data?.role ?? 'user');
          }
        }
      } catch (err) {
        console.error('Error checking session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    // Listen for auth changes to update state immediately
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      // Reset profile role when session changes; next effect will re-fetch if needed
      setProfileRole(null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [allowedRoles]);

  if (loading) {
    // Show a simple loading spinner while checking authentication status
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // If session is null, redirect the user to the login page
  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  // If allowedRoles set, enforce role check
  if (allowedRoles && allowedRoles.length > 0) {
    // If we didn't fetch a role, deny access (treat missing as 'user')
    const role = profileRole ?? 'user';
    if (!allowedRoles.includes(role)) {
      // Instead of silently redirecting, show an explanatory message so admins
      // can diagnose missing profile/role quickly.
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl w-full bg-white p-6 rounded shadow">
            <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
            <p className="text-sm text-gray-700 mb-4">You are signed in but your account does not have the required role to access this page.</p>
            <p className="text-sm text-gray-600 mb-2">Required role: <strong>{allowedRoles.join(', ')}</strong></p>
            <p className="text-sm text-gray-600 mb-4">Detected role: <strong>{profileRole ?? 'none'}</strong></p>
            <p className="text-sm text-gray-600 mb-4">If you should be an admin, set your profile's <code>role</code> to <code>admin</code> in the Supabase Table Editor or run the SQL below (replace &lt;USER_UUID&gt;):</p>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto">update public.profiles set role = 'admin' where user_id = '&lt;USER_UUID&gt;';</pre>
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">Your user id:</div>
              <div className="font-mono text-sm text-gray-800">{session?.user?.id ?? 'unknown'}</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="px-3 py-2 bg-indigo-600 text-white rounded"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const { data: { session: s } } = await supabase.auth.getSession();
                    setSession(s);
                    if (s && allowedRoles && allowedRoles.length > 0) {
                      const { data, error } = await supabase
                        .from('profiles')
                        .select('role')
                        .eq('user_id', s.user.id)
                        .maybeSingle();
                      if (error) console.error('Error fetching profile role:', error);
                      setProfileRole(data?.role ?? null);
                    }
                  } catch (e) {
                    console.error('Retry error:', e);
                  } finally {
                    setLoading(false);
                  }
                }}
              >Retry</button>
              <button className="px-3 py-2 bg-gray-200 rounded" onClick={() => window.location.href = '/'}>Return Home</button>
            </div>
          </div>
        </div>
      );
    }
  }

  // If logged in and authorized, render the child route component
  return <Outlet />;
};

export default ProtectedRoute;