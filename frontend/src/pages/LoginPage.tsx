import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import logoImage from 'figma:asset/661f558dc14c79fa090b7039a885f26b843f5c04.png';

const clearStoredAuth = () => {
  try {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch {
    // Ignore storage cleanup failures on login page.
  }
  try {
    sessionStorage.removeItem('auth401_notified');
  } catch {
    // Ignore session cleanup failures on login page.
  }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, currentUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });

  const nextPath = searchParams.get('next') || '/';

  useEffect(() => {
    clearStoredAuth();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      clearStoredAuth();
      const success = await login(formData.username, formData.password);
      
      if (success) {
        window.location.replace(nextPath);
      } else {
        setError('Username atau password salah');
      }
    } catch (err) {
      setError('Terjadi kesalahan saat login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
      
      <div className="w-full max-w-md relative z-10">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-28 h-28 bg-white rounded-full shadow-2xl mb-6 p-4 transform hover:scale-105 transition-transform duration-300">
            <img src={logoImage} alt="GM Teknik Logo" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-white mb-2 text-3xl">GM TEKNIK</h1>
          <p className="text-red-100 text-sm">Dashboard System</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl text-gray-900 mb-1">Selamat Datang</h2>
            <p className="text-sm text-gray-500">Silakan login untuk melanjutkan</p>
          </div>

          {currentUser && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Sesi lama terdeteksi. Login di sini akan mengganti akun yang sedang aktif.
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 mb-2">Username</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-red-500 focus:bg-white transition-all outline-none"
                  placeholder="Masukkan username"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 bg-gray-50 rounded-xl focus:ring-2 focus:ring-red-500 focus:bg-white transition-all outline-none"
                  placeholder="Masukkan password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white py-3 rounded-xl hover:from-red-700 hover:to-red-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Login</span>
                </>
              )}
            </button>
          </form>

        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-red-100 text-sm">
          © 2024 GM Teknik. All rights reserved.
        </div>
      </div>
    </div>
  );
}
