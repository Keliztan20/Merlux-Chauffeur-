import { motion, AnimatePresence } from 'motion/react';
import {
  Home, MapPin, Clock, User,
  Settings, Bell, CreditCard, History,
  ChevronRight, Star, LogOut, Plane, Loader2, Truck, X, ChevronLeft,
  Search, ArrowUpDown, Filter, RefreshCw, RotateCcw, ArrowUp, ArrowDown, CalendarArrowUp, CalendarArrowDown,
  Plus, Trash2, Ban, CheckCircle, DollarSign, Percent, Car, Shield, UserPlus, Edit2, Eye,
  Mail, Phone, Calendar, BarChart3, Users, LayoutGrid, Globe, Save, MoreVertical, Upload, CircleX, LocateFixed, UserCheck, XCircle, CheckSquare
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '../lib/utils';
import { auth, db, storage } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onAuthStateChanged, signOut, updateProfile } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/layout/Logo';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  isToday, parseISO
} from 'date-fns';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function AppDashboard() {
  const [activeTab, setActiveTab] = useState('bookings');
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [ratingBooking, setRatingBooking] = useState<any>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [expandedFeedback, setExpandedFeedback] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | null>(null);
  const [dateSort, setDateSort] = useState<'asc' | 'desc' | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Profile Edit State
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayBookings, setShowDayBookings] = useState(false);

  // Fleet State
  const [fleet, setFleet] = useState<any[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  // User Management State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  // Booking Management State
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<any>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Settings State
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'booking' | 'user' | 'vehicle', id: string } | null>(null);

  const navigate = useNavigate();

  const isAdmin = userProfile?.role === 'admin';
  const isDriver = userProfile?.role === 'driver';

  const navItems = [
    { id: 'bookings', label: 'Bookings', icon: LayoutGrid, adminOnly: false },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
    { id: 'calendar', label: 'Calendar', icon: Calendar, adminOnly: false },
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'fleet', label: 'Fleet', icon: Truck, adminOnly: true },
    { id: 'settings', label: 'Settings', icon: Settings, adminOnly: true },
    { id: 'profile', label: 'Profile', icon: User, adminOnly: false },
  ];

  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    }
  };

  const markAllAsRead = async () => {
    // Implementation for marking all notifications as read
  };

  const markAsRead = async (id: string) => {
    // Implementation for marking a single notification as read
  };

  const activeBooking = bookings.find(b => b.status === 'confirmed' || b.status === 'pending');

  const clearFilters = () => {
    setSearchQuery('');
    setPriceSort(null);
    setDateSort(null);
    setTypeFilter('all');
    setServiceFilter('all');
    setStatusFilter('all');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Data is real-time via onSnapshot, so we just simulate a refresh for UX
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleRateDriver = async (bookingId: string, rating: number, comment: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        rating,
        ratingComment: comment,
        updatedAt: serverTimestamp()
      });
      setRatingBooking(null);
      setRatingValue(0);
      setRatingComment('');
    } catch (err) {
      console.error('Error rating driver:', err);
    }
  };

  const drivers = allUsers.filter(u => u.role === 'driver');

  const updateBookingStatus = async (bookingId: string, status: string, driverId?: string) => {
    try {
      const updateData: any = { status, updatedAt: serverTimestamp() };
      if (driverId !== undefined) {
        updateData.driverId = driverId;
        // If assigning a driver, status should be 'assigned'
        if (status === 'assigned' && !driverId) {
          // If clearing driver, set back to confirmed
          updateData.status = 'confirmed';
        }
      }

      // If driver rejects, keep status as rejected so admin can see it
      if (status === 'rejected') {
        updateData.status = 'rejected';
      }

      await updateDoc(doc(db, 'bookings', bookingId), updateData);
    } catch (err) {
      console.error('Error updating booking:', err);
    }
  };

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
        } else {
          // If no profile exists, set a default one to allow the app to load
          setUserProfile({ role: 'customer', email: user.email });
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
        // Even on error, set a default profile to prevent stuck loading
        setUserProfile({ role: 'customer', email: user.email });
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    if (userProfile) {
      setProfileName(userProfile.name || user?.displayName || '');
      setProfilePhone(userProfile.phone || '');
    }
  }, [userProfile, user]);

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      await updateProfile(user, { displayName: profileName });
      await updateDoc(doc(db, 'users', user.uid), {
        name: profileName,
        phone: profilePhone,
        updatedAt: serverTimestamp()
      });
      setUserProfile((prev: any) => ({ ...prev, name: profileName, phone: profilePhone }));
      alert('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Time Formatter
  const formatTimeToAMPM = (timeStr: string) => {
    if (!timeStr) return '';
    try {
      // Check if it's already in AM/PM format
      if (timeStr.toLowerCase().includes('am') || timeStr.toLowerCase().includes('pm')) return timeStr;

      const [hours, minutes] = timeStr.split(':');
      if (hours === undefined || minutes === undefined) return timeStr;

      let h = parseInt(hours);
      const m = minutes;
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12;
      h = h ? h : 12; // the hour '0' should be '12'
      return `${h}:${m} ${ampm}`;
    } catch (e) {
      return timeStr;
    }
  };

  // Analytics Computation
  const analytics = useMemo(() => {
    const totalRevenue = bookings
      .filter(b => b.paymentStatus === 'paid' || b.status === 'completed')
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const pendingBookings = bookings.filter(b => b.status === 'pending').length;
    const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
    const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const assignedBookings = bookings.filter(b => b.status === 'assigned').length;
    const acceptedBookings = bookings.filter(b => b.status === 'accepted').length;

    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);

    const currentMonthBookings = bookings.filter(b => {
      if (!b.date) return false;
      const bDate = parseISO(b.date);
      return bDate >= currentMonthStart && bDate <= currentMonthEnd;
    });

    const currentMonthRevenue = currentMonthBookings
      .filter(b => b.paymentStatus === 'paid' || b.status === 'completed')
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    // Group by date for charts
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return format(d, 'MMM dd');
    }).reverse();

    const revenueData = last7Days.map(day => {
      const dayBookings = bookings.filter(b => {
        const bDate = b.createdAt?.seconds ? format(new Date(b.createdAt.seconds * 1000), 'MMM dd') : '';
        return bDate === day && (b.paymentStatus === 'paid' || b.status === 'completed');
      });
      return {
        name: day,
        revenue: dayBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0),
        bookings: dayBookings.length
      };
    });

    return {
      totalRevenue,
      completedBookings,
      pendingBookings,
      cancelledBookings,
      confirmedBookings,
      assignedBookings,
      acceptedBookings,
      currentMonthCount: currentMonthBookings.length,
      currentMonthRevenue,
      revenueData
    };
  }, [bookings]);

  // Calendar Helpers
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(b => {
      if (!b.date) return false;
      const bDate = parseISO(b.date);
      return isSameDay(bDate, date);
    });
  };

  useEffect(() => {
    if (!user || !userProfile) return;

    // Fetch bookings based on role
    let q;
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeFleet: (() => void) | undefined;
    let unsubscribeSettings: (() => void) | undefined;

    if (isAdmin) {
      q = query(collection(db, 'bookings'), orderBy('createdAt', 'desc'));
    } else if (isDriver) {
      q = query(
        collection(db, 'bookings'),
        where('driverId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    } else {
      q = query(
        collection(db, 'bookings'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
    }

    // Fetch all users for everyone (to see driver/customer info)
    const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    unsubscribeUsers = onSnapshot(usersQ, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setAllUsers(usersData);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'users');
    });

    if (isAdmin) {
      // Fetch fleet
      const fleetQ = query(collection(db, 'fleet'), orderBy('name', 'asc'));
      unsubscribeFleet = onSnapshot(fleetQ, (snapshot) => {
        const fleetData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setFleet(fleetData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'fleet');
      });

      // Fetch system settings
      const settingsRef = doc(db, 'settings', 'system');
      unsubscribeSettings = onSnapshot(settingsRef, (docSnap) => {
        if (docSnap.exists()) {
          setSystemSettings(docSnap.data());
        } else {
          // Initialize default settings
          const defaultSettings = {
            basePrice: 50,
            kmPrice: 2.5,
            taxPercentage: 10,
            services: [
              { id: 'airport', name: 'Airport Transfer', desc: 'To or from Melbourne Airport', icon: 'Plane' },
              { id: 'corporate', name: 'Corporate Travel', desc: 'Professional business transport', icon: 'Briefcase' },
              { id: 'wedding', name: 'Wedding Service', desc: 'Luxury for your special day', icon: 'Heart' },
              { id: 'tour', name: 'Private Tour', desc: 'Bespoke regional Victoria tours', icon: 'Map' },
              { id: 'hourly', name: 'Hourly Hire', desc: 'Chauffeur at your disposal', icon: 'Clock' },
            ]
          };
          setDoc(settingsRef, defaultSettings);
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'settings/system');
      });
    }

    // Auto-cancel past bookings
    const checkPastBookings = async () => {
      const now = new Date();
      const pastBookings = bookings.filter(b => {
        if (!b.date || b.status === 'completed' || b.status === 'cancelled') return false;
        const bDate = parseISO(b.date);
        // If date is before today (not including today)
        return bDate < now && !isToday(bDate);
      });

      for (const booking of pastBookings) {
        try {
          await updateDoc(doc(db, 'bookings', booking.id), {
            status: 'cancelled',
            updatedAt: serverTimestamp(),
            cancellationReason: 'Booking date passed'
          });
        } catch (err) {
          console.error('Error auto-cancelling booking:', err);
        }
      }
    };

    if (bookings.length > 0) {
      checkPastBookings();
    }

    const unsubscribeBookings = onSnapshot(q, (snapshot) => {
      let bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Drivers should see rides assigned to them
      if (isDriver) {
        bookingsData = bookingsData.filter(b => b.driverId === user.uid);
      }

      setBookings(bookingsData);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'bookings');
      setLoading(false);
    });

    return () => {
      unsubscribeBookings();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeFleet) unsubscribeFleet();
      if (unsubscribeSettings) unsubscribeSettings();
    };
  }, [user, userProfile, isAdmin, isDriver]);

  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error updating booking status:', err);
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    setConfirmDelete({ type: 'booking', id: bookingId });
  };

  const executeDeleteBooking = async (bookingId: string) => {
    try {
      await deleteDoc(doc(db, 'bookings', bookingId));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting booking:', err);
      handleFirestoreError(err, OperationType.DELETE, `bookings/${bookingId}`);
    }
  };

  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      await setDoc(doc(db, 'users', userId), {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowUserModal(false);
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateBooking = async (bookingId: string, data: any) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setShowBookingModal(false);
      setEditingBooking(null);
    } catch (err) {
      console.error('Error updating booking:', err);
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
    }
  };

  const filteredAndSortedBookings = useMemo(() => {
    let result = [...bookings];

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(b =>
        (b.guestName?.toLowerCase().includes(query)) ||
        (b.pickup?.toLowerCase().includes(query)) ||
        (b.dropoff?.toLowerCase().includes(query)) ||
        (b.guestEmail?.toLowerCase().includes(query)) ||
        (b.guestPhone?.toLowerCase().includes(query))
      );
    }

    // Filter by type (Vehicle Type)
    if (typeFilter !== 'all') {
      result = result.filter(b => (b.vehicleType || 'sedan').toLowerCase() === typeFilter.toLowerCase());
    }

    // Filter by service (Service Type)
    if (serviceFilter !== 'all') {
      result = result.filter(b => (b.serviceType || 'standard').toLowerCase() === serviceFilter.toLowerCase());
    }

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(b => b.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (priceSort) {
        const priceA = Number(a.price) || 0;
        const priceB = Number(b.price) || 0;
        return priceSort === 'asc' ? priceA - priceB : priceB - priceA;
      }

      if (dateSort) {
        const dateA = new Date(`${a.date} ${a.time}`).getTime();
        const dateB = new Date(`${b.date} ${b.time}`).getTime();
        return dateSort === 'asc' ? dateA - dateB : dateB - dateA;
      }

      // Default sort by createdAt
      const createdA = a.createdAt?.seconds || 0;
      const createdB = b.createdAt?.seconds || 0;
      return createdB - createdA;
    });

    return result;
  }, [bookings, searchQuery, typeFilter, serviceFilter, statusFilter, priceSort, dateSort]);

  const handleDeleteUser = async (userId: string) => {
    setConfirmDelete({ type: 'user', id: userId });
  };

  const executeDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting user:', err);
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    }
  };

  const handleBlockUser = async (userId: string, blocked: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        blocked,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error blocking user:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    setConfirmDelete({ type: 'vehicle', id: vehicleId });
  };

  const executeDeleteVehicle = async (vehicleId: string) => {
    try {
      await deleteDoc(doc(db, 'fleet', vehicleId));
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error deleting vehicle:', err);
      handleFirestoreError(err, OperationType.DELETE, `fleet/${vehicleId}`);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `fleet/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setEditingVehicle({ ...editingVehicle, img: url });
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleUpdateSettings = async (data: any) => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'system'), {
        ...data,
        updatedAt: serverTimestamp()
      }, { merge: true });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Error saving settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/system');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateVehicle = async (data: any) => {
    try {
      await addDoc(collection(db, 'fleet'), {
        ...data,
        createdAt: serverTimestamp()
      });
      setShowVehicleModal(false);
      setEditingVehicle(null);
    } catch (err) {
      console.error('Error creating vehicle:', err);
    }
  };

  const handleUpdateVehicle = async (vehicleId: string, data: any) => {
    try {
      if (vehicleId === 'new') {
        const newRef = doc(collection(db, 'fleet'));
        await setDoc(newRef, { ...data, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'fleet', vehicleId), {
          ...data,
          updatedAt: serverTimestamp()
        });
      }
      setShowVehicleModal(false);
      setEditingVehicle(null);
    } catch (err) {
      console.error('Error updating vehicle:', err);
      handleFirestoreError(err, OperationType.UPDATE, `fleet/${vehicleId}`);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'bookings':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-display text-gold">Bookings</h2>
                <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Manage and track all rides</p>
              </div>
            </div>

            {/* Filters Row - Relocated from Header */}
            <div className="flex flex-wrap items-center gap-3 bg-white/5 p-2 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2 px-3 border-r border-white/10 hidden md:flex">
                <Filter size={14} className="text-gold" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Filters</span>
              </div>

              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                <input
                  type="text"
                  placeholder="Search bookings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-xl px-2">
                  <Filter size={12} className="text-white/20" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-transparent py-2 text-[10px] text-white outline-none focus:ring-0 appearance-none min-w-[90px] font-bold uppercase tracking-widest cursor-pointer"
                  >
                    <option value="all" className="bg-black">All Status</option>
                    <option value="pending" className="bg-black">Pending</option>
                    <option value="confirmed" className="bg-black">Confirmed</option>
                    <option value="assigned" className="bg-black">Assigned</option>
                    <option value="accepted" className="bg-black">Accepted</option>
                    <option value="completed" className="bg-black">Completed</option>
                    <option value="cancelled" className="bg-black">Cancelled</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-xl px-2">
                  <Shield size={12} className="text-white/20" />
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className="bg-transparent py-2 text-[10px] text-white outline-none focus:ring-0 appearance-none min-w-[90px] font-bold uppercase tracking-widest cursor-pointer"
                  >
                    <option value="all" className="bg-black">All Services</option>
                    <option value="wedding" className="bg-black">Wedding</option>
                    <option value="tour" className="bg-black">Tour</option>
                    <option value="hourly" className="bg-black">Hourly</option>
                    <option value="airport" className="bg-black">Airport</option>
                    <option value="corporate" className="bg-black">Corporate</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-xl px-2">
                  <Car size={12} className="text-white/20" />
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="bg-transparent py-2 text-[10px] text-white outline-none focus:ring-0 appearance-none min-w-[90px] font-bold uppercase tracking-widest cursor-pointer"
                  >
                    <option value="all" className="bg-black">All Vehicles</option>
                    <option value="sedan" className="bg-black">Sedan</option>
                    <option value="suv" className="bg-black">SUV</option>
                    <option value="van" className="bg-black">Van</option>
                    <option value="luxury" className="bg-black">Luxury</option>
                  </select>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setPriceSort(prev => prev === 'asc' ? 'desc' : 'asc');
                      setDateSort(null);
                    }}
                    className={cn(
                      "p-2 rounded-xl border transition-all flex items-center gap-1.5",
                      priceSort ? "border-gold/50 bg-gold/10 text-gold" : "border-white/10 bg-black/20 text-white/40"
                    )}
                    title={priceSort === 'asc' ? 'Price: Low to High' : priceSort === 'desc' ? 'Price: High to Low' : 'Sort by Price'}
                  >
                    <div className="flex items-center gap-1">
                      <DollarSign size={14} />
                      {priceSort === 'asc' ? <ArrowUp size={10} /> : priceSort === 'desc' ? <ArrowDown size={10} /> : null}
                    </div>
                    <span className="text-[8px] font-bold uppercase hidden xl:inline">Price</span>
                  </button>

                  <button
                    onClick={() => {
                      setDateSort(prev => prev === 'asc' ? 'desc' : 'asc');
                      setPriceSort(null);
                    }}
                    className={cn(
                      "p-2 rounded-xl border transition-all flex items-center gap-1.5",
                      dateSort ? "border-gold/50 bg-gold/10 text-gold" : "border-white/10 bg-black/20 text-white/40"
                    )}
                    title={dateSort === 'asc' ? 'Date: Oldest First' : 'Date: Newest First'}
                  >
                    <div className="flex items-center gap-1">
                      {dateSort === 'asc' ? <CalendarArrowUp size={16} /> : dateSort === 'desc' ? <CalendarArrowDown size={16} /> : <Calendar size={14} />}
                    </div>
                    <span className="text-[8px] font-bold uppercase hidden xl:inline">Pickup</span>
                  </button>
                </div>

                <button
                  onClick={handleRefresh}
                  className="p-2 rounded-xl border border-white/10 bg-black/20 text-white/40 hover:text-gold transition-all"
                  title="Refresh Data"
                >
                  <RefreshCw size={14} className={cn(isRefreshing && "animate-spin")} />
                </button>

                {(searchQuery || priceSort || dateSort || statusFilter !== 'all' || typeFilter !== 'all' || serviceFilter !== 'all') && (
                  <button
                    onClick={clearFilters}
                    className="p-2 rounded-xl border border-gold/20 bg-gold/5 text-gold hover:bg-gold/10 transition-all"
                    title="Reset All Filters"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Booking Stats Section */}
            {isAdmin && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Bookings */}
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-1 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      Total Bookings
                    </p>
                    <div className="p-1.5 bg-gold/10 text-gold rounded-xl">
                      <LayoutGrid size={12} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-gold font-display">{bookings.length}</h3>
                    <p className="text-[10px] text-white/60">All Bookings</p>
                  </div>
                </div>

                {/* Revenue */}
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-1 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      Total Revenue
                    </p>
                    <div className="p-1.5 bg-green-500/10 text-green-500 rounded-xl">
                      <DollarSign size={12} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-green-500 font-display">${analytics.totalRevenue.toFixed(2)}</h3>
                    <p className="text-[10px] text-white/60">From Completed Bookings</p>
                  </div>
                </div>

                {/* Monthly */}
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-1 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      This Month
                    </p>
                    <div className="p-1.5 bg-blue-500/10 text-blue-500 rounded-xl">
                      <Calendar size={12} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-2xl font-bold text-blue-500 font-display">{analytics.currentMonthCount}</h3>
                    <p className="text-[10px] text-white/60">${analytics.currentMonthRevenue?.toFixed(2) || '0.00'} revenue</p>
                  </div>
                </div>

                <div className="glass p-4 rounded-2xl border border-white/5 col-span-2 lg:col-span-1">
                  <div className="flex justify-between items-center mb-3 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      Status Overview
                    </p>
                    <div className="p-1.5 bg-gold/10 text-gold rounded-xl">
                      <BarChart3 size={12} />
                    </div>
                  </div>

                  {/* One row, each column = icon + value */}
                  <div className="grid mt-2 grid-cols-6 gap-x-4 text-center">
                    {/* Pending */}
                    <div className="flex flex-col items-center">
                      <Clock size={12} className="text-gold mb-2" />
                      <span className="text-xs font-display text-gold">{analytics.pendingBookings}</span>
                    </div>

                    {/* Confirmed */}
                    <div className="flex flex-col items-center">
                      <CheckCircle size={12} className="text-blue-400 mb-2" />
                      <span className="text-xs font-display text-blue-400">{analytics.confirmedBookings}</span>
                    </div>

                    {/* Assigned */}
                    <div className="flex flex-col items-center">
                      <Truck size={12} className="text-purple-400 mb-2" />
                      <span className="text-xs font-display text-purple-400">{analytics.assignedBookings}</span>
                    </div>

                    {/* Accepted */}
                    <div className="flex flex-col items-center">
                      <UserCheck size={12} className="text-cyan-400 mb-2" />
                      <span className="text-xs font-display text-cyan-400">{analytics.acceptedBookings}</span>
                    </div>

                    {/* Completed */}
                    <div className="flex flex-col items-center">
                      <CheckSquare size={12} className="text-green-400 mb-2" />
                      <span className="text-xs font-display text-green-400">{analytics.completedBookings}</span>
                    </div>

                    {/* Cancelled */}
                    <div className="flex flex-col items-center">
                      <XCircle size={12} className="text-red-400 mb-2" />
                      <span className="text-xs font-display text-red-400">{analytics.cancelledBookings}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAndSortedBookings.map((booking) => (
                <div key={booking.id} className="glass p-5 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold mb-1">
                        Booked on: {booking.createdAt?.seconds
                          ? format(new Date(booking.createdAt.seconds * 1000), 'MMM dd, yyyy HH:mm')
                          : 'N/A'}
                      </p>
                      <h3 className="text-lg font-display text-white group-hover:text-gold transition-colors">
                        {booking.guestName || 'Guest Customer'}
                      </h3>
                    </div>

                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border",
                        booking.status === 'completed'
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : booking.status === 'confirmed'
                            ? "bg-blue-500/10 text-blue-400 border-blue-400/20"
                            : booking.status === 'assigned'
                              ? "bg-purple-500/10 text-purple-400 border-purple-400/20"
                              : booking.status === 'accepted'
                                ? "bg-cyan-500/10 text-cyan-400 border-cyan-400/20"
                                : booking.status === 'cancelled'
                                  ? "bg-red-500/10 text-red-400 border-red-400/20"
                                  : "bg-gold/10 text-gold border-gold/20"
                      )}
                    >
                      {/* Status icon + label */}
                      {booking.status === 'completed' && (
                        <CheckSquare className="h-3 w-3" />
                      )}
                      {booking.status === 'confirmed' && (
                        <CheckCircle className="h-3 w-3" />
                      )}
                      {booking.status === 'assigned' && (
                        <Truck className="h-3 w-3" />
                      )}
                      {booking.status === 'accepted' && (
                        <UserCheck className="h-3 w-3" />
                      )}
                      {booking.status === 'cancelled' && (
                        <XCircle className="h-3 w-3" />
                      )}
                      {booking.status === 'pending' && (
                        <Clock className="h-3 w-3" />
                      )}

                      <span className="sm:inline">{booking.status}</span>
                    </span>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-start gap-3">
                      <LocateFixed size={12} className="text-gold shrink-0 mt-0.5" />
                      <p className="text-xs text-white/70 truncate">{booking.pickup}</p>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin size={12} className="text-gold shrink-0 mt-0.5" />
                      <p className="text-xs text-white/70 truncate">{booking.dropoff}</p>
                    </div>

                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3">
                        <Calendar size={12} className="text-gold" />
                        <span className="text-[10px] text-white/60 font-bold uppercase tracking-tighter">{booking.date}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock size={12} className="text-gold" />
                        <span className="text-[10px] text-white/60 font-bold uppercase tracking-tighter">{formatTimeToAMPM(booking.time)}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Car size={12} className="text-gold" />
                        <span className="text-[10px] text-white/60 font-bold uppercase tracking-tighter">{booking.vehicleType || 'Sedan'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Service</span>
                      <span className="text-[10px] text-gold font-bold truncate uppercase">{booking.serviceType || 'Standard'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Distance</span>
                      <span className="text-[10px] text-white/70 truncate">{booking.distance || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">ETA</span>
                      <span className="text-[10px] text-white/70 truncate">{booking.duration || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 py-3 border-b border-white/5">
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Gmail</span>
                      <span className="text-[10px] text-white/70 truncate">{booking.guestEmail || 'N/A'}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Phone</span>
                      <span className="text-[10px] text-white/70 truncate">{booking.guestPhone || 'N/A'}</span>
                    </div>
                  </div>

                  {booking.status === 'completed' && booking.rating ? (
                    <div className="mb-4 p-3 bg-gold/5 rounded-xl border border-gold/20">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center">
                            <Star size={12} className="text-gold fill-gold" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-gold/40 font-bold">Customer Feedback</p>
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={8}
                                  className={cn(s <= booking.rating ? "text-gold fill-gold" : "text-white/10")}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] font-display text-gold">{booking.rating}.0</span>
                      </div>
                      {booking.ratingComment && (
                        <div className="mt-2">
                          <p className={cn(
                            "text-[10px] text-white/60 leading-relaxed italic",
                            !expandedFeedback.includes(booking.id) && "line-clamp-2"
                          )}>
                            "{booking.ratingComment}"
                          </p>
                          {booking.ratingComment.length > 60 && (
                            <button
                              onClick={() => setExpandedFeedback(prev =>
                                prev.includes(booking.id)
                                  ? prev.filter(id => id !== booking.id)
                                  : [...prev, booking.id]
                              )}
                              className="text-[9px] text-gold font-bold uppercase mt-1 hover:underline"
                            >
                              {expandedFeedback.includes(booking.id) ? 'Show Less' : 'View Full Feedback'}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : booking.driverId && (
                    <div className="mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gold/20 flex items-center justify-center">
                            <User size={12} className="text-gold" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Assigned Driver</p>
                            <p className="text-[10px] text-white font-bold">
                              {allUsers.find(u => u.id === booking.driverId)?.name || 'Unknown Driver'}
                            </p>
                            {(!isAdmin && !isDriver) && (
                              <p className="text-[9px] text-gold font-bold">
                                {allUsers.find(u => u.id === booking.driverId)?.phone || 'No Contact'}
                              </p>
                            )}
                          </div>
                        </div>
                        {booking.status === 'accepted' ? (
                          <div className="flex items-center gap-1 text-green-500">
                            <CheckCircle size={10} />
                            <span className="text-[8px] font-bold uppercase">Confirmed</span>
                          </div>
                        ) : booking.status === 'rejected' ? (
                          <div className="flex items-center gap-1 text-red-500">
                            <X size={10} />
                            <span className="text-[8px] font-bold uppercase">Rejected</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-white/20">
                            <Clock size={10} />
                            <span className="text-[8px] font-bold uppercase">Pending</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-2.5 bg-gold/5 rounded-xl border border-gold/10 mb-4">
                    <div className="flex flex-col">
                      <span className="text-[9px] uppercase tracking-widest text-gold/40 font-bold">Fare</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-display text-gold">${booking.price}</span>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gold/10 rounded-md border border-gold/20">
                          {booking.paymentMethod === 'cash' ? (
                            <DollarSign size={10} className="text-gold" />
                          ) : (
                            <CreditCard size={10} className="text-gold" />
                          )}
                          <span className="text-[8px] font-bold text-gold uppercase">{booking.paymentMethod || 'Stripe'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] uppercase tracking-widest text-gold/40 font-bold">Status</span>
                      <p className="text-[10px] font-bold text-white uppercase">{booking.paymentStatus}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {isAdmin && (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                          {booking.status === 'pending' && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                              className="p-2 sm:p-2.5 border border-green-500/20 bg-green-500/5 rounded-xl text-green-400 hover:bg-green-500/10 transition-all shrink-0"
                              title="Confirm"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {booking.status === 'confirmed' && (
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'pending')}
                              className="p-2 sm:p-2.5 border border-white/20 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all shrink-0"
                              title="Unconfirm"
                            >
                              <CircleX size={16} />
                            </button>
                          )}
                          {booking.status !== 'cancelled' && (
                            <div className="flex-1 relative min-w-0">
                              <select
                                onChange={(e) => updateBookingStatus(booking.id, 'assigned', e.target.value)}
                                value={booking.driverId || ''}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-2 sm:py-2.5 text-[10px] text-white outline-none focus:border-gold transition-all appearance-none truncate"
                              >
                                <option value="" className="bg-black">Assign</option>
                                {drivers.map(driver => (
                                  <option key={driver.id} value={driver.id} className="bg-black">{driver.name}</option>
                                ))}
                              </select>
                              <User size={12} className="absolute right-1.5 sm:right-3 top-1/2 -translate-y-1/2 text-white/20 pointer-events-none" />
                            </div>
                          )}

                          <button
                            onClick={() => {
                              setViewingBooking(booking);
                              setShowViewModal(true);
                            }}
                            className="p-2 sm:p-2.5 border border-gold/20 bg-gold/5 rounded-xl text-gold hover:bg-gold/10 transition-all shrink-0"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            onClick={() => {
                              setEditingBooking(booking);
                              setShowBookingModal(true);
                            }}
                            className="p-2 sm:p-2.5 border border-blue-500/20 bg-blue-500/5 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all shrink-0"
                            title="Edit Booking"
                          >
                            <Edit2 size={16} />
                          </button>

                          <button
                            onClick={() => handleDeleteBooking(booking.id)}
                            className="p-2 sm:p-2.5 border border-red-500/20 bg-red-500/5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all shrink-0"
                            title="Delete Booking"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    )}

                    {isDriver && booking.driverId === user.uid && (
                      <div className="space-y-2">
                        {booking.status === 'assigned' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'accepted')}
                              className="bg-green-500 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                            >
                              Confirm Ride
                            </button>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'rejected')}
                              className="bg-red-500 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                            >
                              Reject Ride
                            </button>
                          </div>
                        )}
                        {booking.status === 'accepted' && (
                          <div className="space-y-2">
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'completed')}
                              className="w-full bg-gold text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                            >
                              Complete Ride
                            </button>
                            <button
                              onClick={() => updateBookingStatus(booking.id, 'assigned')}
                              className="w-full bg-white/10 text-white border border-white/20 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                            >
                              Unconfirm Ride
                            </button>
                          </div>
                        )}
                        {booking.status === 'rejected' && (
                          <button
                            onClick={() => updateBookingStatus(booking.id, 'assigned')}
                            className="w-full bg-white/10 text-white border border-white/20 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                          >
                            Unreject Ride
                          </button>
                        )}
                      </div>
                    )}

                    {!isAdmin && !isDriver && booking.status === 'completed' && !booking.rating && (
                      <button
                        onClick={() => {
                          setRatingBooking(booking);
                          setRatingValue(0);
                          setRatingComment('');
                        }}
                        className="w-full bg-gold text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2"
                      >
                        <Star size={14} className="fill-black" />
                        Rate Your Experience
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Revenue', value: `$${analytics.totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'text-green-500' },
                { label: 'Completed', value: analytics.completedBookings, icon: CheckCircle, color: 'text-blue-500' },
                { label: 'Pending', value: analytics.pendingBookings, icon: Clock, color: 'text-gold' },
                { label: 'Total Rides', value: bookings.length, icon: LayoutGrid, color: 'text-purple-500' },
              ].map((stat, i) => (
                <div key={i} className="glass p-6 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <div className={cn("p-2 rounded-lg bg-white/5", stat.color)}>
                      <stat.icon size={20} />
                    </div>
                  </div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1">{stat.label}</p>
                  <h3 className="text-2xl font-display">{stat.value}</h3>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="glass p-8 rounded-2xl border border-white/5">
                <h3 className="text-lg font-display text-gold mb-6 uppercase tracking-widest">Revenue Trend (Last 7 Days)</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.revenueData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        itemStyle={{ color: '#D4AF37', fontSize: '12px' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#D4AF37" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass p-8 rounded-2xl border border-white/5">
                <h3 className="text-lg font-display text-gold mb-6 uppercase tracking-widest">Booking Volume</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                      <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }}
                        cursor={{ fill: '#ffffff05' }}
                      />
                      <Bar dataKey="bookings" fill="#D4AF37" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );
      case 'calendar':
        return (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-display text-gold">Booking Calendar</h3>
              <div className="flex items-center gap-4">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-full">
                  <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-bold uppercase tracking-widest min-w-[140px] text-center">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-white/5 rounded-full">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            <div className="glass p-8 rounded-3xl border border-white/5">
              <div className="grid grid-cols-7 gap-4 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-white/20">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-4">
                {calendarDays.map((day, i) => {
                  const dayBookings = getBookingsForDate(day);
                  return (
                    <div
                      key={i}
                      onClick={() => {
                        setSelectedDate(day);
                        if (dayBookings.length > 0) setShowDayBookings(true);
                      }}
                      className={cn(
                        "aspect-square rounded-2xl border p-2 transition-all cursor-pointer relative group",
                        !isSameMonth(day, currentMonth) ? "opacity-10 border-transparent" :
                          isToday(day) ? "border-gold bg-gold/5" : "border-white/5 hover:border-white/20",
                        dayBookings.length > 0 && "bg-white/5"
                      )}
                    >
                      <span className={cn(
                        "text-xs font-bold",
                        isToday(day) ? "text-gold" : "text-white/40"
                      )}>
                        {format(day, 'd')}
                      </span>
                      {dayBookings.length > 0 && (
                        <div className="absolute bottom-2 right-2 flex flex-col items-end">
                          <div className="w-1.5 h-1.5 bg-gold rounded-full mb-1" />
                          <span className="text-[8px] font-bold text-gold">{dayBookings.length} Rides</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 'users':
        if (!isAdmin) return null;
        const filteredUsers = allUsers.filter(u =>
          u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          u.role?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-display text-gold">User Management</h3>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage staff and customers</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                  <input
                    type="text"
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditingUser({ role: 'customer', name: '', email: '', phone: '' });
                    setShowUserModal(true);
                  }}
                  className="btn-primary px-6 py-2 flex items-center gap-2 shrink-0"
                >
                  <UserPlus size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Add User</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map((u) => (
                <div key={u.id} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border transition-all",
                        u.role === 'admin' ? "bg-red-500/10 border-red-500/20 text-red-500" :
                          u.role === 'driver' ? "bg-blue-500/10 border-blue-500/20 text-blue-500" :
                            "bg-gold/10 border-gold/20 text-gold"
                      )}>
                        {u.role === 'admin' ? <Shield size={20} /> : u.role === 'driver' ? <Car size={20} /> : <User size={20} />}
                      </div>
                      <div className="flex flex-col">
                        <h4 className="text-lg font-display text-white group-hover:text-gold transition-colors leading-tight">{u.name || 'No Name'}</h4>
                        <span className="text-[9px] text-white/30 font-mono mt-0.5">ID: {u.id}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border",
                      u.role === 'admin' ? "bg-red-500/10 text-red-400 border-red-400/20" :
                        u.role === 'driver' ? "bg-blue-500/10 text-blue-400 border-blue-400/20" :
                          "bg-gold/10 text-gold border-gold/20"
                    )}>
                      {u.role}
                    </span>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-3">
                      <Mail size={14} className="text-gold shrink-0" />
                      <p className="text-xs text-white/60 truncate">{u.email || 'No Email'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone size={14} className="text-gold shrink-0" />
                      <p className="text-xs text-white/60">{u.phone || 'No Phone'}</p>
                    </div>
                    {u.createdAt && (
                      <div className="flex items-center gap-3">
                        <Calendar size={14} className="text-gold shrink-0" />
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                          Joined: {u.createdAt?.seconds ? format(new Date(u.createdAt.seconds * 1000), 'MMM dd, yyyy') : 'N/A'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-white/5 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setShowUserModal(true);
                      }}
                      className="flex-1 px-3 py-2 border border-blue-500/30 bg-blue-500/5 text-blue-400 hover:bg-blue-500/20 hover:border-blue-500 transition-all rounded-xl flex items-center justify-center gap-2"
                    >
                      <Edit2 size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="flex-1 px-3 py-2 border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:border-red-500 transition-all rounded-xl flex items-center justify-center gap-2"
                    >
                      <Trash2 size={14} />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'fleet':
        if (!isAdmin) return null;
        const filteredFleet = fleet.filter(v =>
          v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.type?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-display text-gold">Fleet Management</h3>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage your luxury vehicles</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                  <input
                    type="text"
                    placeholder="Search fleet..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-10 py-2 text-xs text-white outline-none focus:border-gold transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditingVehicle({ name: '', model: '', type: 'sedan', pax: 3, bags: 2, price: 95, img: '', kmRanges: [] });
                    setShowVehicleModal(true);
                  }}
                  className="btn-primary px-6 py-2 flex items-center gap-2 shrink-0"
                >
                  <Plus size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Add Vehicle</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredFleet.map((v) => (
                <div key={v.id} className="glass rounded-2xl overflow-hidden border border-white/5 group hover:border-gold/30 transition-all">
                  <div className="h-48 relative overflow-hidden">
                    <img src={v.img || 'https://picsum.photos/seed/car/800/400'} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <p className="text-xl font-display">{v.name}</p>
                      <p className="text-xs text-white/60">{v.model}</p>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-white/40">
                          <Users size={14} />
                          <span className="text-xs font-bold">{v.pax}</span>
                        </div>
                        <div className="flex items-center gap-2 text-white/40">
                          <Truck size={14} />
                          <span className="text-xs font-bold">{v.bags}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Price</p>
                        <p className="text-lg font-display text-gold">${v.price}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingVehicle(v);
                          setShowVehicleModal(true);
                        }}
                        className="flex-1 bg-white/5 hover:bg-gold hover:text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                      >
                        Edit Vehicle
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v.id)}
                        className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'settings':
        if (!isAdmin) return null;
        return (
          <div className="space-y-8">
            <h3 className="text-2xl font-display text-gold">System Settings</h3>
            <div className="glass p-8 rounded-3xl border border-white/5 max-w-2xl">
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Global Price ($)</label>
                  <input
                    type="number"
                    value={systemSettings?.basePrice || 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, basePrice: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Price per KM ($)</label>
                  <input
                    type="number"
                    value={systemSettings?.kmPrice || 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, kmPrice: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Tax Percentage (%)</label>
                  <input
                    type="number"
                    value={systemSettings?.taxPercentage || 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, taxPercentage: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <button
                  onClick={() => handleUpdateSettings(systemSettings)}
                  disabled={isSavingSettings}
                  className="w-full bg-gold text-black py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                >
                  {isSavingSettings ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-8 max-w-2xl">
            <h3 className="text-2xl font-display text-gold">Profile Settings</h3>
            <div className="glass p-8 rounded-3xl border border-white/5">
              <div className="flex items-center gap-6 mb-8">
                <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center border-2 border-gold/20">
                  <User size={40} className="text-gold" />
                </div>
                <div>
                  <p className="text-lg font-display">{userProfile?.name || 'User'}</p>
                  <p className="text-xs text-white/40">{user?.email}</p>
                  <span className="text-[8px] bg-gold/10 text-gold px-2 py-0.5 rounded uppercase font-bold mt-1 inline-block">
                    {userProfile?.role}
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Full Name</label>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Phone Number</label>
                  <input
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdatingProfile}
                  className="w-full bg-gold text-black py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                >
                  {isUpdatingProfile ? 'Updating...' : 'Update Profile'}
                </button>
              </div>
            </div>
          </div>
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
              <div className="flex items-center gap-4">
                <button onClick={() => setActiveTab('home')} className="p-2 hover:bg-white/5 rounded-full">
                  <ChevronLeft size={24} />
                </button>
                <h3 className="text-2xl font-display">User Management</h3>
              </div>
              <button
                onClick={() => {
                  setEditingUser({ role: 'customer', name: '', email: '', phone: '' });
                  setShowUserModal(true);
                }}
                className="btn-primary px-6 py-2 flex items-center gap-2"
              >
                <UserPlus size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">Add User</span>
              </button>
            </div>

            <div className="space-y-4">
              {allUsers.map((u) => (
                <div key={u.id} className={cn(
                  "glass p-6 rounded-2xl flex items-center justify-between border transition-all",
                  u.blocked ? "border-red-500/30 bg-red-500/5" : "border-white/5"
                )}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                      <User size={24} className={cn(u.blocked ? "text-red-500" : "text-gold/50")} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold">{u.name}</p>
                        {u.blocked && (
                          <span className="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded uppercase font-bold">Blocked</span>
                        )}
                      </div>
                      <p className="text-xs text-white/40">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded",
                      u.role === 'admin' ? "bg-red-500/20 text-red-500" :
                        u.role === 'driver' ? "bg-blue-500/20 text-blue-500" :
                          "bg-gold/20 text-gold"
                    )}>
                      {u.role}
                    </span>
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setShowUserModal(true);
                      }}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-gold"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleBlockUser(u.id, !u.blocked)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        u.blocked ? "text-green-500 hover:bg-green-500/10" : "text-red-500 hover:bg-red-500/10"
                      )}
                      title={u.blocked ? "Unblock User" : "Block User"}
                    >
                      {u.blocked ? <CheckCircle size={16} /> : <Ban size={16} />}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors text-white/20 hover:text-red-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'settings':
        if (!isAdmin) return null;
        return (
          <div className="space-y-12">
            <div className="flex items-center gap-4">
              <button onClick={() => setActiveTab('home')} className="p-2 hover:bg-white/5 rounded-full">
                <ChevronLeft size={24} />
              </button>
              <h3 className="text-2xl font-display">System Settings</h3>
            </div>

            {/* Pricing Settings */}
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="text-lg font-display text-gold">Pricing & Tax</h4>
                  <p className="text-xs text-white/40 uppercase tracking-widest">Configure base rates and taxation</p>
                </div>
                <button
                  onClick={() => setShowSettingsModal(true)}
                  className="text-gold text-xs font-bold uppercase tracking-widest hover:underline"
                >
                  Edit Settings
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-gold/10 text-gold rounded-lg">
                      <DollarSign size={18} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Price</span>
                  </div>
                  <p className="text-2xl font-display">${systemSettings?.basePrice || 0}</p>
                </div>
                <div className="glass p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                      <MapPin size={18} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Price per KM</span>
                  </div>
                  <p className="text-2xl font-display">${systemSettings?.kmPrice || 0}</p>
                </div>
                <div className="glass p-6 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                      <Percent size={18} />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Tax Rate</span>
                  </div>
                  <p className="text-2xl font-display">{systemSettings?.taxPercentage || 0}%</p>
                </div>
              </div>
            </section>

            {/* Fleet Management */}
            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <div>
                  <h4 className="text-lg font-display text-gold">Fleet Management</h4>
                  <p className="text-xs text-white/40 uppercase tracking-widest">Manage vehicles and availability</p>
                </div>
                <button
                  onClick={() => {
                    setEditingVehicle({ name: '', model: '', type: 'sedan', pax: 3, bags: 2, price: 95, img: '' });
                    setShowVehicleModal(true);
                  }}
                  className="btn-primary px-6 py-2 flex items-center gap-2"
                >
                  <Plus size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Add Vehicle</span>
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {fleet.map((v) => (
                  <div key={v.id} className="glass rounded-2xl overflow-hidden border border-white/5 group hover:border-gold/30 transition-all">
                    <div className="h-40 relative overflow-hidden">
                      <img src={v.img || null} alt={v.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />
                      <div className="absolute bottom-4 left-4">
                        <p className="text-lg font-display">{v.name}</p>
                        <p className="text-xs text-white/60">{v.model}</p>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex justify-between items-center text-xs uppercase tracking-widest font-bold">
                        <div className="flex gap-4">
                          <span className="text-white/40">Pax: <span className="text-white">{v.pax}</span></span>
                          <span className="text-white/40">Bags: <span className="text-white">{v.bags}</span></span>
                        </div>
                        <span className="text-gold">${v.price}</span>
                      </div>

                      {v.kmRanges && v.kmRanges.length > 0 && (
                        <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                          <p className="text-[8px] text-white/40 uppercase font-bold mb-2">KM Surcharges</p>
                          <div className="flex flex-wrap gap-2">
                            {v.kmRanges.map((r: any, i: number) => (
                              <span key={i} className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-full border border-gold/20">
                                {r.label}km: +${r.surcharge}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-4 border-t border-white/5">
                        <button
                          onClick={() => {
                            setEditingVehicle(v);
                            setShowVehicleModal(true);
                          }}
                          className="flex-1 bg-white/5 hover:bg-gold hover:text-black py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
                        >
                          Edit Vehicle
                        </button>
                        <button
                          onClick={() => handleDeleteVehicle(v.id)}
                          className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Admin Services */}
            <section className="space-y-6">
              <div>
                <h4 className="text-lg font-display text-gold">Admin Services</h4>
                <p className="text-xs text-white/40 uppercase tracking-widest">Configure available service categories</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {systemSettings?.services?.map((service: any) => (
                  <div key={service.id} className="glass p-6 rounded-2xl border border-white/5 text-center space-y-3">
                    <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center mx-auto text-gold">
                      <Shield size={24} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-widest">{service.name}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 bg-gold/10 border-2 border-gold rounded-full flex items-center justify-center mb-4 overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL || null} alt="Profile" className="w-full h-full object-cover" />
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
    <div className="flex flex-col min-h-screen bg-black text-white overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-black/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="p-4 lg:px-8 lg:py-4 flex flex-col gap-4">
          {/* Top Row: Logo & User Actions */}
          <div className="flex items-center justify-between">
            <Logo className="h-8 lg:h-10" />

            <div className="flex items-center gap-4">
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gold hover:bg-white/5 rounded-full transition-colors"
                >
                  <Bell size={22} />
                  {bookings.filter(b => !b.read).length > 0 && (
                    <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold text-white">
                      {bookings.filter(b => !b.read).length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold">{userProfile?.name || 'User'}</p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">{userProfile?.role}</p>
                </div>
                <div className="w-9 h-9 bg-gold/10 border border-gold/20 rounded-full flex items-center justify-center">
                  <User size={18} className="text-gold" />
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-white/40 hover:text-red-500 transition-colors"
                title="Logout"
              >
                <LogOut size={22} />
              </button>
            </div>
          </div>

          {/* Bottom Row: Navigation Tabs */}
          <div className="w-full">
            <nav className="flex items-center w-full bg-white/5 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
              {filteredNavItems.map((item) => (
                <button
                  key={`top-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 lg:px-5 py-2.5 rounded-xl transition-all group relative whitespace-nowrap",
                    activeTab === item.id
                      ? "text-black font-bold"
                      : "text-white/40 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon size={18} className={cn(
                    "transition-colors",
                    activeTab === item.id ? "text-black" : "text-gold group-hover:text-gold"
                  )} />
                  <span className="hidden lg:inline text-[10px] uppercase tracking-widest font-bold">{item.label}</span>
                  {activeTab === item.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 bg-gold rounded-xl -z-10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <main className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderTabContent()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Rating Modal */}
      <AnimatePresence>
        {ratingBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm glass p-8 rounded-3xl text-center border border-gold/20"
            >
              <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Star size={32} className="text-gold" />
              </div>
              <h3 className="text-2xl font-display mb-2">Rate Your Driver</h3>
              <p className="text-white/40 text-xs mb-8 uppercase tracking-widest">How was your ride to {ratingBooking.dropoff}?</p>

              <div className="flex justify-center gap-3 mb-6">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setRatingValue(star)}
                    onClick={() => setRatingValue(star)}
                    className="transition-all hover:scale-125"
                  >
                    <Star
                      size={32}
                      className={cn(
                        "transition-colors",
                        star <= ratingValue ? "text-gold fill-gold" : "text-white/10"
                      )}
                    />
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <textarea
                  value={ratingComment}
                  onChange={(e) => setRatingComment(e.target.value)}
                  placeholder="Share your experience (optional)..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-white outline-none focus:border-gold transition-all resize-none h-24"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setRatingBooking(null);
                    setRatingComment('');
                  }}
                  className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={ratingValue === 0}
                  onClick={() => handleRateDriver(ratingBooking.id, ratingValue, ratingComment)}
                  className="flex-1 bg-gold text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 disabled:hover:bg-gold"
                >
                  Submit
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
        {/* Booking Modal */}
        {showBookingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-3xl border border-gold/20 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">Edit Booking</h3>
                <button onClick={() => setShowBookingModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Guest Name</label>
                    <input
                      type="text"
                      value={editingBooking?.guestName || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, guestName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={editingBooking?.guestPhone || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, guestPhone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Pickup Address</label>
                  <input
                    type="text"
                    value={editingBooking?.pickup || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, pickup: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Dropoff Address</label>
                  <input
                    type="text"
                    value={editingBooking?.dropoff || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, dropoff: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Date</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split('T')[0]}
                      value={editingBooking?.date || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, date: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Time</label>
                    <input
                      type="time"
                      value={editingBooking?.time || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, time: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Service Type</label>
                    <select
                      value={editingBooking?.serviceType || 'standard'}
                      onChange={(e) => setEditingBooking({ ...editingBooking, serviceType: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all appearance-none"
                    >
                      <option value="standard" className="bg-black">Standard</option>
                      <option value="wedding" className="bg-black">Wedding</option>
                      <option value="tour" className="bg-black">Tour</option>
                      <option value="hourly" className="bg-black">Hourly</option>
                      <option value="airport" className="bg-black">Airport</option>
                      <option value="corporate" className="bg-black">Corporate</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Type</label>
                    <select
                      value={editingBooking?.vehicleType || 'sedan'}
                      onChange={(e) => setEditingBooking({ ...editingBooking, vehicleType: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all appearance-none"
                    >
                      <option value="sedan" className="bg-black">Sedan</option>
                      <option value="suv" className="bg-black">SUV</option>
                      <option value="van" className="bg-black">Van</option>
                      <option value="luxury" className="bg-black">Luxury</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price ($)</label>
                    <input
                      type="number"
                      value={editingBooking?.price || 0}
                      onChange={(e) => setEditingBooking({ ...editingBooking, price: parseFloat(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Status</label>
                    <select
                      value={editingBooking?.status || 'pending'}
                      onChange={(e) => setEditingBooking({ ...editingBooking, status: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all appearance-none"
                    >
                      <option value="pending" className="bg-black">Pending</option>
                      <option value="confirmed" className="bg-black">Confirmed</option>
                      <option value="assigned" className="bg-black">Assigned</option>
                      <option value="accepted" className="bg-black">Accepted</option>
                      <option value="completed" className="bg-black">Completed</option>
                      <option value="cancelled" className="bg-black">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowBookingModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateBooking(editingBooking.id, editingBooking)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* View Booking Modal */}
        {showViewModal && viewingBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-3xl border border-gold/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">Price Breakdown</h3>
                <button onClick={() => setShowViewModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Base Fare</span>
                    <span className="text-sm text-white font-bold">${(viewingBooking.basePrice || 50).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Distance ({viewingBooking.distance || 0} km)</span>
                    <span className="text-sm text-white font-bold">${((viewingBooking.distance || 0) * (viewingBooking.kmPrice || 2.5)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Service Fee</span>
                    <span className="text-sm text-white font-bold">${(viewingBooking.serviceFee || 0).toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-sm text-gold uppercase tracking-widest font-bold">Total Price</span>
                    <span className="text-xl font-display text-gold">${(Number(viewingBooking.price) || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Ride Details</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Service Type</p>
                        <p className="text-[10px] text-gold font-bold uppercase">{viewingBooking.serviceType || 'Standard'}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Vehicle Type</p>
                        <p className="text-[10px] text-white font-bold uppercase">{viewingBooking.vehicleType || 'Sedan'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowViewModal(false)}
                  className="w-full bg-gold text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmDelete && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[200] flex items-center justify-center p-6"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-sm glass p-8 rounded-3xl text-center border border-red-500/20"
              >
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 size={32} className="text-red-500" />
                </div>
                <h3 className="text-2xl font-display mb-2">Are you sure?</h3>
                <p className="text-white/40 text-xs mb-8 uppercase tracking-widest">
                  This action cannot be undone. You are about to delete this {confirmDelete.type}.
                </p>

                <div className="flex gap-4">
                  <button
                    onClick={() => setConfirmDelete(null)}
                    className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDelete.type === 'booking') executeDeleteBooking(confirmDelete.id);
                      else if (confirmDelete.type === 'user') executeDeleteUser(confirmDelete.id);
                      else if (confirmDelete.type === 'vehicle') executeDeleteVehicle(confirmDelete.id);
                    }}
                    className="flex-1 bg-red-500 text-white py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Modal */}
        {showUserModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-3xl border border-gold/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingUser?.id ? 'Edit User' : 'Create User'}
                </h3>
                <button onClick={() => setShowUserModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={editingUser?.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Email Address</label>
                  <input
                    type="email"
                    value={editingUser?.email || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Phone Number</label>
                  <input
                    type="tel"
                    value={editingUser?.phone || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="+1 234 567 890"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Role</label>
                  <select
                    value={editingUser?.role || 'customer'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all appearance-none"
                  >
                    <option value="customer" className="bg-black">Customer</option>
                    <option value="driver" className="bg-black">Driver</option>
                    <option value="admin" className="bg-black">Admin</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingUser.id) {
                        handleUpdateUser(editingUser.id, editingUser);
                      } else {
                        // For new user, we generate a random ID since we can't easily create Auth user here
                        const newId = Math.random().toString(36).substring(7);
                        handleUpdateUser(newId, { ...editingUser, id: newId, createdAt: serverTimestamp() });
                      }
                    }}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingUser?.id ? 'Save Changes' : 'Create User'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Vehicle Modal */}
        {showVehicleModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-3xl border border-gold/20 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingVehicle?.id ? 'Edit Vehicle' : 'Add Vehicle'}
                </h3>
                <button onClick={() => setShowVehicleModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Name</label>
                    <input
                      type="text"
                      value={editingVehicle?.name || ''}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, name: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Luxury Sedan"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Model</label>
                    <input
                      type="text"
                      value={editingVehicle?.model || ''}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, model: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Mercedes E-Class"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Type</label>
                  <select
                    value={editingVehicle?.type || 'sedan'}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, type: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all appearance-none"
                  >
                    <option value="sedan" className="bg-black">Sedan</option>
                    <option value="suv" className="bg-black">SUV</option>
                    <option value="van" className="bg-black">Van</option>
                    <option value="limo" className="bg-black">Limousine</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Passengers</label>
                    <input
                      type="number"
                      value={editingVehicle?.pax || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, pax: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Luggage</label>
                    <input
                      type="number"
                      value={editingVehicle?.bags || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, bags: parseInt(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price ($)</label>
                  <input
                    type="number"
                    value={editingVehicle?.price || 0}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, price: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Image</label>
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editingVehicle?.img || ''}
                        onChange={(e) => setEditingVehicle({ ...editingVehicle, img: e.target.value })}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder="Image URL..."
                      />
                      <label className="cursor-pointer bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-xl px-4 flex items-center justify-center transition-all">
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                        {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                      </label>
                    </div>
                    {editingVehicle?.img && (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-white/5">
                        <img
                          src={editingVehicle.img || null}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/car/800/450';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3">
                          <span className="text-[8px] uppercase tracking-widest font-bold text-white/60">Image Preview</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">KM-Based Surcharges</label>
                  <div className="space-y-2">
                    {(editingVehicle?.kmRanges || []).map((range: any, index: number) => (
                      <div key={index} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="0-25"
                          value={range.label}
                          onChange={(e) => {
                            const newRanges = [...editingVehicle.kmRanges];
                            newRanges[index].label = e.target.value;
                            setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                        />
                        <input
                          type="number"
                          placeholder="$0"
                          value={range.surcharge}
                          onChange={(e) => {
                            const newRanges = [...editingVehicle.kmRanges];
                            newRanges[index].surcharge = parseFloat(e.target.value);
                            setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                          }}
                          className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-gold"
                        />
                        <button
                          onClick={() => {
                            const newRanges = editingVehicle.kmRanges.filter((_: any, i: number) => i !== index);
                            setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                          }}
                          className="p-2 text-white/20 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => {
                        const newRanges = [...(editingVehicle.kmRanges || []), { label: '', surcharge: 0 }];
                        setEditingVehicle({ ...editingVehicle, kmRanges: newRanges });
                      }}
                      className="w-full border border-dashed border-white/10 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-white/40 hover:border-gold/50 hover:text-gold transition-all"
                    >
                      + Add KM Range
                    </button>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowVehicleModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingVehicle.id) {
                        handleUpdateVehicle(editingVehicle.id, editingVehicle);
                      } else {
                        handleCreateVehicle(editingVehicle);
                      }
                    }}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingVehicle?.id ? 'Save Changes' : 'Add Vehicle'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Settings Modal */}
        {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-8 rounded-3xl border border-gold/20"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">System Pricing</h3>
                <button onClick={() => setShowSettingsModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Global Price ($)</label>
                  <input
                    type="number"
                    value={systemSettings?.basePrice || 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, basePrice: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price per Kilometer ($)</label>
                  <input
                    type="number"
                    value={systemSettings?.kmPrice || 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, kmPrice: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Tax Percentage (%)</label>
                  <input
                    type="number"
                    value={systemSettings?.taxPercentage || 0}
                    onChange={(e) => setSystemSettings({ ...systemSettings, taxPercentage: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowSettingsModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateSettings(systemSettings)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Day Bookings Modal */}
        {showDayBookings && selectedDate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg glass p-8 rounded-3xl border border-gold/20 max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-display text-gold">Bookings for {format(selectedDate, 'MMM dd, yyyy')}</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{getBookingsForDate(selectedDate).length} Rides Scheduled</p>
                </div>
                <button onClick={() => setShowDayBookings(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {getBookingsForDate(selectedDate).map((booking) => (
                  <div key={booking.id} className="glass p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold">{booking.guestName}</p>
                        <p className="text-[10px] text-gold font-bold uppercase tracking-widest">{formatTimeToAMPM(booking.time)} | {booking.serviceType}</p>
                      </div>
                      <span className={cn(
                        "text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border",
                        booking.status === 'completed' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                          booking.status === 'confirmed' ? "bg-blue-500/10 text-blue-400 border-blue-400/20" :
                            "bg-gold/10 text-gold border-gold/20"
                      )}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                        <div className="w-1 h-1 bg-gold rounded-full" />
                        <span className="truncate">{booking.pickup}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-white/60">
                        <MapPin size={10} className="text-gold" />
                        <span className="truncate">{booking.dropoff}</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                      <div>
                        <p className="text-[8px] text-white/40 uppercase font-bold">Contact</p>
                        <p className="text-[10px] text-white/80">{booking.guestPhone || 'No phone'}</p>
                        <p className="text-[10px] text-white/60 truncate">{booking.guestEmail}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] text-white/40 uppercase font-bold">Vehicle</p>
                        <p className="text-[10px] text-white/80">{booking.vehicleId}</p>
                        <p className="text-[10px] text-gold font-bold">${booking.price}</p>
                      </div>
                    </div>
                    {booking.notes && (
                      <div className="bg-white/5 p-2 rounded-lg">
                        <p className="text-[8px] text-white/40 uppercase font-bold mb-1">Notes</p>
                        <p className="text-[10px] text-white/60 italic">"{booking.notes}"</p>
                      </div>
                    )}
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setActiveTab('bookings');
                          setSearchQuery(booking.guestName || '');
                          setShowDayBookings(false);
                        }}
                        className="text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-gold transition-colors"
                      >
                        View Full Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
