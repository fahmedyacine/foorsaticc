import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const Signup = ({ theme }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await register(name, email, password);
    setLoading(false);
    
    // AuthContext.register returns { success: true } or { success: false, error: '...' }
    if (result && result.success) {
      // User is already logged in by register(), so go to Home
      navigate('/');
    } else {
      setError(result?.error || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${
      theme === 'dark' ? 'bg-[#080c17] text-white' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-brand/20 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute top-[20%] -left-[10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[100px] mix-blend-screen animate-pulse delay-1000" />
      </div>

      <div className={`w-full max-w-md p-8 rounded-3xl shadow-2xl border backdrop-blur-xl relative z-10 transition-all duration-300 ${
         theme === 'dark' 
           ? 'bg-white/5 border-white/10 shadow-black/50' 
           : 'bg-white/70 border-white/50 shadow-slate-200/50'
      }`}>
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-brand to-accent mb-2">Create Account</h2>
          <p className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            Join us and explore the possibilities
          </p>
        </div>

        {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center animate-in fade-in slide-in-from-top-2">
                <span className="mr-2">⚠️</span> {error}
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
           <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-70 ml-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-5 py-3.5 rounded-2xl outline-none transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-white/5 border border-white/10 focus:bg-white/10 focus:border-brand/50 text-white placeholder-white/20' 
                  : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand/50 text-slate-900'
              }`}
              placeholder="John Doe"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider opacity-70 ml-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-5 py-3.5 rounded-2xl outline-none transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-white/5 border border-white/10 focus:bg-white/10 focus:border-brand/50 text-white placeholder-white/20' 
                  : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand/50 text-slate-900'
              }`}
              placeholder="name@example.com"
              required
            />
          </div>
          
          <div className="space-y-2">
             <label className="text-xs font-semibold uppercase tracking-wider opacity-70 ml-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-5 py-3.5 rounded-2xl outline-none transition-all duration-300 ${
                theme === 'dark' 
                  ? 'bg-white/5 border border-white/10 focus:bg-white/10 focus:border-brand/50 text-white placeholder-white/20' 
                  : 'bg-slate-50 border border-slate-200 focus:bg-white focus:border-brand/50 text-slate-900'
              }`}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand to-brand/80 text-white font-bold text-lg shadow-lg shadow-brand/25 hover:shadow-brand/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:hover:scale-100 flex justify-center items-center group"
          >
             {loading ? <Loader2 className="animate-spin h-6 w-6" /> : <span className="flex items-center">Get Started <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span></span>}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <span className={`${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Already have an account? </span>
          <Link to="/login" className="text-brand font-semibold hover:text-accent transition-colors">Sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default Signup;
