import { useState, FormEvent, useEffect } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, LogIn, UserPlus, AlertCircle, ChevronRight, Phone, MapPin } from 'lucide-react';
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
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/app');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

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
          const qLower = query(bookingsRef, where('guestEmail', '==', userEmailLower));
          const qOriginal = query(bookingsRef, where('guestEmail', '==', user.email));
          
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
      // Await profile creation to ensure guest bookings are linked before navigation
      await createUserProfile(result.user);
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
      
      // Handle Firebase Auth errors
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
        // Check if it's a Firestore error thrown by handleFirestoreError
        try {
          const firestoreErr = JSON.parse(err.message);
          if (firestoreErr.error) {
            errorMessage = `Profile creation failed: ${firestoreErr.error}`;
          }
        } catch {
          // Not a JSON error, keep default
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-24 min-h-screen bg-[#050505] flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 md:p-12 max-w-md w-full text-center"
      >
        <Logo className="justify-center mb-8" />
        <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">
          {isLogin ? 'Welcome Back' : 'Join Merlux'}
        </span>
        <h1 className="text-4xl font-display mb-8">
          {isLogin ? 'Client Login' : 'Create Account'}
        </h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl mb-8 flex items-center gap-3 text-sm">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-4 bg-white text-black py-4 rounded-sm font-bold hover:bg-gold transition-all mb-8"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Continue with Google
        </button>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest">
            <span className="bg-[#050505] px-4 text-white/40">Or with Email</span>
          </div>
        </div>

        <form onSubmit={handleEmailAuth}>
          <div className="space-y-4 mb-8">
            {!isLogin && (
              <>
                <div className="relative">
                  <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                  <input 
                    type="text" 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                  <input 
                    type="tel" 
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone Number*"
                    className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                  <input 
                    type="text" 
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Address (Optional)"
                    className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                  />
                </div>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="custom-select w-full py-4"
                  >
                    <option value="customer">Customer</option>
                    <option value="driver">Driver</option>
                  </select>
                </div>
              </>
            )}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-4 mb-6 disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        <p className="text-white/40 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
          <button 
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-gold hover:underline"
          >
            {isLogin ? 'Register Now' : 'Login Here'}
          </button>
        </p>
      </motion.div>
    </div>
  );
}
