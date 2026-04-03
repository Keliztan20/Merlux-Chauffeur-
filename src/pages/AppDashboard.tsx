import { motion, AnimatePresence } from 'motion/react';
import { 
  Home, MapPin, Clock, User, 
  Settings, Bell, CreditCard, History,
  ChevronRight, Star, LogOut, Plane, Loader2, Truck, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { auth, db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/layout/Logo';

export default function AppDashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  const isAdmin = user?.email === 'admin@merlux.com.au' || userProfile?.role === 'admin';
  const isDriver = userProfile?.role === 'driver';

  useEffect(() => {
    if (user) {
      console.log('User signed in:', user.email);
      console.log('Admin status:', isAdmin);
      console.log('Driver status:', isDriver);
    }
  }, [user, isAdmin, isDriver]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      setUser(user);

      // Fetch user profile for role
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserProfile(userSnap.data());
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    if (!user || !userProfile) return;

    // Fetch bookings based on role
    let q;
    if (isAdmin) {
      q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
      
      // Also fetch all users if admin
      const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllUsers(usersData);
      });
      return () => unsubscribeUsers();
    } else if (isDriver) {
      q = query(
        collection(db, 'bookings'),
        where('status', 'in', ['pending', 'confirmed', 'completed']),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeBookings = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      const filteredBookings = isDriver 
        ? bookingsData.filter(b => !b.driverId || b.driverId === user.uid)
        : bookingsData;

      setBookings(filteredBookings);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching bookings:', err);
      setLoading(false);
    });

    return () => unsubscribeBookings();
  }, [user, userProfile, isAdmin, isDriver]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
  };

  const activeBooking = bookings.find(b => b.status === 'pending' || b.status === 'confirmed');
  const drivers = allUsers.filter(u => u.role === 'driver');

  const updateBookingStatus = async (bookingId: string, newStatus: string, driverId?: string) => {
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const bookingRef = doc(db, 'bookings', bookingId);
      const updateData: any = { status: newStatus };
      if (driverId !== undefined) {
        updateData.driverId = driverId;
      }
      await updateDoc(bookingRef, updateData);
    } catch (err) {
      console.error('Error updating booking status:', err);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <>
            {isAdmin && (
              <div className="bg-gold/10 border border-gold/20 p-4 rounded-xl mb-8">
                <p className="text-gold text-xs font-bold uppercase tracking-widest mb-1">Admin Dashboard</p>
                <p className="text-white/60 text-sm">You are viewing all bookings across the platform.</p>
              </div>
            )}
            {isDriver && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl mb-8">
                <p className="text-blue-500 text-xs font-bold uppercase tracking-widest mb-1">Driver Dashboard</p>
                <p className="text-white/60 text-sm">Manage your assigned rides and pick up new bookings.</p>
              </div>
            )}
            {activeBooking && !isDriver ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gold p-6 rounded-2xl text-black"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold opacity-60">Upcoming Ride</p>
                    <h3 className="text-2xl font-display">{activeBooking.date}, {activeBooking.time}</h3>
                  </div>
                  <div className="bg-black/10 p-2 rounded-lg">
                    <Clock size={20} />
                  </div>
                </div>
                
                <div className="flex gap-2 mb-6">
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                    activeBooking.paymentStatus === 'paid' ? "bg-black text-white" : "bg-red-500 text-white"
                  )}>
                    {activeBooking.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-widest bg-black/10 px-2 py-1 rounded">
                    {activeBooking.status}
                  </span>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-2 h-2 bg-black rounded-full" />
                    <p className="text-sm font-medium truncate">{activeBooking.pickup}</p>
                  </div>
                  <div className="w-px h-4 bg-black/20 ml-1" />
                  <div className="flex items-center gap-4">
                    <MapPin size={16} />
                    <p className="text-sm font-medium truncate">{activeBooking.dropoff}</p>
                  </div>

                  {activeBooking.flightNumber && (
                    <div className="mt-4 pt-4 border-t border-black/10">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Plane size={14} />
                          <span className="text-xs font-bold uppercase tracking-widest">{activeBooking.flightNumber}</span>
                        </div>
                        {activeBooking.flightStatus && (
                          <span className="text-[10px] font-bold uppercase tracking-widest bg-black/10 px-2 py-0.5 rounded">
                            {activeBooking.flightStatus}
                          </span>
                        )}
                      </div>
                      {activeBooking.flightETA && (
                        <p className="text-[10px] mt-1 opacity-60">
                          ETA: {new Date(activeBooking.flightETA).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => setActiveTab('map')}
                  className="w-full bg-black text-white py-3 rounded-xl mt-6 font-bold text-sm"
                >
                  Track Chauffeur
                </button>
              </motion.div>
            ) : !isDriver && (
              <div className="glass p-8 rounded-2xl text-center">
                <p className="text-white/40 text-sm mb-4">No active bookings</p>
                <button 
                  onClick={() => navigate('/booking')}
                  className="text-gold font-bold uppercase tracking-widest text-xs"
                >
                  Book a Ride
                </button>
              </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Plane, label: 'Airport', color: 'bg-blue-500/10 text-blue-500', service: 'airport' },
                { icon: Clock, label: 'Hourly', color: 'bg-purple-500/10 text-purple-500', service: 'hourly' },
                { icon: Star, label: 'VIP', color: 'bg-gold/10 text-gold', service: 'corporate' },
                { icon: History, label: 'History', color: 'bg-green-500/10 text-green-500', action: () => setActiveTab('wallet') },
              ].map((action, i) => (
                <button 
                  key={i} 
                  onClick={() => action.service ? navigate('/booking', { state: { service: action.service } }) : action.action?.()}
                  className="glass p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-white/5 transition-colors"
                >
                  <div className={cn("p-3 rounded-xl", action.color)}>
                    <action.icon size={24} />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest">{action.label}</span>
                </button>
              ))}
            </div>

            {isAdmin && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button 
                  onClick={() => setActiveTab('users')}
                  className="glass p-6 rounded-2xl flex items-center gap-6 hover:bg-gold hover:text-black transition-all group"
                >
                  <div className="p-4 bg-gold/10 text-gold rounded-xl group-hover:bg-black/10 group-hover:text-black">
                    <User size={32} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold uppercase tracking-widest">Manage Users</p>
                    <p className="text-xs opacity-60">View and manage all registered clients</p>
                  </div>
                </button>
                <button 
                  onClick={() => console.log('System settings coming soon')}
                  className="glass p-6 rounded-2xl flex items-center gap-6 hover:bg-gold hover:text-black transition-all group"
                >
                  <div className="p-4 bg-gold/10 text-gold rounded-xl group-hover:bg-black/10 group-hover:text-black">
                    <Settings size={32} />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold uppercase tracking-widest">System Settings</p>
                    <p className="text-xs opacity-60">Configure fleet, pricing, and services</p>
                  </div>
                </button>
              </div>
            )}

            {/* Recent Activity */}
            <section>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-sm uppercase tracking-widest font-bold text-white/40">
                  {isAdmin ? 'All Recent Bookings' : 'Your Recent Rides'}
                </h4>
                <button className="text-gold text-xs font-bold" onClick={() => setActiveTab('wallet')}>See All</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {bookings.slice(0, 12).map((booking) => (
                  <div key={booking.id} className="glass p-5 rounded-2xl flex flex-col gap-4 border border-white/5 hover:border-gold/30 transition-all group">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                          <History size={18} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-sm font-bold truncate max-w-[120px]">{booking.dropoff}</p>
                          <p className="text-[10px] text-white/40">{booking.date}</p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full",
                          booking.status === 'completed' ? "bg-green-500/10 text-green-500" : 
                          booking.status === 'confirmed' ? "bg-blue-500/10 text-blue-400" :
                          "bg-gold/10 text-gold"
                        )}>
                          {booking.status}
                        </span>
                        {isDriver && booking.driverId === user.uid && (
                          <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 rounded-full">
                            <Truck size={10} className="text-blue-400" />
                            <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Your Ride</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3 flex-1">
                      <div className="flex items-center justify-between py-2 border-y border-white/5">
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-widest text-white/30">Price</span>
                          <span className="text-sm font-display text-gold">${booking.price}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[8px] uppercase tracking-widest text-white/30">Payment</span>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[9px] uppercase font-bold",
                              booking.paymentStatus === 'paid' ? "text-green-500" : "text-red-500"
                            )}>
                              {booking.paymentStatus}
                            </span>
                            {booking.paymentMethod === 'cash' && (
                              <span className="text-[8px] bg-gold/20 text-gold px-1 rounded uppercase font-bold">Cash</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-white/40 flex items-center justify-between">
                            <span>Client:</span>
                            <span className="text-white/70">{booking.guestName || booking.userId || 'Unknown'}</span>
                          </p>
                          <p className="text-[10px] text-white/40 flex items-center justify-between">
                            <span>Driver:</span>
                            <span className="text-blue-400">
                              {booking.driverId ? (allUsers.find(u => u.id === booking.driverId)?.name || 'Assigned') : 'Unassigned'}
                            </span>
                          </p>
                        </div>
                      )}

                      {isDriver && !booking.driverId && booking.status === 'pending' && (
                        <div className="bg-gold/5 border border-gold/10 rounded-lg p-2 text-center">
                          <p className="text-[9px] text-gold font-bold uppercase tracking-widest">Available for Pickup</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      {(isAdmin || isDriver) && booking.status === 'pending' && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => updateBookingStatus(booking.id, 'confirmed', isDriver ? user.uid : undefined)}
                            className="flex-1 bg-green-500/20 text-green-500 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-500 hover:text-white transition-all"
                          >
                            {isDriver ? 'Accept Ride' : 'Confirm'}
                          </button>
                          {isAdmin && (
                            <button 
                              onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                              className="flex-1 bg-red-500/20 text-red-500 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      )}
                      
                      {(isAdmin || (isDriver && booking.driverId === user.uid)) && booking.status === 'confirmed' && (
                        <div className="flex flex-col gap-2">
                          <button 
                            onClick={() => updateBookingStatus(booking.id, 'completed')}
                            className="w-full bg-gold text-black py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                          >
                            Mark Completed
                          </button>
                          {isDriver && booking.driverId === user.uid && (
                            <button 
                              onClick={() => updateBookingStatus(booking.id, 'pending', '')}
                              className="w-full bg-white/5 text-white/40 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:text-red-500 transition-all"
                            >
                              Unaccept Ride
                            </button>
                          )}
                        </div>
                      )}

                      {isAdmin && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                        <div className="space-y-2">
                          <p className="text-[9px] uppercase tracking-widest font-bold text-white/30 text-center">Assign Driver</p>
                          <select 
                            value={booking.driverId || ''} 
                            onChange={(e) => updateBookingStatus(booking.id, booking.status, e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white/70 outline-none focus:border-gold transition-all appearance-none text-center"
                          >
                            <option value="" className="bg-black">Unassigned</option>
                            {drivers.map(driver => (
                              <option key={driver.id} value={driver.id} className="bg-black">
                                {driver.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {bookings.length === 0 && (
                  <p className="text-center text-white/20 text-xs py-12 border border-dashed border-white/5 rounded-xl">
                    No bookings found in the system
                  </p>
                )}
              </div>
            </section>
          </>
        );
      case 'map':
        return (
          <div className="glass p-12 rounded-2xl text-center space-y-4">
            <div className="w-16 h-16 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto">
              <MapPin size={32} />
            </div>
            <h3 className="text-xl font-display">Live Tracking</h3>
            <p className="text-white/40 text-sm max-w-xs mx-auto">
              Real-time chauffeur tracking is available 30 minutes before your scheduled pickup.
            </p>
            {!activeBooking && (
              <button 
                onClick={() => navigate('/booking')}
                className="btn-primary px-8 py-3"
              >
                Book a Ride
              </button>
            )}
          </div>
        );
      case 'wallet':
        return (
          <div className="space-y-8">
            <div className="glass p-8 rounded-2xl bg-gradient-to-br from-gold/20 to-transparent">
              <p className="text-[10px] uppercase tracking-widest font-bold text-gold mb-2">Total Spent</p>
              <h3 className="text-4xl font-display mb-6">
                ${bookings.filter(b => b.paymentStatus === 'paid').reduce((acc, b) => acc + (Number(b.price) || 0), 0).toFixed(2)}
              </h3>
              <div className="flex gap-4">
                <button className="flex-1 bg-white text-black py-3 rounded-xl font-bold text-xs uppercase tracking-widest">
                  Add Card
                </button>
                <button className="flex-1 border border-white/10 py-3 rounded-xl font-bold text-xs uppercase tracking-widest">
                  Methods
                </button>
              </div>
            </div>

            <section>
              <h4 className="text-sm uppercase tracking-widest font-bold text-white/40 mb-4">Payment History</h4>
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking.id} className="glass p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center">
                        <CreditCard size={18} className="text-white/40" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{booking.serviceType.toUpperCase()}</p>
                        <p className="text-[10px] text-white/40">{booking.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold">${booking.price}</p>
                      <p className={cn(
                        "text-[8px] uppercase font-bold",
                        booking.paymentStatus === 'paid' ? "text-green-500" : "text-red-500"
                      )}>
                        {booking.paymentStatus}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      case 'users':
        if (!isAdmin) return null;
        return (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h3 className="text-2xl font-display">User Management</h3>
              <span className="text-[10px] bg-gold text-black px-2 py-1 rounded font-bold uppercase tracking-widest">
                {allUsers.length} Registered Users
              </span>
            </div>
            
            <div className="space-y-4">
              {allUsers.map((u) => (
                <div key={u.id} className="glass p-6 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <User size={24} className="text-gold/50" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{u.name}</p>
                      <p className="text-xs text-white/40">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                      u.role === 'admin' ? "bg-red-500/20 text-red-500" : 
                      u.role === 'driver' ? "bg-blue-500/20 text-blue-500" : 
                      "bg-gold/20 text-gold"
                    )}>
                      {u.role}
                    </span>
                    <button className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                      <Settings size={16} className="text-white/20" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-gold/10 border-2 border-gold rounded-full flex items-center justify-center mb-4 overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-gold" />
                )}
              </div>
              <h3 className="text-2xl font-display">{userProfile?.name || user?.displayName || 'Merlux Client'}</h3>
              <p className="text-white/40 text-sm">{user?.email}</p>
              <div className="mt-4 flex gap-2">
                <span className="text-[10px] bg-gold/10 text-gold px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                  {userProfile?.role || 'Customer'}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { icon: User, label: 'Personal Information' },
                { icon: Bell, label: 'Notifications' },
                { icon: CreditCard, label: 'Payment Methods' },
                { icon: Settings, label: 'App Settings' },
              ].map((item, i) => (
                <button 
                  key={i} 
                  onClick={() => item.label === 'Notifications' ? setShowNotifications(true) : null}
                  className="w-full glass p-4 rounded-xl flex items-center justify-between hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <item.icon size={20} className="text-gold" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <ChevronRight size={16} className="text-white/20" />
                </button>
              ))}
            </div>

            <button 
              onClick={handleLogout}
              className="w-full bg-red-500/10 text-red-500 py-4 rounded-xl font-bold text-sm uppercase tracking-widest border border-red-500/20"
            >
              Sign Out
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-gold animate-spin" />
          <p className="text-gold text-xs font-bold uppercase tracking-[0.3em] animate-pulse">
            Loading Dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-black text-white overflow-x-hidden">
      {/* Header */}
      <header className="p-6 flex justify-between items-center bg-black/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Logo className="h-10" />
          {isAdmin && (
            <span className="text-[8px] bg-gold text-black px-2 py-0.5 rounded font-bold uppercase tracking-widest">
              Admin Access
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-6 mr-6">
            <span className="text-xs text-white/40 font-bold uppercase tracking-widest">
              {user?.email}
            </span>
          </div>
          <button onClick={handleLogout} className="text-white/40 hover:text-white transition-colors">
            <LogOut size={20} />
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 text-gold hover:bg-white/5 rounded-full transition-colors"
            >
              <Bell size={24} />
              {bookings.filter(b => b.status === 'pending').length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white">
                  {bookings.filter(b => b.status === 'pending').length}
                </span>
              )}
            </button>

            {/* Notifications Dropdown */}
            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 md:right-auto md:left-1/2 md:-translate-x-1/2 mt-4 w-80 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-[60]"
                >
                  <div className="p-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                    <h4 className="text-xs font-bold uppercase tracking-widest text-gold">Notifications</h4>
                    <button 
                      onClick={() => setShowNotifications(false)}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {bookings.slice(0, 5).map((booking) => (
                    <div 
                      key={booking.id} 
                      className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => {
                        setActiveTab('home');
                        setShowNotifications(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-lg shrink-0",
                          booking.status === 'pending' ? "bg-gold/10 text-gold" : "bg-green-500/10 text-green-500"
                        )}>
                          <Clock size={16} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">
                            {booking.status === 'pending' ? 'New Booking Request' : 'Booking Updated'}
                          </p>
                          <p className="text-[10px] text-white/40 truncate mt-0.5">
                            To: {booking.dropoff}
                          </p>
                          <p className="text-[8px] text-gold/60 mt-1 uppercase font-bold">
                            {booking.date} • {booking.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {bookings.length === 0 && (
                    <div className="p-8 text-center">
                      <Bell size={24} className="text-white/10 mx-auto mb-2" />
                      <p className="text-[10px] text-white/40 uppercase tracking-widest">No notifications</p>
                    </div>
                  )}
                </div>
                {bookings.length > 0 && (
                  <button 
                    onClick={() => {
                      setActiveTab('home');
                      setShowNotifications(false);
                    }}
                    className="w-full p-3 text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-gold transition-colors bg-white/5"
                  >
                    View All Bookings
                  </button>
                )}
              </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-8 pb-32">
        {renderTabContent()}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/5 px-8 py-4 flex justify-between items-center z-50">
        {[
          { id: 'home', icon: Home },
          { id: 'map', icon: MapPin },
          { id: 'wallet', icon: CreditCard },
          { id: 'profile', icon: User },
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "p-2 transition-all",
              activeTab === tab.id ? "text-gold scale-110" : "text-white/30"
            )}
          >
            <tab.icon size={24} />
          </button>
        ))}
      </nav>
    </div>
  );
}
