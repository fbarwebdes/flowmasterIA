import React, { useState } from 'react';
import { Zap, ArrowRight, Loader2, AlertCircle, CheckCircle2, UserPlus, LogIn, Sun, Moon } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useTheme } from '../components/ui/ThemeContext';

export const Login: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();

  const translateAuthError = (error: any) => {
    const msg = error.message.toLowerCase();

    if (msg.includes('rate limit') || msg.includes('too many requests')) {
      return 'Muitas tentativas. Por favor, aguarde alguns minutos antes de tentar novamente.';
    }
    if (msg.includes('invalid login credentials')) {
      return 'E-mail ou senha incorretos.';
    }
    if (msg.includes('user already registered')) {
      return 'Este e-mail já está cadastrado. Tente fazer login.';
    }
    if (msg.includes('password should be at least')) {
      return 'A senha deve ter no mínimo 6 caracteres.';
    }
    if (msg.includes('email not confirmed')) {
      return 'E-mail não confirmado. Verifique sua caixa de entrada.';
    }

    return 'Ocorreu um erro ao processar sua solicitação. Tente novamente.';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        setMessage("📧 E-mail de recuperação enviado! Verifique sua caixa de entrada.");
        setMode('signin');
      } else if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name }
          }
        });
        if (error) throw error;
        setMessage("✅ Conta criada! Verifique seu e-mail para confirmar.");
        setMode('signin');
      }
    } catch (err: any) {
      console.error(err);
      setError(translateAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden transition-colors duration-300
      ${theme === 'dark'
        ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900'
        : 'bg-gradient-to-br from-slate-100 via-white to-emerald-50'}`}>
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 p-3 rounded-xl transition-all z-20
          ${theme === 'dark'
            ? 'bg-slate-700/50 text-yellow-400 hover:bg-slate-700'
            : 'bg-white/80 text-slate-600 hover:bg-white shadow-lg'}`}
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl ${theme === 'dark' ? 'bg-emerald-500/20' : 'bg-emerald-500/10'}`}></div>
        <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl ${theme === 'dark' ? 'bg-emerald-500/10' : 'bg-emerald-400/10'}`}></div>
      </div>

      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo & Brand */}
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30 mb-4">
            <Zap className="text-white w-9 h-9 fill-current" />
          </div>
          <h1 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            Flow Master <span className="text-emerald-500">Afiliado</span>
          </h1>
          <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Gerencie e automatize seus links de afiliado
          </p>
        </div>

        {/* Mode Toggle Tabs */}
        <div className={`mt-8 flex rounded-xl p-1 border backdrop-blur-sm
          ${theme === 'dark' ? 'bg-slate-800/50 border-slate-700/50' : 'bg-white/80 border-slate-200 shadow-lg'}`}>
          <button
            onClick={() => { setMode('signin'); setError(null); setMessage(null); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
              ${mode === 'signin'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <LogIn size={18} /> Entrar
          </button>
          <button
            onClick={() => { setMode('signup'); setError(null); setMessage(null); }}
            className={`flex-1 py-3 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2
              ${mode === 'signup'
                ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : theme === 'dark' ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
          >
            <UserPlus size={18} /> Criar Conta
          </button>
        </div>

        {/* Form Card */}
        <div className={`mt-6 py-8 px-6 shadow-2xl sm:rounded-2xl border backdrop-blur-xl
          ${theme === 'dark' ? 'bg-slate-800/60 border-slate-700/50' : 'bg-white/90 border-slate-200'}`}>
          <h2 className={`text-xl font-semibold mb-6 text-center ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
            {mode === 'signin' ? 'Acesse sua conta' : mode === 'signup' ? 'Crie sua conta gratuita' : 'Recuperar senha'}
          </h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Seu Nome
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required={mode === 'signup'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Como você quer ser chamado?"
                  className={`appearance-none block w-full px-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                    ${theme === 'dark'
                      ? 'bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                E-mail
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className={`appearance-none block w-full px-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                  ${theme === 'dark'
                    ? 'bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500'
                    : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'}`}
              />
            </div>

            {mode !== 'forgot' && (
              <div>
                <label htmlFor="password" className={`block text-sm font-medium mb-1.5 ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••'}
                  className={`appearance-none block w-full px-4 py-3 rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                    ${theme === 'dark'
                      ? 'bg-slate-900/50 border border-slate-600 text-white placeholder-slate-500'
                      : 'bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-400'}`}
                />
              </div>
            )}

            {mode === 'signin' && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => { setMode('forgot'); setError(null); setMessage(null); }}
                  className={`text-sm font-medium hover:underline ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-600'}`}
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            {mode === 'forgot' && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode('signin'); setError(null); setMessage(null); }}
                  className={`text-sm font-medium hover:underline ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}
                >
                  ← Voltar ao login
                </button>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-500/10 p-4 border border-red-500/30">
                <div className="flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            )}

            {message && (
              <div className="rounded-xl bg-emerald-500/10 p-4 border border-emerald-500/30">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-sm text-emerald-300">{message}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/30"
            >
              {isLoading ? (
                <Loader2 className="animate-spin w-5 h-5" />
              ) : (
                <>
                  {mode === 'signin' ? 'Entrar' : mode === 'signup' ? 'Criar minha conta' : 'Enviar link de recuperação'}
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className={`text-xs ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
              Ao continuar, você concorda com nossos Termos de Uso
            </p>
          </div>
        </div>

        {/* Copyright */}
        <p className={`mt-8 text-center text-sm ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
          © 2026 Flow Master Afiliado — Todos os direitos reservados
        </p>
      </div>
    </div>
  );
};