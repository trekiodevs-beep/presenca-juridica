import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { CheckCircle2, Shield } from 'lucide-react';

export const Login = () => {
  const { user, loading: authLoading, login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-brand-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
          <p className="text-sm font-medium text-slate-500">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" />;
  }

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await login();
      navigate('/');
    } catch (err) {
      console.error(err);
      setError('Erro ao fazer login. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-50 flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[70%] rounded-full bg-brand-800/30 blur-3xl" />
          <div className="absolute bottom-[10%] right-[10%] w-[50%] h-[50%] rounded-full bg-brand-800/40 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            <img 
              src="/atom_simbolo_para_fundo_escuro_clean.png" 
              alt="ATOM Logo" 
              className="w-16 h-16 object-contain mb-10" 
              onError={(e) => {
                // Fallback to text if image not found
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.insertAdjacentHTML('afterbegin', '<div class="text-white text-2xl font-bold mb-10">ATOM</div>');
              }}
            />
            
            <div className="space-y-4 max-w-lg">
              <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
                Presença Jurídica CRM
              </h1>
              <p className="text-lg text-slate-300">
                Atendimento inicial, contatos e rotina jurídica organizada.
              </p>

              <ul className="space-y-4 mt-10">
                {[
                  'Contatos com origem rastreada',
                  'WhatsApp com histórico',
                  'Próximas ações visíveis',
                  'Rotina jurídica mais organizada'
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-slate-200">
                    <CheckCircle2 className="w-5 h-5 text-brand-400 shrink-0" />
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative z-10 mt-12 pt-8 border-t border-brand-800/50">
            <p className="text-sm text-slate-400 font-medium tracking-wide">
              Tecnologia TrekIO &bull; Método ATOM
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-8 sm:p-12 relative z-10">
        
        {/* Mobile Header (only visible on small screens) */}
        <div className="lg:hidden flex flex-col items-center mb-10 text-center">
          <img 
            src="/atom_simbolo_transparente_clean.png" 
            alt="ATOM Logo" 
            className="w-16 h-16 object-contain mb-6" 
            onError={(e) => e.currentTarget.style.display = 'none'}
          />
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Presença Jurídica CRM</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-xs">Atendimento inicial, contatos e rotina jurídica organizada.</p>
        </div>

        <div className="w-full max-w-md">
          <div className="bg-white py-10 px-6 sm:px-10 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100">
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold text-slate-900">Acessar sistema</h3>
              <p className="text-sm text-slate-500 mt-2">Use a conta Google do escritório</p>
            </div>
            
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 text-red-700 p-4 rounded-lg text-sm border border-red-100 flex items-start gap-3">
                  <Shield className="w-5 h-5 text-red-500 shrink-0" />
                  <p>{error}</p>
                </div>
              )}
              
              <div>
                <Button 
                  onClick={handleLogin} 
                  disabled={loading} 
                  className="w-full flex items-center justify-center gap-3 h-14 text-base font-medium shadow-sm transition-all hover:shadow-md"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  )}
                  {loading ? 'Conectando...' : 'Entrar com Google'}
                </Button>
              </div>
              
              <div className="pt-6 mt-6 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  Acesso seguro para advogados autorizados.
                </p>
                <p className="text-xs text-slate-400 mt-2 lg:hidden font-medium">Tecnologia TrekIO &bull; Método ATOM</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

