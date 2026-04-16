import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, ChevronRight, Phone, MapPin, ArrowRight, Chrome, User, ShieldCheck, Clock } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/layout/Logo';
import { cn } from '../lib/utils';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [role, setRole] = useState('customer');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [allowAdminReg, setAllowAdminReg] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/app');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'system'));
        if (settingsSnap.exists()) {
          setAllowAdminReg(!!settingsSnap.data().allowAdminRegistration);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);

  const createUserProfile = async (user: any, displayName?: string, selectedRole?: string, phone?: string, address?: string) => {
    const userRef = doc(db, 'users', user.uid);
    try {
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          id: user.uid,
          name: displayName || user.displayName || 'New User',
          email: user.email,
          phone: phone || '',
          address: address || '',
          role: selectedRole || 'customer',
          createdAt: serverTimestamp()
        });

        // Associate guest bookings with this email to the new user
        const bookingsRef = collection(db, 'bookings');
        const userEmailLower = user.email?.toLowerCase();
        
        if (userEmailLower) {
          const qLower = query(bookingsRef, where('customerEmail', '==', userEmailLower));
          const qOriginal = query(bookingsRef, where('customerEmail', '==', user.email));
          
          const [snapLower, snapOriginal] = await Promise.all([
            getDocs(qLower),
            getDocs(qOriginal)
          ]);
          
          const allDocs = [...snapLower.docs, ...snapOriginal.docs];
          // Remove duplicates if any
          const uniqueDocs = Array.from(new Set(allDocs.map(d => d.id)))
            .map(id => allDocs.find(d => d.id === id)!);

          console.log(`Found ${uniqueDocs.length} guest bookings for ${user.email}`);
          
          const updatePromises = uniqueDocs.map(docSnap => {
            if (!docSnap.data().userId) {
              return updateDoc(doc(db, 'bookings', docSnap.id), {
                userId: user.uid
              });
            }
            return Promise.resolve();
          });
          
          await Promise.all(updatePromises);
        }
      }
    } catch (err) {
      console.error('Error in createUserProfile:', err);
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Google login always defaults to 'customer' role
      await createUserProfile(result.user, result.user.displayName || undefined, 'customer');
      navigate('/app');
    } catch (error: any) {
      console.error('Login error:', error);
      setLoading(false);
      if (error.code === 'auth/operation-not-allowed') {
        setError('Google login is not enabled. Please enable it in your Firebase Console (Authentication > Sign-in method).');
      } else if (error.code !== 'auth/popup-closed-by-user') {
        setError('Google login failed. Please try again.');
      }
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await createUserProfile(result.user, name, role, phone, address);
      }
      navigate('/app');
    } catch (err: any) {
      setLoading(false);
      console.error('Auth error:', err);
      let errorMessage = 'Authentication failed. Please try again.';
      
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered. Please try logging in instead.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed login attempts. Please try again later or reset your password.';
      } else if (err.code === 'auth/operation-not-allowed') {
        errorMessage = 'Authentication providers are not enabled. Please enable Email/Password and Google in your Firebase Console (Authentication > Sign-in method).';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact support.';
      } else {
        try {
          const firestoreErr = JSON.parse(err.message);
          if (firestoreErr.error) {
            errorMessage = `Profile creation failed: ${firestoreErr.error}`;
          }
        } catch {
          // Not a JSON error
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-gold/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-12 items-center px-6 py-20 relative z-10">
        
        {/* Left Side: Branding & Info */}
        <motion.div 
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col justify-center space-y-8"
        >
          <div className="space-y-4">
            <h2 className="text-5xl font-display text-white leading-tight">
              Experience the <span className="text-gold">Ultimate</span> in Luxury Chauffeur Services
            </h2>
            <p className="text-white/60 text-lg max-w-md leading-relaxed">
              Join Melbourne's premier chauffeur network. Whether you're a client seeking excellence or a driver delivering it, your journey starts here.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-6 pt-8">
            <div className="glass p-6 rounded-2xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center mb-4">
                <ShieldCheck className="text-gold" size={20} />
              </div>
              <h4 className="text-white font-bold mb-1">Secure Access</h4>
              <p className="text-white/40 text-xs">Your data is protected with industry-standard encryption.</p>
            </div>
            <div className="glass p-6 rounded-2xl border border-white/5">
              <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center mb-4">
                <Clock className="text-gold" size={20} />
              </div>
              <h4 className="text-white font-bold mb-1">Real-time Tracking</h4>
              <p className="text-white/40 text-xs">Monitor your bookings and chauffeur in real-time.</p>
            </div>
          </div>
        </motion.div>

        {/* Right Side: Auth Form */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md mx-auto py-15"
        >
          <div className="glass p-8 md:p-10 rounded-[2rem] border border-white/10 relative overflow-hidden">
            {/* Form Header */}
            <div className="text-center mb-8">
              <div className="lg:hidden flex justify-center mb-6">
                <Logo className="h-10" />
              </div>
              <span className="text-gold uppercase tracking-[0.4em] text-[10px] font-bold mb-2 block">
                {isLogin ? 'Welcome Back' : 'Get Started'}
              </span>
              <h1 className="text-3xl font-display text-white">
                {isLogin ? 'Client Login' : 'Create Account'}
              </h1>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-6 flex items-center gap-3 text-xs"
              >
                <AlertCircle size={16} className="shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Google Login */}
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white text-black py-3.5 rounded-xl font-bold hover:bg-gold transition-all mb-6 group disabled:opacity-50"
            >
              <Chrome size={20} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm">Continue with Google</span>
            </button>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/5"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
                <span className="bg-[#0b0b0b] px-4 text-white/20">Or use email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <AnimatePresence mode="wait">
                {!isLogin && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-4 overflow-hidden"
                  >
                    {/* Role Selection Toggle */}
                    <div className="bg-white/5 p-1 rounded-xl flex gap-1 mb-2">
                      <button
                        type="button"
                        onClick={() => setRole('customer')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                          role === 'customer' ? "bg-gold text-black" : "text-white/40 hover:text-white"
                        )}
                      >
                        <User size={14} />
                        Customer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRole('driver')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                          role === 'driver' ? "bg-gold text-black" : "text-white/40 hover:text-white"
                        )}
                      >
                        <ShieldCheck size={14} />
                        Driver
                      </button>
                      {allowAdminReg && (
                        <button
                          type="button"
                          onClick={() => setRole('admin')}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                            role === 'admin' ? "bg-gold text-black" : "text-white/40 hover:text-white"
                          )}
                        >
                          <ShieldCheck size={14} />
                          Admin
                        </button>
                      )}
                    </div>

                    <div className="relative group">
                      <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={18} />
                      <input 
                        type="text" 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full Name"
                        className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-xl focus:border-gold outline-none transition-all text-sm text-white placeholder:text-white/20"
                      />
                    </div>
                    <div className="relative group">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={18} />
                      <input 
                        type="tel" 
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone Number*"
                        className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-xl focus:border-gold outline-none transition-all text-sm text-white placeholder:text-white/20"
                      />
                    </div>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={18} />
                      <input 
                        type="text" 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Address (Optional)"
                        className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-xl focus:border-gold outline-none transition-all text-sm text-white placeholder:text-white/20"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={18} />
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email Address"
                  className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-xl focus:border-gold outline-none transition-all text-sm text-white placeholder:text-white/20"
                />
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-gold transition-colors" size={18} />
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 rounded-xl focus:border-gold outline-none transition-all text-sm text-white placeholder:text-white/20"
                />
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-gold text-black py-4 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-white transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In' : 'Create Account'}
                    <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-white/40 text-xs">
                {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
                <button 
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-gold hover:text-white font-bold transition-colors"
                >
                  {isLogin ? 'Register Now' : 'Login Here'}
                </button>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
