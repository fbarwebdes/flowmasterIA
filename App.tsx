import React, { useState, useEffect } from 'react';
import { Layout } from './components/ui/Layout';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Login } from './pages/Login';
import { Schedule } from './pages/Schedule';
import { Links } from './pages/Links';
import { Integrations } from './pages/Integrations';
import { Settings } from './pages/Settings';
import { SalesTemplates } from './pages/SalesTemplates';
import { QuickPost } from './pages/QuickPost';
import { ViewState, User } from './types';
import { supabase } from './services/supabase';
import { Session } from '@supabase/supabase-js';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [forceLogout, setForceLogout] = useState(false);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) setForceLogout(false); // Reset forceLogout when session exists
      setLoading(false);
    });

    // Listen for changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) setForceLogout(false); // Reset forceLogout when user logs in
    });

    return () => subscription.unsubscribe();
  }, []);

  // Map Supabase user to our App User type
  const user: User | null = session ? {
    name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'Usuário',
    email: session.user.email || '',
    avatar: session.user.user_metadata.avatar_url || `https://ui-avatars.com/api/?name=${session.user.email}&background=random`
  } : null;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setForceLogout(true);
    setCurrentView('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Require real authentication - no bypass
  if (!session || forceLogout) {
    return <Login />;
  }

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <Products />;
      case 'schedule':
        return <Schedule />;
      case 'links':
        return <Links />;
      case 'integrations':
        return <Integrations />;
      case 'settings':
        return <Settings />;
      case 'templates':
        return <SalesTemplates />;
      case 'quickpost':
        return <QuickPost />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout
      currentView={currentView}
      onChangeView={setCurrentView}
      onLogout={handleLogout}
      user={user!}
    >
      {renderContent()}
    </Layout>
  );
};

export default App;
