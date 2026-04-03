import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Menu, X, Phone, User, LogOut, ChevronDown, LogIn, ShieldCheck, Truck, UserCircle, LayoutDashboard } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { auth, db } from '../../lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Logo from './Logo';

const navLinks = [
  { name: 'Home', path: '/' },
  { name: 'Offers', path: '/offers' },
  { name: 'Tours', path: '/tours' },
  { name: 'Services', path: '/services' },
];

const moreLinks = [
  { name: 'Fleet', path: '/fleet' },
  { name: 'Blog', path: '/blog' },
  { name: 'About', path: '/about' },
  { name: 'Contact', path: '/contact' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showRoleTooltip, setShowRoleTooltip] = useState(false);
  const location = useLocation();
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          }
        } catch (err) {
          console.error('Error fetching user profile in Navbar:', err);
        }
      } else {
        setUserProfile(null);
      }
    });

    const handleClickOutside = (event: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousedown', handleClickOutside);
      unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4',
        scrolled ? 'bg-black/90 backdrop-blur-md py-3 border-b border-white/10' : 'bg-transparent'
      )}
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Logo />

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                'text-sm uppercase tracking-widest hover:text-gold transition-colors',
                location.pathname === link.path ? 'text-gold' : 'text-white/70'
              )}
            >
              {link.name}
            </Link>
          ))}
          
          {/* More Dropdown */}
          <div className="relative" ref={moreRef}>
            <button 
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={cn(
                "flex items-center gap-2 text-sm uppercase tracking-widest hover:text-gold transition-colors",
                moreLinks.some(l => l.path === location.pathname) ? "text-gold" : "text-white/70"
              )}
            >
              More <ChevronDown size={14} className={cn("transition-transform", isMoreOpen && "rotate-180")} />
            </button>
            
            <AnimatePresence>
              {isMoreOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full right-0 mt-4 w-48 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden shadow-2xl"
                >
                  {moreLinks.map((link) => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsMoreOpen(false)}
                      className={cn(
                        "block px-6 py-4 text-[10px] uppercase tracking-widest font-bold hover:bg-gold hover:text-black transition-all",
                        location.pathname === link.path ? "text-gold" : "text-white/70"
                      )}
                    >
                      {link.name}
                    </Link>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex items-center gap-6">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <Link 
                    to="/app" 
                    onMouseEnter={() => setShowRoleTooltip(true)}
                    onMouseLeave={() => setShowRoleTooltip(false)}
                    className={cn(
                      "flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold hover:text-gold transition-colors",
                      location.pathname === '/app' ? "text-gold" : "text-white/70"
                    )}
                  >
                    {userProfile?.role === 'admin' ? (
                      <ShieldCheck size={18} className="text-gold" />
                    ) : userProfile?.role === 'driver' ? (
                      <Truck size={18} className="text-gold" />
                    ) : (
                      <UserCircle size={18} className="text-gold" />
                    )}
                    <span>Dashboard</span>
                  </Link>
                  
                  {/* Tooltip */}
                  <AnimatePresence>
                    {showRoleTooltip && userProfile && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-gold text-black text-[8px] font-bold uppercase tracking-widest rounded whitespace-nowrap z-[60]"
                      >
                        Role: {userProfile.role}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <button onClick={handleLogout} className="text-white/40 hover:text-white transition-colors">
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link to="/login" className="text-white/70 hover:text-gold transition-colors" title="Login">
                <LogIn size={20} />
              </Link>
            )}
            <Link to="/booking" className="btn-primary py-2 px-6 text-xs">
              Book Now
            </Link>
          </div>
        </div>

        {/* Mobile Toggle */}
        <button className="md:hidden text-white" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="absolute top-full left-0 right-0 bg-black border-b border-white/10 p-6 flex flex-col gap-4 md:hidden overflow-hidden"
          >
            {[...navLinks, ...moreLinks].map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  "text-lg uppercase tracking-widest",
                  location.pathname === link.path ? "text-gold" : "text-white"
                )}
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ))}
            <div className="h-px bg-white/10 my-2" />
            {user ? (
              <div className="flex flex-col gap-4">
                <Link 
                  to="/app" 
                  className="flex items-center gap-3 text-gold font-bold uppercase tracking-widest" 
                  onClick={() => setIsOpen(false)}
                >
                  {userProfile?.role === 'admin' ? (
                    <ShieldCheck size={20} />
                  ) : userProfile?.role === 'driver' ? (
                    <Truck size={20} />
                  ) : (
                    <UserCircle size={20} />
                  )}
                  <span>{userProfile?.role === 'admin' ? 'Admin Dashboard' : 'Dashboard'}</span>
                </Link>
                <button onClick={handleLogout} className="text-white/40 text-left font-bold uppercase tracking-widest">
                  Logout
                </button>
              </div>
            ) : (
              <Link to="/login" className="text-white/70 font-bold uppercase tracking-widest" onClick={() => setIsOpen(false)}>
                Login
              </Link>
            )}
            <Link to="/booking" className="btn-primary text-center" onClick={() => setIsOpen(false)}>
              Book Now
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
