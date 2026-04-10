import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Gift, MapPin, Briefcase, MoreHorizontal, User, CalendarDays, LogOut, ChevronDown, LogIn, ShieldCheck, Truck, UserCircle, LayoutDashboard } from 'lucide-react';
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
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [showRoleTooltip, setShowRoleTooltip] = useState(false);
  const location = useLocation();
  const moreRef = useRef<HTMLDivElement>(null);

  const roleColor = userProfile?.role === 'admin'
    ? 'text-red-400'
    : userProfile?.role === 'driver'
      ? 'text-blue-400'
      : 'text-gold';

  const mobileNavItems = [
    { name: 'Home', path: '/', Icon: Home },
    { name: 'Offers', path: '/offers', Icon: Gift },
    { name: 'Tours', path: '/tours', Icon: MapPin },
    { name: 'Services', path: '/services', Icon: Briefcase },
    { name: 'More', action: () => setIsMoreOpen(!isMoreOpen), Icon: MoreHorizontal },
  ];

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
    <>
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
                  'group relative overflow-hidden text-sm uppercase font-bold tracking-widest transition-colors duration-300',
                  location.pathname === link.path ? 'text-gold' : 'text-white/70'
                )}
              >
                {link.name}
                <span
                  className={cn(
                    'absolute inset-x-0 -bottom-1 h-[2px] bg-gold transition-transform duration-300 origin-right',
                    location.pathname === link.path ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                  )}
                />
              </Link>
            ))}

            {/* More Dropdown */}
            <div className="relative" ref={moreRef}>
              <button
                onClick={() => setIsMoreOpen(!isMoreOpen)}
                className={cn(
                  "group flex items-center gap-2 text-sm font-bold uppercase tracking-widest transition-colors duration-300",
                  moreLinks.some(l => l.path === location.pathname) ? "text-gold" : "text-white/70"
                )}
              >
                More
                <ChevronDown size={14} className={cn("transition-transform duration-300", isMoreOpen && "rotate-180")} />
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
                        "flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold transition-colors",
                        roleColor
                      )}
                    >
                      {userProfile?.role === 'admin' ? (
                        <ShieldCheck size={18} className="text-red-400" />
                      ) : userProfile?.role === 'driver' ? (
                        <Truck size={18} className="text-blue-400" />
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
                  <button onClick={handleLogout} className="text-red-400 hover:text-red-600 transition-colors">
                    <LogOut size={20} />
                  </button>
                </div>
              ) : (
                <Link to="/login" className="text-blue-400 hover:text-blue-600 transition-colors" title="Login">
                  <LogIn size={20} />
                </Link>
              )}
              <Link to="/booking" className="btn-primary py-2 px-6 text-xs rounded-sm">
                Book Now
              </Link>
            </div>
          </div>

          {/* Mobile Header Actions */}
          <div className="flex items-center gap-3 md:hidden">
            {user ? (
              <Link
                to="/app"
                className={cn(
                  'transition-colors',
                  roleColor
                )}
                title="Dashboard"
              >
                {userProfile?.role === 'admin' ? (
                  <div className="bg-red-700 hover:bg-red-800 border border-red-700 rounded-md p-1.5">
                    <ShieldCheck size={16} className="text-white" />
                  </div>
                ) : userProfile?.role === 'driver' ? (
                  <div className="bg-blue-700 hover:bg-blue-800 border border-blue-700 rounded-md p-1.5">
                    <Truck size={16} className="text-white" />
                  </div>
                ) : (
                  <div className="bg-yellow-700 hover:bg-yellow-800 border border-yellow-700 rounded-md p-1.5">
                    <UserCircle size={16} className="text-white" />
                  </div>
                )}
              </Link>
            ) : (
              <Link
                to="/login"
                className="border border-blue-700 rounded-md p-1.5 shadow-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                title="Login"
              >
                <LogIn size={16} />
              </Link>
            )}

            <Link
              to="/booking"
              className="border border-green-700 rounded-md p-1.5 shadow-sm bg-green-700 text-white hover:bg-green-800 transition-colors"
              title="Book Now"
            >
              <CalendarDays size={16} />
            </Link>

            {user && (
              <button
                onClick={handleLogout}
                className="bg-red-500/10 border border-red-500 rounded-md p-1.5 shadow-sm text-red-500 hover:bg-red-800 hover:text-white transition-colors"
                title="Logout"
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between rounded-t-3xl border-t border-white/10 bg-black/95 px-4 py-2 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]">
          {mobileNavItems.map((item) => (
            item.path ? (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] uppercase tracking-widest transition-colors',
                  location.pathname === item.path ? 'text-gold' : 'text-white/70'
                )}
              >
                <item.Icon size={20} />
                <span>{item.name}</span>
              </Link>
            ) : (
              <button
                key={item.name}
                type="button"
                onClick={item.action}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[10px] uppercase tracking-widest transition-colors',
                  isMoreOpen ? 'text-gold' : 'text-white/70'
                )}
              >
                <item.Icon size={20} />
                <span>{item.name}</span>
              </button>
            )
          ))}
        </div>

        <AnimatePresence>
          {isMoreOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed inset-x-4 bottom-16 z-50 rounded-3xl border border-white/10 bg-black/95 p-3 shadow-2xl md:hidden"
            >
              <div className="grid grid-cols-2 gap-2">
                {moreLinks.map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    onClick={() => setIsMoreOpen(false)}
                    className={cn(
                      'rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-[10px] uppercase tracking-widest font-bold transition hover:bg-gold hover:text-black',
                      location.pathname === link.path ? 'text-gold' : 'text-white/70'
                    )}
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
