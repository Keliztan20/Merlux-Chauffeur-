import { motion, AnimatePresence } from 'motion/react';
import {
  Home, MapPin, Clock, User,
  Settings, Bell, CreditCard, History,
  ChevronRight, Star, LogOut, Plane, Loader2, Truck, X, ChevronLeft,
  Search, ArrowUpDown, Filter, RefreshCw, RotateCcw, ArrowUp, ArrowDown, CalendarArrowUp, CalendarArrowDown, Luggage,
  Plus, Trash2, Ban, CheckCircle, DollarSign, Percent, Car, Shield, UserPlus, Edit2, Eye, UserLock,
  Mail, Phone, Calendar, BarChart3, Users, LayoutGrid, Globe, Save, MoreVertical, Upload, CircleX, LocateFixed, UserCheck, XCircle, CheckSquare, CalendarCog
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
  const [activeSubTab, setActiveSubTab] = useState('fleet');
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
  const [profileAddress, setProfileAddress] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDayBookings, setShowDayBookings] = useState(false);

  // Fleet State
  const [fleet, setFleet] = useState<any[]>([]);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

  // Extras State
  const [extras, setExtras] = useState<any[]>([]);
  const [editingExtra, setEditingExtra] = useState<any>(null);
  const [showExtraModal, setShowExtraModal] = useState(false);

  // Coupon State
  const [coupons, setCoupons] = useState<any[]>([]);
  const [editingCoupon, setEditingCoupon] = useState<any>(null);
  const [showCouponModal, setShowCouponModal] = useState(false);

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
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'booking' | 'user' | 'vehicle' | 'coupon' | 'extra', id: string } | null>(null);

  const navigate = useNavigate();

  const isAdmin = userProfile?.role === 'admin';
  const isDriver = userProfile?.role === 'driver';

  const navItems = [
    { id: 'bookings', label: 'Bookings', icon: LayoutGrid, adminOnly: false },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
    { id: 'calendar', label: 'Calendar', icon: Calendar, adminOnly: false },
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'profile', label: 'Profile', icon: User, adminOnly: false },
    { id: 'management', label: 'Management', icon: Settings, adminOnly: true },
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
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${bookingId}`);
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
      setProfileAddress(userProfile.address || '');
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
        address: profileAddress,
        updatedAt: serverTimestamp()
      });
      setUserProfile((prev: any) => ({ ...prev, name: profileName, phone: profilePhone, address: profileAddress }));
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
    let unsubscribeExtras: (() => void) | undefined;
    let unsubscribeCoupons: (() => void) | undefined;
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

      // Fetch extras
      const extrasQ = query(collection(db, 'extras'), orderBy('name', 'asc'));
      unsubscribeExtras = onSnapshot(extrasQ, (snapshot) => {
        const extrasData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setExtras(extrasData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'extras');
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

      // Fetch coupons
      const couponsQ = query(collection(db, 'coupons'), orderBy('createdAt', 'desc'));
      unsubscribeCoupons = onSnapshot(couponsQ, (snapshot) => {
        const couponsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setCoupons(couponsData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'coupons');
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
      if (unsubscribeExtras) unsubscribeExtras();
      if (unsubscribeCoupons) unsubscribeCoupons();
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

  const handleCreateCoupon = async (data: any) => {
    try {
      await addDoc(collection(db, 'coupons'), {
        ...data,
        createdAt: serverTimestamp(),
        active: true
      });
      setShowCouponModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'coupons');
    }
  };

  const handleUpdateCoupon = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, 'coupons', id), data);
      setShowCouponModal(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `coupons/${id}`);
    }
  };

  const handleDeleteCoupon = (id: string) => {
    setConfirmDelete({ id, type: 'coupon' });
  };

  const executeDeleteCoupon = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'coupons', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `coupons/${id}`);
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

  const handleUpdateExtra = async (id: string | null, data: any) => {
    try {
      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'extras'));
        await setDoc(newRef, { ...data, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'extras', id), {
          ...data,
          updatedAt: serverTimestamp()
        });
      }
      setShowExtraModal(false);
      setEditingExtra(null);
    } catch (err) {
      console.error('Error updating extra:', err);
      handleFirestoreError(err, OperationType.WRITE, 'extras');
    }
  };

  const handleDeleteExtra = async (id: string) => {
    setConfirmDelete({ type: 'extra', id: id });
  };

  const executeDeleteExtra = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'extras', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `extras/${id}`);
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
            {/* Booking Stats Section */}
            {isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

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
                    <p className="text-[10px] text-white/60">All Time</p>
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

                {/* Status Overview */}
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-3 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      Status Overview
                    </p>
                    <div className="p-1.5 bg-gold/10 text-gold rounded-xl">
                      <BarChart3 size={12} />
                    </div>
                  </div>

                  <div className="grid mt-2 grid-cols-3 sm:grid-cols-6 gap-x-4 text-center">
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
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="custom-select min-w-[120px]"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="assigned">Assigned</option>
                  <option value="accepted">Accepted</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={serviceFilter}
                  onChange={(e) => setServiceFilter(e.target.value)}
                  className="custom-select min-w-[120px]"
                >
                  <option value="all">All Services</option>
                  <option value="wedding">Wedding</option>
                  <option value="tour">Tour</option>
                  <option value="hourly">Hourly</option>
                  <option value="airport">Airport</option>
                  <option value="corporate">Corporate</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="custom-select min-w-[120px]"
                >
                  <option value="all">All Vehicles</option>
                  <option value="sedan">Sedan</option>
                  <option value="suv">SUV</option>
                  <option value="van">Van</option>
                  <option value="luxury">Luxury</option>
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
                    {priceSort === 'asc' ? <ArrowDown size={10} /> : priceSort === 'desc' ? <ArrowUp size={10} /> : null}
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
                    {dateSort === 'asc' ? <CalendarArrowDown size={16} /> : dateSort === 'desc' ? <CalendarArrowUp size={16} /> : <Calendar size={14} />}
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

            {bookings.length === 0 ? (
              <div className="glass p-12 rounded-3xl border border-white/5 text-center space-y-6">
                <div className="w-20 h-20 bg-gold/10 text-gold rounded-full flex items-center justify-center mx-auto">
                  <Calendar size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-display text-white">No Bookings Found</h3>
                  <p className="text-white/40 text-sm max-w-xs mx-auto">
                    You haven't made any bookings yet. Start your luxury journey today.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/booking')}
                  className="btn-primary px-10 py-4 mx-auto block"
                >
                  Book Now
                </button>
              </div>
            ) : filteredAndSortedBookings.length === 0 ? (
              <div className="glass p-12 rounded-3xl border border-white/5 text-center space-y-6">
                <div className="w-20 h-20 bg-white/5 text-white/20 rounded-full flex items-center justify-center mx-auto">
                  <Search size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-display text-white">No Results Found</h3>
                  <p className="text-white/40 text-sm max-w-xs mx-auto">
                    We couldn't find any bookings matching your current filters.
                  </p>
                </div>
                <button
                  onClick={clearFilters}
                  className="btn-outline px-10 py-4 mx-auto block"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
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
                                    : booking.status === 'rejected'
                                      ? "bg-red-500/10 text-pink-400 border-pink-400/20"
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
                        {booking.status === 'rejected' && (
                          <X className="h-3 w-3" />
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

                    {/* Driver & Feedback Section */}
                    <div className="space-y-3 mb-4">
                      {booking.driverId && booking.status !== 'completed' && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                                <UserLock size={12} className="text-blue-500" />
                              </div>
                              <div>
                                <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Assigned Driver</p>
                                <div className="flex gap-2 items-center">
                                  <p className="text-[10px] text-white font-bold">
                                    {allUsers.find(u => u.id === booking.driverId)?.name || 'Unknown Driver'}
                                  </p>
                                  {(isAdmin && !isDriver) && (
                                    <p className="text-[9px] text-gold font-bold">
                                      {allUsers.find(u => u.id === booking.driverId)?.phone || 'No Contact'}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            {booking.status === 'accepted' ? (
                              <div className="flex items-center gap-1 text-cyan-500">
                                <UserCheck size={10} />
                                <span className="text-[9px] font-bold uppercase">Accepted</span>
                              </div>
                            ) : booking.status === 'rejected' ? (
                              <div className="flex items-center gap-1 text-pink-400">
                                <X size={10} />
                                <span className="text-[9px] font-bold uppercase">Rejected</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-gold">
                                <Clock size={10} />
                                <span className="text-[9px] font-bold uppercase">Request ?</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {booking.status === 'completed' && (
                        <div className="p-3 bg-white/5 rounded-xl border border-white/20 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gold/10 flex items-center justify-center">
                                <Star size={12} className={cn(booking.rating ? "text-gold fill-gold" : "text-white/20")} />
                              </div>
                              <div>
                                <p className="text-[8px] uppercase tracking-widest text-gold/40 font-bold">
                                  Feedback for <span className="text-blue-500">{allUsers.find(u => u.id === booking.driverId)?.name || 'Driver'}</span>
                                </p>
                                {booking.rating ? (
                                  <div className="flex items-center gap-0.5">
                                    {[1, 2, 3, 4, 5].map((s) => (
                                      <Star
                                        key={s}
                                        size={8}
                                        className={cn(s <= booking.rating ? "text-gold fill-gold" : "text-white/10")}
                                      />
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[9px] text-white/40 font-bold uppercase">Not Rated Yet</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {booking.rating && <span className="text-[10px] font-display text-gold">{booking.rating}.0</span>}
                              {!isAdmin && !isDriver && (
                                <button
                                  onClick={() => {
                                    setRatingBooking(booking);
                                    setRatingValue(booking.rating || 0);
                                    setRatingComment(booking.ratingComment || '');
                                  }}
                                  className="p-1.5 bg-gold/10 hover:bg-gold/20 rounded-lg text-gold transition-all"
                                  title={booking.rating ? "Edit Rating" : "Rate Now"}
                                >
                                  <Edit2 size={10} />
                                </button>
                              )}
                            </div>
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
                      )}
                    </div>

                    < div className="flex items-center justify-between p-2.5 bg-gold/5 rounded-xl border border-gold/10 mb-4" >
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
                          <div className="flex items-center gap-2 w-full">
                            {booking.status === 'pending' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                className="p-2.5 border border-green-500/20 bg-green-500/5 rounded-xl text-green-400 hover:bg-green-500/10 transition-all shrink-0"
                                title="Confirm"
                              >
                                <CheckCircle size={16} />
                              </button>
                            )}
                            {booking.status === 'confirmed' && (
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'pending')}
                                className="p-2.5 border border-white/20 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all shrink-0"
                                title="Unconfirm"
                              >
                                <CircleX size={16} />
                              </button>
                            )}
                            {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                              <div className="flex-1 relative min-w-0">
                                <select
                                  onChange={(e) => updateBookingStatus(booking.id, 'assigned', e.target.value)}
                                  value={booking.driverId || ''}
                                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-[10px] text-white outline-none focus:border-gold transition-all appearance-none truncate"
                                >
                                  <option value="" className="bg-black">Assign</option>
                                  {drivers.map((driver) => (
                                    <option key={driver.id} value={driver.id} className="bg-black">{driver.name}</option>
                                  ))}
                                </select>
                                <User size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white pointer-events-none" />
                              </div>
                            )}

                            <div className={cn(
                              "flex items-center gap-2",
                              (booking.status === 'cancelled' || booking.status === 'completed') ? "w-full" : "shrink-0"
                            )}>
                              <button
                                onClick={() => {
                                  setViewingBooking(booking);
                                  setShowViewModal(true);
                                }}
                                className={cn(
                                  "p-2.5 border border-gold/20 bg-gold/5 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-2",
                                  (booking.status === 'cancelled' || booking.status === 'completed') ? "flex-1" : "aspect-square"
                                )}
                                title="View Details"
                              >
                                <Eye size={16} />
                                {(booking.status === 'cancelled' || booking.status === 'completed') && (
                                  <span className="text-[10px] font-bold uppercase tracking-widest">View</span>
                                )}
                              </button>

                              <button
                                onClick={() => {
                                  setEditingBooking(booking);
                                  setShowBookingModal(true);
                                }}
                                className={cn(
                                  "p-2.5 border border-blue-500/20 bg-blue-500/5 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2",
                                  (booking.status === 'cancelled' || booking.status === 'completed') ? "flex-1" : "aspect-square"
                                )}
                                title="Edit Booking"
                              >
                                <Edit2 size={16} />
                                {(booking.status === 'cancelled' || booking.status === 'completed') && (
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Edit</span>
                                )}
                              </button>

                              <button
                                onClick={() => handleDeleteBooking(booking.id)}
                                className={cn(
                                  "p-2.5 border border-red-500/20 bg-red-500/5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2",
                                  (booking.status === 'cancelled' || booking.status === 'completed') ? "flex-1" : "aspect-square"
                                )}
                                title="Delete Booking"
                              >
                                <Trash2 size={16} />
                                {(booking.status === 'cancelled' || booking.status === 'completed') && (
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
                                )}
                              </button>
                            </div>
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
                                Accept Ride
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
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'completed')}
                                className="flex-1 bg-gold text-black py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                              >
                                Complete Ride
                              </button>
                              <button
                                onClick={() => updateBookingStatus(booking.id, 'assigned')}
                                className="flex-1 bg-white/10 text-white border border-white/20 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                              >
                                UnAccept Ride
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
                        <div className="h-0 overflow-hidden" />
                      )}
                    </div>
                  </div>
                ))
                }
              </div>
            )}
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
                <div key={`stat-${i}`} className="glass p-6 rounded-2xl border border-white/5">
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
              {/* Row 1: Title */}
              <h3 className="text-2xl font-display text-gold">Booking Calendar</h3>

              {/* Row 2: Month navigation */}
              <div className="flex flex-row items-center justify-center md:justify-start gap-4">
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-white/5 rounded-full"
                >
                  <ChevronLeft size={20} />
                </button>

                <span className="text-sm font-bold uppercase tracking-widest min-w-[140px] text-center">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>

                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-white/5 rounded-full"
                >
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
                {calendarDays.map((day) => {
                  const dayStr = day.toISOString();
                  const dayBookings = getBookingsForDate(day);
                  return (
                    <div
                      key={dayStr}
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
              {/* Row 1: Heading */}
              <div>
                <h3 className="text-2xl font-display text-gold">User Management</h3>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">
                  Manage staff and customers
                </p>
              </div>

              {/* Row 2: Search + Add User */}
              <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                {/* Search input */}
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

                {/* Add User button */}
                <button
                  onClick={() => {
                    setEditingUser({ role: 'customer', name: '', email: '', phone: '' });
                    setShowUserModal(true);
                  }}
                  className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
                >
                  <UserPlus size={18} />
                  {/* Hide text on mobile, show on md+ */}
                  <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                    Add User
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map((u) => (
                <div key={u.id} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center border transition-all",
                          u.role === "admin"
                            ? "bg-red-500/10 border-red-500/20 text-red-500"
                            : u.role === "driver"
                              ? "bg-blue-500/10 border-blue-500/20 text-blue-500"
                              : "bg-gold/10 border-gold/20 text-gold"
                        )}
                      >
                        {u.role === "admin" ? (
                          <Shield className="w-4 h-4 md:w-5 md:h-5" />
                        ) : u.role === "driver" ? (
                          <Car className="w-4 h-4 md:w-5 md:h-5" />
                        ) : (
                          <User className="w-4 h-4 md:w-5 md:h-5" />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <h4 className="text-[14px] font-bold font-display text-white group-hover:text-gold transition-colors leading-tight">
                          {u.name || "No Name"}
                        </h4>
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
                    <div className="flex items-center gap-3">
                      <MapPin size={14} className="text-gold shrink-0" />
                      <p className="text-xs text-white/60">{u.address || 'No Adrress'}</p>
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
      case 'management':
        if (!isAdmin) return null;
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4 border-b border-white/5 p-1 bg-white/5 rounded-lg">
              {[
                { id: 'fleet', label: 'Fleet', icon: Truck },
                { id: 'extras', label: 'Extras', icon: Plus },
                { id: 'coupons', label: 'Coupons', icon: Percent },
                { id: 'booking-mgmt', label: 'Booking', icon: CalendarCog },
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                    activeSubTab === sub.id
                      ? "bg-gold text-black"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                >
                  <sub.icon size={14} />
                  {/* Hide labels on small screens, show on md+ */}
                  <span className="hidden md:inline">{sub.label}</span>
                </button>
              ))}
            </div>

            {activeSubTab === 'fleet' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                  {/* Heading */}
                  <div>
                    <h3 className="text-2xl font-display text-gold">Fleet Management</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest">
                      Manage your luxury vehicles
                    </p>
                  </div>

                  {/* Search + Add Vehicle */}
                  <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                    {/* Search input */}
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

                    {/* Add Vehicle button */}
                    <button
                      onClick={() => {
                        setEditingVehicle({ name: '', model: '', type: 'sedan', pax: 3, bags: 2, price: 95, img: '', kmRanges: [] });
                        setShowVehicleModal(true);
                      }}
                      className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
                    >
                      <Plus size={18} />
                      {/* Hide text on mobile, show on md+ */}
                      <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                        Add Vehicle
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fleet.filter(v =>
                    v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    v.model?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((v) => (
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
                              <Luggage size={14} />
                              <span className="text-xs font-bold">{v.bags}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Price</p>
                            <p className="text-lg font-display text-gold">${v.basePrice}</p>
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
            )}

            {activeSubTab === 'extras' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                  {/* Row 1: Heading */}
                  <div>
                    <h3 className="text-2xl font-display text-gold">Extras Management</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest">
                      Manage additional ride options
                    </p>
                  </div>

                  {/* Row 2: Search + Add Extra */}
                  <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                    {/* Search input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                      <input
                        type="text"
                        placeholder="Search extras..."
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

                    {/* Add Extra button */}
                    <button
                      onClick={() => {
                        setEditingExtra({ name: '', description: '', price: 0, active: true });
                        setShowExtraModal(true);
                      }}
                      className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
                    >
                      <Plus size={18} />
                      {/* Hide text on mobile, show on md+ */}
                      <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                        Add Extra
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {extras.filter(e =>
                    e.name?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((e) => (
                    <div key={e.id} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden">
                      {e.active ? (
                        <div className="absolute top-0 right-0 bg-green-600 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                          Active
                        </div>
                      ) : (
                        <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                          Inactive
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2 mt-2">
                        <div>
                          <h4 className="text-xl font-display font-bold text-gold mb-1">{e.name}</h4>
                        </div>
                        <div className="bg-gold/10 p-1.5 rounded-lg">
                          <p className="text-[10px] text-gold uppercase tracking-widest font-bold">
                            ${e.price}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-white/60 mb-6 line-clamp-2">{e.description}</p>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingExtra(e);
                            setShowExtraModal(true);
                          }}
                          className="flex-1 py-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/50 hover:text-white text-[12px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>

                        <button
                          onClick={() => handleDeleteExtra(e.id)}
                          className="flex-1 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/50 hover:text-white text-[12px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSubTab === 'coupons' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full">
                  {/* Row 1: Heading */}
                  <div>
                    <h3 className="text-2xl font-display text-gold">Coupon Management</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest">
                      Manage discount codes
                    </p>
                  </div>

                  {/* Row 2: Search + Add Coupon */}
                  <div className="flex flex-row items-center gap-2 w-full md:w-auto">
                    {/* Search input */}
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" size={14} />
                      <input
                        type="text"
                        placeholder="Search coupons..."
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

                    {/* Add Coupon button */}
                    <button
                      onClick={() => {
                        setEditingCoupon({
                          code: '',
                          type: 'percentage',
                          value: 0,
                          startDate: '',
                          endDate: '',
                          usageLimit: 0,
                          usedCount: 0,
                          active: true,
                          serviceIds: [],
                        });
                        setShowCouponModal(true);
                      }}
                      className="btn-primary px-6 py-2 flex items-center justify-center gap-2 shrink-0"
                    >
                      <Plus size={18} />
                      {/* Hide text on mobile, show on md+ */}
                      <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                        Add Coupon
                      </span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {coupons.filter(c =>
                    c.code?.toLowerCase().includes(searchQuery.toLowerCase())
                  ).map((c) => (
                    <div key={c.id} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group relative overflow-hidden">
                      {c.active ? (
                        <div className="absolute top-0 right-0 bg-green-600 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                          Active
                        </div>
                      ) : (
                        <div className="absolute top-0 right-0 bg-red-500 text-white text-[8px] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                          Inactive
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-4 mt-2">
                        <div>
                          <h4 className="text-xl font-bold font-display text-gold mb-1">{c.code}</h4>
                        </div>
                        <div className="bg-gold/10 p-1.5 rounded-lg">
                          <p className="text-[10px] uppercase font-bold text-gold">
                            {c.type === 'percentage' ? `${c.value}% OFF` : `$${c.value} OFF`}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                          <span className="text-white/30">Validity</span>
                          <span className="text-white/60">{c.startDate} - {c.endDate}</span>
                        </div>
                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                          <span className="text-white/30">Usage</span>
                          <span className="text-white/60">{c.usedCount || 0} / {c.usageLimit || '∞'}</span>
                        </div>
                        <div className="flex justify-between text-[10px] tracking-widest font-bold">
                          <span className="text-white/30 uppercase">Aplc. Services</span>

                          {(!c.serviceIds || c.serviceIds.length === 0) ? (
                            <span className="text-[9px] bg-white/10 text-white/80 px-2 py-1 rounded-lg">All Services</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 justify-end">
                              {c.serviceIds.map((service) => (
                                <span
                                  key={service}
                                  className="text-[9px] bg-white/10 text-white/80 px-1.5 py-1 rounded-lg"
                                >
                                  {service.charAt(0).toUpperCase() + service.slice(1).toLowerCase()}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingCoupon(c);
                            setShowCouponModal(true);
                          }}
                          className="flex-1 py-2 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500/50 hover:text-white text-[12px] font-bold transition-all flex items-center justify-center gap-1"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>

                        <button
                          onClick={() => handleDeleteCoupon(c.id)}
                          className="flex-1 py-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/50 hover:text-white transition-all font-bold flex items-center justify-center gap-1"
                        >
                          <Trash2 size={14} />
                          <span className="text-[12px] font-bold uppercase tracking-widest">Delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeSubTab === 'booking-mgmt' && (
              <div className="space-y-8">
                <div className="glass p-6 md:p-8 rounded-3xl border border-white/5 w-full">
                  {/* Booking Configuration header row with Save button */}
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-display text-gold uppercase tracking-widest">
                      Booking Configuration
                    </h3>

                    <button
                      onClick={() => handleUpdateSettings(systemSettings)}
                      disabled={isSavingSettings}
                      className={cn(
                        "bg-gold text-black rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2",
                        "hover:bg-white",
                        "w-auto py-2 px-4 md:py-3 md:px-6"
                      )}
                    >
                      {/* Icon always visible */}
                      {isSavingSettings ? (
                        <Loader2 className="h-4 w-4 animate-spin text-black" />
                      ) : (
                        <Save className="h-4 w-4 text-black" />
                      )}

                      {/* Text label only on desktop */}
                      <span className="hidden md:inline text-xs font-bold uppercase tracking-widest">
                        {isSavingSettings ? "Saving..." : "Save Settings"}
                      </span>
                    </button>
                  </div>
                  {/* Responsive two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Price Component Visibility */}
                    <div className="space-y-4">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 border-b border-white/5 pb-2">
                        Price Component Visibility
                      </h4>

                      {/* Gross Price (always enabled) */}
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-gold">
                        <div>
                          <p className="text-sm font-bold">Show Gross Price (Always Enabled)</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">
                            Final total price
                          </p>
                        </div>
                        <button
                          disabled
                          className="w-12 h-6 rounded-full transition-all relative bg-gold"
                        >
                          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white transition-all" />
                        </button>
                      </div>

                      {/* Show Price Breakdown toggle + pills inside */}
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">Show Price Breakdown</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">
                              Enable detailed pricing options
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setSystemSettings({
                                ...systemSettings,
                                showPriceBreakdown: !systemSettings?.showPriceBreakdown,
                              })
                            }
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              systemSettings?.showPriceBreakdown ? "bg-gold" : "bg-white/10"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                                systemSettings?.showPriceBreakdown ? "right-1" : "left-1"
                              )}
                            />
                          </button>
                        </div>

                        {/* Pills appear inside same div when enabled */}
                        {systemSettings?.showPriceBreakdown && (
                          <div className="flex flex-wrap gap-2">
                            {[
                              { id: "showBasePrice", label: "Base Price" },
                              { id: "showDistancePrice", label: "Distance/Hour Price" },
                              { id: "showExtrasPrice", label: "Extras Price" },
                              { id: "showTax", label: "Tax" },
                              { id: "showDiscount", label: "Discount" },
                              { id: "showNetPrice", label: "Net Price" },
                              { id: "showStripeFees", label: "Stripe Fees" },
                            ].map((pill) => (
                              <button
                                key={pill.id}
                                onClick={() =>
                                  setSystemSettings({
                                    ...systemSettings,
                                    [pill.id]: !systemSettings?.[pill.id],
                                  })
                                }
                                className={cn(
                                  "text-[10px] px-3 py-1 rounded-lg font-bold tracking-widest transition-all",
                                  systemSettings?.[pill.id]
                                    ? "bg-green-600 text-white"
                                    : "bg-red-500/10 text-white hover:bg-red-500/30"
                                )}
                              >
                                {pill.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Settings */}
                    <div className="space-y-6">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 border-b border-white/5 pb-2">
                        Financial Settings
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                            Tax Percentage (%)
                          </label>
                          <input
                            type="number"
                            value={systemSettings?.taxPercentage || 0}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                taxPercentage: parseFloat(e.target.value),
                              })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                            Stripe Fee (%)
                          </label>
                          <input
                            type="number"
                            value={systemSettings?.stripeFeePercentage || 2.9}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                stripeFeePercentage: parseFloat(e.target.value),
                              })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                            Waypoint Price ($)
                          </label>
                          <input
                            type="number"
                            value={systemSettings?.waypointPrice || 0}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                waypointPrice: parseFloat(e.target.value),
                              })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                            Limit to Country (ISO Code)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. AU, US"
                            value={systemSettings?.limitCountry || ""}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                limitCountry: e.target.value.toUpperCase(),
                              })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                            Limit to City (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Melbourne"
                            value={systemSettings?.limitCity || ""}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                limitCity: e.target.value,
                              })
                            }
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Address (Optional)</label>
                  <input
                    type="text"
                    value={profileAddress}
                    onChange={(e) => setProfileAddress(e.target.value)}
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
                className="p-2 text-red-400 hover:text-red-600 transition-colors"
                title="Logout"
              >
                <LogOut size={22} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <main className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto">
          {/* Navigation Tabs - Relocated from Header */}
          <div className="w-full mb-8">
            <nav className="flex items-center w-full bg-white/5 p-1 rounded-2xl border border-white/5 overflow-x-auto no-scrollbar">
              {filteredNavItems.map((item) => (
                <button
                  key={`top-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 lg:px-5 py-3 rounded-xl transition-all group relative whitespace-nowrap",
                    activeTab === item.id
                      ? "text-white font-bold"
                      : "text-white/60 hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon size={16} className={cn(
                    "transition-colors relative z-10",
                    activeTab === item.id ? "text-white" : "text-gold group-hover:text-gold"
                  )} />
                  <span className="hidden lg:inline text-[10px] uppercase tracking-[0.2em] font-bold relative z-10">{item.label}</span>
                  {activeTab === item.id && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-gradient-to-br from-gold/95 to-gold-dark rounded-xl -z-0 shadow-[0_0_20px_rgba(153,101,21,0.4)]"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

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
                    key={`star-${star}`}
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
                  className="flex-1 py-4 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
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
                      className="custom-select w-full py-3 text-sm"
                    >
                      <option value="standard">Standard</option>
                      <option value="wedding">Wedding</option>
                      <option value="tour">Tour</option>
                      <option value="hourly">Hourly</option>
                      <option value="airport">Airport</option>
                      <option value="corporate">Corporate</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Vehicle Type</label>
                    <select
                      value={editingBooking?.vehicleType || 'sedan'}
                      onChange={(e) => setEditingBooking({ ...editingBooking, vehicleType: e.target.value })}
                      className="custom-select w-full py-3 text-sm"
                    >
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                      <option value="van">Van</option>
                      <option value="luxury">Luxury</option>
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
                      className="custom-select w-full py-3 text-sm"
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="assigned">Assigned</option>
                      <option value="accepted">Accepted</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowBookingModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
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
                    className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white border border-white/30 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (confirmDelete.type === 'booking') executeDeleteBooking(confirmDelete.id);
                      else if (confirmDelete.type === 'user') executeDeleteUser(confirmDelete.id);
                      else if (confirmDelete.type === 'vehicle') executeDeleteVehicle(confirmDelete.id);
                      else if (confirmDelete.type === 'coupon') executeDeleteCoupon(confirmDelete.id);
                      else if (confirmDelete.type === 'extra') executeDeleteExtra(confirmDelete.id);
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
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Address (Optional)</label>
                  <input
                    type="text"
                    value={editingUser?.address || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, address: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="123 Luxury St, Melbourne"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Role</label>
                  <select
                    value={editingUser?.role || 'customer'}
                    onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    className="custom-select w-full py-3 text-sm"
                  >
                    <option value="customer">Customer</option>
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
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

        {/* Extra Modal */}
        {showExtraModal && (
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
                  {editingExtra?.id ? 'Edit Extra' : 'Add Extra'}
                </h3>
                <button onClick={() => setShowExtraModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Name</label>
                  <input
                    type="text"
                    value={editingExtra?.name || ''}
                    onChange={(e) => setEditingExtra({ ...editingExtra, name: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Baby Seat"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Description</label>
                  <textarea
                    value={editingExtra?.description || ''}
                    onChange={(e) => setEditingExtra({ ...editingExtra, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all min-h-[100px]"
                    placeholder="Safe and comfortable baby seat for infants..."
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price ($)</label>
                  <input
                    type="number"
                    value={editingExtra?.price || 0}
                    onChange={(e) => setEditingExtra({ ...editingExtra, price: parseFloat(e.target.value) })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                  <div>
                    <p className="text-sm font-bold">Active Status</p>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">Toggle availability</p>
                  </div>
                  <button
                    onClick={() => setEditingExtra({ ...editingExtra, active: !editingExtra.active })}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      editingExtra?.active ? "bg-gold" : "bg-white/10"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      editingExtra?.active ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowExtraModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateExtra(editingExtra.id, editingExtra)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Save Changes
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
                    className="custom-select w-full py-3 text-sm"
                  >
                    <option value="sedan">Sedan</option>
                    <option value="suv">SUV</option>
                    <option value="van">Van</option>
                    <option value="limo">Limousine</option>
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Base Fare ($)</label>
                    <input
                      type="number"
                      value={editingVehicle?.basePrice || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, basePrice: parseFloat(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price per KM ($)</label>
                    <input
                      type="number"
                      value={editingVehicle?.price || 0}
                      onChange={(e) => setEditingVehicle({ ...editingVehicle, price: parseFloat(e.target.value) })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Hourly Price ($/HR)</label>
                  <input
                    type="number"
                    value={editingVehicle?.hourlyPrice || 0}
                    onChange={(e) => setEditingVehicle({ ...editingVehicle, hourlyPrice: parseFloat(e.target.value) })}
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
                      <div key={`km-${index}`} className="flex gap-2 items-center">
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
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
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

        {/* Coupon Modal */}
        {showCouponModal && (
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
              {/* Heading row: Title + Active toggle + Close button */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingCoupon?.id ? "Edit Coupon" : "Add Coupon"}
                </h3>

                <div className="flex items-center gap-4">
                  {/* Active toggle */}
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={editingCoupon?.active}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, active: e.target.checked })
                      }
                      className="w-5 h-5 rounded-lg border-white/10 bg-white/5 text-gold focus:ring-gold"
                    />
                    <span className="text-[10px] uppercase tracking-widest font-bold text-white/40 group-hover:text-white transition-colors">
                      {editingCoupon?.active ? "Active" : "Inactive"}
                    </span>
                  </label>

                  {/* Close button */}
                  <button
                    onClick={() => setShowCouponModal(false)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Row 1: Coupon Code */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Coupon Code
                  </label>
                  <input
                    type="text"
                    value={editingCoupon?.code || ""}
                    onChange={(e) =>
                      setEditingCoupon({
                        ...editingCoupon,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="SAVE20"
                  />
                </div>

                {/* Row 2: Value + Type + Usage Limit */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Value
                    </label>
                    <input
                      type="number"
                      value={editingCoupon?.value || 0}
                      onChange={(e) =>
                        setEditingCoupon({
                          ...editingCoupon,
                          value: parseFloat(e.target.value),
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Type
                    </label>
                    <select
                      value={editingCoupon?.type || "percentage"}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, type: e.target.value })
                      }
                      className="custom-select w-full py-3 text-sm"
                    >
                      <option value="percentage">%</option>
                      <option value="fixed">$</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      value={editingCoupon?.usageLimit || 0}
                      onChange={(e) =>
                        setEditingCoupon({
                          ...editingCoupon,
                          usageLimit: parseInt(e.target.value),
                        })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="0 for unlimited"
                    />
                  </div>
                </div>

                {/* Row 3: Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={editingCoupon?.startDate || ""}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, startDate: e.target.value })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={editingCoupon?.endDate || ""}
                      onChange={(e) =>
                        setEditingCoupon({ ...editingCoupon, endDate: e.target.value })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                {/* Row 4: Service Selection */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                    Applicable Services
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["airport", "corporate", "wedding", "tour", "hourly"].map(
                      (service) => (
                        <label
                          key={service}
                          className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 cursor-pointer hover:border-gold/30 transition-all"
                        >
                          <input
                            type="checkbox"
                            checked={editingCoupon?.serviceIds?.includes(service)}
                            onChange={(e) => {
                              const current = editingCoupon?.serviceIds || [];
                              const next = e.target.checked
                                ? [...current, service]
                                : current.filter((s) => s !== service);
                              setEditingCoupon({ ...editingCoupon, serviceIds: next });
                            }}
                            className="w-3 h-3 rounded border-white/10 bg-white/5 text-gold focus:ring-gold"
                          />
                          <span className="text-[10px] uppercase tracking-widest font-bold text-white/60">
                            {service}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                  <p className="text-[8px] text-white/30 mt-2 italic">
                    If none selected, coupon applies to all services.
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowCouponModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (editingCoupon.id) {
                        handleUpdateCoupon(editingCoupon.id, editingCoupon);
                      } else {
                        handleCreateCoupon(editingCoupon);
                      }
                    }}
                    className="border border-white/5 flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingCoupon?.id ? "Save Changes" : "Create Coupon"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
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
