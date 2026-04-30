import { motion, AnimatePresence } from 'motion/react';
import {
  Home, MapPin, Clock, User,
  Settings, Bell, CreditCard, History,
  ChevronRight, Star, LogOut, Plane, Loader2, Truck, X, ChevronLeft, ArrowRight, ChevronDown,
  Search, ArrowUpDown, Filter, RefreshCw, RotateCcw, ArrowUp, ArrowDown, CalendarArrowUp, CalendarArrowDown, Luggage, Map as MapIcon,
  Plus, Trash2, Ban, CheckCircle, DollarSign, Percent, Car, Shield, UserPlus, Edit2, Eye, EyeOff, UserLock, Copy, Tag, Compass,
  Scaling, Maximize2,
  Mail, Phone, Calendar, BarChart3, Users, LayoutGrid, List, Globe, Save, MoreVertical, Upload, CircleX, LocateFixed, UserCheck, XCircle, CheckSquare, CalendarCog, Navigation, Route, Settings2, Code2, Cog, MessageSquare, AlertCircle, PiggyBank, Activity, Award, Info, FileUp, Image, IdCard, Blocks, Download, Check, Square, SquareCheck, CheckCheck, XSquare, ThumbsDown, ThumbsUp,
  Facebook, Instagram, Linkedin, MessageCircle, ArrowUpCircle, MousePointer2, Palette, Monitor, Smartphone, Layout, Twitter, Youtube
} from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { cn } from '../lib/utils';
import { auth, db, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, getDocs, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, uploadBytesResumable } from 'firebase/storage';
import { onAuthStateChanged, signOut, updateProfile, updatePassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import Logo from '../components/layout/Logo';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend, LabelList
} from 'recharts';
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths,
  isToday, parseISO, subDays, startOfYear, endOfYear, eachMonthOfInterval,
  startOfDay, endOfDay, setMonth, setYear, eachYearOfInterval
} from 'date-fns';
import { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_ID } from '../lib/google-maps';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const BLOG_CATEGORIES = ["Travel Tips", "Business", "Weddings", "Tours", "Industry", "Safety"];

export default function AppDashboard() {
  const [activeTab, setActiveTab] = useState('bookings');
  const [activeSubTab, setActiveSubTab] = useState('seo');
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [isBookingsSelectionMode, setIsBookingsSelectionMode] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [showDriverBulkAssign, setShowDriverBulkAssign] = useState(false);
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
  const [pages, setPages] = useState<any[]>([]);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [showPageModal, setShowPageModal] = useState(false);
  const [showBlogModal, setShowBlogModal] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [editingBlog, setEditingBlog] = useState<any>(null);
  const [mediaFolder, setMediaFolder] = useState('general');
  const [newFolder, setNewFolder] = useState('');



  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES
  });

  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showWaypointsPopup, setShowWaypointsPopup] = useState<string | null>(null);
  const [showExtrasPopup, setShowExtrasPopup] = useState<string | null>(null);
  const [showNotesPopup, setShowNotesPopup] = useState<string | null>(null);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [routeBooking, setRouteBooking] = useState<any>(null);
  const [mapDirections, setMapDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [isMapLoading, setIsMapLoading] = useState(false);

  // Fetch directions when modal opens or booking changes
  useEffect(() => {
    if (showRouteModal && routeBooking && isLoaded) {
      const fetchDirections = async () => {
        const hasPickup = routeBooking.pickup && routeBooking.pickup.length >= 5;
        const hasDropoff = routeBooking.dropoff && routeBooking.dropoff.length >= 5;
        const hasWaypoints = routeBooking.waypoints && routeBooking.waypoints.length > 0;

        // If only 1 point (pickup) → no route, will show marker
        if (!hasPickup || (!hasDropoff && !hasWaypoints)) {
          setMapDirections(null);
          return;
        }

        setIsMapLoading(true);
        try {
          const service = new google.maps.DirectionsService();

          let destination = routeBooking.dropoff;
          let waypoints = (routeBooking.waypoints || []).map((wp: string) => ({
            location: wp,
            stopover: true,
          }));

          if (!hasDropoff && hasWaypoints) {
            destination = routeBooking.waypoints[routeBooking.waypoints.length - 1];
            waypoints = routeBooking.waypoints.slice(0, -1).map((wp: string) => ({
              location: wp,
              stopover: true,
            }));
          }

          const result = await service.route({
            origin: routeBooking.pickup,
            destination: destination,
            waypoints: waypoints,
            travelMode: google.maps.TravelMode.DRIVING,
          });

          if (result) {
            setMapDirections(result);
          }
        } catch (error) {
          console.error('Error fetching directions:', error);
          setMapDirections(null);
        } finally {
          setIsMapLoading(false);
        }
      };

      fetchDirections();
    } else if (!showRouteModal) {
      setMapDirections(null);
      setIsMapLoading(false);
    }
  }, [showRouteModal, routeBooking, isLoaded]);

  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  // Profile Edit State
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileAddress, setProfileAddress] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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

  // Offers State
  const [offers, setOffers] = useState<any[]>([]);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offersSearchTerm, setOffersSearchTerm] = useState('');
  const [offersLayout, setOffersLayout] = useState<'grid' | 'list'>('grid');
  const [selectedOffers, setSelectedOffers] = useState<string[]>([]);
  const [isOffersSelectionMode, setIsOffersSelectionMode] = useState(false);

  // Tours State
  const [tours, setTours] = useState<any[]>([]);
  const [tourActiveTab, setTourActiveTab] = useState<'general' | 'content' | 'pricing' | 'itinerary' | 'marketing'>('general');
  const [editingTour, setEditingTour] = useState<any>(null);
  const [showTourModal, setShowTourModal] = useState(false);
  const [toursSearchTerm, setToursSearchTerm] = useState('');
  const [toursLayout, setToursLayout] = useState<'grid' | 'list'>('grid');
  const [selectedTours, setSelectedTours] = useState<string[]>([]);
  const [isToursSelectionMode, setIsToursSelectionMode] = useState(false);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [showCsvImportModal, setShowCsvImportModal] = useState(false);
  const [csvImportType, setCsvImportType] = useState<'offers' | 'tours'>('offers');
  const [dragActive, setDragActive] = useState(false);

  // User Management State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Booking Management State
  const [editingBooking, setEditingBooking] = useState<any>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [viewingBooking, setViewingBooking] = useState<any>(null);

  // CSS State
  const [showCssModal, setShowCssModal] = useState(false);
  const [cssEditingLoading, setCssEditingLoading] = useState(false);
  const [cssConfig, setCssConfig] = useState<{
    type: 'global' | 'page' | 'blog';
    id?: string;
    content: string;
    isActive: boolean;
    title?: string;
    itemContent?: string;
    slug?: string;
    featuredImage?: string;
  }>({ type: 'global', content: '', isActive: true });
  const [calendarDateType, setCalendarDateType] = useState<'pickup' | 'booking'>('pickup');
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDistanceBreakdown, setShowDistanceBreakdown] = useState(false);

  // Settings State
  const [systemSettings, setSystemSettings] = useState<any>(null);
  const [floatingSettings, setFloatingSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSavingFloatingSettings, setIsSavingFloatingSettings] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showBarModal, setShowBarModal] = useState(false);
  const [editingBarIndex, setEditingBarIndex] = useState<number | null>(null);
  const [showPopupModal, setShowPopupModal] = useState(false);
  const [editingPopupIndex, setEditingPopupIndex] = useState<number | null>(null);

  // Media Management State
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [editingMedia, setEditingMedia] = useState<any>({
    alt: '',
    title: '',
    description: '',
    caption: '',
  });
  const [storageUsageBytes, setStorageUsageBytes] = useState(0);
  const [storageLimitBytes, setStorageLimitBytes] = useState(5 * 1024 * 1024 * 1024); // 5GB Free Tier Simulation

  // Confirmation State
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'booking' | 'user' | 'vehicle' | 'coupon' | 'extra' | 'page' | 'blog' | 'tour' | 'offer' | 'bulk-tours' | 'bulk-offers' | 'bulk-bookings', id?: string, ids?: string[] } | null>(null);

  // New Analytics State
  const [analyticsTimeFilter, setAnalyticsTimeFilter] = useState<'all' | '7d' | '30d' | 'month' | 'year'>('all');
  const [monthRange, setMonthRange] = useState({ start: 0, end: new Date().getMonth() });
  const [yearRange, setYearRange] = useState({
    start: new Date().getFullYear() - 2,
    end: new Date().getFullYear()
  });
  const [analyticsRoleFilter, setAnalyticsRoleFilter] = useState<'all' | 'driver' | 'customer'>('all');
  const [analyticsViewMode, setAnalyticsViewMode] = useState<'charts' | 'numerical'>('charts');
  const [bookingTimeFilter, setBookingTimeFilter] = useState<'3d' | '7d' | '30d' | 'month' | 'year' | 'all'>('all');
  const [bookingDateTypeFilter, setBookingDateTypeFilter] = useState<'pickup' | 'booking'>('pickup');
  const [bookingMonthRange, setBookingMonthRange] = useState({
    start: format(startOfMonth(subMonths(new Date(), 5)), 'yyyy-MM'),
    end: format(endOfMonth(new Date()), 'yyyy-MM')
  });
  const [bookingYearRange, setBookingYearRange] = useState({
    start: new Date().getFullYear() - 1,
    end: new Date().getFullYear()
  });
  const [dashboardCharts, setDashboardCharts] = useState<any[]>([
    { id: 'revenue-trend', type: 'area', title: 'Revenue Trend', dataKey: 'revenue', color: '#D4AF37', width: 'medium' },
    { id: 'booking-volume', type: 'bar', title: 'Booking Volume', dataKey: 'bookings', color: '#60A5FA', width: 'medium' },
    { id: 'booking-statuses', type: 'pie', title: 'Booking Statuses', dataKey: 'value', color: '#22D3EE', width: 'medium', dataSource: 'statusData' },
    { id: 'role-distribution', type: 'pie', title: 'User Roles', dataKey: 'value', color: '#F43F5E', width: 'medium', dataSource: 'roleData' },
    { id: 'service-performance', type: 'stacked-bar', title: 'Service Performance', dataKey: 'value', color: '#D4AF37', width: 'medium', dataSource: 'serviceDistribution' }
  ]);

  const [bookingCategory, setBookingCategory] = useState<'standard' | 'offer' | 'tour'>('standard');
  const [bookingViewMode, setBookingViewMode] = useState<'grid' | 'table'>('grid');
  const [offerViewMode, setOfferViewMode] = useState<'grid' | 'list'>('grid');
  const navigate = useNavigate();

  const isAdmin = userProfile?.role === 'admin';
  const isDriver = userProfile?.role === 'driver';

  const navItems = [
    { id: 'bookings', label: 'Bookings', icon: LayoutGrid, adminOnly: false },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, adminOnly: false },
    { id: 'calendar', label: 'Calendar', icon: Calendar, adminOnly: false },
    { id: 'users', label: 'Users', icon: Users, adminOnly: true },
    { id: 'profile', label: 'Profile', icon: IdCard, adminOnly: false },
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
    setBookingTimeFilter('all');
    setBookingDateTypeFilter('pickup');
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    // Data is real-time via onSnapshot, so we just simulate a refresh for UX
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleRateDriver = async (bookingId: string, rating: number, comment: string) => {
    try {
      // Fetch the booking to check status and ownership
      const bookingRef = doc(db, 'bookings', bookingId);
      const bookingSnap = await getDoc(bookingRef);
      if (!bookingSnap.exists()) {
        console.error('Booking not found');
        return;
      }
      await updateDoc(bookingRef, {
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
    if (!isAdmin || coupons.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const couponsToDeactivate = coupons.filter(c => c.active && c.endDate && c.endDate < today);

    couponsToDeactivate.forEach(coupon => {
      const couponRef = doc(db, 'coupons', coupon.id);
      updateDoc(couponRef, { active: false });
    });
  }, [coupons, isAdmin]);

  // Auto-deactivate Floating Bars based on date
  useEffect(() => {
    if (!isAdmin || !floatingSettings?.bars) return;

    const today = new Date().toISOString().split('T')[0];
    let changed = false;

    // Check Bars
    const newBars = (floatingSettings.bars || []).map((bar: any) => {
      if (bar.active && bar.endDate && bar.endDate < today) {
        changed = true;
        return { ...bar, active: false };
      }
      return bar;
    });

    // Check Popups
    const newPopups = (floatingSettings.popups || []).map((popup: any) => {
      if (popup.active && popup.endDate && popup.endDate < today) {
        changed = true;
        return { ...popup, active: false };
      }
      return popup;
    });

    if (changed) {
      setFloatingSettings((prev: any) => ({ ...prev, bars: newBars, popups: newPopups }));
    }
  }, [floatingSettings?.bars, floatingSettings?.popups, isAdmin]);


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

  const handleSaveCss = async () => {
    setCssEditingLoading(true);
    try {
      if (cssConfig.type === 'global') {
        const settingsRef = doc(db, "settings", "system");
        // Using setDoc with merge is safer if the seo object doesn't exist yet
        await setDoc(settingsRef, {
          seo: {
            globalCmsCss: cssConfig.content,
            isGlobalCssActive: cssConfig.isActive
          }
        }, { merge: true });

        setSystemSettings(prev => ({
          ...prev,
          seo: {
            ...prev?.seo,
            globalCmsCss: cssConfig.content,
            isGlobalCssActive: cssConfig.isActive
          }
        }));
      } else if (cssConfig.type === 'page' && cssConfig.id) {
        const pageRef = doc(db, "pages", cssConfig.id);
        await updateDoc(pageRef, {
          customCss: cssConfig.content,
          isCustomCssActive: cssConfig.isActive,
          updatedAt: serverTimestamp()
        });
        setPages(prev => prev.map(p => p.id === cssConfig.id ? { ...p, customCss: cssConfig.content, isCustomCssActive: cssConfig.isActive } : p));
      } else if (cssConfig.type === 'blog' && cssConfig.id) {
        const blogRef = doc(db, "blogs", cssConfig.id);
        await updateDoc(blogRef, {
          customCss: cssConfig.content,
          isCustomCssActive: cssConfig.isActive,
          updatedAt: serverTimestamp()
        });
        setBlogs(prev => prev.map(b => b.id === cssConfig.id ? { ...b, customCss: cssConfig.content, isCustomCssActive: cssConfig.isActive } : b));
      }
      setShowCssModal(false);
    } catch (err) {
      console.error("Error saving CSS:", err);
      handleFirestoreError(err, OperationType.UPDATE, `save-css-${cssConfig.type}`);
    } finally {
      setCssEditingLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsUpdatingProfile(true);
    try {
      // 1. Password change if requested
      if (newPassword) {
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters');
        }
        if (newPassword !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        await updatePassword(user, newPassword);
      }

      // 2. Profile metadata update
      await updateProfile(user, { displayName: profileName });
      await updateDoc(doc(db, 'users', user.uid), {
        name: profileName,
        phone: profilePhone,
        address: profileAddress,
        updatedAt: serverTimestamp()
      });

      setUserProfile((prev: any) => ({ ...prev, name: profileName, phone: profilePhone, address: profileAddress }));
      setNewPassword('');
      setConfirmPassword('');
      alert('Profile updated successfully!');
    } catch (err: any) {
      console.error('Error updating profile:', err);
      // Handle Firebase sensitive operation error (requires recent login)
      if (err.code === 'auth/requires-recent-login') {
        alert('This operation is sensitive and requires recent authentication. Please log out and log back in to change your password.');
      } else {
        alert(err.message || 'Failed to update profile.');
      }
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
    const now = new Date();
    const totalRevenue = bookings
      .filter(b => b.paymentStatus === 'paid' || b.status === 'completed')
      .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

    // Derived Filtered Status Counts
    const filteredBookingsList = bookings.filter(b => {
      const bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : null;
      if (!bDate) return false;

      // Role filter
      if (analyticsRoleFilter === 'driver' && !b.driverId) return false;
      if (analyticsRoleFilter === 'customer' && !b.userId) return false;

      if (analyticsTimeFilter === 'month') {
        const start = setMonth(startOfYear(now), monthRange.start);
        const end = setMonth(startOfYear(now), monthRange.end);
        const s = start < end ? start : end;
        const e = endOfMonth(start < end ? end : start);
        return bDate >= s && bDate <= e;
      } else if (analyticsTimeFilter === 'year') {
        const start = startOfYear(setYear(now, yearRange.start));
        const end = endOfYear(setYear(now, yearRange.end));
        const s = start < end ? start : end;
        const e = start < end ? end : start;
        return bDate >= s && bDate <= e;
      } else if (analyticsTimeFilter === '7d') {
        return bDate >= subDays(now, 6);
      } else if (analyticsTimeFilter === '30d') {
        return bDate >= subDays(now, 29);
      } else if (analyticsTimeFilter === 'all') {
        return true;
      }
      return true;
    });

    const completedCount = filteredBookingsList.filter(b => b.status === 'completed').length;
    const pendingCount = filteredBookingsList.filter(b => b.status === 'pending').length;
    const cancelledCount = filteredBookingsList.filter(b => b.status === 'cancelled').length;
    const confirmedCount = filteredBookingsList.filter(b => b.status === 'confirmed').length;
    const assignedCount = filteredBookingsList.filter(b => b.status === 'assigned').length;
    const acceptedCount = filteredBookingsList.filter(b => b.status === 'accepted').length;

    const statusData = [
      { name: 'Pending', value: pendingCount, color: '#D4AF37' },
      { name: 'Confirmed', value: confirmedCount, color: '#60A5FA' },
      { name: 'Assigned', value: assignedCount, color: '#C084FC' },
      { name: 'Accepted', value: acceptedCount, color: '#22D3EE' },
      { name: 'Completed', value: completedCount, color: '#4ADE80' },
      { name: 'Cancelled', value: cancelledCount, color: '#F87171' },
    ].filter(item => item.value > 0);

    // Filter by Service Type for more insights
    const serviceDistribution = [...new Set(filteredBookingsList.map(b => b.serviceType).filter(Boolean))].map(type => {
      const typeBookings = filteredBookingsList.filter(b => b.serviceType === type);
      const completed = typeBookings.filter(b => b.status === 'completed').length;
      const cancelled = typeBookings.filter(b => b.status === 'cancelled').length;
      const other = typeBookings.length - (completed + cancelled);
      const revenue = typeBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0);

      return {
        name: type.charAt(0).toUpperCase() + type.slice(1),
        value: typeBookings.length,
        completed,
        cancelled,
        other,
        revenue,
        color: type === 'airport' ? '#60A5FA' : type === 'corporate' ? '#D4AF37' : type === 'wedding' ? '#F43F5E' : '#C084FC'
      };
    });

    let intervals: Date[] = [];
    let formatStr = 'MMM dd';
    let grouping: 'day' | 'month' | 'year' = 'day';

    if (analyticsTimeFilter === '7d') {
      intervals = eachDayOfInterval({ start: subDays(now, 6), end: now });
      formatStr = 'MMM dd';
      grouping = 'day';
    } else if (analyticsTimeFilter === '30d') {
      intervals = eachDayOfInterval({ start: subDays(now, 29), end: now });
      formatStr = 'MMM dd';
      grouping = 'day';
    } else if (analyticsTimeFilter === 'month') {
      // Respect user selected month range
      const start = setMonth(startOfYear(now), monthRange.start);
      const end = setMonth(startOfYear(now), monthRange.end);
      intervals = eachMonthOfInterval({
        start: start < end ? start : end,
        end: start < end ? end : start
      });
      formatStr = 'MMM';
      grouping = 'month';
    } else if (analyticsTimeFilter === 'year') {
      // Respect user selected year range
      const start = startOfYear(setYear(now, yearRange.start));
      const end = startOfYear(setYear(now, yearRange.end));
      intervals = eachYearOfInterval({
        start: start < end ? start : end,
        end: start < end ? end : start
      });
      formatStr = 'yyyy';
      grouping = 'year';
    } else if (analyticsTimeFilter === 'all') {
      const allDates = bookings.map(b => b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : null).filter(Boolean) as Date[];
      if (allDates.length > 0) {
        const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
        const yearsDiff = maxDate.getFullYear() - minDate.getFullYear();

        if (yearsDiff < 3) {
          intervals = eachMonthOfInterval({ start: startOfMonth(minDate), end: endOfMonth(maxDate) });
          formatStr = 'MMM yy';
          grouping = 'month';
        } else {
          intervals = eachYearOfInterval({ start: startOfYear(minDate), end: endOfYear(maxDate) });
          formatStr = 'yyyy';
          grouping = 'year';
        }
      } else {
        intervals = [startOfYear(now)];
        formatStr = 'yyyy';
        grouping = 'year';
      }
    }

    const intervalsProcessed = intervals.length > 0;
    const rangeStart = intervalsProcessed ? intervals[0] : now;
    const rangeEnd = intervalsProcessed ? intervals[intervals.length - 1] : now;

    const rangeDescription = analyticsTimeFilter === '7d' ? `Last 7 Days (${format(rangeStart, 'MMM dd')} - ${format(rangeEnd, 'MMM dd')})` :
      analyticsTimeFilter === '30d' ? `Last 30 Days (${format(rangeStart, 'MMM dd')} - ${format(rangeEnd, 'MMM dd')})` :
        analyticsTimeFilter === 'month' ? `Monthly Range (${format(rangeStart, 'MMM yyyy')} - ${format(rangeEnd, 'MMM yyyy')})` :
          analyticsTimeFilter === 'year' ? `Yearly Range (${format(rangeStart, 'yyyy')} - ${format(rangeEnd, 'yyyy')})` :
            `All (${format(rangeStart, 'MMM yyyy')} - ${format(rangeEnd, 'MMM yyyy')})`;

    const revenueData = intervals.map(date => {
      const dayBookings = bookings.filter(b => {
        const bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : null;
        if (!bDate) return false;

        if (grouping === 'month') {
          return format(bDate, 'yyyy-MM') === format(date, 'yyyy-MM');
        } else if (grouping === 'year') {
          return format(bDate, 'yyyy') === format(date, 'yyyy');
        } else {
          return format(bDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
        }
      });

      return {
        name: format(date, formatStr),
        revenue: dayBookings
          .filter(b => b.paymentStatus === 'paid' || b.status === 'completed')
          .reduce((sum, b) => sum + (Number(b.price) || 0), 0),
        bookings: dayBookings.length,
        fullDate: format(date, 'PPP')
      };
    });

    const filteredRevenue = revenueData.reduce((sum, item) => sum + item.revenue, 0);
    const filteredBookings = revenueData.reduce((sum, item) => sum + item.bookings, 0);

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

    const adminCount = allUsers.filter(u => u.role === 'admin').length;
    const customerCount = allUsers.filter(u => u.role === 'customer' || !u.role).length;
    const driverCount = allUsers.filter(u => u.role === 'driver').length;

    const roleData = [
      { name: 'Admins', value: adminCount, color: '#D4AF37' },
      { name: 'Customers', value: customerCount, color: '#22D3EE' },
      { name: 'Drivers', value: driverCount, color: '#F43F5E' }
    ];

    return {
      totalRevenue: filteredRevenue,
      totalBookings: filteredBookings,
      rangeDescription,
      completedBookings: completedCount,
      pendingBookings: pendingCount,
      cancelledBookings: cancelledCount,
      confirmedBookings: confirmedCount,
      assignedBookings: assignedCount,
      acceptedBookings: acceptedCount,
      customerCount: customerCount,
      driverCount: driverCount,
      adminCount: adminCount,
      statusData,
      roleData,
      currentMonthCount: currentMonthBookings.length,
      currentMonthRevenue,
      revenueData,
      serviceDistribution,
      topDrivers: [...new Set(filteredBookingsList.map(b => b.driverId).filter(Boolean))].map(id => {
        const name = allUsers.find(u => u.id === id)?.name || 'Unknown Driver';
        const dBookings = filteredBookingsList.filter(b => b.driverId === id);
        return { name, count: dBookings.length, revenue: dBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0) };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      topCustomers: [...new Set(filteredBookingsList.map(b => b.userId).filter(Boolean))].map(id => {
        const name = allUsers.find(u => u.id === id)?.name || 'Guest User';
        const cBookings = filteredBookingsList.filter(b => b.userId === id);
        return { name, count: cBookings.length, revenue: cBookings.reduce((sum, b) => sum + (Number(b.price) || 0), 0) };
      }).sort((a, b) => b.revenue - a.revenue).slice(0, 5)
    };
  }, [bookings, analyticsTimeFilter, monthRange, yearRange, allUsers]);

  const userDetailStats = useMemo(() => {
    const stats: Record<string, any> = {};
    allUsers.forEach(u => {
      // For Drivers
      if (u.role === 'driver') {
        const driverBookings = bookings.filter(b => b.driverId === u.id);
        const completed = driverBookings.filter(b => b.status === 'completed');
        const rated = completed.filter(b => b.rating);
        const totalRatingValue = rated.reduce((sum, b) => sum + (Number(b.rating) || 0), 0);
        const avgRating = rated.length ? totalRatingValue / rated.length : 0;
        const totalEarnings = completed.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
        const unreviewed = completed.filter(b => !b.rating);
        const feedbacks = completed.map(b => {
          const customer = allUsers.find(cu => cu.id === b.userId);

          return {
            comment: b.ratingComment?.trim() || '',
            rating: b.rating || 0,
            customerName: customer?.name || 'Anonymous'
          };
        });

        stats[u.id] = {
          completedRides: completed.length,
          avgRating: avgRating,
          totalRatingValue: totalRatingValue,
          ratingCount: rated.length,
          unreviewedCount: unreviewed.length,
          totalEarnings: totalEarnings,
          feedbacks: feedbacks
        };
      } else if (u.role === 'admin') {
        const unassigned = bookings.filter(b => !b.driverId && b.status !== 'cancelled' && b.status !== 'completed');
        const cancelled = bookings.filter(b => b.status === 'cancelled');
        const confirmed = bookings.filter(b => b.status === 'confirmed');
        const completed = bookings.filter(b => b.status === 'completed');
        const activeCoupons = coupons.filter(c => c.active).length;

        const totalRevenue = completed.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
        const lostRevenue = cancelled.reduce((sum, b) => sum + (Number(b.price) || 0), 0);

        stats[u.id] = {
          unassignedCount: unassigned.length,
          cancelledCount: cancelled.length,
          confirmedCount: confirmed.length,
          activeCoupons: activeCoupons,
          totalSystemUsers: allUsers.length,
          totalRevenue,
          lostRevenue
        };
      } else if (u.role === 'customer' || !u.role || u.role === 'user') {
        // For Customers
        const customerBookings = bookings.filter(b => b.userId === u.id);
        const completed = customerBookings.filter(b => b.status === 'completed');
        const cancelled = customerBookings.filter(b => b.status === 'cancelled');
        const reviewed = completed.filter(b => b.rating);
        const unreviewed = completed.filter(b => !b.rating);
        const totalSpend = customerBookings
          .filter(b => b.status === 'completed' || b.paymentStatus === 'paid')
          .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

        // Find favorite vehicle/service
        const serviceCounts: Record<string, number> = {};
        customerBookings.forEach(b => {
          if (b.serviceType) serviceCounts[b.serviceType] = (serviceCounts[b.serviceType] || 0) + 1;
        });
        const favoriteService = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

        stats[u.id] = {
          totalBookings: customerBookings.length,
          completedRides: completed.length,
          cancelledRides: cancelled.length,
          reviewedCount: reviewed.length,
          unreviewedCount: unreviewed.length,
          totalSpend,
          favoriteService: favoriteService.charAt(0).toUpperCase() + favoriteService.slice(1)
        };
      }
    });
    return stats;
  }, [allUsers, bookings]);

  // Calendar Helpers
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const getBookingsForDate = useCallback((date: Date) => {
    return bookings.filter(b => {
      let bDate;
      if (calendarDateType === 'pickup') {
        if (!b.date) return false;
        bDate = parseISO(b.date);
      } else {
        // Fallback for createdAt
        bDate = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : (b.createdAt || b.date ? parseISO(b.createdAt || b.date) : null);
      }
      return bDate && isSameDay(bDate, date);
    });
  }, [bookings, calendarDateType]);

  useEffect(() => {
    if (!user || !userProfile) return;

    // Fetch bookings based on role
    let q;
    let unsubscribeUsers: (() => void) | undefined;
    let unsubscribeFleet: (() => void) | undefined;
    let unsubscribeExtras: (() => void) | undefined;
    let unsubscribeCoupons: (() => void) | undefined;
    let unsubscribeSettings: (() => void) | undefined;
    let unsubscribePages: (() => void) | undefined;
    let unsubscribeBlogs: (() => void) | undefined;
    let unsubscribeOffers: (() => void) | undefined;
    let unsubscribeTours: (() => void) | undefined;
    let unsubscribeMedia: (() => void) | undefined;

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
            distanceCalculationType: 'type1',
            showDistanceEyeIcon: true,
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
        console.error('Error fetching system settings:', err);
      });

      // Fetch floating settings
      const floatingRef = doc(db, 'settings', 'floating');
      const unsubscribeFloating = onSnapshot(floatingRef, (docSnap) => {
        if (docSnap.exists()) {
          setFloatingSettings(docSnap.data());
        } else {
          const defaultFloating = {
            bars: [
              {
                id: 'default-bar',
                active: true,
                content: "GRAND OPENING: 20% OFF ON ALL AIRPORT TRANSFERS! USE CODE: MEL20",
                promoCode: "MEL20",
                bgColor: "#D4AF37",
                bgType: "solid",
                bgGradient: "linear-gradient(90deg, #D4AF37, #F1D483)",
                textColor: "#000000",
                promoColor: "#000000",
                promoBg: "rgba(0,0,0,0.1)",
                closeColor: "#000000",
                position: "top",
                showClose: true,
                animation: "marquee",
                marqueeSpeed: 20,
                startDate: "",
                endDate: "",
                displayCondition: "all",
                specificPages: [],
                ctaText: "",
                ctaLink: ""
              }
            ],
            social: {
              active: true,
              position: "right-bottom",
              offsetX: 24,
              offsetY: 40,
              icons: [
                { id: 'whatsapp', type: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/yournumber', active: true, color: '#25D366', iconColor: '#ffffff', bgType: 'solid', bgColor: '#25D366', bgGradient: 'linear-gradient(45deg, #25D366, #128C7E)' },
                { id: 'fb', type: 'facebook', label: 'Facebook', url: '', active: true, color: '#1877F2', iconColor: '#ffffff', bgType: 'solid', bgColor: '#1877F2', bgGradient: 'linear-gradient(45deg, #1877F2, #0C5CA0)' },
                { id: 'insta', type: 'instagram', label: 'Instagram', url: '', active: true, color: '#E4405F', iconColor: '#ffffff', bgType: 'solid', bgColor: '#E4405F', bgGradient: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }
              ]
            },
            scrollTop: {
              active: true,
              position: "right-bottom",
              offset: 300,
              offsetX: 24,
              offsetY: 24,
              color: "#D4AF37",
              bgType: "solid",
              bgGradient: "linear-gradient(45deg, #D4AF37, #F1D483)",
              iconColor: "#000000"
            }
          };
          setDoc(floatingRef, defaultFloating);
        }
      }, (err) => {
        console.error('Error fetching floating settings:', err);
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

      // Fetch pages
      const pagesQ = query(collection(db, 'pages'), orderBy('createdAt', 'desc'));
      unsubscribePages = onSnapshot(pagesQ, (snapshot) => {
        setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'pages');
      });

      // Fetch blogs
      const blogsQ = query(collection(db, 'blogs'), orderBy('createdAt', 'desc'));
      unsubscribeBlogs = onSnapshot(blogsQ, (snapshot) => {
        setBlogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'blogs');
      });

      // Fetch offers
      const offersQ = query(collection(db, 'offers'), orderBy('createdAt', 'desc'));
      unsubscribeOffers = onSnapshot(offersQ, (snapshot) => {
        setOffers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'offers');
      });

      // Fetch tours
      const toursQ = query(collection(db, 'tours'), orderBy('createdAt', 'desc'));
      unsubscribeTours = onSnapshot(toursQ, (snapshot) => {
        setTours(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'tours');
      });

      // Fetch Media
      const mediaQ = query(collection(db, 'media'), orderBy('createdAt', 'desc'));
      unsubscribeMedia = onSnapshot(mediaQ, (snapshot) => {
        const mediaData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            // Ensure a stable, truly unique key for React that combines multiple sources of uniqueness
            u_key: `media_${doc.id}_${data.createdAt?.seconds || Date.now()}`
          };
        });

        // Final deduplication check before setting state
        const seen = new Set();
        const uniqueMedia = mediaData.filter(item => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });

        setMediaList(uniqueMedia);
        // Calculate storage usage
        const totalSize = uniqueMedia.reduce((sum, item: any) => sum + (Number(item.size) || 0), 0);
        setStorageUsageBytes(totalSize);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'media');
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
      if (unsubscribeBookings) unsubscribeBookings();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeFleet) unsubscribeFleet();
      if (unsubscribeExtras) unsubscribeExtras();
      if (unsubscribeCoupons) unsubscribeCoupons();
      if (unsubscribeSettings) unsubscribeSettings();
      if (unsubscribePages) unsubscribePages();
      if (unsubscribeBlogs) unsubscribeBlogs();
      if (unsubscribeOffers) unsubscribeOffers();
      if (unsubscribeTours) unsubscribeTours();
      if (unsubscribeMedia) unsubscribeMedia();
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

  const executeBulkDeleteBookings = async (ids: string[]) => {
    const validIds = ids.filter(id => {
      const b = bookings.find(booking => booking.id === id);
      return b && b.status !== 'completed' && b.status !== 'cancelled';
    });
    if (validIds.length === 0) return;
    try {
      for (const id of validIds) {
        await deleteDoc(doc(db, 'bookings', id));
      }
      setConfirmDelete(null);
      setSelectedBookings([]);
    } catch (err) {
      console.error('Error bulk deleting bookings:', err);
      handleFirestoreError(err, OperationType.DELETE, `bookings`);
    }
  };

  const executeBulkUpdateBookingsStatus = async (ids: string[], newStatus: string) => {
    const validIds = ids.filter(id => {
      const b = bookings.find(booking => booking.id === id);
      return b && b.status !== 'completed' && b.status !== 'cancelled';
    });
    if (validIds.length === 0) return;
    try {
      for (const id of validIds) {
        await updateDoc(doc(db, 'bookings', id), {
          status: newStatus,
          updatedAt: serverTimestamp()
        });
      }
      setSelectedBookings([]);
    } catch (err) {
      console.error('Error bulk updating booking statuses:', err);
      handleFirestoreError(err, OperationType.UPDATE, `bookings`);
    }
  };

  const executeBulkAssignDriver = async (ids: string[], driverId: string | null) => {
    const validIds = ids.filter(id => {
      const b = bookings.find(booking => booking.id === id);
      return b && b.status !== 'completed' && b.status !== 'cancelled';
    });
    if (validIds.length === 0) return;
    try {
      for (const id of validIds) {
        if (driverId) {
          await updateDoc(doc(db, 'bookings', id), {
            driverId,
            status: 'assigned',
            updatedAt: serverTimestamp()
          });
        } else {
          await updateDoc(doc(db, 'bookings', id), {
            driverId: null,
            status: 'confirmed',
            updatedAt: serverTimestamp()
          });
        }
      }
      setSelectedBookings([]);
    } catch (err) {
      console.error('Error bulk assigning/unassigning driver:', err);
      handleFirestoreError(err, OperationType.UPDATE, `bookings`);
    }
  };

  const handleUpdateUser = async (userId: string, data: any) => {
    try {
      // Ensure the internal id field always matches the document path ID
      const sanitizedData = { ...data, id: userId };

      await setDoc(doc(db, 'users', userId), {
        ...sanitizedData,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setShowUserModal(false);
      setEditingUser(null);
    } catch (err) {
      console.error('Error updating user:', err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleCreateUser = async (userData: any) => {
    if (!userData.email || !userData.password || !userData.name) {
      alert('Email, Password and Name are required');
      return;
    }

    setIsCreatingUser(true);
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          displayName: userData.name,
          role: userData.role,
          phone: userData.phone,
          address: userData.address
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create user');
      }

      setShowUserModal(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error('Error creating user:', err);
      alert(err.message || 'Failed to create user');
    } finally {
      setIsCreatingUser(false);
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

    // Filter by category (Standard vs Offers vs Tours) - ONLY for Admin/Driver dashboard views
    if (bookingCategory === 'offer') {
      result = result.filter(b => b.type === 'offer');
    } else if (bookingCategory === 'tour') {
      result = result.filter(b => b.type === 'tour');
    } else {
      result = result.filter(b => b.type !== 'offer' && b.type !== 'tour');
    }

    // Filter by time period
    if (bookingTimeFilter !== 'all') {
      const now = new Date();
      let startDate: Date;
      let endDate: Date;

      if (bookingTimeFilter === '3d') {
        startDate = startOfDay(subDays(now, 3));
        endDate = endOfDay(now);
      } else if (bookingTimeFilter === '7d') {
        startDate = startOfDay(subDays(now, 7));
        endDate = endOfDay(now);
      } else if (bookingTimeFilter === '30d') {
        startDate = startOfDay(subDays(now, 30));
        endDate = endOfDay(now);
      } else if (bookingTimeFilter === 'month') {
        startDate = startOfMonth(parseISO(`${bookingMonthRange.start}-01`));
        endDate = endOfMonth(parseISO(`${bookingMonthRange.end}-01`));
      } else { // year
        startDate = startOfYear(new Date(bookingYearRange.start, 0, 1));
        endDate = endOfYear(new Date(bookingYearRange.end, 11, 31));
      }

      result = result.filter(b => {
        const dateToCompare = bookingDateTypeFilter === 'pickup'
          ? parseISO(b.date)
          : (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : null);

        if (!dateToCompare) return false;
        return dateToCompare >= startDate && dateToCompare <= endDate;
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(b =>
        (b.customerName?.toLowerCase().includes(query)) ||
        (b.pickup?.toLowerCase().includes(query)) ||
        (b.dropoff?.toLowerCase().includes(query)) ||
        (b.customerEmail?.toLowerCase().includes(query)) ||
        (b.customerPhone?.toLowerCase().includes(query))
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

    // Deduplicate by id to prevent React key errors
    const uniqueBookings = result.filter((booking, index, self) =>
      index === self.findIndex(b => b.id === booking.id)
    );

    return uniqueBookings;
  }, [bookings, bookingCategory, searchQuery, typeFilter, serviceFilter, statusFilter, priceSort, dateSort, bookingTimeFilter, bookingDateTypeFilter, bookingMonthRange, bookingYearRange]);

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
      const { id, ...couponData } = data;
      const newRef = doc(collection(db, 'coupons'));
      await setDoc(newRef, {
        ...couponData,
        id: newRef.id,
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `assets/logo_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, logo: url } });
    } catch (err) {
      console.error('Logo upload error:', err);
      alert('Failed to upload logo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `assets/favicon_${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, favicon: url } });
    } catch (err) {
      console.error('Favicon upload error:', err);
      alert('Failed to upload favicon');
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

  const handleUpdateFloatingSettings = async (data: any) => {
    setIsSavingFloatingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'floating'), {
        ...data,
        updatedAt: serverTimestamp()
      });
      alert('Floating elements settings saved successfully!');
    } catch (err) {
      console.error('Error saving floating settings:', err);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/floating');
    } finally {
      setIsSavingFloatingSettings(false);
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

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    alert('URL copied to clipboard!');
  };

  const handleUpdateMedia = async (id: string, data: any) => {
    try {
      await updateDoc(doc(db, 'media', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setEditingMedia({ alt: '', title: '', description: '', caption: '' });
      setShowMediaModal(false);
    } catch (err) {
      console.error('Error updating media:', err);
      handleFirestoreError(err, OperationType.UPDATE, `media/${id}`);
    }
  };

  const uploadMedia = async (file: File, metadata: any, folder: string) => {
    if (!file) {
      alert('Please select a file to upload');
      return;
    }

    // Ensure we are signed in and admin before even starting
    if (!isAdmin) {
      alert('You must be an admin to upload media.');
      return;
    }

    setUploadingMedia(true);
    console.log('--- STARTING UPLOAD ---');
    console.log('Folder:', folder);
    console.log('File Name:', file.name);
    console.log('File Size:', file.size);

    try {
      const timestamp = Date.now();
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const folderPath = (folder || 'general').replace(/^\//, '').replace(/\/$/, '');
      const storagePath = `media/${folderPath}/${timestamp}_${sanitizedName}`;

      const storageRef = ref(storage, storagePath);
      console.log('Storage Path:', storagePath);

      const uploadTask = uploadBytesResumable(storageRef, file);

      const url = await new Promise<string>((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            console.log(`Upload Progress: ${progress.toFixed(2)}%`);
          },
          (error) => {
            console.error('SERVER REJECTED UPLOAD:', error);
            reject(error);
          },
          async () => {
            try {
              console.log('Upload task completed successfully.');
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (err) {
              console.error('Failed to get download URL:', err);
              reject(err);
            }
          }
        );
      });

      console.log('Download URL obtained:', url);

      const mediaData = {
        name: file.name,
        url,
        size: file.size,
        type: file.type,
        folder: folderPath,
        alt: metadata.alt || '',
        title: metadata.title || '',
        description: metadata.description || '',
        caption: metadata.caption || '',
        createdAt: serverTimestamp(),
        usedIn: [],
      };

      console.log('Committing to Firestore...');
      const docRef = await addDoc(collection(db, 'media'), mediaData);
      console.log('SUCCESS: Media created in Firestore with ID:', docRef.id);

      setShowMediaModal(false);
      setMediaFile(null);
      setEditingMedia({ alt: '', title: '', description: '', caption: '' });
      setTimeout(() => alert('Media uploaded successfully!'), 100);
    } catch (err: any) {
      console.error('CRITICAL FAILURE:', err);
      let msg = 'Unknown error';
      if (err.code === 'storage/unauthorized') msg = 'Permission denied (Storage Rules)';
      else if (err.message) msg = err.message;
      alert(`Upload Error: ${msg}`);
    } finally {
      setUploadingMedia(false);
      console.log('--- UPLOAD PROCESS FINISHED ---');
    }
  };

  const handleDeleteMedia = async (id: string, url: string) => {
    try {
      // 1. Delete from storage if it exists
      if (url) {
        try {
          const storageRef = ref(storage, url);
          await deleteObject(storageRef);
        } catch (storageErr) {
          console.error('Error deleting from storage (might not exist or invalid url):', storageErr);
        }
      }

      // 2. Delete from db
      await deleteDoc(doc(db, 'media', id));
    } catch (err) {
      console.error('Error deleting media:', err);
      handleFirestoreError(err, OperationType.DELETE, `media/${id}`);
    }
  };

  const executeDeleteExtra = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'extras', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `extras/${id}`);
    }
  };

  const handleDuplicateOffer = async (offer: any) => {
    try {
      const duplicatedData = {
        ...offer,
        title: `${offer.title} (Copy)`,
        slug: `${offer.slug}-copy-${Math.floor(Math.random() * 1000)}`,
      };
      // Clean up metadata
      delete duplicatedData.id;
      delete duplicatedData.createdAt;
      delete duplicatedData.updatedAt;

      await handleUpdateOffer('new', duplicatedData);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'offers');
    }
  };

  const handleDuplicateTour = async (tour: any) => {
    try {
      const { id, createdAt, updatedAt, ...rest } = tour;
      await handleUpdateTour('new', {
        ...rest,
        title: `${rest.title} (Copy)`,
        slug: `${rest.slug}-copy`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tours');
    }
  };

  const handleUpdatePage = async (id: string | null, data: any) => {
    try {
      // Clean up data before saving
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;

      // Convert keywords string to array if it's a string
      const processedData = {
        ...rest,
        keywords: typeof data.keywords === 'string'
          ? data.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k !== '')
          : (data.keywords || [])
      };

      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'pages'));
        await setDoc(newRef, { ...processedData, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'pages', id), {
          ...processedData,
          updatedAt: serverTimestamp()
        });
      }
      setShowPageModal(false);
      setEditingPage(null);
    } catch (err) {
      console.error('Error saving page:', err);
      handleFirestoreError(err, OperationType.WRITE, 'pages');
    }
  };

  const handleUpdateBlog = async (id: string | null, data: any) => {
    try {
      // Clean up data
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;

      // Convert keywords string to array if it's a string
      const processedData = {
        ...rest,
        keywords: typeof data.keywords === 'string'
          ? data.keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k !== '')
          : (data.keywords || [])
      };

      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'blogs'));
        await setDoc(newRef, { ...processedData, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'blogs', id), {
          ...processedData,
          updatedAt: serverTimestamp()
        });
      }
      setShowBlogModal(false);
      setEditingBlog(null);
    } catch (err) {
      console.error('Error saving blog:', err);
      handleFirestoreError(err, OperationType.WRITE, 'blogs');
    }
  };

  const handleUpdateOffer = async (id: string | null, data: any) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;

      const processedFleets = (rest.fleets || []).map((f: any) => ({
        ...f,
        basePrice: Number(f.basePrice),
        salePrice: Number(f.salePrice)
      }));

      const processedData = {
        ...rest,
        discountValue: Number(rest.discountValue),
        fleets: processedFleets,
        active: rest.active === undefined ? true : Boolean(rest.active),
        slug: rest.slug || rest.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `offer-${Date.now()}`
      };

      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'offers'));
        await setDoc(newRef, { ...processedData, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'offers', id), {
          ...processedData,
          updatedAt: serverTimestamp()
        });
      }
      setShowOfferModal(false);
      setEditingOffer(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'offers');
    }
  };

  const handleDeleteOffer = (id: string) => {
    setConfirmDelete({ id, type: 'offer' as any });
  };

  const executeDeleteOffer = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'offers', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `offers/${id}`);
    }
  };

  const handleUpdateTour = async (id: string | null, data: any) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...rest } = data;

      const deepClean = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(v => deepClean(v)).filter(v => v !== undefined);
        }
        if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
          return Object.fromEntries(
            Object.entries(obj)
              .map(([k, v]) => [k, deepClean(v)])
              .filter(([_, v]) => v !== undefined)
          );
        }
        return obj === undefined ? undefined : obj;
      };

      const cleanList = (list: any[], filterKey: string) => {
        return (list || []).filter(item => {
          if (typeof item === 'string') return item.trim() !== '';
          if (typeof item === 'object' && item !== null) {
            return item[filterKey] && String(item[filterKey]).trim() !== '';
          }
          return false;
        });
      };

      const rawData: any = {
        title: rest.title || 'Untitled Tour',
        slug: rest.slug || rest.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `tour-${Date.now()}`,
        active: rest.active === undefined ? true : Boolean(rest.active),
        maxPeople: Number(rest.maxPeople || 0),
        duration: rest.duration || '',
        startPlace: rest.startPlace || '',
        ageRange: rest.ageRange || '',
        shortDescription: rest.shortDescription || '',
        fullDescription: rest.fullDescription || '',
        promoTag: rest.promoTag || '',
        customerNote: rest.customerNote || '',
        category: rest.category || '',
        image: rest.image || rest.featuredImage || '',
        featuredImage: rest.featuredImage || rest.image || '',
        gallery: cleanList(rest.gallery, ''),
        inclusions: cleanList(rest.inclusions, ''),
        exclusions: cleanList(rest.exclusions, ''),
        activities: cleanList(rest.activities, ''),
        placesToVisit: cleanList(rest.placesToVisit, ''),
        fleets: cleanList(rest.fleets, 'name').map((f: any) => ({
          ...f,
          passengers: Number(f.passengers || 0),
          standardPrice: Number(f.standardPrice || 0),
          salePrice: Number(f.salePrice || 0)
        })),
        extras: cleanList(rest.extras, 'name').map((e: any) => ({
          ...e,
          price: Number(e.price || 0),
          availableCount: Number(e.availableCount || 0)
        })),
        itinerary: cleanList(rest.itinerary, 'name').map((it: any, idx: number) => ({
          ...it,
          order: it.order !== undefined ? Number(it.order) : idx
        })),
        faqs: cleanList(rest.faqs, 'question'),
        tags: cleanList(rest.tags, ''),
        availability: rest.availability || {}
      };

      const processedData = deepClean(rawData);

      if (!id || id === 'new') {
        const newRef = doc(collection(db, 'tours'));
        await setDoc(newRef, { ...processedData, id: newRef.id, createdAt: serverTimestamp() });
      } else {
        await updateDoc(doc(db, 'tours', id), {
          ...processedData,
          updatedAt: serverTimestamp()
        });
      }
      setShowTourModal(false);
      setEditingTour(null);
    } catch (err) {
      console.error('Error updating tour:', err);
      handleFirestoreError(err, OperationType.WRITE, 'tours');
    }
  };

  const handleDeleteTour = (id: string) => {
    setConfirmDelete({ id, type: 'tour' as any });
  };

  const executeDeleteTour = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tours', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tours/${id}`);
    }
  };

  const handleBulkDuplicateTours = async () => {
    for (const id of selectedTours) {
      const tour = tours.find(t => t.id === id);
      if (tour) {
        await handleDuplicateTour(tour);
      }
    }
    setSelectedTours([]);
  };

  const executeBulkDeleteTours = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'tours', id));
      }
      setConfirmDelete(null);
      setSelectedTours([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tours`);
    }
  };

  const handleBulkDuplicateOffers = async () => {
    for (const id of selectedOffers) {
      const offer = offers.find(o => o.id === id);
      if (offer) {
        await handleDuplicateOffer(offer);
      }
    }
    setSelectedOffers([]);
  };

  const executeBulkDeleteOffers = async (ids: string[]) => {
    try {
      for (const id of ids) {
        await deleteDoc(doc(db, 'offers', id));
      }
      setConfirmDelete(null);
      setSelectedOffers([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `offers`);
    }
  };

  const executeBulkUpdateOffersStatus = async (ids: string[], active: boolean) => {
    try {
      for (const id of ids) {
        await updateDoc(doc(db, 'offers', id), { active, updatedAt: serverTimestamp() });
      }
      setSelectedOffers([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `offers`);
    }
  };

  const executeBulkUpdateToursStatus = async (ids: string[], active: boolean) => {
    try {
      for (const id of ids) {
        await updateDoc(doc(db, 'tours', id), { active, updatedAt: serverTimestamp() });
      }
      setSelectedTours([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tours`);
    }
  };

  const handleToggleOfferStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'offers', id), { active: !currentStatus, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `offers/${id}`);
    }
  };

  const handleToggleTourStatus = async (id: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'tours', id), { active: !currentStatus, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tours/${id}`);
    }
  };

  const handleCsvUpload = async (type: 'offers' | 'tours', file: File) => {
    if (!file) return;

    setIsUploadingCsv(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const rows = text.split('\n').filter(row => row.trim() !== '');
        if (rows.length < 2) {
          alert('CSV file must contain at least a header row and one data row.');
          return;
        }

        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

        let successCount = 0;
        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].split(',').map(v => v.trim());
          if (values.length < headers.length) continue;

          const item: any = {};
          headers.forEach((header, index) => {
            if (header && header.trim() !== "") {
              item[header.trim()] = values[index];
            }
          });

          // Metadata & conversions
          item.active = item.active === 'false' ? false : true;
          item.createdAt = serverTimestamp();

          if (type === 'offers') {
            const fleetsData = item.fleets_data || "";
            delete item.fleets_data;

            if (item.overalldescription) {
              item.description = item.overalldescription;
              delete item.overalldescription;
            }

            // Process tags
            if (item.tags && typeof item.tags === 'string') {
              item.tags = item.tags.split('|').map((t: string) => t.trim());
            }

            // Process nested fleets
            item.fleets = (fleetsData as string).split(';').filter(f => f.trim() !== '').map((fleetStr: string) => {
              const [fType, fImage, fDescription, fCapacity, fLuggage, fBasePrice, fAdditionalInfo] = fleetStr.split('|').map(v => v.trim());
              const bPrice = Number(fBasePrice) || 0;
              const dValue = Number(item.discountvalue || item.discval) || 15;
              const dType = item.discounttype || item.disctype || 'percentage';
              item.discountType = dType;
              item.discountValue = dValue;

              const salePrice = dType === 'percentage'
                ? Math.round(bPrice * (1 - dValue / 100))
                : Math.max(0, bPrice - dValue);

              return {
                type: fType || 'Standard',
                image: fImage || '',
                description: fDescription || '',
                capacity: fCapacity || '3 Passengers',
                luggage: fLuggage || '2 Suitcases',
                basePrice: bPrice,
                salePrice,
                additionalInfo: fAdditionalInfo || ''
              };
            });

            // delete unwanted CSV headers if they exist
            delete item.discountvalue;
            delete item.discval;
            delete item.discounttype;
            delete item.disctype;

            await handleUpdateOffer('new', item);
          } else {
            // Process complex tour fields
            // Normalize common lowercase CSV keys to camelCase
            if (item.maxpeople) { item.maxPeople = item.maxpeople; delete item.maxpeople; }
            if (item.agerange) { item.ageRange = item.agerange; delete item.agerange; }
            if (item.startplace) { item.startPlace = item.startplace; delete item.startplace; }
            if (item.shortdescription) { item.shortDescription = item.shortdescription; delete item.shortdescription; }
            if (item.fulldescription) { item.fullDescription = item.fulldescription; delete item.fulldescription; }
            if (item.placestovisit) { item.placesToVisit = item.placestovisit; delete item.placestovisit; }
            if (item.promotag) { item.promoTag = item.promotag; delete item.promotag; }
            if (item.customernote) { item.customerNote = item.customernote; delete item.customernote; }

            if (item.availabilitystartdate || item.availabilityenddate) {
              item.availability = {
                startDate: item.availabilitystartdate || '',
                endDate: item.availabilityenddate || ''
              };
              delete item.availabilitystartdate;
              delete item.availabilityenddate;
            }

            item.active = String(item.active).toLowerCase() === 'false' ? false : true;
            item.maxPeople = Number(item.maxPeople || 0);

            // Basic lists
            const splitList = (key: string) => {
              if (item[key] && typeof item[key] === 'string') {
                item[key] = item[key].split('|').map((s: string) => s.trim()).filter((s: string) => s !== '');
              } else if (!Array.isArray(item[key])) {
                item[key] = [];
              }
            };
            ['gallery', 'inclusions', 'exclusions', 'activities', 'placesToVisit', 'tags'].forEach(splitList);

            // Fleets: Name|Image|Pax|Luggage|StdPrice|SalePrice|Info ; Name2...
            if (item.fleets && typeof item.fleets === 'string') {
              item.fleets = item.fleets.split(';').filter(f => f.trim() !== '').map((f: string) => {
                const [name, image, passengers, luggage, standardPrice, salePrice, additionalInfo] = f.split('|').map(v => v.trim());
                return {
                  name, image,
                  passengers: Number(passengers) || 0,
                  luggage,
                  standardPrice: Number(standardPrice) || 0,
                  salePrice: Number(salePrice) || 0,
                  additionalInfo
                };
              });
            } else {
              item.fleets = [];
            }

            // Extras: Name|Description|Price|Count ; Name2...
            if (item.extras && typeof item.extras === 'string') {
              item.extras = item.extras.split(';').filter(e => e.trim() !== '').map((e: string) => {
                const [name, description, price, availableCount] = e.split('|').map(v => v.trim());
                return { name, description, price: Number(price) || 0, availableCount: Number(availableCount) || 0 };
              });
            } else {
              item.extras = [];
            }

            // Itinerary: Name|Image|Details ; Name2...
            if (item.itinerary && typeof item.itinerary === 'string') {
              item.itinerary = item.itinerary.split(';').filter(it => it.trim() !== '').map((it: string) => {
                const [name, image, details] = it.split('|').map(v => v.trim());
                return { name, image, details };
              });
            } else {
              item.itinerary = [];
            }

            // FAQs: Q|A ; Q2|A2
            if (item.faqs && typeof item.faqs === 'string') {
              item.faqs = item.faqs.split(';').filter(f => f.trim() !== '').map((f: string) => {
                const [question, answer] = f.split('|').map(v => v.trim());
                return { question, answer };
              });
            } else {
              item.faqs = [];
            }

            await handleUpdateTour('new', item);
          }
          successCount++;
        }
        alert(`${successCount} ${type} imported successfully!`);
        setShowCsvImportModal(false);
      } catch (err) {
        console.error(`Error importing ${type}:`, err);
        alert(`Failed to import ${type}. Please check your CSV format.`);
      } finally {
        setIsUploadingCsv(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDuplicatePage = async (page: any) => {
    try {
      const duplicatedData = {
        ...page,
        title: `${page.title} (Copy)`,
        slug: `${page.slug}-copy-${Math.floor(Math.random() * 1000)}`,
      };
      // Clean up metadata from Firestore if present
      delete duplicatedData.id;
      delete duplicatedData.createdAt;
      delete duplicatedData.updatedAt;

      await handleUpdatePage(null, duplicatedData);
    } catch (err) {
      console.error('Error duplicating page:', err);
    }
  };

  const handleDuplicateBlog = async (blog: any) => {
    try {
      const duplicatedData = {
        ...blog,
        title: `${blog.title} (Copy)`,
        slug: `${blog.slug}-copy-${Math.floor(Math.random() * 1000)}`,
      };
      // Clean up metadata from Firestore if present
      delete duplicatedData.id;
      delete duplicatedData.createdAt;
      delete duplicatedData.updatedAt;

      await handleUpdateBlog(null, duplicatedData);
    } catch (err) {
      console.error('Error duplicating blog:', err);
    }
  };

  const handleDeletePage = (id: string) => {
    setConfirmDelete({ id, type: 'page' });
  };

  const handleDeleteBlog = (id: string) => {
    setConfirmDelete({ id, type: 'blog' });
  };

  const executeDeletePage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'pages', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `pages/${id}`);
    }
  };

  const executeDeleteBlog = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'blogs', id));
      setConfirmDelete(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `blogs/${id}`);
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
            {/* Booking Stats Section ... (original content continued) */}
            {isAdmin && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Total Bookings */}
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-2 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      Total Bookings
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-gold font-display">{bookings.length}</h3>
                  </div>
                  <p className="text-[10px] text-white/60">All Time</p>
                </div>

                {/* Revenue */}
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-2 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      Total Revenue
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-green-500 font-display">${Math.round(analytics.totalRevenue)}</h3>
                  </div>
                  <p className="text-[10px] text-white/60">From Completed Bookings</p>
                </div>

                {/* Monthly */}
                <div className="glass p-4 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-2 w-full">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/40">
                      This Month
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-blue-500 font-display">{analytics.currentMonthCount}</h3>
                  </div>
                  <p className="text-[10px] text-white/60">${Math.round(analytics.currentMonthRevenue || 0)} revenue</p>
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
                      <ThumbsUp size={12} className="text-cyan-400 mb-2" />
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
            <div className="flex flex-col gap-6">
              {/* Heading Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-display text-gold">Bookings</h2>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
                    Manage and track all rides
                  </p>
                </div>
              </div>

              {/* Filters Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left side: Standard + Grid/List */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Standard / Offers */}
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9">
                    <button
                      onClick={() => setBookingCategory('standard')}
                      className={cn(
                        "px-4 py-1 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                        bookingCategory === 'standard'
                          ? "bg-gold text-black shadow-lg"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        Standard <span className={cn("px-1.5 py-0.5 rounded text-[9px]", bookingCategory === 'standard' ? "bg-black/20 text-black" : "bg-white/10 text-white/60")}>{bookings.filter(b => b.type !== 'offer' && b.type !== 'tour').length}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => setBookingCategory('offer')}
                      className={cn(
                        "px-4 py-1 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                        bookingCategory === 'offer'
                          ? "bg-gold text-black shadow-lg"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        Offers <span className={cn("px-1.5 py-0.5 rounded text-[9px]", bookingCategory === 'offer' ? "bg-black/20 text-black" : "bg-white/10 text-white/60")}>{bookings.filter(b => b.type === 'offer').length}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => setBookingCategory('tour')}
                      className={cn(
                        "px-4 py-1 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                        bookingCategory === 'tour'
                          ? "bg-gold text-black shadow-lg"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      <span className="flex items-center gap-1.5">
                        Tours <span className={cn("px-1.5 py-0.5 rounded text-[9px]", bookingCategory === 'tour' ? "bg-black/20 text-black" : "bg-white/10 text-white/60")}>{bookings.filter(b => b.type === 'tour').length}</span>
                      </span>
                    </button>
                  </div>

                  {/* Grid / List */}
                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9">
                    <button
                      onClick={() => setBookingViewMode('grid')}
                      className={cn(
                        "px-3 py-1 rounded-lg transition-all",
                        bookingViewMode === 'grid'
                          ? "bg-gold text-black shadow-lg"
                          : "text-white/40 hover:text-white"
                      )}
                      title="Grid View"
                    >
                      <LayoutGrid size={14} />
                    </button>
                    <button
                      onClick={() => setBookingViewMode('table')}
                      className={cn(
                        "px-3 py-1 rounded-lg transition-all",
                        bookingViewMode === 'table'
                          ? "bg-gold text-black shadow-lg"
                          : "text-white/40 hover:text-white"
                      )}
                      title="Table View"
                    >
                      <List size={14} />
                    </button>
                  </div>
                </div>

                {/* Right side: Day/Time filters + Bulk Actions */}
                <div className="flex flex-wrap items-center gap-2">
                  <AnimatePresence>
                    {isFiltersExpanded && (
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9 mr-2">
                          {(() => {
                            const selectableBookings = filteredAndSortedBookings.filter((b: any) => b.status !== 'completed' && b.status !== 'cancelled');
                            const allSelected = isBookingsSelectionMode && selectableBookings.length > 0 && selectedBookings.length === selectableBookings.length;
                            return (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsBookingsSelectionMode(!isBookingsSelectionMode);
                                    setSelectedBookings([]);
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                                    isBookingsSelectionMode && !allSelected ? "bg-gold text-black" : "text-white/40 hover:text-white"
                                  )}
                                  title="Selection Mode ON"
                                >
                                  <Check size={14} />
                                  <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">Select</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsBookingsSelectionMode(true);
                                    setSelectedBookings(selectableBookings.map((b: any) => b.id));
                                  }}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                                    allSelected ? "bg-gold text-black" : "text-white/40 hover:text-white"
                                  )}
                                  title="Select All"
                                >
                                  <CheckCheck size={14} />
                                  <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">All</span>
                                </button>
                              </>
                            );
                          })()}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBookings([]);
                              setIsBookingsSelectionMode(false);
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                              !isBookingsSelectionMode ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                            )}
                            title="Select None"
                          >
                            <XSquare size={14} />
                            <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">None</span>
                          </button>
                        </div>


                        {selectedBookings.length > 0 && (
                          <div className="flex items-center gap-2 mr-2 animate-in fade-in zoom-in duration-200">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-gold px-2 shrink-0">
                              {selectedBookings.length} Selected
                            </span>

                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'pending')}
                                  className="p-2 bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500 hover:text-white transition-all"
                                  title="Mark as Pending"
                                >
                                  <Clock size={16} />
                                </button>
                                <button
                                  onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'confirmed')}
                                  className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                                  title="Mark as Confirmed"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'cancelled')}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                  title="Mark as Cancelled"
                                >
                                  <XCircle size={16} />
                                </button>
                                <div className="relative">
                                  <button
                                    onClick={() => setShowDriverBulkAssign(!showDriverBulkAssign)}
                                    className="p-2 bg-purple-500/10 text-purple-400 rounded-lg hover:bg-purple-500 hover:text-white transition-all"
                                  >
                                    <Truck size={16} />
                                  </button>
                                  {showDriverBulkAssign && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-black/90 p-2 rounded-xl border border-white/10 shadow-xl z-20 flex flex-col gap-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                                      <div className="text-[8px] uppercase tracking-widest text-white/40 px-2 py-1 font-bold mb-1">Assign Driver To Selection</div>
                                      <button
                                        onClick={() => { executeBulkAssignDriver(selectedBookings, null); setShowDriverBulkAssign(false); }}
                                        className="text-left px-3 py-2 text-xs text-white/40 hover:bg-white/10 hover:text-white rounded-lg transition-colors truncate italic"
                                      >
                                        None (Unassign)
                                      </button>
                                      {drivers.map((driver, dIdx) => (
                                        <button
                                          key={`${driver.id}-${dIdx}`}
                                          onClick={() => { executeBulkAssignDriver(selectedBookings, driver.id); setShowDriverBulkAssign(false); }}
                                          className="text-left px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white rounded-lg transition-colors truncate mt-1"
                                        >
                                          {driver.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => setConfirmDelete({ type: 'bulk-bookings', ids: selectedBookings })}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all ml-1"
                                  title="Delete Selected"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}

                            {isDriver && !isAdmin && (
                              <>
                                <button
                                  onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'accepted')}
                                  className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                                  title="Accept Bookings"
                                >
                                  <CheckCircle size={16} />
                                </button>
                                <button
                                  onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'rejected')}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                  title="Reject Bookings"
                                >
                                  <X size={16} />
                                </button>
                                <button
                                  onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'completed')}
                                  className="p-2 bg-gold/10 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                  title="Mark as Completed"
                                >
                                  <CheckSquare size={16} />
                                </button>
                              </>
                            )}

                            {!isAdmin && !isDriver && (
                              <>
                                <button
                                  onClick={() => executeBulkUpdateBookingsStatus(selectedBookings, 'cancelled')}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                  title="Cancel Select Bookings"
                                >
                                  <XCircle size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Time range buttons */}
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9">
                          {[
                            { label: 'All', value: 'all' },
                            { label: '3D', value: '3d' },
                            { label: '7D', value: '7d' },
                            { label: '30D', value: '30d' },
                            { label: 'Month', value: 'month' },
                            { label: 'Year', value: 'year' }
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => setBookingTimeFilter(opt.value as any)}
                              className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all whitespace-nowrap",
                                bookingTimeFilter === opt.value
                                  ? "bg-gold text-black shadow-lg"
                                  : "text-white/40 hover:text-white"
                              )}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {/* Year range select */}
                        {bookingTimeFilter === 'year' && (
                          <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/10 h-9">
                            {/* start year */}
                            <select
                              value={bookingYearRange.start}
                              onChange={(e) =>
                                setBookingYearRange((prev) => ({
                                  ...prev,
                                  start: parseInt(e.target.value),
                                }))
                              }
                              className="bg-transparent text-[10px] text-white/70 outline-none px-1 cursor-pointer"
                            >
                              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                                <option key={y} value={y} className="bg-black">
                                  {y}
                                </option>
                              ))}
                            </select>
                            <span className="text-white/20 text-[10px]">-</span>
                            {/* end year */}
                            <select
                              value={bookingYearRange.end}
                              onChange={(e) =>
                                setBookingYearRange((prev) => ({
                                  ...prev,
                                  end: parseInt(e.target.value),
                                }))
                              }
                              className="bg-transparent text-[10px] text-white/70 outline-none px-1 cursor-pointer"
                            >
                              {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                                <option key={y} value={y} className="bg-black">
                                  {y}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Month range inputs */}
                        {bookingTimeFilter === 'month' && (
                          <div className="flex items-center gap-2 bg-black/20 p-1 rounded-xl border border-white/10 h-9">
                            <input
                              type="month"
                              value={bookingMonthRange.start}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) setBookingMonthRange((prev) => ({ ...prev, start: val }));
                              }}
                              className="bg-transparent text-[10px] text-white/70 outline-none px-1 cursor-pointer [color-scheme:dark]"
                            />
                            <span className="text-white/20 text-[10px]">-</span>
                            <input
                              type="month"
                              value={bookingMonthRange.end}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) setBookingMonthRange((prev) => ({ ...prev, end: val }));
                              }}
                              className="bg-transparent text-[10px] text-white/70 outline-none px-1 cursor-pointer [color-scheme:dark]"
                            />
                          </div>
                        )}

                        {/* Pickup / Booking toggle */}
                        <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 h-9">
                          <button
                            onClick={() => setBookingDateTypeFilter('pickup')}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all",
                              bookingDateTypeFilter === 'pickup'
                                ? "bg-gold text-black shadow-lg"
                                : "text-white/40 hover:text-white"
                            )}
                          >
                            Pickup
                          </button>
                          <button
                            onClick={() => setBookingDateTypeFilter('booking')}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all",
                              bookingDateTypeFilter === 'booking'
                                ? "bg-gold text-black shadow-lg"
                                : "text-white/40 hover:text-white"
                            )}
                          >
                            Booking
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                    className={cn(
                      "p-2 rounded-xl border border-white/5 bg-white/5 text-gold hover:bg-white/10 transition-all self-end",
                      isFiltersExpanded ? "rotate-180" : ""
                    )}
                    title={isFiltersExpanded ? "Collapse Filters" : "Expand Filters"}
                  >
                    <ChevronLeft size={16} />
                  </button>
                </div>
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
                  <option value="occasions">Special Occasions</option>
                  <option value="hourly">Hourly</option>
                  <option value="event">Event</option>
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
            ) : bookingViewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAndSortedBookings.map((booking, idx) => (
                  <div key={`booking-card-${booking.id}-${idx}`} className={cn("glass p-5 rounded-2xl overflow-hidden border transition-all group flex flex-col h-full relative", selectedBookings.includes(booking.id) ? "border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "border-white/5")}>

                    <div className="flex justify-between items-start mb-4">
                      {/* Left side: Selection + stacked date + name */}
                      <div className="flex items-start gap-3">
                        {isBookingsSelectionMode &&
                          booking.status !== 'completed' &&
                          booking.status !== 'cancelled' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (selectedBookings.includes(booking.id))
                                  setSelectedBookings((prev) => prev.filter((id) => id !== booking.id));
                                else setSelectedBookings((prev) => [...prev, booking.id]);
                              }}
                              className={cn(
                                "w-5 h-5 flex items-center justify-center transition-all flex-shrink-0 mt-1",
                                selectedBookings.includes(booking.id)
                                  ? "text-gold"
                                  : "text-white/40 hover:text-white"
                              )}
                            >
                              {selectedBookings.includes(booking.id) ? (
                                <SquareCheck size={14} />
                              ) : (
                                <Square size={14} />
                              )}
                            </button>
                          )}

                        <div className="flex flex-col min-w-0">
                          <p className="text-[9px] text-white/30 uppercase tracking-widest font-bold">
                            Booked on: {booking.createdAt?.seconds
                              ? format(new Date(booking.createdAt.seconds * 1000), 'dd-MM-yyyy HH:mm')
                              : 'N/A'}
                          </p>
                          <h3 className="text-lg font-display text-white group-hover:text-gold transition-colors truncate">
                            {bookingCategory === 'offer'
                              ? booking.packageTitle || 'Package'
                              : bookingCategory === 'tour'
                                ? booking.tourTitle || 'Tour'
                                : booking.customerName || 'Customer'}
                          </h3>
                        </div>
                      </div>

                      {/* Right side: status pill */}
                      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest self-start">
                        {booking.status && (
                          <span
                            className={cn(
                              "flex items-center gap-1.5 px-2 py-1 rounded-full border",
                              booking.status === 'pending'
                                ? "bg-gold/10 text-gold border-gold/20"
                                : booking.status === 'confirmed'
                                  ? "bg-blue-500/10 text-blue-400 border-blue-400/20"
                                  : booking.status === 'completed'
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : booking.status === 'cancelled'
                                      ? "bg-red-500/10 text-red-400 border-red-400/20"
                                      : booking.status === 'accepted'
                                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-400/20"
                                        : booking.status === 'rejected'
                                          ? "bg-orange-500/10 text-orange-400 border-orange-400/20"
                                          : booking.status === 'assigned'
                                            ? "bg-purple-500/10 text-purple-400 border-purple-400/20"
                                            : "bg-black/10 text-white border-white/20"
                            )}
                          >
                            {booking.status === 'pending' && <Clock className="h-3 w-3" />}
                            {booking.status === 'confirmed' && <CheckCircle className="h-3 w-3" />}
                            {booking.status === 'completed' && <CheckSquare className="h-3 w-3" />}
                            {booking.status === 'cancelled' && <XCircle className="h-3 w-3" />}
                            {booking.status === 'accepted' && <ThumbsUp className="h-3 w-3" />}
                            {booking.status === 'rejected' && <ThumbsDown className="h-3 w-3" />}
                            {booking.status === 'assigned' && <Truck className="h-3 w-3" />}
                            <span>{booking.status}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-start gap-3">
                        <LocateFixed size={12} className="text-gold shrink-0 mt-0.5" />
                        <p className="text-xs text-white/70 truncate">{booking.pickup}</p>
                      </div>
                      <div className="flex items-start gap-3">
                        <MapPin size={12} className="text-gold shrink-0 mt-0.5" />
                        <p className={cn("text-xs truncate", booking.dropoff ? "text-white/70" : "text-white/60 italic")}>
                          {booking.dropoff || (booking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                        </p>
                      </div>

                      {/* Date + Info */}
                      <div className="space-y-3 pt-2 border-t border-white/5 pb-2">

                        <div className="flex flex-wrap items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Calendar size={12} className="text-gold" />
                            <span className="text-[10px] text-white/60 font-bold uppercase">
                              {booking.date} at {formatTimeToAMPM(booking.time)}
                            </span>
                          </div>

                          {booking.isReturn && (
                            <div className="flex items-center gap-2">
                              <RotateCcw size={12} className="text-blue-500" />
                              <span className="text-[10px] text-white/60 font-bold uppercase">
                                {booking.returnDate} at {formatTimeToAMPM(booking.returnTime)}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                          {booking.distance && (
                            <div className="flex items-center gap-1.5">
                              <Navigation size={12} className="text-gold" />
                              <span className="text-[10px] text-white/60 font-bold uppercase">
                                {(() => {
                                  if (!booking.isReturn) return booking.distance;
                                  const num = parseFloat(booking.distance.replace(/[^\d.]/g, ''));
                                  return isNaN(num) ? booking.distance : `${(num * 2).toFixed(1)} km`;
                                })()}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5">
                            {bookingCategory === 'offer' ? (
                              <>
                                <Blocks size={12} className="text-gold" />
                                <span className="text-[10px] text-white/60 font-bold uppercase truncate">
                                  {booking.serviceType || 'Standard'}
                                </span>
                              </>
                            ) : bookingCategory === 'tour' ? (
                              <>
                                <MapIcon size={12} className="text-gold" />
                                <span className="text-[10px] text-white/60 font-bold uppercase truncate">
                                  {booking.serviceType || 'Standard'}
                                </span>
                              </>
                            ) : (
                              <>
                                <Clock size={12} className="text-gold" />
                                <span className="text-[10px] text-white/60 font-bold uppercase">
                                  {booking.serviceType === 'hourly'
                                    ? `${booking.hours} Hours`
                                    : (() => {
                                      if (!booking.duration) return 'N/A';
                                      if (!booking.isReturn) return booking.duration;
                                      const match = booking.duration.match(/(\d+)\s*min/);
                                      if (match) {
                                        return `${parseInt(match[1]) * 2} mins`;
                                      }
                                      return booking.duration;
                                    })()}
                                </span>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Car size={12} className="text-gold" />
                            <span className="text-[10px] text-white/60 font-bold uppercase">
                              {booking.vehicleType || 'Sedan'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {bookingCategory !== 'offer' && (
                      <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5">
                        {/* Service */}
                        <div className="flex flex-col">
                          <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Service</span>
                          <span className="text-[10px] text-gold font-bold truncate uppercase">
                            {booking.serviceType || 'Standard'}
                          </span>
                        </div>

                        {/* Waypoints */}
                        <div className="flex flex-col relative">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Waypoints</span>
                            {booking.waypoints?.length > 0 && (
                              <button
                                onMouseEnter={() => setShowWaypointsPopup(booking.id)}
                                onMouseLeave={() => setShowWaypointsPopup(null)}
                                className="text-gold/50 hover:text-gold transition-colors"
                              >
                                <Eye size={10} />
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-white/70 truncate">
                            {booking.waypoints?.length || 0} Stops
                          </span>

                          <AnimatePresence>
                            {showWaypointsPopup === booking.id && booking.waypoints?.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute bottom-full left-0 mb-2 w-48 bg-black p-3 rounded-xl border border-gold/20 z-50 shadow-2xl"
                              >
                                <p className="text-[8px] uppercase tracking-widest text-gold font-bold mb-2">Stop Details</p>
                                <div className="space-y-2">
                                  {(booking.waypoints || []).map((wp: string, i: number) => (
                                    <div key={`wp-pop-${i}`} className="flex gap-2 items-start">
                                      <div className="w-1 h-1 rounded-full bg-gold mt-1.5 shrink-0" />
                                      <p className="text-[9px] text-white/70 leading-tight">{wp}</p>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Extras */}
                        <div className="flex flex-col relative">
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Extras</span>
                            {booking.selectedExtras && (Array.isArray(booking.selectedExtras) ? booking.selectedExtras.length > 0 : Object.keys(booking.selectedExtras).length > 0) && (
                              <button
                                onMouseEnter={() => setShowExtrasPopup(booking.id)}
                                onMouseLeave={() => setShowExtrasPopup(null)}
                                className="text-gold/50 hover:text-gold transition-colors"
                              >
                                <Eye size={10} />
                              </button>
                            )}
                          </div>
                          <span className="text-[10px] text-white/70 truncate">
                            {Array.isArray(booking.selectedExtras)
                              ? booking.selectedExtras.length
                              : Object.keys(booking.selectedExtras || {}).length} Added
                          </span>

                          <AnimatePresence>
                            {showExtrasPopup === booking.id && (Array.isArray(booking.selectedExtras) ? booking.selectedExtras.length > 0 : Object.keys(booking.selectedExtras || {}).length > 0) && (
                              <motion.div
                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                className="absolute bottom-full right-0 mb-2 w-48 bg-black p-4 rounded-2xl border border-gold/20 z-50 shadow-2xl"
                              >
                                <p className="text-[9px] uppercase tracking-widest text-gold font-bold mb-3 border-b border-gold/10 pb-2">Selected Extras</p>
                                <div className="space-y-2">
                                  {Array.isArray(booking.selectedExtras) ? (
                                    booking.selectedExtras.map((id: string, index: number) => {
                                      const extra = extras.find((e) => e.id === id);
                                      return (
                                        <p
                                          key={`${id}-${index}`}
                                          className="text-[10px] text-white/70 font-bold uppercase tracking-tighter flex justify-between"
                                        >
                                          <span>• {extra?.name || 'Extra'}</span>
                                        </p>
                                      );
                                    })
                                  ) : (
                                    Object.entries(booking.selectedExtras || {}).map(([id, count]) => {
                                      const tour = tours.find(t => t.id === booking.tourId);
                                      const extra = (tour?.extras || []).find((e: any) => e.id === id);
                                      return (
                                        <div key={`extra-summary-${id}`} className="flex justify-between items-center bg-white/5 p-1.5 rounded-lg border border-white/5">
                                          <p className="text-[10px] text-white/70 font-bold uppercase tracking-tighter truncate">
                                            {extra?.name || 'Extra'}
                                          </p>
                                          <span className="text-[10px] text-gold font-mono bg-gold/10 px-1.5 rounded">×{count as number}</span>
                                        </div>
                                      );
                                    })
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )}

                    <div className="py-3 border-y border-white/10 mb-3 space-y-2">
                      {/* Always show customer name if offer */}
                      {bookingCategory === 'offer' && (
                        <div className="flex items-center gap-2">
                          <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">
                            Name:
                          </span>
                          <span className="text-[10px] text-white/70 whitespace-nowrap">
                            {booking.customerName || 'N/A'}
                          </span>
                        </div>
                      )}

                      {/* Row 1: Email & Phone */}
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        <div className="flex items-center gap-2 min-w-fit">
                          <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Email:</span>
                          <span className="text-[10px] text-white/70 whitespace-nowrap">
                            {booking.customerEmail || 'N/A'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 min-w-fit">
                          <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Phone:</span>
                          <span className="text-[10px] text-white/70 whitespace-nowrap">
                            {booking.customerPhone || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Row 2: Flight Number & Notes */}
                      <div className="flex flex-wrap gap-x-6 gap-y-2 items-center">
                        {booking.flightNumber && (
                          <div className="flex items-center gap-2 min-w-fit">
                            <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Flight:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-white/70 font-bold uppercase">{booking.flightNumber}</span>
                              <a
                                href={`https://www.melbourneairport.com.au/flights/departures/${booking.flightNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold hover:text-white transition-colors"
                                title="View on Melbourne Airport website"
                              >
                                <Globe size={10} />
                              </a>
                            </div>
                          </div>
                        )}

                        {booking.purpose && (
                          <div className="flex items-center gap-2 relative flex-1 min-w-[120px]">
                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Notes:</span>
                              <button
                                onMouseEnter={() => setShowNotesPopup(booking.id)}
                                onMouseLeave={() => setShowNotesPopup(null)}
                                className="text-gold/50 hover:text-gold transition-colors"
                              >
                                <Eye size={10} />
                              </button>
                            </div>
                            <p className="text-[10px] text-white/60 truncate italic">"{booking.purpose}"</p>

                            <AnimatePresence>
                              {showNotesPopup === booking.id && booking.purpose && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="absolute bottom-full right-0 mb-2 w-48 bg-black p-3 rounded-xl border border-gold/20 z-50 shadow-2xl"
                                >
                                  <p className="text-[8px] uppercase tracking-widest text-gold font-bold mb-2">Additional Info</p>
                                  <p className="text-[9px] text-white/70 leading-relaxed italic">"{booking.purpose}"</p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-auto space-y-3">
                      <div className="flex items-center justify-between p-2.5 bg-gold/5 rounded-xl border border-gold/10">
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

                      {/* Driver & Feedback Section */}
                      <div className="space-y-3 mb-3">
                        {booking.status !== 'completed' && (
                          <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                            <div className="flex justify-between items-center">

                              {/* Left side: Status badge + Driver details */}
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center",
                                    !booking.driverId
                                      ? "bg-red-500/20"
                                      : booking.status === "accepted"
                                        ? "bg-cyan-500/20"
                                        : booking.status === "rejected"
                                          ? "bg-orange-400/20"
                                          : "bg-purple-500/20"
                                  )}
                                >
                                  {!booking.driverId ? (
                                    <X size={12} className="text-red-500" />
                                  ) : booking.status === "accepted" ? (
                                    <UserCheck size={12} className="text-cyan-500" />
                                  ) : booking.status === "rejected" ? (
                                    <X size={12} className="text-orange-400" />
                                  ) : (
                                    <Truck size={12} className="text-purple-400" />
                                  )}
                                </div>

                                <div>
                                  <p className="text-[8px] uppercase tracking-widest font-bold">
                                    <span className="text-white/50">Driver: </span>{" "}
                                    <span
                                      className={cn(
                                        !booking.driverId
                                          ? "text-red-500"
                                          : booking.status === "accepted"
                                            ? "text-cyan-500/75"
                                            : booking.status === "rejected"
                                              ? "text-orange-400/75"
                                              : "text-purple-400/75"
                                      )}
                                    >
                                      {!booking.driverId
                                        ? "Unassigned"
                                        : booking.status === "accepted"
                                          ? "Accepted"
                                          : booking.status === "rejected"
                                            ? "Rejected"
                                            : "Assigned"}
                                    </span>
                                  </p>

                                  <div className="flex gap-2 items-center">
                                    {booking.driverId ? (
                                      <p className="text-[10px] text-white font-bold flex items-center gap-1">
                                        {allUsers.find(u => u.id === booking.driverId)?.name || "Unknown Driver"}
                                        <span className="text-white/30 font-normal">|</span>
                                        <span className="text-[9px] text-gold font-medium">
                                          {allUsers.find(u => u.id === booking.driverId)?.phone || "No Phone"}
                                        </span>
                                      </p>
                                    ) : (
                                      <p className="text-[10px] text-white font-bold">No Driver Assigned</p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right side: Route button */}
                              <div>
                                <button
                                  onClick={() => {
                                    setRouteBooking(booking);
                                    setMapDirections(null);
                                    setIsMapLoading(true);
                                    setShowRouteModal(true);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-red-500/10 via-green-500/10 to-blue-500/10 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-[9px] font-bold uppercase tracking-widest text-white/60 hover:text-white"
                                >
                                  <Route size={12} className="text-blue-400" />
                                  Route
                                </button>
                              </div>
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
                                {typeof booking.rating === "number" && booking.rating > 0 && (
                                  <span className="text-[10px] font-display text-gold">
                                    {booking.rating}   {/* integer only, no .0 */}
                                  </span>
                                )}

                                {!isDriver && (
                                  <button
                                    onClick={() => {
                                      setRatingBooking(booking);
                                      setRatingValue(booking.rating || 0);
                                      setRatingComment(booking.ratingComment || '');
                                    }}
                                    className="p-1.5 bg-gold/10 hover:bg-gold/20 rounded-lg text-gold transition-all"
                                    title={booking.rating ? "Edit Rating" : "Rate Now"}
                                  >
                                    {booking.rating ? (
                                      <Edit2 size={10} />
                                    ) : (
                                      <Plus size={10} />
                                    )}
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

                      <div className="flex items-center gap-1.5 w-full mt-2">
                        {isAdmin ? (
                          booking.status === 'completed' || booking.status === 'cancelled' ? (
                            <>
                              <button
                                onClick={() => {
                                  setViewingBooking(booking);
                                  setShowViewModal(true);
                                }}
                                className="flex-1 p-2.5 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                                title="View Details"
                              >
                                <Eye size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">View</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBooking(booking);
                                  setShowBookingModal(true);
                                }}
                                className="flex-1 p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
                                title="Edit Booking"
                              >
                                <Edit2 size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Edit</span>
                              </button>
                              <button
                                onClick={() => handleDeleteBooking(booking.id)}
                                className="flex-1 p-2.5 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                                title="Delete Booking"
                              >
                                <Trash2 size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Delete</span>
                              </button>
                            </>
                          ) : (
                            <>
                              {booking.status === 'pending' && (
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                                  className="w-10 h-10 border border-green-500/20 bg-green-500/5 rounded-xl text-green-400 hover:bg-green-500/10 transition-all flex items-center justify-center shrink-0"
                                  title="Confirm"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                              {booking.status === 'confirmed' && (
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'pending')}
                                  className="w-10 h-10 border border-white/20 bg-white/5 rounded-xl text-white hover:bg-white/10 transition-all flex items-center justify-center shrink-0"
                                  title="Unconfirm"
                                >
                                  <CircleX size={16} />
                                </button>
                              )}
                              {booking.status !== 'cancelled' && booking.status !== 'completed' && (
                                <div className="flex-1 relative min-w-0 h-10">
                                  <select
                                    onChange={(e) => updateBookingStatus(booking.id, 'assigned', e.target.value)}
                                    value={booking.driverId || ''}
                                    className="w-full h-full bg-white/5 border border-white/10 rounded-xl px-3 text-[10px] text-white/80 outline-none focus:border-gold transition-all appearance-none truncate font-bold tracking-widest pr-8"
                                  >
                                    <option value="" className="bg-black">Assign Driver</option>
                                    {drivers.map((driver) => {
                                      const stats = userDetailStats[driver.id] || { avgRating: 0, completedRides: 0 };
                                      return (
                                        <option key={driver.id} value={driver.id} className="bg-black">
                                          {driver.name} ({stats.avgRating?.toFixed(1)}★, {stats.completedRides}✓)
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                                </div>
                              )}
                              <button
                                onClick={() => {
                                  setViewingBooking(booking);
                                  setShowViewModal(true);
                                }}
                                className="w-10 h-10 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center shrink-0"
                                title="View"
                              >
                                <Eye size={16} />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBooking(booking);
                                  setShowBookingModal(true);
                                }}
                                className="w-10 h-10 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center shrink-0"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteBooking(booking.id)}
                                className="w-10 h-10 bg-red-500/5 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-500/10 transition-all flex items-center justify-center shrink-0"
                                title="Delete"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )
                        ) : !isDriver && booking.userId === user?.uid ? (
                          booking.status === 'completed' ? (
                            <button
                              onClick={() => {
                                setViewingBooking(booking);
                                setShowViewModal(true);
                              }}
                              className="flex-1 p-2.5 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                              title="View Details"
                            >
                              <Eye size={16} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">View Booking</span>
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setViewingBooking(booking);
                                  setShowViewModal(true);
                                }}
                                className="flex-1 p-2.5 bg-gold/5 border border-gold/20 rounded-xl text-gold hover:bg-gold/10 transition-all flex items-center justify-center gap-2"
                                title="View"
                              >
                                <Eye size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">View</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingBooking(booking);
                                  setShowBookingModal(true);
                                }}
                                className="flex-1 p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl text-blue-400 hover:bg-blue-500/10 transition-all flex items-center justify-center gap-2"
                                title="Edit"
                              >
                                <Edit2 size={16} />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Edit</span>
                              </button>
                              {booking.status !== 'cancelled' && (
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                  className="flex-1 p-2.5 bg-red-500/5 border border-red-500/20 rounded-xl text-red-500 hover:bg-red-500/10 transition-all flex items-center justify-center gap-2"
                                  title="Cancel Booking"
                                >
                                  <XCircle size={16} />
                                  <span className="text-[10px] font-bold uppercase tracking-widest">Cancel</span>
                                </button>
                              )}
                            </>
                          )
                        ) : null}

                        {isDriver && booking.driverId === user.uid && (
                          <div className="space-y-2 w-full">
                            {booking.status === 'assigned' && (
                              <div className="flex gap-2 w-full">
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'accepted')}
                                  className="flex-1 bg-green-500 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-green-600 transition-all"
                                >
                                  Accept Ride
                                </button>
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'rejected')}
                                  className="flex-1 bg-red-500 text-white py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-red-600 transition-all"
                                >
                                  Reject Ride
                                </button>
                              </div>
                            )}

                            {booking.status === 'accepted' && (
                              <div className="flex gap-2 w-full">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="glass rounded-[0.5rem] border border-white/5 overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-[1240px]">
                    <thead>
                      <tr className="bg-white/5 border-b border-white/10">
                        {isBookingsSelectionMode && (
                          <th className="px-4 py-4 w-10"></th>
                        )}
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Date & Time</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Customer</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Route (Pickup/Dropoff)</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Services</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Fare</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold">Driver / Status</th>
                        <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-gold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredAndSortedBookings.map((booking, idx) => (
                        <tr key={`booking-row-${booking.id}-${idx}`} className={cn("hover:bg-white/[0.02] transition-colors group", selectedBookings.includes(booking.id) ? "bg-gold/5" : "")}>
                          {isBookingsSelectionMode && booking.status !== 'completed' && booking.status !== 'cancelled' && (
                            <td className="px-4 py-5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (selectedBookings.includes(booking.id))
                                    setSelectedBookings((prev) => prev.filter((id) => id !== booking.id));
                                  else
                                    setSelectedBookings((prev) => [...prev, booking.id]);
                                }}
                                className={cn(
                                  "w-6 h-6 rounded flex items-center justify-center transition-all border",
                                  selectedBookings.includes(booking.id) ? "bg-gold text-black border-gold" : "bg-black/40 text-white/40 border-white/10 hover:border-white/30"
                                )}
                              >
                                {selectedBookings.includes(booking.id) && <Check size={14} />}
                              </button>
                            </td>
                          )}
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-white text-xs font-bold uppercase">{booking.date}</span>
                              <span className="text-white/40 text-[10px] uppercase tracking-widest">{formatTimeToAMPM(booking.time)}</span>
                              {booking.isReturn && (
                                <div className="mt-1 flex items-center gap-1 text-blue-400">
                                  <RotateCcw size={10} />
                                  <span className="text-[8px] uppercase tracking-widest font-bold">{booking.returnDate}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-white text-xs font-bold uppercase truncate max-w-[150px]">
                                {bookingCategory === 'tour'
                                  ? booking.tourTitle || 'Tour'
                                  : bookingCategory === 'offer'
                                    ? booking.packageTitle || 'Package'
                                    : (booking.customerName || 'Guest')}
                              </span>
                              <span className="text-white/40 text-[10px] truncate max-w-[150px]">{booking.customerEmail}</span>
                              <span className="text-white/40 text-[10px]">{booking.customerPhone}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="space-y-1.5 max-w-[200px]">
                              <div className="flex items-start gap-2">
                                <LocateFixed size={12} className="text-gold shrink-0 mt-0.5" />
                                <span className="text-xs text-white/70 line-clamp-1">{booking.pickup}</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <MapPin size={12} className="text-gold shrink-0 mt-0.5" />
                                <span className="text-xs text-white/40 line-clamp-1">{booking.dropoff || (booking.serviceType === 'hourly' ? 'Optional' : 'N/A')}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-wrap gap-2">
                              <span className="px-2 py-0.5 bg-gold/10 text-gold rounded text-[8px] font-bold uppercase tracking-widest border border-gold/20 whitespace-nowrap">
                                {booking.serviceType}
                              </span>
                              <span className="px-2 py-0.5 bg-white/5 text-white/60 rounded text-[8px] font-bold uppercase tracking-widest border border-white/10 whitespace-nowrap">
                                {booking.vehicleType || 'Sedan'}
                              </span>
                              {booking.type === 'offer' && (
                                <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-[8px] font-bold uppercase tracking-widest border border-purple-500/20 whitespace-nowrap transition-all group-hover:bg-purple-500 group-hover:text-white">
                                  OFFER RIDE
                                </span>
                              )}
                              {booking.type === 'tour' && (
                                <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[8px] font-bold uppercase tracking-widest border border-cyan-500/20 whitespace-nowrap transition-all group-hover:bg-cyan-500 group-hover:text-white">
                                  TOUR RIDE
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <span className="text-gold text-sm font-bold font-display">${booking.price}</span>
                              <span className={cn(
                                "text-[9px] uppercase tracking-widest font-bold",
                                booking.paymentStatus === 'paid' ? "text-green-400" : "text-white/40"
                              )}>{booking.paymentStatus}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <div className={cn(
                                  "w-2 h-2 rounded-full",
                                  booking.status === 'completed' ? "bg-green-500" :
                                    booking.status === 'confirmed' ? "bg-blue-400" :
                                      booking.status === 'cancelled' ? "bg-red-500" :
                                        !booking.driverId ? "bg-red-400 animate-pulse" : "bg-purple-500"
                                )} />
                                <div className="flex flex-col">
                                  <span className="text-xs text-white font-bold uppercase tracking-tighter">
                                    {booking.status}
                                  </span>
                                  <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest">
                                    {booking.driverId ? (allUsers.find(u => u.id === booking.driverId)?.name || 'Unknown Driver') : 'Unassigned'}
                                  </span>
                                </div>
                              </div>
                              {isAdmin && !['completed', 'cancelled'].includes(booking.status) && (
                                <div className="relative">
                                  <select
                                    value={booking.driverId || ''}
                                    onChange={(e) => updateBookingStatus(booking.id, 'assigned', e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg pl-2 pr-8 py-1.5 text-[10px] text-white/60 outline-none focus:border-gold transition-all appearance-none cursor-pointer hover:bg-white/5"
                                  >
                                    <option value="" className="bg-black">Assign Driver...</option>
                                    {drivers.map(driver => {
                                      const stats = userDetailStats[driver.id] || { completedRides: 0, avgRating: 0 };
                                      return (
                                        <option key={`opt-${booking.id}-${driver.id}`} value={driver.id} className="bg-black">
                                          {driver.name} ({stats.avgRating?.toFixed(1)}★)
                                        </option>
                                      );
                                    })}
                                  </select>
                                  <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => {
                                  setViewingBooking(booking);
                                  setShowViewModal(true);
                                }}
                                className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                                title="View Details"
                              >
                                <Eye size={14} />
                              </button>

                              {isAdmin ? (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingBooking(booking);
                                      setShowBookingModal(true);
                                    }}
                                    className="p-2 bg-white/5 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all shadow-lg shadow-blue-500/5"
                                    title="Edit"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBooking(booking.id)}
                                    className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-lg shadow-red-500/5"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              ) : isDriver && booking.driverId === user?.uid ? (
                                <div className="flex gap-1">
                                  {booking.status === 'assigned' && (
                                    <>
                                      <button onClick={() => updateBookingStatus(booking.id, 'accepted')} className="p-2 bg-green-500/10 text-green-500 rounded-lg h-9 w-9 flex items-center justify-center hover:bg-green-500 hover:text-white transition-all"><CheckCircle size={14} /></button>
                                      <button onClick={() => updateBookingStatus(booking.id, 'rejected')} className="p-2 bg-red-500/10 text-red-500 rounded-lg h-9 w-9 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all"><X size={14} /></button>
                                    </>
                                  )}
                                  {booking.status === 'accepted' && (
                                    <button onClick={() => updateBookingStatus(booking.id, 'completed')} className="px-3 py-1.5 h-9 bg-gold text-black rounded-lg text-[9px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all">Complete</button>
                                  )}
                                </div>
                              ) : !isDriver && booking.userId === user?.uid && booking.status !== 'cancelled' && booking.status !== 'completed' && (
                                <button
                                  onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                                  title="Cancel"
                                >
                                  <XCircle size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header with Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-2xl font-display text-gold">
                  {isAdmin ? 'Analytics Overview' : isDriver ? 'Driver Insights' : 'My Travel Analytics'}
                </h3>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">
                  {isAdmin ? 'Business performance & insights' : isDriver ? 'Your performance and earnings' : 'Your booking history and spending trends'}
                </p>
              </div>
            </div>

            {/* Header / Filter Row */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

              {/* Active Range (Left Side) */}
              <div className="flex items-center gap-2 bg-gold/10 pr-3 rounded-xs">
                <div className="w-1 h-9 bg-white/30 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]" />
                <div className="flex flex-col justify-center min-h-[32px]">
                  <p className="text-[8px] font-black uppercase tracking-[0.2em] text-gold/60 leading-none mb-1">
                    Active Range
                  </p>
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {analytics.rangeDescription}
                  </p>
                </div>
              </div>

              {/* Right Side: View Mode + Filters */}
              <div className="flex flex-col sm:flex-row gap-4 item-center">

                {/* View Mode Buttons */}
                <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
                  {[
                    { id: 'charts', label: 'Visual', icon: BarChart3 },
                    { id: 'numerical', label: 'Data', icon: LayoutGrid },
                  ].map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setAnalyticsViewMode(v.id as any)}
                      className={cn(
                        "flex items-center gap-2 h-7 px-4 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                        analyticsViewMode === v.id
                          ? "bg-gold text-black shadow-lg shadow-gold/20"
                          : "text-white/40 hover:text-white"
                      )}
                    >
                      <v.icon size={12} />
                      <span className="hidden sm:inline">{v.label}</span>
                    </button>
                  ))}
                </div>

                {/* Time Filters */}
                {analyticsViewMode !== 'numerical' && (
                  <div className="flex items-center gap-1 bg-black/20 p-1 rounded-lg border border-white/10">
                    {[
                      { id: 'all', label: 'All' },
                      { id: '7d', label: '7D' },
                      { id: '30d', label: '30D' },
                      { id: 'month', label: 'Monthly' },
                      { id: 'year', label: 'Yearly' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setAnalyticsTimeFilter(f.id as any)}
                        className={cn(
                          "h-7 px-3 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all",
                          analyticsTimeFilter === f.id
                            ? "bg-gold text-black shadow-md shadow-gold/10"
                            : "text-white/30 hover:text-white"
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Range Selectors */}
                {analyticsViewMode !== 'numerical' &&
                  (analyticsTimeFilter === 'month' || analyticsTimeFilter === 'year') && (
                    <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/10">
                      <select
                        value={analyticsTimeFilter === 'month' ? monthRange.start : yearRange.start}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (analyticsTimeFilter === 'month') setMonthRange(prev => ({ ...prev, start: val }));
                          else setYearRange(prev => ({ ...prev, start: val }));
                        }}
                        className="h-7 custom-select bg-transparent border-none text-[10px] pr-10 text-white"
                      >
                        {analyticsTimeFilter === 'month'
                          ? Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i} className="bg-black text-white">
                              {format(new Date(2024, i, 1), 'MMM')}
                            </option>
                          ))
                          : Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() - 9 + i;
                            return (
                              <option key={year} value={year} className="bg-black text-white">
                                {year}
                              </option>
                            );
                          })}
                      </select>
                      <span className="text-white/20 text-[10px]">—</span>
                      <select
                        value={analyticsTimeFilter === 'month' ? monthRange.end : yearRange.end}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (analyticsTimeFilter === 'month') {
                            setMonthRange(prev => ({ ...prev, end: val }));
                          } else {
                            setYearRange(prev => ({ ...prev, end: val }));
                          }
                        }}
                        className="h-7 custom-select bg-transparent border-none text-[10px] pr-10 text-white"
                      >
                        {analyticsTimeFilter === 'month'
                          ? Array.from({ length: 12 }, (_, i) => (
                            <option key={i} value={i} className="bg-black text-white">
                              {format(new Date(2024, i, 1), 'MMM')}
                            </option>
                          ))
                          : Array.from({ length: 10 }, (_, i) => {
                            const year = new Date().getFullYear() - 9 + i;
                            return (
                              <option key={year} value={year} className="bg-black text-white">
                                {year}
                              </option>
                            );
                          })}
                      </select>
                    </div>
                  )}
              </div>
            </div>

            {/* Main Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  label: isAdmin ? 'Total Revenue' : isDriver ? 'My Earnings' : 'Total Spending',
                  value: `$${Math.round(analytics.totalRevenue)}`,
                  icon: isAdmin ? DollarSign : PiggyBank,
                  color: 'text-gold'
                },
                {
                  label: isAdmin ? 'Completed' : isDriver ? 'Finished Jobs' : 'Completed Rides',
                  value: analytics.completedBookings,
                  icon: CheckCircle,
                  color: 'text-green-500'
                },
                {
                  label: isAdmin ? 'Active' : isDriver ? 'Active Jobs' : 'Active Rides',
                  value: analytics.confirmedBookings + analytics.assignedBookings + analytics.acceptedBookings,
                  icon: Clock,
                  color: 'text-blue-400'
                },
                {
                  label: 'Cancelled',
                  value: analytics.cancelledBookings,
                  icon: XCircle,
                  color: 'text-red-400'
                },
              ].map((stat, i) => (
                <div key={`stat-${i}`} className="glass p-4 rounded-xl border border-white/5 relative overflow-hidden group">
                  <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-30 transition-opacity">
                    <stat.icon size={20} className={stat.color} />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 mb-1">{stat.label}</p>
                    <h3 className={cn("text-2xl font-display", stat.color)}>{stat.value}</h3>
                  </div>
                </div>
              ))}
            </div>

            {analyticsViewMode === 'charts' ? (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  {dashboardCharts
                    .filter(chart => isAdmin || chart.id !== 'role-distribution')
                    .map((chart) => (
                      <div
                        key={chart.id}
                        className={cn(
                          "glass p-8 rounded-3xl border border-white/5 relative group transition-all duration-500",
                          chart.width === 'small' ? "lg:col-span-4" :
                            chart.width === 'medium' ? "lg:col-span-6" :
                              chart.width === 'large' ? "lg:col-span-8" : "lg:col-span-12"
                        )}
                      >
                        <div className="flex justify-between items-center mb-6">
                          <div>
                            <h4 className="text-sm font-bold text-gold uppercase tracking-widest">{chart.title}</h4>
                            <p className="text-[10px] text-white/40 mt-1 uppercase tracking-tighter italic">Based on filtered data</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setDashboardCharts(prev => prev.map(c => {
                                  if (c.id === chart.id) {
                                    const widths = ['small', 'medium', 'large', 'full'];
                                    const currentIndex = widths.indexOf(c.width || 'large');
                                    const nextIndex = (currentIndex + 1) % widths.length;
                                    return { ...c, width: widths[nextIndex] };
                                  }
                                  return c;
                                }));
                              }}
                              className="p-2 text-white/40 hover:text-gold transition-all"
                              title="Change Size"
                            >
                              <Scaling size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="h-60 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            {chart.type === 'area' ? (
                              <AreaChart data={analytics.revenueData}>
                                <defs>
                                  <linearGradient id={`color-${chart.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={chart.color || '#D4AF37'} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={chart.color || '#D4AF37'} stopOpacity={0} />
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Area type="monotone" dataKey={chart.dataKey} stroke={chart.color || '#D4AF37'} fillOpacity={1} fill={`url(#color-${chart.id})`} strokeWidth={2} />
                              </AreaChart>
                            ) : chart.type === 'bar' ? (
                              <BarChart data={analytics.revenueData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Bar dataKey={chart.dataKey} fill={chart.color || '#D4AF37'} radius={[4, 4, 0, 0]}>
                                  <LabelList dataKey={chart.dataKey} position="insideTop" fill="#000" fontSize={10} formatter={(val: number) => typeof val === 'number' ? `${val.toLocaleString()}` : val} />
                                </Bar>
                              </BarChart>
                            ) : chart.type === 'line' ? (
                              <LineChart data={analytics.revenueData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                <XAxis dataKey="name" stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                <YAxis stroke="#ffffff20" fontSize={10} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Line type="monotone" dataKey={chart.dataKey} stroke={chart.color || '#D4AF37'} strokeWidth={3} dot={{ r: 4, fill: '#0a0a0a', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                              </LineChart>
                            ) : chart.type === 'pie' ? (
                              <PieChart>
                                <Pie
                                  data={chart.dataSource === 'roleData' ? analytics.roleData : analytics.statusData}
                                  cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none"
                                >
                                  {(chart.dataSource === 'roleData' ? analytics.roleData : analytics.statusData).map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10', borderRadius: '12px' }} />
                                <Legend
                                  verticalAlign="bottom"
                                  height={36}
                                  iconType="circle"
                                  iconSize={9}
                                  wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                                  formatter={(value, entry: any) => (
                                    <span className="text-white/70 ml-1">
                                      {value}: <span className="text-gold font-bold ml-1">{entry.payload.value}</span>
                                    </span>
                                  )}
                                />
                              </PieChart>
                            ) : chart.type === 'stacked-bar' ? (
                              <BarChart data={analytics.serviceDistribution} layout="vertical">
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" stroke="#ffffff40" fontSize={10} width={80} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff10' }}
                                  formatter={(value: any, name: string) => [value, name.charAt(0).toUpperCase() + name.slice(1)]}
                                />
                                <Legend verticalAlign="top" height={36} iconType="circle" iconSize={9} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                                <Bar dataKey="completed" stackId="a" fill="#4ADE80" name="Completed" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="other" stackId="a" fill="#60A5FA" name="Active / Other" radius={[0, 0, 0, 0]} />
                                <Bar dataKey="cancelled" stackId="a" fill="#F87171" name="Cancelled" radius={[0, 4, 4, 0]} />
                              </BarChart>
                            ) : null}
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              /* Numerical Mode */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {isAdmin ? (
                  <>
                    <div className="glass p-8 rounded-3xl border border-white/5">
                      <h4 className="text-lg font-display text-gold mb-6">Top Drivers</h4>
                      <div className="space-y-4">
                        {analytics.topDrivers.map((d, i) => (
                          <div key={`top-driver-${i}`} className="flex justify-between p-4 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/70">{d.name}</span>
                            <span className="text-xs font-bold text-gold">${Math.round(d.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="glass p-8 rounded-3xl border border-white/5">
                      <h4 className="text-lg font-display text-gold mb-6">Top Customers</h4>
                      <div className="space-y-4">
                        {analytics.topCustomers.map((c, i) => (
                          <div key={`top-customer-${i}`} className="flex justify-between p-4 bg-white/5 rounded-xl">
                            <span className="text-xs text-white/70">{c.name}</span>
                            <span className="text-xs font-bold text-gold">${Math.round(c.revenue)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="glass p-8 rounded-3xl border border-white/5 lg:col-span-2">
                    <h4 className="text-lg font-display text-gold mb-6">Recent Activity Analysis</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="text-white/20 uppercase tracking-widest border-b border-white/5">
                            <th className="pb-4">Date</th>
                            <th className="pb-4">Route</th>
                            <th className="pb-4">Status</th>
                            <th className="pb-4 text-right">Fare</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {bookings.map(b => (
                            <tr key={b.id}>
                              <td className="py-4 text-white/60">{b.date}</td>
                              <td className="py-4 text-white/60">{b.pickup} → {b.dropoff}</td>
                              <td className="py-4">
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                                  b.status === 'completed' ? "bg-green-500/10 text-green-500" :
                                    b.status === 'cancelled' ? "bg-red-500/10 text-red-500" :
                                      b.status === 'pending' ? "bg-gold/10 text-gold" : "bg-blue-500/10 text-blue-500"
                                )}>{b.status}</span>
                              </td>
                              <td className="py-4 text-right text-gold font-bold">${b.price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case 'calendar':
        return (
          <div className="space-y-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 w-full">
              {/* Row 1: Title & Toggle */}
              <div className="flex flex-row items-center justify-between w-full">
                <h3 className="text-2xl font-display text-gold">Booking Calendar</h3>

                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                  <button
                    onClick={() => setCalendarDateType('pickup')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      calendarDateType === 'pickup'
                        ? "bg-gold text-black shadow-lg"
                        : "text-white/40 hover:text-white"
                    )}
                  >
                    Pickup Date
                  </button>
                  <button
                    onClick={() => setCalendarDateType('booking')}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all",
                      calendarDateType === 'booking'
                        ? "bg-gold text-black shadow-lg"
                        : "text-white/40 hover:text-white"
                    )}
                  >
                    Booking Date
                  </button>
                </div>
              </div>
            </div>

            <div className="glass p-4 sm:p-8 rounded-3xl border border-white/5">
              {/* Month Navigation now inside */}
              <div className="flex items-center justify-between gap-4 mb-6 bg-white/5 p-1.5 rounded-xl">
                {/* Left chevron */}
                <button
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  className="p-2 hover:bg-gold hover:text-black rounded-xl transition-all"
                >
                  <ChevronLeft size={20} />
                </button>

                {/* Month label */}
                <span className="text-xs font-bold uppercase tracking-[0.2em] min-w-[140px] text-center text-white/80">
                  {format(currentMonth, 'MMMM yyyy')}
                </span>

                {/* Right chevron */}
                <button
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  className="p-2 hover:bg-gold hover:text-black rounded-xl transition-all"
                >
                  <ChevronRight size={20} />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-2 sm:gap-4 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-[10px] font-bold uppercase tracking-widest text-white/20">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2 sm:gap-4">
                {calendarDays.map((day) => {
                  const dayStr = day.toISOString();
                  const dayBookings = getBookingsForDate(day);

                  // Group bookings by status
                  const statusGroups = dayBookings.reduce((acc: Record<string, number>, b) => {
                    const status = b.status || 'pending';
                    acc[status] = (acc[status] || 0) + 1;
                    return acc;
                  }, {});

                  const getStatusColor = (status: string) => {
                    switch (status.toLowerCase()) {
                      case 'pending': return 'bg-[#D4AF37]';
                      case 'confirmed': return 'bg-[#60A5FA]';
                      case 'assigned': return 'bg-[#C084FC]';
                      case 'accepted': return 'bg-[#22D3EE]';
                      case 'completed': return 'bg-[#4ADE80]';
                      case 'cancelled': return 'bg-[#F87171]';
                      default: return 'bg-white/40';
                    }
                  };

                  return (
                    <div
                      key={dayStr}
                      onClick={() => {
                        setSelectedDate(day);
                        if (dayBookings.length > 0) setShowDayBookings(true);
                      }}
                      className={cn(
                        "aspect-square rounded-xl sm:rounded-2xl border p-1 sm:p-3 transition-all cursor-pointer relative group",
                        !isSameMonth(day, currentMonth) ? "opacity-10 border-transparent pointer-events-none" :
                          isToday(day) ? "border-gold bg-gold/5" : "border-white/5 hover:border-white/20 shadow-xl",
                        dayBookings.length > 0 && "bg-white/5"
                      )}
                    >
                      {/* Date number pinned at top */}
                      <span
                        className={cn(
                          "absolute top-1 left-1 sm:top-2 sm:left-2 text-[10px] sm:text-xs font-bold font-mono",
                          isToday(day) ? "text-gold" : "text-white/40"
                        )}
                      >
                        {format(day, "d")}
                      </span>



                      {dayBookings.length > 0 && (
                        <div className="absolute bottom-1 sm:bottom-2 left-1 sm:left-3 right-1 sm:right-3">
                          {/* Dot Matrix for bookings */}
                          <div className="flex flex-wrap gap-0.5 sm:gap-1 max-w-full">
                            {Object.entries(statusGroups).map(([status, countValue]) => {
                              const count = countValue as number;
                              return (
                                <div
                                  key={status}
                                  className={cn(
                                    "w-1 h-1 sm:w-2 sm:h-2 rounded-full relative group/dot",
                                    getStatusColor(status)
                                  )}
                                >
                                  <div className="invisible group-hover/dot:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1 bg-black text-white text-[8px] px-1 py-0.5 rounded whitespace-nowrap z-10">
                                    {status}: {count}
                                  </div>
                                  {count > 1 && (
                                    <span className="absolute -top-1 -right-1 text-[6px] font-bold text-white leading-none scale-75 lg:scale-100">
                                      {count}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Total Count - Desktop Only */}
                          <div className="hidden lg:block mt-1 pt-1 border-t border-white/5">
                            <p className="text-[7px] font-bold uppercase tracking-tight text-white/30 truncate">
                              {dayBookings.length} {dayBookings.length === 1 ? 'Ride' : 'Rides'}
                            </p>
                          </div>
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
        const filteredUsers = allUsers.filter(u => {
          const matchesSearch = (
            u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.role?.toLowerCase().includes(searchQuery.toLowerCase())
          );
          const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
          return matchesSearch && matchesRole;
        });
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

            {/* Role Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-white/5 p-1 bg-white/5 rounded-lg w-fit overflow-x-auto no-scrollbar">
              {[
                { id: 'all', label: 'All Users', icon: Users, count: allUsers.length },
                { id: 'admin', label: 'Admins', icon: Shield, count: allUsers.filter(u => u.role === 'admin').length },
                { id: 'driver', label: 'Drivers', icon: Car, count: allUsers.filter(u => u.role === 'driver').length },
                { id: 'customer', label: 'Customers', icon: User, count: allUsers.filter(u => u.role === 'customer' || !u.role || u.role === 'user').length },
              ].map((roleTab) => (
                <button
                  key={`user-role-tab-${roleTab.id}`}
                  onClick={() => setUserRoleFilter(roleTab.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 md:px-4 md:py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap",
                    userRoleFilter === roleTab.id
                      ? "bg-gold text-black shadow-lg shadow-gold/20"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                  title={`${roleTab.label} (${roleTab.count})`}
                >
                  <roleTab.icon size={14} />
                  <span className="hidden md:inline-flex items-center">
                    {roleTab.label}
                    <span className={cn(
                      "ml-1.5 opacity-60 font-mono",
                      userRoleFilter === roleTab.id ? "text-black" : "text-gold"
                    )}>
                      ({roleTab.count})
                    </span>
                  </span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredUsers.map((u) => (
                <div key={u.id} className="glass p-6 rounded-2xl border border-white/5 hover:border-gold/30 transition-all group flex flex-col h-full">
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
                        <h4 className="text-[14px] font-bold font-display text-white group-hover:text-gold transition-colors flex items-center justify-between gap-2 w-full min-w-0">
                          <span className="truncate leading-tight">
                            {u.name || "No Name"}
                          </span>

                          {u.role === "driver" && (
                            <span className="flex items-center gap-1 text-gold text-[11px] font-bold shrink-0 leading-none">
                              <Star size={12} className="fill-gold text-gold" />
                              {userDetailStats[u.id]?.avgRating?.toFixed(1) || "0.0"}
                            </span>
                          )}
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
                  {/* User Activity Stats container with fixed min height for consistency */}
                  <div className="pt-4 border-t border-white/5 pb-4 flex-1 flex flex-col justify-center min-h-[160px]">
                    {u.role === 'admin' ? (
                      <div className="space-y-4 h-full flex flex-col">
                        <div className="flex justify-between items-center">
                          <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold">System Overview</p>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[7px] text-blue-500/80 font-bold uppercase tracking-widest">Master Feed</span>
                          </div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex-1 flex items-center">
                          <div className="grid grid-cols-4 gap-1 w-full text-center">
                            <div className="flex flex-col items-center justify-center">
                              <DollarSign size={14} className="text-green-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(userDetailStats[u.id]?.totalRevenue || 0).toLocaleString()}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Revenue</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <XCircle size={14} className="text-red-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(userDetailStats[u.id]?.lostRevenue || 0).toLocaleString()}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Lost</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <CalendarCog size={14} className="text-purple-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats[u.id]?.unassignedCount || 0}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Pending</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <Users size={14} className="text-blue-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats[u.id]?.totalSystemUsers || 0}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Users</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : u.role === 'driver' ? (
                      <div className="flex flex-col justify-center h-full">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold">
                            Operational Health
                          </p>

                          {userDetailStats[u.id]?.feedbacks?.length > 0 && (
                            <div className="relative group/feedback">
                              <button className="text-gold hover:text-white transition-colors p-1 -m-1">
                                <MessageSquare size={12} />
                              </button>

                              {/* Feedback Popup Content */}
                              <div className="invisible opacity-0 group-hover/feedback:visible group-hover/feedback:opacity-100 absolute right-0 bottom-full mb-3 w-64 bg-black/95 backdrop-blur-2xl border border-white/10 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] transition-all duration-300 transform translate-y-2 group-hover/feedback:translate-y-0">
                                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
                                  <p className="text-[10px] font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                                    <MessageSquare size={12} />
                                    Client Feedback
                                  </p>
                                  <span className="text-[10px] text-white/40 font-mono bg-white/5 px-1.5 py-0.5 rounded">
                                    {userDetailStats[u.id]?.feedbacks?.length}
                                  </span>
                                </div>
                                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                  {userDetailStats[u.id]?.feedbacks?.map((f: any, i: number) => (
                                    <div
                                      key={i}
                                      className="group/item relative bg-white/5 p-2.5 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                                    >
                                      <div className="flex justify-between items-start mb-1">
                                        <div className="min-w-0 flex-1">
                                          <span className="text-[10px] font-bold text-white block truncate">
                                            {f.customerName}
                                          </span>
                                          <div className="flex gap-0.5 mt-0.5">
                                            {[...Array(5)].map((_, j) => (
                                              <Star
                                                key={j}
                                                size={8}
                                                className={j < (f.rating || 0) ? "text-gold fill-gold" : "text-white/10"}
                                              />
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                      <p className="text-[10px] text-white/70 italic leading-relaxed line-clamp-3">
                                        {f.comment?.trim() ? `"${f.comment}"` : "No comment provided"}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                                {/* Pointer arrow */}
                                <div className="absolute right-2 top-full w-3 h-3 bg-black/95 border-r border-b border-white/10 transform rotate-45 -translate-y-1.5"></div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-white/5 p-2 rounded-2xl border border-white/5 flex-1 flex items-center">
                          <div className="grid grid-cols-5 gap-1 w-full text-center">
                            <div className="flex flex-col items-center justify-center">
                              <CheckCircle size={14} className="text-green-400 mb-1.5" />
                              <span className="text-[11px] text-white font-bold leading-none mb-1">{userDetailStats[u.id]?.completedRides || 0}</span>
                              <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Done</span>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <Star size={14} className="text-gold mb-1.5" />
                              <span className="text-[11px] text-white font-bold leading-none mb-1">{userDetailStats[u.id]?.ratingCount || 0}</span>
                              <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Rating</span>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <AlertCircle size={14} className="text-orange-400 mb-1.5" />
                              <span className="text-[11px] text-white font-bold leading-none mb-1">{userDetailStats[u.id]?.unreviewedCount || 0}</span>
                              <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Wait</span>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <Award size={14} className="text-cyan-400 mb-1.5" />
                              <span className="text-[11px] text-cyan-400 font-bold leading-none mb-1">{userDetailStats[u.id]?.totalRatingValue || 0}</span>
                              <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Score</span>
                            </div>
                            <div className="flex flex-col items-center justify-center border-l border-white/10 pl-1">
                              <PiggyBank size={14} className="text-lime-400 mb-1.5" />
                              <span className="text-[11px] text-lime-400 font-bold leading-none mb-1">${Math.round(userDetailStats[u.id]?.totalEarnings || 0).toLocaleString()}</span>
                              <span className="text-[7px] text-white/40 uppercase font-black tracking-tight">Rev</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4 h-full flex flex-col">
                        <div className="flex justify-between items-center">
                          <p className="text-[8px] uppercase tracking-widest text-white/30 font-extrabold">Engagement History</p>
                          <span className="text-[9px] bg-gold/10 text-gold px-2 py-0.5 rounded-lg border border-gold/20 font-bold uppercase tracking-widest">
                            Fav: {userDetailStats[u.id]?.favoriteService}
                          </span>
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl border border-white/5 flex-1 flex items-center">
                          <div className="grid grid-cols-5 gap-1.5 w-full text-center">
                            <div className="flex flex-col items-center justify-center">
                              <Activity size={14} className="text-blue-400 mb-1.5" />
                              <div className="flex items-end justify-center gap-0.5 leading-none mb-1">
                                <span className="text-[11px] font-bold text-white">{userDetailStats[u.id]?.completedRides || 0}</span>
                                <span className="text-[7px] text-white/40 font-bold">/{userDetailStats[u.id]?.totalBookings || 0}</span>
                              </div>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Activity</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <DollarSign size={14} className="text-green-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">${Math.round(userDetailStats[u.id]?.totalSpend || 0).toLocaleString()}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Spend</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <XCircle size={14} className="text-red-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats[u.id]?.cancelledRides || 0}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Cancel</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <MessageSquare size={14} className="text-cyan-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats[u.id]?.reviewedCount || 0}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Reviews</p>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                              <Clock size={14} className="text-orange-400 mb-1.5" />
                              <p className="text-[11px] font-bold text-white leading-none mb-1">{userDetailStats[u.id]?.unreviewedCount || 0}</p>
                              <p className="text-[7px] text-white/40 uppercase font-black tracking-tighter">Pending</p>
                            </div>
                          </div>
                        </div>
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
            <div className="flex w-full justify-between items-center border-b border-white/5 p-1 bg-white/5 rounded-lg mb-6 overflow-x-auto scrollbar-hide">
              {[
                { id: 'seo', label: 'SEO', icon: Globe },
                { id: 'config', label: 'Config', icon: Cog },
                { id: 'offers-tours', label: 'Offers & Tours', icon: Tag },
                { id: 'floating', label: 'Floating Elements', icon: Blocks },
                { id: 'media', label: 'Media', icon: Upload }
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubTab(sub.id)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all",
                    activeSubTab === sub.id
                      ? "bg-gold text-black shadow-lg shadow-gold/20"
                      : "text-white/40 hover:text-white hover:bg-white/5"
                  )}
                  title={sub.label}
                >
                  <sub.icon size={14} />
                  <span className="hidden lg:inline text-xs font-bold uppercase tracking-widest whitespace-nowrap">
                    {sub.label}
                  </span>
                </button>
              ))}
            </div>


            {activeSubTab === 'floating' && !floatingSettings && (
              <div className="flex flex-col items-center justify-center p-20 glass rounded-3xl border border-white/5">
                <Loader2 size={40} className="text-gold animate-spin mb-4" />
                <p className="text-white/40 uppercase tracking-widest text-[10px] font-bold">Loading Floating Settings...</p>
              </div>
            )}

            {activeSubTab === 'floating' && floatingSettings && (
              <div className="space-y-12 animate-in fade-in duration-700">
                {/* Section Header */}
                <div className="flex flex-row justify-between items-center gap-6 mb-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="text-2xl font-display text-gold tracking-tight">Floating Elements</h3>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest">
                        Global Floating Element Controls
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleUpdateFloatingSettings(floatingSettings)}
                    disabled={isSavingFloatingSettings}
                    className="btn-primary flex items-center justify-center gap-2 sm:gap-3 h-10 px-3 sm:px-6 py-2 sm:py-3 group"
                  >
                    {isSavingFloatingSettings ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    {/* Hide text on mobile, show on sm+ */}
                    <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">
                      Save All
                    </span>
                  </button>
                </div>

                {/* Social Icons Section */}
                <div className="glass p-6 sm:p-8 rounded-2xl border border-white/5 space-y-4">
                  <div>
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6 border-b border-white/5 pb-3">
                      <div>
                        <h4 className="text-lg sm:text-xl font-display text-white">
                          Floating Social Icons
                        </h4>
                        <p className="text-xs sm:text-sm text-white/40">
                          Manage your floating contact & social media shortcuts
                        </p>
                      </div>

                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={floatingSettings?.social?.active}
                          onChange={() =>
                            setFloatingSettings((prev: any) => ({
                              ...prev,
                              social: { ...(prev?.social || {}), active: !prev?.social?.active },
                            }))
                          }
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-white/20 rounded-full peer-checked:bg-gold relative transition-colors">
                          <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5/6" />
                        </div>
                        <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-white/40 peer-checked:text-gold">
                          {floatingSettings?.social?.active ? "Active" : "Disabled"}
                        </span>
                      </label>
                    </div>

                    {/* MAIN GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                      {/* ================= LEFT COLUMN ================= */}
                      <div className="space-y-6">

                        {/* Heading */}
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                            Layout & Placement
                          </span>
                        </div>

                        {/* Offset Controls */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 bg-white/[0.02] rounded-2xl border border-white/5">

                          {/* Horizontal Offset */}
                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">
                              Horizontal Offset
                            </label>

                            <div className="px-3 py-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-gold/60">X-AXIS</span>
                                <span className="text-xs font-mono text-gold">
                                  {floatingSettings?.social?.offsetX || 24}px
                                </span>
                              </div>

                              <input
                                type="range"
                                min="0"
                                max="200"
                                step="4"
                                value={floatingSettings?.social?.offsetX || 24}
                                onChange={(e) =>
                                  setFloatingSettings((prev: any) => ({
                                    ...prev,
                                    social: {
                                      ...(prev?.social || {}),
                                      offsetX: Number(e.target.value),
                                    },
                                  }))
                                }
                                className="w-full accent-gold h-1"
                                style={{ '--value': `${(((floatingSettings?.social?.offsetX || 24) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties}
                              />
                            </div>
                          </div>

                          {/* Vertical Offset */}
                          <div className="space-y-4">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">
                              Vertical Offset
                            </label>

                            <div className="px-3 py-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-mono text-gold/60">Y-AXIS</span>
                                <span className="text-xs font-mono text-gold">
                                  {floatingSettings?.social?.offsetY || 40}px
                                </span>
                              </div>

                              <input
                                type="range"
                                min="0"
                                max="200"
                                step="4"
                                value={floatingSettings?.social?.offsetY || 40}
                                onChange={(e) =>
                                  setFloatingSettings((prev: any) => ({
                                    ...prev,
                                    social: {
                                      ...(prev?.social || {}),
                                      offsetY: Number(e.target.value),
                                    },
                                  }))
                                }
                                className="w-full accent-gold h-1"
                                style={{ '--value': `${(((floatingSettings?.social?.offsetY || 40) - 0) / (200 - 0)) * 100}%` } as React.CSSProperties}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Screen Position Dropdown */}
                        <div className="space-y-4">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 block">
                            Screen Position
                          </label>

                          <select
                            value={floatingSettings?.social?.position || "right-bottom"}
                            onChange={(e) =>
                              setFloatingSettings((prev: any) => ({
                                ...prev,
                                social: {
                                  ...(prev?.social || {}),
                                  position: e.target.value,
                                },
                              }))
                            }
                            className="custom-select w-full"
                          >
                            <option value="right-bottom">Bottom Right</option>
                            <option value="left-bottom">Bottom Left</option>
                            <option value="right-center">Center Right</option>
                            <option value="left-center">Center Left</option>
                          </select>
                        </div>
                      </div>

                      {/* ================= RIGHT COLUMN ================= */}
                      <div className="space-y-6">

                        {/* Heading */}
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">
                            Visibility & Auto Close Rules
                          </span>
                        </div>

                        {/* Auto Close Timing */}
                        <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                            <EyeOff size={12} />
                            Auto Close Timing
                          </label>

                          <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                              <span className="text-[9px] text-white/30 uppercase font-bold tracking-widest">
                                Close after (seconds)
                              </span>
                              <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-0.5 rounded-lg">
                                {floatingSettings?.social?.autoCloseTime || 0}s
                              </span>
                            </div>

                            <input
                              type="range"
                              min="0"
                              max="60"
                              step="1"
                              value={floatingSettings?.social?.autoCloseTime || 0}
                              onChange={(e) =>
                                setFloatingSettings((prev: any) => ({
                                  ...prev,
                                  social: {
                                    ...(prev?.social || {}),
                                    autoCloseTime: Number(e.target.value),
                                  },
                                }))
                              }
                              className="w-full accent-gold h-1.5"
                              style={{ '--value': `${(((floatingSettings?.social?.autoCloseTime || 0) - 0) / (60 - 0)) * 100}%` } as React.CSSProperties}
                            />
                          </div>
                        </div>

                        {/* Page Visibility */}
                        <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                            <Eye size={12} />
                            Page Visibility Rules
                          </label>

                          <select
                            value={floatingSettings?.social?.displayCondition || "all"}
                            onChange={(e) =>
                              setFloatingSettings((prev: any) => ({
                                ...prev,
                                social: {
                                  ...(prev?.social || {}),
                                  displayCondition: e.target.value,
                                },
                              }))
                            }
                            className="custom-select w-full"
                          >
                            <option value="all">Show Everywhere</option>
                            <option value="landing">Home Page Only</option>
                            <option value="specific">Specific Pages Only</option>
                            <option value="except">Except Specific Pages</option>
                          </select>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Detailed Icon Editor */}
                  <div className="pt-8 border-t border-white/5">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">Configuration Details</span>
                      </div>
                      <button
                        onClick={() => {
                          const newIcon = {
                            id: `custom-${Date.now()}`,
                            type: 'whatsapp',
                            label: 'Whatsapp',
                            url: '',
                            active: true,
                            color: '#D4AF37',
                            iconColor: '#ffffff',
                            bgType: 'solid',
                            bgColor: '#D4AF37',
                            bgGradient: 'linear-gradient(45deg, #D4AF37, #F1D483)',
                            padding: 12,
                            iconSize: 20,
                          };
                          setFloatingSettings((prev: any) => ({
                            ...prev,
                            social: {
                              ...prev.social,
                              icons: [...(prev.social.icons || []), newIcon],
                            },
                          }));
                        }}
                        className="flex items-center justify-center gap-2 sm:gap-3 h-10 px-3 sm:px-4 py-2 bg-gold text-black      rounded-lg text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105"
                      >
                        <Plus size={16} />
                        {/* Hide text on mobile, show on sm+ */}
                        <span className="hidden sm:inline">Add New</span>
                      </button>
                    </div>

                    {(floatingSettings?.social?.icons || []).length === 0 ? (
                      <div className="flex flex-col items-center justify-center text-center p-8 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-white/20 mb-4">
                          <Plus size={24} />
                        </div>
                        <p className="text-xs text-white/40">No icons added yet</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {(floatingSettings?.social?.icons || []).map((icon: any, idx: number) => (
                          <div key={`edit-${icon.id || idx}`} className="bg-black/40 border border-white/10 p-5 rounded-2xl flex flex-col gap-5 relative overflow-hidden group/editor">
                            {/* Header Section */}
                            <div className="flex items-center justify-between border-b border-white/5 pb-4 relative z-10">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
                                  {icon.type === 'whatsapp' ? <MessageCircle size={16} /> :
                                    icon.type === 'facebook' ? <Facebook size={16} /> :
                                      icon.type === 'instagram' ? <Instagram size={16} /> :
                                        icon.type === 'linkedin' ? <Linkedin size={16} /> :
                                          icon.type === 'email' ? <Mail size={16} /> :
                                            icon.type === 'phone' ? <Phone size={16} /> :
                                              icon.type === 'twitter' ? <Twitter size={16} /> :
                                                icon.type === 'youtube' ? <Youtube size={16} /> :
                                                  <Globe size={16} />}
                                </div>

                                {/* Hide on mobile, show from md breakpoint upwards */}
                                <input
                                  type="text"
                                  value={icon.label}
                                  onChange={(e) => {
                                    setFloatingSettings((prev: any) => {
                                      const newIcons = [...prev.social.icons];
                                      newIcons[idx].label = e.target.value;
                                      return { ...prev, social: { ...prev.social, icons: newIcons } };
                                    });
                                  }}
                                  className="hidden md:block bg-transparent border-none text-sm font-display text-white outline-none focus:ring-0 border-b border-transparent focus:border-gold/30 transition-all px-0 w-32"
                                  placeholder="Icon Label"
                                />
                              </div>
                              <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 border border-white/10">
                                <button
                                  onClick={() => {
                                    if (idx > 0) {
                                      setFloatingSettings((prev: any) => {
                                        const newIcons = [...prev.social.icons];
                                        [newIcons[idx], newIcons[idx - 1]] = [newIcons[idx - 1], newIcons[idx]];
                                        return { ...prev, social: { ...prev.social, icons: newIcons } };
                                      });
                                    }
                                  }}
                                  disabled={idx === 0}
                                  className="p-1.5 hover:bg-white/10 text-white/40 hover:text-white rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                                  title="Move Up"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    if (idx < (floatingSettings?.social?.icons?.length || 0) - 1) {
                                      setFloatingSettings((prev: any) => {
                                        const newIcons = [...prev.social.icons];
                                        [newIcons[idx], newIcons[idx + 1]] = [newIcons[idx + 1], newIcons[idx]];
                                        return { ...prev, social: { ...prev.social, icons: newIcons } };
                                      });
                                    }
                                  }}
                                  disabled={idx === (floatingSettings?.social?.icons?.length || 0) - 1}
                                  className="p-1.5 hover:bg-white/10 text-white/40 hover:text-white rounded disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                                  title="Move Down"
                                >
                                  <ArrowDown size={12} />
                                </button>
                                <div className="w-px h-4 bg-white/10 mx-1" />
                                <button
                                  onClick={() => {
                                    setFloatingSettings((prev: any) => ({
                                      ...prev,
                                      social: {
                                        ...prev.social,
                                        icons: prev.social.icons.filter((_: any, i: number) => i !== idx)
                                      }
                                    }));
                                  }}
                                  className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded transition-all"
                                  title="Remove Icon"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Settings Grid */}
                            <div className="grid grid-cols-2 gap-x-4 gap-y-4 relative z-10 scale-[0.98] origin-top">
                              {/* Platform */}
                              <div className="space-y-1.5">
                                <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30 pl-1">Platform</label>
                                <select
                                  value={icon.type}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const labelMap: Record<string, string> = {
                                      whatsapp: 'WhatsApp', facebook: 'Facebook', instagram: 'Instagram', linkedin: 'LinkedIn',
                                      twitter: 'Twitter', youtube: 'YouTube', email: 'Email', phone: 'Phone / Call', website: 'Website / Link'
                                    };
                                    setFloatingSettings((prev: any) => {
                                      const newIcons = [...prev.social.icons];
                                      newIcons[idx].type = value;
                                      newIcons[idx].label = labelMap[value] || value;
                                      return { ...prev, social: { ...prev.social, icons: newIcons } };
                                    });
                                  }}
                                  className="custom-select w-full py-2 text-[10px]"
                                >
                                  <option value="whatsapp">WhatsApp</option>
                                  <option value="facebook">Facebook</option>
                                  <option value="instagram">Instagram</option>
                                  <option value="linkedin">LinkedIn</option>
                                  <option value="twitter">Twitter</option>
                                  <option value="youtube">YouTube</option>
                                  <option value="email">Email</option>
                                  <option value="phone">Phone / Call</option>
                                  <option value="website">Website / Link</option>
                                </select>
                              </div>

                              {/* Destination URL */}
                              <div className="space-y-1.5">
                                <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30 pl-1">URL / ID</label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    value={icon.url}
                                    onChange={(e) => {
                                      setFloatingSettings((prev: any) => {
                                        const newIcons = [...prev.social.icons];
                                        newIcons[idx].url = e.target.value;
                                        return { ...prev, social: { ...prev.social, icons: newIcons } };
                                      });
                                    }}
                                    className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-[10px] text-white/80 focus:border-gold outline-none transition-all pr-8"
                                    placeholder={icon.type === 'phone' ? 'tel:+61...' : 'https://...'}
                                  />
                                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20">
                                    <Plus size={12} className="rotate-45" />
                                  </div>
                                </div>
                              </div>

                              {/* Style */}
                              <div className="space-y-1.5">
                                <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30 pl-1">Style</label>
                                <select
                                  value={icon.bgType || 'solid'}
                                  onChange={(e) => {
                                    setFloatingSettings((prev: any) => {
                                      const newIcons = [...prev.social.icons];
                                      newIcons[idx].bgType = e.target.value;
                                      return { ...prev, social: { ...prev.social, icons: newIcons } };
                                    });
                                  }}
                                  className="custom-select w-full py-2 text-[10px]"
                                >
                                  <option value="solid">Solid Background</option>
                                  <option value="gradient">Gradient Finish</option>
                                </select>
                              </div>

                              {/* Background / Gradient */}
                              <div className="space-y-1.5">
                                <div className="flex justify-between items-center pl-1 pr-1">
                                  <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">
                                    {icon.bgType === 'gradient' ? 'Gradient CSS' : 'BG Color'}
                                  </label>
                                  {!icon.bgType || icon.bgType === 'solid' ? (
                                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: icon.bgColor || icon.color || '#D4AF37' }} />
                                  ) : (
                                    <div className="w-3 h-3 rounded-full border border-white/20" style={{ background: icon.bgGradient }} />
                                  )}
                                </div>
                                {icon.bgType === 'gradient' ? (
                                  <input
                                    type="text"
                                    value={icon.bgGradient || 'linear-gradient(45deg, #D4AF37, #F1D483)'}
                                    onChange={(e) => {
                                      setFloatingSettings((prev: any) => {
                                        const newIcons = [...prev.social.icons];
                                        newIcons[idx].bgGradient = e.target.value;
                                        return { ...prev, social: { ...prev.social, icons: newIcons } };
                                      });
                                    }}
                                    className="w-full h-7 bg-black/40 border border-white/10 rounded-lg text-[8px] font-mono px-2 outline-none focus:border-gold text-white/60"
                                  />
                                ) : (
                                  <input
                                    type="color"
                                    value={icon.bgColor || icon.color || '#D4AF37'}
                                    onChange={(e) => {
                                      setFloatingSettings((prev: any) => {
                                        const newIcons = [...prev.social.icons];
                                        newIcons[idx].bgColor = e.target.value;
                                        newIcons[idx].color = e.target.value;
                                        return { ...prev, social: { ...prev.social, icons: newIcons } };
                                      });
                                    }}
                                    className="w-full h-7 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden p-0"
                                  />
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4 pt-1 border-t border-white/5 relative z-10 scale-[0.98] origin-top">
                              {/* Padding */}
                              <div className="space-y-2.5">
                                <div className="flex justify-between items-center px-1">
                                  <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">Padding</label>
                                  <span className="text-[8px] font-mono text-gold">{icon.padding || 12}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="4"
                                  max="32"
                                  value={icon.padding || 12}
                                  onChange={(e) => {
                                    setFloatingSettings((prev: any) => {
                                      const newIcons = [...prev.social.icons];
                                      newIcons[idx].padding = parseInt(e.target.value);
                                      return { ...prev, social: { ...prev.social, icons: newIcons } };
                                    });
                                  }}
                                  className="w-full accent-gold h-1"
                                  style={{ '--value': `${(((icon.padding || 12) - 4) / (32 - 4)) * 100}%` } as React.CSSProperties}
                                />
                              </div>

                              {/* Icon Size */}
                              <div className="space-y-2.5">
                                <div className="flex justify-between items-center px-1">
                                  <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">Size</label>
                                  <span className="text-[8px] font-mono text-gold">{icon.iconSize || 20}px</span>
                                </div>
                                <input
                                  type="range"
                                  min="10"
                                  max="48"
                                  value={icon.iconSize || 20}
                                  onChange={(e) => {
                                    setFloatingSettings((prev: any) => {
                                      const newIcons = [...prev.social.icons];
                                      newIcons[idx].iconSize = parseInt(e.target.value);
                                      return { ...prev, social: { ...prev.social, icons: newIcons } };
                                    });
                                  }}
                                  className="w-full accent-gold h-1"
                                  style={{ '--value': `${(((icon.iconSize || 20) - 10) / (48 - 10)) * 100}%` } as React.CSSProperties}
                                />
                              </div>

                              {/* Icon Color */}
                              <div className="space-y-2.5">
                                <div className="flex justify-between items-center px-1">
                                  <label className="text-[7.5px] uppercase tracking-widest font-black text-white/30">Color</label>
                                  <div className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: icon.iconColor || '#ffffff' }} />
                                </div>
                                <input
                                  type="color"
                                  value={icon.iconColor || '#ffffff'}
                                  onChange={(e) => {
                                    setFloatingSettings((prev: any) => {
                                      const newIcons = [...prev.social.icons];
                                      newIcons[idx].iconColor = e.target.value;
                                      return { ...prev, social: { ...prev.social, icons: newIcons } };
                                    });
                                  }}
                                  className="w-full h-4 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden p-0"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Scroll To Top Section */}
                <div className="glass p-6 sm:p-8 rounded-2xl border border-white/5 space-y-8">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-400">
                        <ArrowUpCircle size={22} />
                      </div>
                      <div>
                        <h4 className="text-lg font-display text-gold tracking-tight">Scroll To Top Button</h4>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Automated navigation helper</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer group bg-black/20 self-start sm:self-auto py-2 px-4 rounded-xl border border-white/5 hover:border-gold/30 transition-all">
                      <div className={cn("w-10 h-5 rounded-full transition-all relative shrink-0", floatingSettings?.scrollTop?.active ? "bg-gold" : "bg-white/10")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={floatingSettings?.scrollTop?.active || false}
                          onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), active: e.target.checked } }))}
                        />
                        <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all", floatingSettings?.scrollTop?.active ? "right-1" : "left-1")} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Status</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    {/* Left Column: Layout & Visibility */}
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                          <Layout size={12} />
                          Position & Threshold
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                          <button
                            onClick={() => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), position: 'right-bottom' } }))}
                            className={cn(
                              "py-3.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm",
                              floatingSettings?.scrollTop?.position === 'right-bottom' ? "bg-gold text-black border-gold" : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                            )}
                          >
                            Bottom Right
                          </button>
                          <button
                            onClick={() => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), position: 'left-bottom' } }))}
                            className={cn(
                              "py-3.5 rounded-xl border transition-all text-[10px] font-black uppercase tracking-widest shadow-sm",
                              floatingSettings?.scrollTop?.position === 'left-bottom' ? "bg-gold text-black border-gold" : "bg-black/40 border-white/5 text-white/40 hover:border-white/20"
                            )}
                          >
                            Bottom Left
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">X-Axis Offset</span>
                            <div className="relative">
                              <input
                                type="number"
                                value={floatingSettings?.scrollTop?.offsetX || 24}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), offsetX: Number(e.target.value) } }))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gold outline-none focus:border-gold/50 transition-all font-mono"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-mono">PX</span>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Y-Axis Offset</span>
                            <div className="relative">
                              <input
                                type="number"
                                value={floatingSettings?.scrollTop?.offsetY || 24}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), offsetY: Number(e.target.value) } }))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-gold outline-none focus:border-gold/50 transition-all font-mono"
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-white/20 font-mono">PX</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2">
                          <div className="flex justify-between items-center mb-4">
                            <span className="text-[9px] text-white/30 uppercase font-black tracking-widest ml-1">Show after scroll of</span>
                            <span className="text-xs font-mono text-gold bg-gold/10 px-2 py-0.5 rounded-lg border border-gold/20">{floatingSettings?.scrollTop?.offset || 300}px</span>
                          </div>
                          <input
                            type="range"
                            min="100"
                            max="2000"
                            step="50"
                            value={floatingSettings?.scrollTop?.offset || 300}
                            onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), offset: Number(e.target.value) } }))}
                            className="w-full accent-gold h-1.5 bg-white/5 rounded-full appearance-none cursor-pointer"
                            style={{ '--value': `${(((floatingSettings?.scrollTop?.offset || 300) - 100) / (2000 - 100)) * 100}%` } as React.CSSProperties}
                          />
                        </div>
                      </div>

                      <div className="p-5 bg-black/20 rounded-2xl border border-white/5 space-y-4">
                        <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                          <Eye size={12} />
                          Page Visibility Rules
                        </label>
                        <div className="space-y-4">
                          <select
                            value={floatingSettings?.scrollTop?.displayCondition || 'all'}
                            onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), displayCondition: e.target.value } }))}
                            className="custom-select w-full"
                          >
                            <option value="all">Show Everywhere</option>
                            <option value="landing">Home Page Only</option>
                            <option value="specific">Specific Pages Only</option>
                            <option value="except">Except Specific Pages</option>
                          </select>

                          {floatingSettings?.scrollTop?.displayCondition === 'specific' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                              <input
                                type="text"
                                value={floatingSettings?.scrollTop?.specificPages?.join(', ') || ''}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), specificPages: e.target.value.split(',').map(s => s.trim()) } }))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-gold/50"
                                placeholder="/fleet, /offers, /pricing"
                              />
                            </div>
                          )}

                          {floatingSettings?.scrollTop?.displayCondition === 'except' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                              <input
                                type="text"
                                value={floatingSettings?.scrollTop?.exceptPages?.join(', ') || ''}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), exceptPages: e.target.value.split(',').map(s => s.trim()) } }))}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3.5 text-xs text-white placeholder:text-white/20 outline-none focus:border-gold/50"
                                placeholder="/checkout, /payment"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Style & Customization */}
                    <div className="space-y-6">
                      <div className="p-6 bg-black/20 rounded-2xl border border-white/5 space-y-6">
                        <label className="text-[10px] uppercase tracking-widest font-black text-gold/60 flex items-center gap-2">
                          <Palette size={12} />
                          Style & Appearance
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest ml-1">Shape</span>
                              <select
                                value={floatingSettings?.scrollTop?.shape || 'circle'}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), shape: e.target.value } }))}
                                className="custom-select w-full"
                              >
                                <option value="circle">Circle</option>
                                <option value="square">Sharp Square</option>
                                <option value="rounded">Modern Rounded</option>
                                <option value="pulse">Pulse Glow Effect</option>
                              </select>
                            </div>

                            <div className="space-y-2">
                              <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest ml-1">Icon Style</span>
                              <select
                                value={floatingSettings?.scrollTop?.icon || 'arrow-up'}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), icon: e.target.value } }))}
                                className="custom-select w-full"
                              >
                                <option value="arrow-up">Arrow Simple</option>
                                <option value="chevron-up">Chevron Minimal</option>
                                <option value="arrow-up-circle">Circle Arrow</option>
                                <option value="move-up">Move Up Accent</option>
                                <option value="rocket">Rocket Launcher</option>
                              </select>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="space-y-2">
                              <div className="flex justify-between items-center px-1">
                                <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Button Sizing</span>
                                <span className="text-[10px] font-mono text-gold">{floatingSettings?.scrollTop?.padding || 12}px</span>
                              </div>
                              <input
                                type="range"
                                min="4"
                                max="40"
                                value={floatingSettings?.scrollTop?.padding || 12}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), padding: parseInt(e.target.value) } }))}
                                className="w-full accent-gold h-1 bg-white/5 rounded-full appearance-none cursor-pointer"
                                style={{ '--value': `${(((floatingSettings?.scrollTop?.padding || 12) - 4) / (40 - 4)) * 100}%` } as React.CSSProperties}
                              />
                            </div>

                            <div className="space-y-2">
                              <div className="flex justify-between items-center px-1">
                                <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest">Icon Scale</span>
                                <span className="text-[10px] font-mono text-gold">{floatingSettings?.scrollTop?.iconSize || 20}px</span>
                              </div>
                              <input
                                type="range"
                                min="12"
                                max="64"
                                value={floatingSettings?.scrollTop?.iconSize || 20}
                                onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), iconSize: parseInt(e.target.value) } }))}
                                className="w-full accent-gold h-1 bg-white/5 rounded-full appearance-none cursor-pointer"
                                style={{ '--value': `${(((floatingSettings?.scrollTop?.iconSize || 20) - 12) / (64 - 12)) * 100}%` } as React.CSSProperties}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/5 space-y-6">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest block ml-1">Background style</span>
                              <div className="space-y-3">
                                <select
                                  value={floatingSettings?.scrollTop?.bgType || 'solid'}
                                  onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), bgType: e.target.value } }))}
                                  className="custom-select w-full"
                                >
                                  <option value="solid">Flat Color</option>
                                  <option value="gradient">Premium Gradient</option>
                                </select>

                                {floatingSettings?.scrollTop?.bgType === 'gradient' ? (
                                  <input
                                    type="text"
                                    value={floatingSettings?.scrollTop?.bgGradient || 'linear-gradient(45deg, #D4AF37, #F1D483)'}
                                    onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), bgGradient: e.target.value } }))}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono text-gold outline-none focus:border-gold/50"
                                  />
                                ) : (
                                  <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                                    <input
                                      type="color"
                                      value={floatingSettings?.scrollTop?.color || '#D4AF37'}
                                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), color: e.target.value } }))}
                                      className="w-10 h-10 rounded-lg overflow-hidden bg-transparent border-none cursor-pointer"
                                    />
                                    <input
                                      type="text"
                                      value={floatingSettings?.scrollTop?.color || '#D4AF37'}
                                      onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), color: e.target.value } }))}
                                      className="flex-1 bg-transparent text-[10px] font-mono text-gold outline-none"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <span className="text-[9px] text-white/20 uppercase font-bold tracking-widest block ml-1">Icon Color</span>
                              <div className="flex items-center gap-3 bg-black/40 p-3 rounded-xl border border-white/5">
                                <input
                                  type="color"
                                  value={floatingSettings?.scrollTop?.iconColor || '#000000'}
                                  onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), iconColor: e.target.value } }))}
                                  className="w-10 h-10 rounded-lg overflow-hidden bg-transparent border-none cursor-pointer"
                                />
                                <input
                                  type="text"
                                  value={floatingSettings?.scrollTop?.iconColor || '#000000'}
                                  onChange={(e) => setFloatingSettings((prev: any) => ({ ...prev, scrollTop: { ...(prev?.scrollTop || {}), iconColor: e.target.value } }))}
                                  className="flex-1 bg-transparent text-[10px] font-mono text-gold outline-none"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Promo Bars Area */}
                <div className="space-y-8">
                  {/* Header */}
                  <div className="flex flex-col md:flex-row items-center md:justify-between group transition-all">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3 px-2">
                        <div className="w-1.5 h-8 bg-gold/50 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]" />
                        <div>
                          <h4 className="text-xl font-display text-white tracking-tight">Promo Bars</h4>
                          <p className="text-[9px] uppercase tracking-[0.2em] font-black text-gold">
                            Create a new floating bar for sales or news
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bars Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {(floatingSettings?.bars || []).map((bar: any, bIdx: number) => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = bar.endDate && bar.endDate < today;
                      const isUpcoming = bar.startDate && bar.startDate > today;
                      const isWithinDate = (!bar.startDate || bar.startDate <= today) && (!bar.endDate || bar.endDate >= today);

                      return (
                        <div key={bar.id || bIdx} className="glass p-6 rounded-2xl border border-white/5 space-y-4 relative group hover:border-gold/20 transition-all">
                          <div className="flex justify-between items-start w-full">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-display text-white group-hover:text-gold transition-colors">
                                  {bar.name || `Bar #${bIdx + 1}`}
                                </h4>
                                {bar.active && isWithinDate && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded border border-emerald-500/20">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                    Live
                                  </span>
                                )}
                                {!bar.active && (
                                  <span className="px-1.5 py-0.5 bg-white/5 text-white/30 text-[8px] font-black uppercase rounded border border-white/10">
                                    Inactive
                                  </span>
                                )}
                                {bar.active && isExpired && (
                                  <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] font-black uppercase rounded border border-red-500/20">
                                    Expired
                                  </span>
                                )}
                                {bar.active && isUpcoming && (
                                  <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase rounded border border-blue-500/20">
                                    Scheduled
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-white/40 line-clamp-1 max-w-[200px]">
                                {bar.content?.replace(/<[^>]*>?/gm, '')}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingBarIndex(bIdx);
                                  setShowBarModal(true);
                                }}
                                className="p-1.5 bg-white/5 hover:bg-blue-500/10 text-white/40 hover:text-blue-500 rounded transition-all"
                                title="Edit Bar"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  const duplicated = {
                                    ...bar,
                                    id: `bar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                    name: `${bar.name || 'Bar'} (Copy)`
                                  };
                                  setFloatingSettings((prev: any) => {
                                    const newBars = [...(prev.bars || [])];
                                    newBars.splice(bIdx + 1, 0, duplicated);
                                    return { ...prev, bars: newBars };
                                  });
                                }}
                                className="p-1.5 bg-white/5 hover:bg-gold/10 text-white/40 hover:text-gold rounded transition-all"
                                title="Duplicate"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setFloatingSettings((prev: any) => ({
                                    ...prev,
                                    bars: (prev.bars || []).filter((_: any, i: number) => i !== bIdx)
                                  }));
                                }}
                                className="p-1.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded transition-all"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 pt-3 mt-2 border-t border-white/5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: bar.bgType === 'gradient' ? '#D4AF37' : (bar.bgColor || '#D4AF37') }} />
                                  <span className="text-[9px] uppercase tracking-wider text-white/40 font-bold">{bar.bgType || 'solid'}</span>
                                </div>
                                <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest">
                                  {bar.position === 'top' ? 'Header' : 'Footer'}
                                </div>
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-[9px] uppercase font-bold text-white/20 tracking-widest">Enabled</span>
                                <div className={cn("w-8 h-4 rounded-full transition-all relative", bar.active ? "bg-emerald-500" : "bg-white/10")}>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={bar.active || false}
                                    onChange={(e) => {
                                      setFloatingSettings((prev: any) => {
                                        const newBars = [...(prev.bars || [])];
                                        newBars[bIdx].active = e.target.checked;
                                        return { ...prev, bars: newBars };
                                      });
                                    }}
                                  />
                                  <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", bar.active ? "right-0.5" : "left-0.5")} />
                                </div>
                              </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-white/30 font-bold uppercase tracking-widest bg-black/20 p-2 rounded-lg border border-white/5">
                              <div className="flex items-center gap-1.5" title="Visibility Rule">
                                <Eye size={10} className="text-white/40" />
                                {bar.displayCondition === 'all' ? 'Everywhere' : bar.displayCondition === 'landing' ? 'Home' : bar.displayCondition === 'specific' ? 'Specific Pages' : 'Excluded Pages'}
                              </div>
                              <div className="flex items-center gap-1.5" title="Available Dates">
                                <Calendar size={10} className="text-white/40" />
                                {(!bar.startDate && !bar.endDate) ? 'Always Available' : `${bar.startDate || 'Any'} to ${bar.endDate || 'Any'}`}
                              </div>
                              <div className="flex items-center gap-1.5" title="Display Timing">
                                <Clock size={10} className="text-white/40" />
                                Wait <span className="text-gold">{bar.delay || 0}ms</span>
                                {bar.autoCloseTime > 0 && <span className="text-white/20 mx-1">•</span>}
                                {bar.autoCloseTime > 0 && <span>Close <span className="text-gold">{bar.autoCloseTime}s</span></span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => {
                        const newBar = {
                          id: `bar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          name: "New Promo Bar",
                          active: true,
                          content: "New Promo Bar",
                          promoCode: "",
                          bgColor: "#D4AF37",
                          bgType: "solid",
                          bgGradient: "linear-gradient(90deg, #D4AF37, #F1D483)",
                          textColor: "#000000",
                          promoColor: "#000000",
                          promoBg: "rgba(0,0,0,0.1)",
                          closeColor: "#000000",
                          position: "top",
                          showClose: true,
                          animation: "marquee",
                          marqueeSpeed: 20,
                          delay: 0,
                          autoCloseTime: 0,
                          startDate: "",
                          endDate: "",
                          displayCondition: "all",
                          specificPages: [],
                          exceptPages: [],
                          ctaText: "",
                          ctaLink: ""
                        };
                        setFloatingSettings((prev: any) => ({
                          ...prev,
                          bars: [...(prev.bars || []), newBar]
                        }));
                        setEditingBarIndex((floatingSettings?.bars || []).length);
                        setShowBarModal(true);
                      }}
                      className="glass p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-gold hover:bg-gold/5 flex flex-col items-center justify-center gap-3 transition-all min-h-[140px] h-full w-full text-white/50 hover:text-gold group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-gold/20 flex items-center justify-center transition-colors">
                        <Plus size={24} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Add Promo Bar</span>
                    </button>
                  </div>

                  {/* Popups Management Header */}
                  <div className="flex flex-col md:flex-row md:items-center md:gap-6 px-2 pt-8">
                    {/* Info Block */}
                    <div className="flex items-center gap-4 mb-4 md:mb-0">
                      <div className="w-1.5 h-8 bg-gold/50 rounded-full shadow-[0_0_10px_rgba(212,175,55,0.3)]" />
                      <div>
                        <h4 className="text-xl font-display text-white tracking-tight">
                          Floating Popups
                        </h4>
                        <p className="text-[9px] uppercase tracking-[0.2em] font-black text-gold/40">
                          Targeted popups for sales, offers or news
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Popups Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {(floatingSettings?.popups || []).map((popup: any, pIdx: number) => {
                      const today = new Date().toISOString().split('T')[0];
                      const isExpired = popup.endDate && popup.endDate < today;
                      const isWithinDate = (!popup.startDate || popup.startDate <= today) && (!popup.endDate || popup.endDate >= today);

                      return (
                        <div key={popup.id} className="glass p-6 rounded-2xl border border-white/5 space-y-4 relative group hover:border-gold/20 transition-all">
                          <div className="flex justify-between items-start w-full">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-display text-white group-hover:text-gold transition-colors">
                                  {popup.name || `Popup #${pIdx + 1}`}
                                </h4>
                                {popup.active && isWithinDate && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[8px] font-black uppercase rounded border border-emerald-500/20">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                    Live
                                  </span>
                                )}
                                {popup.active && isExpired && (
                                  <span className="px-1.5 py-0.5 bg-red-500/10 text-red-400 text-[8px] font-black uppercase rounded border border-red-500/20">
                                    Expired
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">
                                Type: {popup.type} • {popup.position}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => { setEditingPopupIndex(pIdx); setShowPopupModal(true); }}
                                className="p-1.5 bg-white/5 hover:bg-blue-500/10 text-white/40 hover:text-blue-500 rounded transition-all"
                                title="Edit Popup"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  const clonedPopup = {
                                    ...popup,
                                    id: Math.random().toString(36).substr(2, 9),
                                    name: `${popup.name || 'Popup'} (Copy)`,
                                    active: false
                                  };
                                  setFloatingSettings((prev: any) => ({
                                    ...prev,
                                    popups: [...(prev.popups || []), clonedPopup]
                                  }));
                                }}
                                className="p-1.5 bg-white/5 hover:bg-gold/10 text-white/40 hover:text-gold rounded transition-all"
                                title="Duplicate Popup"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  setFloatingSettings((prev: any) => ({
                                    ...prev,
                                    popups: (prev.popups || []).filter((_: any, i: number) => i !== pIdx)
                                  }));
                                }}
                                className="p-1.5 bg-white/5 hover:bg-red-500/10 text-white/40 hover:text-red-500 rounded transition-all"
                                title="Delete Popup"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 pt-3 mt-2 border-t border-white/5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="text-[9px] text-white/30 font-bold uppercase tracking-widest">
                                  Animation: {popup.animation}
                                </div>
                              </div>

                              <label className="flex items-center gap-2 cursor-pointer">
                                <span className="text-[9px] uppercase font-bold text-white/20 tracking-widest">Enabled</span>
                                <div className={cn("w-8 h-4 rounded-full transition-all relative", popup.active ? "bg-gold" : "bg-white/10")}>
                                  <input
                                    type="checkbox"
                                    className="hidden"
                                    checked={popup.active || false}
                                    onChange={(e) => {
                                      setFloatingSettings((prev: any) => {
                                        const newPopups = [...(prev.popups || [])];
                                        newPopups[pIdx].active = e.target.checked;
                                        return { ...prev, popups: newPopups };
                                      });
                                    }}
                                  />
                                  <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm", popup.active ? "right-0.5" : "left-0.5")} />
                                </div>
                              </label>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-white/30 font-bold uppercase tracking-widest bg-black/20 p-2 rounded-lg border border-white/5">
                              <div className="flex items-center gap-1.5" title="Visibility Rule">
                                <Eye size={10} className="text-white/40" />
                                {popup.displayCondition === 'all' ? 'Everywhere' : popup.displayCondition === 'landing' ? 'Home' : popup.displayCondition === 'specific' ? 'Specific Pages' : 'Excluded Pages'}
                              </div>
                              <div className="flex items-center gap-1.5" title="Available Dates">
                                <Calendar size={10} className="text-white/40" />
                                {(!popup.startDate && !popup.endDate) ? 'Always Available' : `${popup.startDate || 'Any'} to ${popup.endDate || 'Any'}`}
                              </div>
                              <div className="flex items-center gap-1.5" title="Display Timing">
                                <Clock size={10} className="text-white/40" />
                                Wait <span className="text-gold">{popup.delay || 0}ms</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <button
                      onClick={() => {
                        const newPopup = {
                          id: `popup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                          name: "New Promo Popup",
                          type: "sales",
                          active: true,
                          title: "Summer Offer",
                          subtitle: "Limited Time Only",
                          details: "Get exclusive access to our luxury fleet with 15% discount.",
                          promoCode: "SUMMER15",
                          ctaText: "Get Offer",
                          ctaLink: "/offers",
                          bgType: "gradient",
                          bgGradient: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
                          textColor: "#FFFFFF",
                          accentColor: "#D4AF37",
                          position: "center",
                          animation: "scale",
                          delay: 2000,
                          displayCondition: "all"
                        };
                        setFloatingSettings((prev: any) => ({
                          ...prev,
                          popups: [...(prev.popups || []), newPopup]
                        }));
                        setEditingPopupIndex((floatingSettings?.popups || []).length);
                        setShowPopupModal(true);
                      }}
                      className="glass p-6 rounded-2xl border-2 border-dashed border-white/20 hover:border-gold hover:bg-gold/5 flex flex-col items-center justify-center gap-3 transition-all min-h-[140px] h-full w-full text-white/50 hover:text-gold group cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-full bg-white/5 group-hover:bg-gold/20 flex items-center justify-center transition-colors">
                        <Plus size={24} />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">Add Popup</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'media' && (
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="text-2xl font-display text-gold">Media Library</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mt-1">
                      Manage images and files ({((storageUsageBytes / storageLimitBytes) * 100).toFixed(1)}% of free tier used)
                    </p>
                    <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-gold"
                        style={{ width: `${Math.min((storageUsageBytes / storageLimitBytes) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-white/30 mt-1 mt-1">
                      {(storageUsageBytes / (1024 * 1024)).toFixed(2)} MB / {(storageLimitBytes / (1024 * 1024 * 1024)).toFixed(0)} GB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingMedia({ alt: '', title: '', description: '', caption: '' });
                      setMediaFile(null);
                      setShowMediaModal(true);
                    }}
                    className="btn-primary px-6 py-2 flex items-center gap-2"
                  >
                    <Plus size={18} />
                    <span className="text-xs font-bold uppercase tracking-widest">Upload Media</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
                  {mediaList.map((media) => (
                    <motion.div
                      layout
                      key={media.u_key || media.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative bg-[#050505] rounded-xl overflow-hidden border border-white/5 hover:border-gold/30 transition-all duration-500"
                    >
                      {/* Media Preview Area */}
                      <div className="aspect-square flex items-center justify-center overflow-hidden bg-black/40">
                        {media.type?.startsWith('image/') ? (
                          <img
                            src={media.url}
                            alt={media.alt || media.name}
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex flex-col items-center gap-3">
                            <FileUp className="text-white/20" size={32} />
                            <span className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">
                              {media.type?.split('/')[1] || 'FILE'}
                            </span>
                          </div>
                        )}

                        {/* Top Metadata Badge */}
                        <div className="absolute top-2 left-2 z-10">
                          <span className="px-2 py-0.5 bg-black/60 backdrop-blur-md border border-white/10 rounded text-[8px] uppercase tracking-widest font-black text-gold">
                            {media.folder || 'General'}
                          </span>
                        </div>
                      </div>

                      {/* Content & Hidden Actions Area */}
                      <div className="p-3 bg-black/60 backdrop-blur-sm border-t border-white/5">
                        <div className="flex justify-between items-start mb-1 gap-2">
                          <p className="text-[11px] text-white/90 truncate font-medium flex-1" title={media.name}>
                            {media.name}
                          </p>
                          <span className="text-[9px] text-white/30 font-mono tracking-tighter">
                            {(media.size / 1024).toFixed(1)}K
                          </span>
                        </div>

                        {/* Expandable Actions on Hover */}
                        <div className="max-h-0 group-hover:max-h-24 overflow-hidden transition-all duration-500 ease-out">
                          <div className="pt-3 grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleCopyUrl(media.url)}
                              className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-gold/10 hover:text-gold border border-white/10 hover:border-gold/30 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                            >
                              <Copy size={10} /> Link
                            </button>
                            <button
                              onClick={() => {
                                setEditingMedia(media);
                                setMediaFile(null);
                                setMediaFolder(media.folder || 'general');
                                setShowMediaModal(true);
                              }}
                              className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                            >
                              <Edit2 size={10} /> Edit
                            </button>
                            <a
                              href={media.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-center gap-1.5 py-1.5 bg-white/5 hover:bg-white/10 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                            >
                              <Eye size={10} /> View
                            </a>
                            <button
                              onClick={() => handleDeleteMedia(media.id, media.url)}
                              className="flex items-center justify-center gap-1.5 py-1.5 bg-red-500/5 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/10 hover:border-red-500/30 rounded text-[9px] uppercase font-bold tracking-widest transition-all"
                            >
                              <Trash2 size={10} /> Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {mediaList.length === 0 && (
                    <div className="col-span-full py-20 text-center glass rounded-2xl border border-white/5 border-dashed">
                      <Image size={48} className="mx-auto mb-4 text-white/20" />
                      <p className="text-white/50 text-sm uppercase tracking-widest">No Media Found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'seo' && (
              <div className="space-y-12">
                {/* 1st: Global SEO Section */}
                <div className="space-y-8">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-display text-gold">Global SEO & Contact</h3>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage site-wide settings and contact info</p>
                    </div>
                    <button
                      onClick={() => handleUpdateSettings(systemSettings)}
                      disabled={isSavingSettings}
                      className="btn-primary flex items-center justify-center gap-2 h-10 sm:h-10 px-3 sm:px-4 py-2"
                    >
                      {isSavingSettings ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Save size={18} />
                      )}
                      {/* Hide text on mobile, show on sm+ */}
                      <span className="hidden sm:inline text-xs font-bold uppercase tracking-widest">
                        Save Changes
                      </span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Contact Details */}
                    <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
                      <h4 className="text-sm font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                        <Phone size={16} /> Contact Details
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Website Address</label>
                          <input
                            type="text"
                            value={systemSettings?.contact?.address || ''}
                            onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...systemSettings.contact, address: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="123 Luxury Way, Melbourne VIC 3000"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Phone Number</label>
                          <input
                            type="text"
                            value={systemSettings?.contact?.phone || ''}
                            onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...systemSettings.contact, phone: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="+61 400 000 000"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Contact Email</label>
                            <input
                              type="email"
                              value={systemSettings?.contact?.email || ''}
                              onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...systemSettings.contact, email: e.target.value } })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                              placeholder="info@merlux.com.au"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Booking Email</label>
                            <input
                              type="email"
                              value={systemSettings?.contact?.bookingEmail || ''}
                              onChange={(e) => setSystemSettings({ ...systemSettings, contact: { ...systemSettings.contact, bookingEmail: e.target.value } })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                              placeholder="bookings@merlux.com.au"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Global SEO Details */}
                    <div className="glass p-8 rounded-3xl border border-white/5 space-y-6">
                      <h4 className="text-sm font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                        <Globe size={16} /> Global SEO
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Site Logo</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={systemSettings?.seo?.logo || ''}
                              onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, logo: e.target.value } })}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                              placeholder="Logo URL..."
                            />
                            <label className="cursor-pointer bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-xl px-4 flex items-center justify-center transition-all">
                              <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} disabled={isUploading} />
                              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Favicon (.ico/png)</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={systemSettings?.seo?.favicon || ''}
                              onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, favicon: e.target.value } })}
                              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                              placeholder="Favicon URL..."
                            />
                            <label className="cursor-pointer bg-white/5 hover:bg-gold hover:text-black border border-white/10 rounded-xl px-4 flex items-center justify-center transition-all">
                              <input type="file" className="hidden" accept="image/*" onChange={handleFaviconUpload} disabled={isUploading} />
                              {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Site Name</label>
                          <input
                            type="text"
                            value={systemSettings?.seo?.siteName || ''}
                            onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, siteName: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="Merlux Chauffeur Services"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Default Meta Title</label>
                          <input
                            type="text"
                            value={systemSettings?.seo?.defaultTitle || ''}
                            onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, defaultTitle: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="Luxury Chauffeur Melbourne | Merlux"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Default Meta Description</label>
                          <textarea
                            value={systemSettings?.seo?.defaultDescription || ''}
                            onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, defaultDescription: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24"
                            placeholder="Book luxury chauffeur services in Melbourne..."
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Default Keywords (comma separated)</label>
                          <input
                            type="text"
                            value={Array.isArray(systemSettings?.seo?.defaultKeywords) ? systemSettings.seo.defaultKeywords.join(', ') : systemSettings?.seo?.defaultKeywords || ''}
                            onChange={(e) => {
                              const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k !== '');
                              setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, defaultKeywords: keywords } });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="chauffeur, melbourne, luxury travel"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Analytics & Schema */}
                    <div className="glass p-8 rounded-3xl border border-white/5 space-y-6 lg:col-span-2">
                      <h4 className="text-sm font-bold text-gold uppercase tracking-widest flex items-center gap-2">
                        <BarChart3 size={16} /> Analytics & Schema
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Google Analytics ID</label>
                          <input
                            type="text"
                            value={systemSettings?.seo?.googleAnalyticsId || ''}
                            onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, googleAnalyticsId: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="G-XXXXXXXXXX"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Search Console ID</label>
                          <input
                            type="text"
                            value={systemSettings?.seo?.searchConsoleId || ''}
                            onChange={(e) => setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, searchConsoleId: e.target.value } })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                            placeholder="verification-code"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Organization Schema (JSON-LD)</label>
                          <textarea
                            value={systemSettings?.seo?.organizationSchema ? JSON.stringify(systemSettings.seo.organizationSchema, null, 2) : ''}
                            onChange={(e) => {
                              try {
                                const schema = JSON.parse(e.target.value);
                                setSystemSettings({ ...systemSettings, seo: { ...systemSettings.seo, organizationSchema: schema } });
                              } catch (err) {
                                // Allow typing invalid JSON temporarily
                              }
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-48 font-mono"
                            placeholder='{ "@context": "https://schema.org", "@type": "Organization", ... }'
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2nd: Blogs Section */}
                <div className="space-y-6 border-t border-white/5 pt-12 custom-scrollbar">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-display text-gold">Blog Posts</h3>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage your journal articles</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCssConfig({
                            type: 'global',
                            content: systemSettings?.seo?.globalCmsCss || '',
                            isActive: systemSettings?.seo?.isGlobalCssActive !== false,
                            title: 'Global CMS CSS'
                          });
                          setShowCssModal(true);
                        }}
                        className="bg-white/5 border border-white/10 text-white/60 hover:text-gold hover:border-gold px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
                      >
                        <Globe size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Global CSS</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingBlog({
                            title: '',
                            slug: '',
                            content: '',
                            excerpt: '',
                            category: 'Travel Tips',
                            featuredImage: '',
                            featuredImageAlt: '',
                            metaTitle: '',
                            metaDescription: '',
                            keywords: '',
                            includeInSitemap: true,
                            noindex: false
                          });
                          setShowBlogModal(true);
                        }}
                        className="btn-primary px-6 py-2 flex items-center gap-2"
                      >
                        <Plus size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Add Post</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {blogs.length > 0 ? blogs.map(blog => (
                      <div key={blog.id || blog.slug || blog.title} className="glass rounded-2xl overflow-hidden border border-white/5 group hover:border-gold/30 transition-all">
                        <div className="h-32 relative overflow-hidden">
                          <img src={blog.featuredImage || blog.image || 'https://picsum.photos/seed/blog/800/400'} alt={blog.title} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40" />
                          <div className="absolute bottom-3 left-4">
                            <p className="text-sm font-bold text-white line-clamp-1">{blog.title}</p>
                            <div className="flex items-center gap-2">
                              <p className="text-[10px] text-gold uppercase tracking-widest">{blog.category}</p>
                              <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                              <p className="text-[9px] text-white/40 uppercase font-medium">
                                {blog.date || (blog.createdAt?.seconds ? new Date(blog.createdAt.seconds * 1000).toLocaleDateString() : 'Draft')}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="p-4 flex items-center justify-between">
                          <div className="flex gap-2">
                            <span className={cn("text-[8px] uppercase font-bold px-2 py-0.5 rounded", blog.noindex ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400")}>
                              {blog.noindex ? 'No Index' : 'Index'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => window.open(`/blog/${blog.slug}`, '_blank')}
                              className="p-2 bg-white/5 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                              title="View Post"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setCssConfig({
                                  type: 'blog',
                                  id: blog.id,
                                  content: blog.customCss || '',
                                  isActive: blog.isCustomCssActive !== false,
                                  title: `CSS: ${blog.title}`,
                                  itemContent: blog.content,
                                  slug: blog.slug,
                                  featuredImage: blog.featuredImage || blog.image
                                });
                                setShowCssModal(true);
                              }}
                              className="p-2 bg-white/5 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all"
                              title="Custom CSS"
                            >
                              <Code2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDuplicateBlog(blog)}
                              className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                              title="Duplicate Post"
                            >
                              <Copy size={14} />
                            </button>
                            <button
                              onClick={() => {
                                const blogWithKeywordString = {
                                  ...blog,
                                  keywords: Array.isArray(blog.keywords) ? blog.keywords.join(', ') : (blog.keywords || '')
                                };
                                setEditingBlog(blogWithKeywordString);
                                setShowBlogModal(true);
                              }}
                              className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteBlog(blog.id)}
                              className="p-2 bg-white/5 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="md:col-span-2 lg:col-span-3 py-20 text-center glass rounded-3xl border border-white/5">
                        <Globe size={48} className="text-white/10 mx-auto mb-4" />
                        <h4 className="text-lg font-display text-white/40">No blog posts found</h4>
                        <p className="text-xs text-white/20 mt-1 uppercase tracking-widest font-bold">Start writing by clicking 'Add Post'</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3rd: Dynamic Pages Section */}
                <div className="space-y-8 border-t border-white/5 pt-12">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-2xl font-display text-gold">Dynamic Pages</h3>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage custom landing pages</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCssConfig({
                            type: 'global',
                            content: systemSettings?.seo?.globalCmsCss || '',
                            isActive: systemSettings?.seo?.isGlobalCssActive !== false,
                            title: 'Global CMS CSS'
                          });
                          setShowCssModal(true);
                        }}
                        className="bg-white/5 border border-white/10 text-white/60 hover:text-gold hover:border-gold px-4 py-2 rounded-xl flex items-center gap-2 transition-all"
                      >
                        <Globe size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Global CSS</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingPage({
                            title: '',
                            slug: '',
                            content: '',
                            featuredImage: '',
                            featuredImageAlt: '',
                            metaTitle: '',
                            metaDescription: '',
                            keywords: '',
                            includeInSitemap: true,
                            noindex: false
                          });
                          setShowPageModal(true);
                        }}
                        className="btn-primary px-6 py-2 flex items-center gap-2"
                      >
                        <Plus size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Add Page</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pages.filter(p => !['home', 'fleet', 'services', 'about', 'contact', 'booking', 'offers', 'tours'].includes(p.slug)).length > 0 ? (
                      pages
                        .filter(p => !['home', 'fleet', 'services', 'about', 'contact', 'booking', 'offers', 'tours'].includes(p.slug))
                        .map(page => (
                          <div
                            key={page.id || page.slug}
                            className="glass rounded-2xl overflow-hidden border border-white/5 group hover:border-gold/30 transition-all flex flex-col"
                          >
                            <div className="h-32 relative overflow-hidden">
                              <img src={page.featuredImage || 'https://picsum.photos/seed/page/800/400'} alt={page.featuredImageAlt || page.title} className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40" />
                              <div className="absolute bottom-3 left-4">
                                <h4 className="text-sm font-bold text-white line-clamp-1">{page.title}</h4>
                                <p className="text-[10px] text-gold uppercase tracking-widest font-bold">/{page.slug}</p>
                              </div>
                            </div>

                            <div className="p-4 space-y-4">
                              {/* Top row: badges */}
                              <div className="flex gap-2">
                                <span className={cn("text-[8px] uppercase font-bold px-2 py-0.5 rounded", page.noindex ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400")}>
                                  {page.noindex ? 'No Index' : 'Index'}
                                </span>
                                <span className={cn("text-[8px] uppercase font-bold px-2 py-0.5 rounded", page.includeInSitemap ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-white/40")}>
                                  {page.includeInSitemap ? 'In Sitemap' : 'Hidden'}
                                </span>
                              </div>

                              {/* Bottom row: action buttons pinned */}
                              <div className="flex gap-2 justify-end">
                                <button
                                  onClick={() => window.open(`/${page.slug}`, '_blank')}
                                  className="p-3 bg-white/5 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
                                  title="View Page"
                                >
                                  <Eye size={18} />
                                </button>
                                <button
                                  onClick={() => {
                                    setCssConfig({
                                      type: 'page',
                                      id: page.id,
                                      content: page.customCss || '',
                                      isActive: page.isCustomCssActive !== false,
                                      title: `CSS: ${page.title}`,
                                      itemContent: page.content,
                                      slug: page.slug,
                                      featuredImage: page.featuredImage
                                    });
                                    setShowCssModal(true);
                                  }}
                                  className="p-3 bg-white/5 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
                                  title="Custom CSS"
                                >
                                  <Code2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDuplicatePage(page)}
                                  className="p-3 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                                  title="Duplicate Page"
                                >
                                  <Copy size={18} />
                                </button>
                                <button
                                  onClick={() => {
                                    const pageWithKeywordString = {
                                      ...page,
                                      keywords: Array.isArray(page.keywords) ? page.keywords.join(', ') : (page.keywords || '')
                                    };
                                    setEditingPage(pageWithKeywordString);
                                    setShowPageModal(true);
                                  }}
                                  className="p-3 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                                >
                                  <Edit2 size={18} />
                                </button>
                                <button
                                  onClick={() => handleDeletePage(page.id)}
                                  className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <div className="col-span-full text-center py-12 bg-white/5 rounded-2xl border border-dashed border-white/10">
                        <p className="text-white/40 italic">No dynamic pages created yet.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubTab === 'offers-tours' && (
              <div className="space-y-12">
                {/* Offers Section */}
                <div className="space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-display text-gold flex items-center gap-3">
                        Offers Management
                      </h3>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage special fixed-rate deals</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setCsvImportType('offers');
                          setShowCsvImportModal(true);
                        }}
                        className="bg-white/5 border border-white/10 hover:border-gold/50 text-white/60 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                      >
                        <Upload size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Import CSV</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingOffer({
                            title: '',
                            description: '',
                            discountType: 'percentage',
                            discountValue: 15,
                            image: '',
                            active: true,
                            slug: '',
                            tags: [],
                            fleets: []
                          });
                          setShowOfferModal(true);
                        }}
                        className="bg-gold text-black hover:bg-gold/80 px-6 py-2 rounded-xl flex items-center gap-2 transition-all"
                      >
                        <Plus size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Add Offer</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4">
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setIsOffersSelectionMode(false);
                            setSelectedOffers([]);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                            !isOffersSelectionMode ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                          )}
                          title="None (Selection Mode OFF)"
                        >
                          <CircleX size={14} />
                          <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">None</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOffersSelectionMode(true);
                            if (selectedOffers.length === filteredOffers.length) {
                              setSelectedOffers([]);
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                            isOffersSelectionMode && selectedOffers.length < filteredOffers.length ? "bg-gold text-black" : "text-white/40 hover:text-white"
                          )}
                          title="Selection Mode ON"
                        >
                          <Check size={14} />
                          <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">Select</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsOffersSelectionMode(true);
                            setSelectedOffers(filteredOffers.map((o: any) => o.id));
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                            isOffersSelectionMode && selectedOffers.length === filteredOffers.length && filteredOffers.length > 0 ? "bg-gold text-black" : "text-white/40 hover:text-white"
                          )}
                          title="Select All"
                        >
                          <CheckCheck size={14} />
                          <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">All</span>
                        </button>
                      </div>

                      <div className="relative flex-1 w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                        <input
                          type="text"
                          placeholder="Search standard and special offers..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-black/40 border border-white/15 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-gold/50 transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {selectedOffers.length > 0 && (
                        <div className="flex items-center gap-2 mr-2 animate-in fade-in zoom-in duration-200">
                          <span className="text-[10px] uppercase tracking-widest font-bold text-gold px-2">
                            {selectedOffers.length} Selected
                          </span>
                          <button
                            onClick={() => executeBulkUpdateOffersStatus(selectedOffers, true)}
                            className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                            title="Activate Selected"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => executeBulkUpdateOffersStatus(selectedOffers, false)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white transition-all"
                            title="Deactivate Selected"
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            onClick={handleBulkDuplicateOffers}
                            className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                            title="Duplicate Selected"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: 'bulk-offers', ids: selectedOffers })}
                            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            title="Delete Selected"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                        <button
                          onClick={() => setOfferViewMode('grid')}
                          className={cn(
                            "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                            offerViewMode === 'grid'
                              ? "bg-gold text-black shadow-lg"
                              : "text-white/40 hover:text-white hover:bg-white/5"
                          )}
                          title="Grid View"
                        >
                          <LayoutGrid size={14} />
                        </button>
                        <button
                          onClick={() => setOfferViewMode('list')}
                          className={cn(
                            "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                            offerViewMode === 'list'
                              ? "bg-gold text-black shadow-lg"
                              : "text-white/40 hover:text-white hover:bg-white/5"
                          )}
                          title="List View"
                        >
                          <List size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {offerViewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredOffers.length > 0 ? (
                        filteredOffers.map((offer) => (
                          <div key={offer.id} className={cn("glass rounded-2xl overflow-hidden border transition-all flex flex-col group relative", selectedOffers.includes(offer.id) ? "border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "border-white/5 hover:border-gold/30")}>

                            <div className="h-40 relative">
                              <img
                                src={offer.image || 'https://picsum.photos/seed/offer/600/300'}
                                alt={offer.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent" />

                              {/* Top bar: tags left, active badge right */}
                              <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-3 pt-2">

                                {/* Left side: tags */}
                                <div className="flex items-center gap-2 flex-wrap">
                                  <div className="flex flex-wrap gap-1">
                                    {offer.tags?.map((tag: string, tIdx: number) => (
                                      <span
                                        key={`${offer.id}-tag-${tag}-${tIdx}`}
                                        className="px-2 py-1 rounded bg-gold text-black text-[8px] font-black uppercase shadow-sm"
                                      >
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                </div>

                                {/* Right side: Active/Inactive badge */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "px-3 py-1 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest shadow-lg -mr-3 -mt-2",
                                      offer.active ? "bg-green-700 text-white" : "bg-red-700 text-white"
                                    )}
                                  >
                                    {offer.active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              </div>

                              {/* Title and price bottom-left */}
                              <div className="absolute bottom-4 left-4">
                                <p className="text-xl font-display">{offer.title}</p>
                                {(() => {
                                  const prices = (offer.fleets || [])
                                    .map((f: any) => Number(f.salePrice))
                                    .filter((p: number) => !isNaN(p));
                                  const min = prices.length ? Math.min(...prices) : 0;
                                  const max = prices.length ? Math.max(...prices) : 0;
                                  return (
                                    <p className="text-gold font-bold text-sm">
                                      {min === max ? `$${min}` : `$${min} - $${max}`}
                                    </p>
                                  );
                                })()}
                              </div>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                              <p className="text-white/60 text-[10px] line-clamp-2 mb-4 italic">"{offer.description}"</p>
                              <div className="mt-auto flex items-center gap-2">
                                {isOffersSelectionMode && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (selectedOffers.includes(offer.id))
                                        setSelectedOffers((prev) => prev.filter((id) => id !== offer.id));
                                      else
                                        setSelectedOffers((prev) => [...prev, offer.id]);
                                    }}
                                    className={cn(
                                      "flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                                      selectedOffers.includes(offer.id) ? "bg-gold text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                                    )}
                                    title={selectedOffers.includes(offer.id) ? "Deselect" : "Select"}
                                  >
                                    {selectedOffers.includes(offer.id) ? <SquareCheck size={16} /> : <Square size={16} />}
                                  </button>
                                )}
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleToggleOfferStatus(offer.id, offer.active); }}
                                  className={cn("flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1", offer.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white" : "bg-green-500/10 text-green-500 hover:bg-green-500/50 hover:text-white")}
                                  title={offer.active ? "Deactivate" : "Activate"}
                                >
                                  {offer.active ? <Ban size={16} /> : <CheckCircle size={16} />}
                                </button>
                                <button
                                  onClick={() => handleDuplicateOffer(offer)}
                                  className="flex-1 py-2 px-2 bg-gold/10 text-gold hover:bg-gold/50 hover:text-white rounded-lg font-bold transition-all flex items-center justify-center gap-1"
                                  title="Duplicate"
                                >
                                  <Copy size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingOffer(offer);
                                    setShowOfferModal(true);
                                  }}
                                  className="flex-1 py-2 px-2 bg-blue-500/10 text-blue-500 hover:bg-blue-500/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteOffer(offer.id)}
                                  className="flex-1 py-2 px-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                          <p className="text-white/40 italic">No offers found.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass rounded-[0.5rem] border border-white/5 overflow-hidden">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold w-16">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold min-w-[250px]">Offer Details</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold">Discount</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold">Price Range</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredOffers.length > 0 ? (
                              filteredOffers.map((offer) => {
                                const prices = (offer.fleets || []).map((f: any) => Number(f.salePrice)).filter((p: number) => !isNaN(p));
                                const min = prices.length ? Math.min(...prices) : 0;
                                const max = prices.length ? Math.max(...prices) : 0;
                                return (
                                  <tr key={`list-offer-${offer.id}`} className={cn("transition-colors group", selectedOffers.includes(offer.id) ? "bg-gold/5" : "hover:bg-white/5")}>
                                    <td className="px-6 py-4">
                                      <span className={cn(
                                        "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest",
                                        offer.active ? "bg-green-500 text-white" : "bg-red-500 text-white"
                                      )}>
                                        {offer.active ? 'Active' : 'Inactive'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <img src={offer.image || 'https://picsum.photos/seed/offer/60/60'} alt={offer.title} className="w-12 h-12 rounded-lg object-cover" />
                                        <div>
                                          <p className="text-sm font-bold text-white mb-0.5">{offer.title}</p>
                                          <p className="text-[10px] text-white/50 line-clamp-1">"{offer.description}"</p>
                                          <div className="flex gap-1 mt-1">
                                            {offer.tags?.slice(0, 3).map((tag: string, tIdx: number) => (
                                              <span key={`${offer.id}-list-tag-${tag}-${tIdx}`} className="text-[8px] bg-gold/10 text-gold px-1 rounded uppercase tracking-widest">
                                                {tag}
                                              </span>
                                            ))}
                                            {(offer.tags?.length || 0) > 3 && <span className="text-[8px] text-white/40">...</span>}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4">
                                      {offer.discountType === 'percentage'
                                        ? <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-bold">{offer.discountValue}% OFF</span>
                                        : <span className="px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs font-bold">${offer.discountValue} OFF</span>}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-sm">
                                      {min === max ? `$${min}` : `$${min} - $${max}`}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex items-center gap-2 justify-end transition-opacity">
                                        {isOffersSelectionMode && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (selectedOffers.includes(offer.id)) setSelectedOffers(prev => prev.filter(id => id !== offer.id));
                                              else setSelectedOffers(prev => [...prev, offer.id]);
                                            }}
                                            className={cn(
                                              "p-2 rounded-lg transition-all border",
                                              selectedOffers.includes(offer.id) ? "bg-gold text-black border-gold" : "bg-white/5 text-white/40 hover:text-white border-white/10"
                                            )}
                                            title={selectedOffers.includes(offer.id) ? "Deselect" : "Select"}
                                          >
                                            {selectedOffers.includes(offer.id) ? <SquareCheck size={14} /> : <Square size={14} />}
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleToggleOfferStatus(offer.id, offer.active); }}
                                          className={cn("p-2 rounded-lg transition-all border", offer.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white border-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border-green-500/20")}
                                          title={offer.active ? "Deactivate" : "Activate"}
                                        >
                                          {offer.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                                        </button>
                                        <button
                                          onClick={() => handleDuplicateOffer(offer)}
                                          className="p-2 bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-black rounded-lg transition-all"
                                          title="Duplicate"
                                        >
                                          <Copy size={14} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingOffer(offer);
                                            setShowOfferModal(true);
                                          }}
                                          className="p-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                          title="Edit"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteOffer(offer.id)}
                                          className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                          title="Delete"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-white/40 italic">
                                  No offers found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tours Section */}
                <div className="space-y-6 pt-12 border-t border-white/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-2xl font-display text-gold flex items-center gap-3">
                        Tours Management
                      </h3>
                      <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage luxury private tours</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          setCsvImportType('tours');
                          setShowCsvImportModal(true);
                        }}
                        className="bg-white/5 border border-white/10 hover:border-gold/50 text-white/60 hover:text-white px-4 py-2 rounded-xl transition-all flex items-center gap-2"
                      >
                        <Upload size={16} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Import CSV</span>
                      </button>
                      <button
                        onClick={() => {
                          setEditingTour({ title: '', description: '', price: 0, image: '', active: true, slug: '', duration: '', capacity: 0, locations: [] });
                          setShowTourModal(true);
                        }}
                        className="bg-gold text-black hover:bg-gold/80 px-6 py-2 rounded-xl flex items-center gap-2 transition-all"
                      >
                        <Plus size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Add Tour</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex flex-1 items-center gap-4">
                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setIsToursSelectionMode(false);
                            setSelectedTours([]);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                            !isToursSelectionMode ? "bg-white/10 text-white" : "text-white/40 hover:text-white"
                          )}
                          title="None (Selection Mode OFF)"
                        >
                          <CircleX size={14} />
                          <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">None</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsToursSelectionMode(true);
                            if (selectedTours.length === filteredTours.length) {
                              setSelectedTours([]);
                            }
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                            isToursSelectionMode && selectedTours.length < filteredTours.length ? "bg-gold text-black" : "text-white/40 hover:text-white"
                          )}
                          title="Selection Mode ON"
                        >
                          <Check size={14} />
                          <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">Select</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsToursSelectionMode(true);
                            setSelectedTours(filteredTours.map((t: any) => t.id));
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2",
                            isToursSelectionMode && selectedTours.length === filteredTours.length && filteredTours.length > 0 ? "bg-gold text-black" : "text-white/40 hover:text-white"
                          )}
                          title="Select All"
                        >
                          <CheckCheck size={14} />
                          <span className="hidden md:inline text-[10px] uppercase font-black tracking-widest">All</span>
                        </button>
                      </div>

                      <div className="relative flex-1 w-full sm:max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={16} />
                        <input
                          type="text"
                          placeholder="Search luxury tours..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-black/40 border border-white/15 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-gold/50 transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white transition-colors"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {selectedTours.length > 0 && (
                        <div className="flex items-center gap-2 mr-2 animate-in fade-in zoom-in duration-200">
                          <span className="text-[10px] uppercase tracking-widest font-bold text-gold px-2">
                            {selectedTours.length} Selected
                          </span>
                          <button
                            onClick={() => executeBulkUpdateToursStatus(selectedTours, true)}
                            className="p-2 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-all"
                            title="Activate Selected"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button
                            onClick={() => executeBulkUpdateToursStatus(selectedTours, false)}
                            className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white transition-all"
                            title="Deactivate Selected"
                          >
                            <Ban size={16} />
                          </button>
                          <button
                            onClick={handleBulkDuplicateTours}
                            className="p-2 bg-white/5 text-gold rounded-lg hover:bg-gold hover:text-black transition-all"
                            title="Duplicate Selected"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete({ type: 'bulk-tours', ids: selectedTours })}
                            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all"
                            title="Delete Selected"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}

                      <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                        <button
                          onClick={() => setToursLayout('grid')}
                          className={cn(
                            "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                            toursLayout === 'grid'
                              ? "bg-gold text-black shadow-lg"
                              : "text-white/40 hover:text-white hover:bg-white/5"
                          )}
                          title="Grid View"
                        >
                          <LayoutGrid size={14} />
                        </button>
                        <button
                          onClick={() => setToursLayout('list')}
                          className={cn(
                            "p-1.5 rounded-lg transition-all flex items-center justify-center min-w-[40px]",
                            toursLayout === 'list'
                              ? "bg-gold text-black shadow-lg"
                              : "text-white/40 hover:text-white hover:bg-white/5"
                          )}
                          title="List View"
                        >
                          <List size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {toursLayout === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTours.length > 0 ? (
                        filteredTours.map((tour) => {
                          let isActive = tour.active;
                          if (tour.availability?.endDate) {
                            const endDate = new Date(tour.availability.endDate);
                            if (endDate < new Date(new Date().setHours(0, 0, 0, 0))) {
                              isActive = false;
                            }
                          }

                          // Calculate price range
                          const prices = tour.fleets?.map((f: any) => Number(f.salePrice || f.standardPrice || f.price || 0)).filter((p: number) => p > 0) || [];
                          const minPrice = prices.length > 0 ? Math.min(...prices) : tour.price || 0;
                          const maxPrice = prices.length > 0 ? Math.max(...prices) : tour.price || 0;
                          const priceDisplay = prices.length > 0 && minPrice !== maxPrice ? `$${minPrice} - $${maxPrice}` : `$${minPrice}`;

                          return (
                            <div key={tour.id} className={cn("glass rounded-2xl overflow-hidden border transition-all flex flex-col group relative", selectedTours.includes(tour.id) ? "border-gold shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "border-white/5 hover:border-gold/30")}>
                              <div className="relative h-40 group rounded overflow-hidden shadow-lg">
                                {/* Background image */}
                                <img
                                  src={tour.image || "https://picsum.photos/seed/tour/600/300"}
                                  alt={tour.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent backdrop-blur-[1px]" />

                                {/* Top-left: promo tag */}
                                <div className="absolute top-2 left-3 z-10 flex items-center gap-2 flex-wrap">
                                  {tour.promoTag && (
                                    <span className="px-2 py-1 rounded bg-gold text-black text-[8px] font-black uppercase shadow-sm">
                                      {tour.promoTag}
                                    </span>
                                  )}
                                </div>

                                {/* Top-right: Active/Inactive badge */}
                                <div className="absolute top-0 right-0 z-20 flex items-center gap-2">
                                  <span
                                    className={cn(
                                      "px-3 py-1 rounded-bl-2xl text-[9px] font-black uppercase tracking-widest shadow-lg",
                                      isActive ? "bg-green-700 text-white" : "bg-red-700 text-white"
                                    )}
                                  >
                                    {isActive ? "Active" : !tour.active ? "Inactive" : "Expired"}
                                  </span>
                                </div>

                                {/* Bottom-left: Title + duration + price */}
                                <div className="absolute bottom-4 left-4 right-4">
                                  <p className="text-xl font-display drop-shadow-md">{tour.title}</p>
                                  <div className="flex items-center gap-3 text-[10px] text-white/70 uppercase tracking-widest font-bold">
                                    {tour.duration && (
                                      <span className="flex items-center gap-1">
                                        <Clock size={10} /> {tour.duration}
                                      </span>
                                    )}
                                    {priceDisplay && (
                                      <span className="flex items-center gap-1 font-display text-gold font-normal">
                                        From {priceDisplay}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="p-4 flex-1 flex flex-col">
                                <p className="text-white/60 text-[10px] line-clamp-2 mb-4 italic">"{tour.shortDescription || tour.description || 'No description available.'}"</p>
                                <div className="mt-auto flex items-center gap-2">
                                  {isToursSelectionMode && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (selectedTours.includes(tour.id))
                                          setSelectedTours((prev) => prev.filter((id) => id !== tour.id));
                                        else
                                          setSelectedTours((prev) => [...prev, tour.id]);
                                      }}
                                      className={cn(
                                        "flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1",
                                        selectedTours.includes(tour.id) ? "bg-gold text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                                      )}
                                      title={selectedTours.includes(tour.id) ? "Deselect" : "Select"}
                                    >
                                      {selectedTours.includes(tour.id) ? <SquareCheck size={16} /> : <Square size={16} />}
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleToggleTourStatus(tour.id, tour.active); }}
                                    className={cn("flex-1 py-2 px-2 font-bold rounded-lg transition-all flex items-center justify-center gap-1", tour.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white" : "bg-green-500/10 text-green-500 hover:bg-green-500/50 hover:text-white")}
                                    title={tour.active ? "Deactivate" : "Activate"}
                                  >
                                    {tour.active ? <Ban size={16} /> : <CheckCircle size={16} />}
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateTour(tour)}
                                    className="flex-1 py-2 px-2 bg-gold/10 text-gold hover:bg-gold/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                                    title="Duplicate"
                                  >
                                    <Copy size={14} />
                                  </button>

                                  <button
                                    onClick={() => {
                                      setEditingTour(tour);
                                      setShowTourModal(true);
                                    }}
                                    className="flex-1 py-2 px-2 bg-blue-600/10 text-blue-500 font-bold hover:bg-blue-500/50 hover:text-white rounded-lg transition-all flex items-center justify-center gap-1"
                                    title="Edit"
                                  >
                                    <Edit2 size={14} />
                                  </button>

                                  <button
                                    onClick={() => handleDeleteTour(tour.id)}
                                    className="flex-1 py-2 px-2 bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1"
                                    title="Delete"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <div className="col-span-full py-12 text-center bg-white/5 rounded-2xl border border-dashed border-white/10">
                          <p className="text-white/40 italic">No tours found.</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="glass rounded-[0.5rem] border border-white/5 overflow-hidden">
                      <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                          <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold w-16">Status</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold min-w-[250px]">Tour Details</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold pt-4">Start Place</th>
                              <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gold text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredTours.length > 0 ? (
                              filteredTours.map((tour) => {
                                let isActive = tour.active;
                                if (tour.availability?.endDate) {
                                  const endDate = new Date(tour.availability.endDate);
                                  if (endDate < new Date(new Date().setHours(0, 0, 0, 0))) {
                                    isActive = false;
                                  }
                                }
                                const prices = tour.fleets?.map((f: any) => Number(f.salePrice || f.standardPrice || f.price || 0)).filter((p: number) => p > 0) || [];
                                const minPrice = prices.length > 0 ? Math.min(...prices) : tour.price || 0;
                                const maxPrice = prices.length > 0 ? Math.max(...prices) : tour.price || 0;
                                const priceDisplay = prices.length > 0 && minPrice !== maxPrice ? `$${minPrice} - $${maxPrice}` : `$${minPrice}`;

                                return (
                                  <tr key={`list-tour-${tour.id}`} className={cn("transition-colors group", selectedTours.includes(tour.id) ? "bg-gold/5" : "hover:bg-white/5")}>
                                    <td className="px-6 py-4">
                                      <span className={cn(
                                        "px-2 py-1 rounded text-[8px] font-bold uppercase tracking-widest",
                                        isActive ? "bg-green-500 text-white" : "bg-red-500 text-white"
                                      )}>
                                        {isActive ? 'Active' : (!tour.active ? 'Inactive' : 'Expired')}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="flex items-center gap-3">
                                        <img src={tour.image || 'https://picsum.photos/seed/tour/60/60'} alt={tour.title} className="w-12 h-12 rounded-lg object-cover" />
                                        <div>
                                          <p className="text-sm font-bold text-white mb-0.5 flex items-center gap-2">
                                            {tour.title}
                                            {tour.promoTag && (
                                              <span className="bg-gold text-black px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest shadow-lg inline-block">
                                                {tour.promoTag}
                                              </span>
                                            )}
                                          </p>
                                          <p className="text-[10px] text-white/50 line-clamp-1">"{tour.shortDescription || tour.description || 'No description available.'}"</p>
                                          <div className="flex gap-3 mt-1 text-[9px] text-white/40 uppercase tracking-widest">
                                            <span className="flex items-center gap-1"><Clock size={10} /> {tour.duration}</span>
                                            <span className="flex items-center gap-1 font-display text-gold font-normal">From {priceDisplay}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-mono text-white/80">
                                      {tour.startPlace || 'Not Specified'}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex items-center gap-2 justify-end transition-opacity">
                                        {isToursSelectionMode && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (selectedTours.includes(tour.id)) setSelectedTours(prev => prev.filter(id => id !== tour.id));
                                              else setSelectedTours(prev => [...prev, tour.id]);
                                            }}
                                            className={cn(
                                              "p-2 rounded-lg transition-all border",
                                              selectedTours.includes(tour.id) ? "bg-gold text-black border-gold" : "bg-white/5 text-white/40 hover:text-white border-white/10"
                                            )}
                                            title={selectedTours.includes(tour.id) ? "Deselect" : "Select"}
                                          >
                                            {selectedTours.includes(tour.id) ? <SquareCheck size={14} /> : <Square size={14} />}
                                          </button>
                                        )}
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleToggleTourStatus(tour.id, tour.active); }}
                                          className={cn("p-2 rounded-lg transition-all border", tour.active ? "bg-red-500/10 text-red-500 hover:bg-red-500/50 hover:text-white border-red-500/20" : "bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white border-green-500/20")}
                                          title={tour.active ? "Deactivate" : "Activate"}
                                        >
                                          {tour.active ? <Ban size={14} /> : <CheckCircle size={14} />}
                                        </button>
                                        <button
                                          onClick={() => handleDuplicateTour(tour)}
                                          className="p-2 bg-gold/10 text-gold border border-gold/20 hover:bg-gold hover:text-black rounded-lg transition-all"
                                          title="Duplicate"
                                        >
                                          <Copy size={14} />
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingTour(tour);
                                            setShowTourModal(true);
                                          }}
                                          className="p-2 bg-blue-600/10 text-blue-500 border border-blue-500/20 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                          title="Edit"
                                        >
                                          <Edit2 size={14} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteTour(tour.id)}
                                          className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                          title="Delete"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr>
                                <td colSpan={5} className="py-12 text-center text-white/40 italic">
                                  No tours found.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeSubTab === 'config' && (
              <div className="space-y-8">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                              <div className="flex items-center gap-2 text-blue-600">
                                <Users size={14} />
                                <span className="text-xs font-bold text-white/40">{v.pax}</span>
                              </div>
                              <div className="flex items-center gap-2 text-gold">
                                <Luggage size={14} />
                                <span className="text-xs font-bold text-white/40">{v.bags}</span>
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
                                setEditingVehicle({ ...v, id: 'new' });
                                setShowVehicleModal(true);
                              }}
                              className="p-3 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                              title="Duplicate"
                            >
                              <Copy size={18} />
                            </button>
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
                <hr className="border-white/10 my-6" />
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
                              setEditingExtra({ ...e, id: 'new' });
                              setShowExtraModal(true);
                            }}
                            className="p-2 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
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
                <hr className="border-white/10 my-6" />
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
                                    key={`${c.id}-${service}`}
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
                              const { id, ...couponData } = c;
                              setEditingCoupon({ ...couponData, code: c.code + '-COPY' });
                              setShowCouponModal(true);
                            }}
                            className="p-2 bg-white/5 text-gold rounded-xl hover:bg-gold hover:text-black transition-all"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
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
                <hr className="border-white/10 my-6" />
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

                      {/* Gross Price toggle */}
                      <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                        <div>
                          <p className="text-sm font-bold">Show Gross Price</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">
                            Subtotal before discounts
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setSystemSettings({
                              ...systemSettings,
                              showGrossPrice: !systemSettings?.showGrossPrice,
                            })
                          }
                          className={cn(
                            "w-12 h-6 rounded-full transition-all relative",
                            systemSettings?.showGrossPrice !== false ? "bg-gold" : "bg-white/10"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                              systemSettings?.showGrossPrice !== false ? "right-1" : "left-1"
                            )}
                          />
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
                              { id: "showWaypointPrice", label: "Waypoint Price" },
                              { id: "showExtrasPrice", label: "Extras Price" },
                              { id: "showTax", label: "Tax" },
                              { id: "showDiscount", label: "Discount" },
                              { id: "showNetPrice", label: "Net Price" },
                              { id: "showGrossPrice", label: "Gross Price" },
                              { id: "showStripeFees", label: "Stripe Fees" },
                              { id: "showTotalPrice", label: "Total Price" },
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
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">
                            Waypoint Limit (Count)
                          </label>
                          <input
                            type="number"
                            value={systemSettings?.waypointLimit || 5}
                            onChange={(e) =>
                              setSystemSettings({
                                ...systemSettings,
                                waypointLimit: parseInt(e.target.value),
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

                    {/* Distance Calculation Settings */}
                    <div className="space-y-6">
                      <h4 className="text-xs uppercase tracking-widest font-bold text-white/40 border-b border-white/5 pb-2">
                        Distance Calculation Settings
                      </h4>

                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                        <div className="border-b border-white/10 space-y-3 pb-3">
                          <div>
                            <p className="text-sm font-bold">Calculation Type</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">
                              How distance price is calculated
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSystemSettings({ ...systemSettings, distanceCalculationType: 'type1' })}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                systemSettings?.distanceCalculationType !== 'type2'
                                  ? "bg-gold text-black border-gold"
                                  : "bg-white/5 text-white/40 border-white/10 hover:border-white/30"
                              )}
                            >
                              Type 1 (Range)
                            </button>
                            <button
                              onClick={() => setSystemSettings({ ...systemSettings, distanceCalculationType: 'type2' })}
                              className={cn(
                                "flex-1 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border",
                                systemSettings?.distanceCalculationType === 'type2'
                                  ? "bg-gold text-black border-gold"
                                  : "bg-white/5 text-white/40 border-white/10 hover:border-white/30"
                              )}
                            >
                              Type 2 (Cumulative)
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold">Show Distance Eye Icon</p>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">
                              Allow users to see breakdown
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              setSystemSettings({
                                ...systemSettings,
                                showDistanceEyeIcon: !systemSettings?.showDistanceEyeIcon,
                              })
                            }
                            className={cn(
                              "w-12 h-6 rounded-full transition-all relative",
                              systemSettings?.showDistanceEyeIcon ? "bg-gold" : "bg-white/10"
                            )}
                          >
                            <div
                              className={cn(
                                "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                                systemSettings?.showDistanceEyeIcon ? "right-1" : "left-1"
                              )}
                            />
                          </button>
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
          <div className="space-y-8 w-full max-w-4xl mx-auto">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-display text-gold">Profile Settings</h3>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">Manage your account and security</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Card */}
              <div className="lg:col-span-1 border border-white/5 rounded-3xl overflow-hidden bg-white/5 h-fit">
                <div className={cn(
                  "h-24 relative",
                  userProfile?.role === 'admin' ? "bg-red-500/20" :
                    userProfile?.role === 'driver' ? "bg-blue-500/20" : "bg-gold/20"
                )}>
                  {/* Decorative background element */}
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                    {userProfile?.role === 'admin' ? <Shield size={80} /> :
                      userProfile?.role === 'driver' ? <Car size={80} /> : <User size={80} />}
                  </div>
                </div>
                <div className="px-6 pb-6 -mt-10 relative">
                  <div className={cn(
                    "w-20 h-20 rounded-2xl flex items-center justify-center border-4 border-black mb-4",
                    userProfile?.role === 'admin' ? "bg-red-500 text-white" :
                      userProfile?.role === 'driver' ? "bg-blue-500 text-white" : "bg-gold text-black"
                  )}>
                    {userProfile?.role === 'admin' ? <Shield size={32} /> :
                      userProfile?.role === 'driver' ? <Car size={32} /> : <User size={32} />}
                  </div>
                  <h4 className="text-lg font-bold text-white">{userProfile?.name || 'User'}</h4>
                  <p className="text-xs text-white/40 mb-4">{user?.email}</p>

                  <div className="flex flex-wrap gap-2">
                    <span className={cn(
                      "text-[10px] uppercase font-bold px-3 py-1 rounded-full",
                      userProfile?.role === 'admin' ? "bg-red-500/10 text-red-500" :
                        userProfile?.role === 'driver' ? "bg-blue-500/10 text-blue-500" : "bg-gold/10 text-gold"
                    )}>
                      {userProfile?.role}
                    </span>
                    <span className="text-[10px] bg-white/5 text-white/40 px-3 py-1 rounded-full uppercase font-bold">
                      Account Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Settings Forms */}
              <div className="lg:col-span-2 space-y-6">
                <div className="glass p-8 rounded-3xl border border-white/5">
                  <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6">Personal Details</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Full Name</label>
                        <input
                          type="text"
                          value={profileName}
                          onChange={(e) => setProfileName(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          placeholder="Your Name"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Phone Number</label>
                        <input
                          type="tel"
                          value={profilePhone}
                          onChange={(e) => setProfilePhone(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          placeholder="+61 ..."
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Address</label>
                      <input
                        type="text"
                        value={profileAddress}
                        onChange={(e) => setProfileAddress(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder="Street Address, Suburb, City"
                      />
                    </div>
                  </div>
                </div>

                <div className="glass p-8 rounded-3xl border border-white/5">
                  <h4 className="text-sm font-bold text-gold uppercase tracking-widest mb-6">Security</h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">New Password</label>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 block">Confirm Password</label>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-white/20 italic">
                      Leave password fields blank if you don't want to change your password.
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleUpdateProfile}
                  disabled={isUpdatingProfile}
                  className="w-full bg-gold text-black py-4 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUpdatingProfile ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Updating Account...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Profile Settings</span>
                    </>
                  )}
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
                  <div key={`wallet-hist-${booking.id}`} className="glass p-4 rounded-xl flex items-center justify-between">
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

  const filteredOffers = (offers || []).filter((o: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      o.title?.toLowerCase().includes(q) ||
      o.description?.toLowerCase().includes(q) ||
      o.slug?.toLowerCase().includes(q)
    );
  });

  const filteredTours = (tours || []).filter((t: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title?.toLowerCase().includes(q) ||
      t.shortDescription?.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.slug?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col min-h-screen bg-black text-white overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="bg-black/50 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
        <div className="p-4 lg:px-8 lg:py-4 flex flex-col gap-4">
          {/* Top Row: Logo & User Actions */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
              {/* Heading always visible, smaller on mobile */}
              <h1 className="text-xs sm:text-sm lg:text-base font-display font-bold tracking-[0.15em] text-white/90 text-center sm:text-left">
                {isAdmin ? 'Admin Dashboard' : isDriver ? 'Driver Dashboard' : 'Customer Dashboard'}
              </h1>
            </div>

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
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">
                    {userProfile?.role === 'admin' ? 'Administrator' : userProfile?.role === 'driver' ? 'Verified Driver' : 'Valued Customer'}
                  </p>
                </div>
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center
                    ${isAdmin ? 'bg-red-500/10 border border-red-500/20' :
                      isDriver ? 'bg-blue-500/10 border border-blue-500/20' :
                        'bg-gold/10 border border-gold/20'}`}
                >
                  {isAdmin ? (
                    <Shield size={18} className="text-red-600" />
                  ) : isDriver ? (
                    <Truck size={18} className="text-blue-600" />
                  ) : (
                    <User size={18} className="text-gold" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <main className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto">
          {/* Navigation Tabs - Relocated from Header */}
          <div className="w-full mb-8">
            <nav className="flex items-center w-full bg-white/5 p-1 rounded-2xl border border-white/5">
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
        {showMediaModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-6 md:p-8 rounded-sm text-center border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">Upload Media</h3>
                <button onClick={() => {
                  setShowMediaModal(false);
                  setMediaFile(null);
                }} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4 text-left">
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Folder (Required)</label>
                  <select
                    value={mediaFolder}
                    onChange={(e) => setMediaFolder(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white/70 custom-select"
                  >
                    <option value="general">General</option>
                    <option value="blog">Blog</option>
                    <option value="offers">Offers</option>
                    <option value="tours">Tours</option>
                    <option value="pages">Pages</option>
                    <option value="new">-- Add New Folder --</option>
                  </select>
                </div>
                {mediaFolder === 'new' && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">New Folder Name (Required)</label>
                    <input
                      type="text"
                      value={newFolder}
                      onChange={(e) => setNewFolder(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Folder Name"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">File (Required)</label>
                  <input
                    type="file"
                    onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all text-white/70"
                  />
                  {mediaFile && (
                    <div className="mt-2 text-[10px] text-white/50 flex items-center gap-2 bg-white/5 p-2 rounded-lg">
                      <Image size={12} className="text-gold" />
                      <span className="truncate flex-1">{mediaFile.name}</span>
                      <span>({(mediaFile.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Title (Optional)</label>
                  <input
                    type="text"
                    value={editingMedia.title}
                    onChange={(e) => setEditingMedia({ ...editingMedia, title: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Image Title"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Alt Text (Optional)</label>
                  <input
                    type="text"
                    value={editingMedia.alt}
                    onChange={(e) => setEditingMedia({ ...editingMedia, alt: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Alt attribute for SEO"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Caption (Optional)</label>
                  <input
                    type="text"
                    value={editingMedia.caption}
                    onChange={(e) => setEditingMedia({ ...editingMedia, caption: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Visible caption"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Description (Optional)</label>
                  <textarea
                    value={editingMedia.description}
                    onChange={(e) => setEditingMedia({ ...editingMedia, description: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm outline-none focus:border-gold transition-all resize-none h-24"
                    placeholder="Internal description"
                  />
                </div>

                <button
                  disabled={uploadingMedia || (mediaFolder === 'new' && !newFolder)}
                  onClick={() => {
                    const finalFolder = mediaFolder === 'new' ? newFolder : mediaFolder;
                    if (editingMedia.id) {
                      handleUpdateMedia(editingMedia.id, editingMedia);
                    } else if (mediaFile && finalFolder) {
                      uploadMedia(mediaFile, editingMedia, finalFolder);
                    } else {
                      alert('Please select a file and folder');
                    }
                  }}
                  className="w-full btn-primary py-4 rounded-xl flex items-center justify-center gap-3 transition-all relative overflow-hidden group mt-4 mb-2"
                >
                  <div className="absolute inset-0 bg-gold/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"></div>
                  {uploadingMedia ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">Processing...</span>
                    </>
                  ) : (
                    <>
                      {editingMedia.id ? <Save size={18} /> : <Upload size={18} />}
                      <span className="text-xs font-bold uppercase tracking-[0.2em]">
                        {editingMedia.id ? 'Save Changes' : 'Confirm Upload'}
                      </span>
                    </>
                  )}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}

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

                {/* Clear option */}
                <button
                  onClick={() => setRatingValue(0)}
                  className="ml-4 px-2 py-1 text-[10px] font-bold uppercase rounded-lg 
               bg-white/5 text-white/50 hover:text-gold hover:bg-gold/10 transition-all"
                  title="Clear Rating"
                >
                  Clear
                </button>
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
                  onClick={() => handleRateDriver(ratingBooking.id, ratingValue, ratingComment)}
                  className="flex-1 bg-gold text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
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
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md glass p-4 md:p-8 rounded-sm border border-gold/20 max-h-[95vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar"
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
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Customer Name</label>
                    <input
                      type="text"
                      value={editingBooking?.customerName || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, customerName: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Phone</label>
                    <input
                      type="tel"
                      value={editingBooking?.customerPhone || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, customerPhone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
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
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Pickup Location</label>
                    <input
                      type="text"
                      value={editingBooking?.pickup || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, pickup: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Dropoff Location</label>
                    <input
                      type="text"
                      value={editingBooking?.dropoff || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, dropoff: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Additional Info</label>
                  <textarea
                    value={editingBooking?.additionalInfo || ''}
                    onChange={(e) => setEditingBooking({ ...editingBooking, additionalInfo: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24 resize-none"
                    placeholder="Add any additional notes here..."
                  />
                </div>

                {isAdmin && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Admin Notes</label>
                    <textarea
                      value={editingBooking?.adminNotes || ''}
                      onChange={(e) => setEditingBooking({ ...editingBooking, adminNotes: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-20 resize-none"
                      placeholder="Private admin notes..."
                    />
                  </div>
                )}

                {isAdmin && (
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
                )}

                <div className="p-4 bg-white/5 rounded-xl border border-white/5 space-y-3">
                  <p className="text-[8px] uppercase tracking-widest font-bold text-white/30">Fixed Details (View Only)</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-[8px] text-white/40 uppercase font-bold">Service</p>
                      <p className="text-[10px] text-white/70 uppercase font-bold text-gold">{editingBooking?.serviceType}</p>
                    </div>
                    <div>
                      <p className="text-[8px] text-white/40 uppercase font-bold">Vehicle</p>
                      <p className="text-[10px] text-white/70 uppercase font-bold">{editingBooking?.vehicleType}</p>
                    </div>
                    <div className="col-span-2 pt-2 border-t border-white/5">
                      <p className="text-[8px] text-white/40 uppercase font-bold">Total Price</p>
                      <p className="text-sm text-gold font-bold">${editingBooking?.price}</p>
                    </div>
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
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg glass p-4 md:p-8 rounded-sm border border-gold/20 max-h-[95vh] md:max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">Booking Details</h3>
                <button onClick={() => { setShowViewModal(false); setShowDistanceBreakdown(false); }} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Fare Breakdown - Hidden for Drivers */}
                {(!isDriver || isAdmin) && (
                  <div className="space-y-4">
                    {/* Tour Specific Details */}
                    {viewingBooking.type === 'tour' && (
                      <div className="p-4 bg-cyan-500/5 rounded-2xl border border-cyan-500/20 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-cyan-400">Tour Details</h4>
                          <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">Experience</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white/40 uppercase tracking-widest font-bold text-[9px]">Package Name</span>
                          <span className="text-white font-bold">{viewingBooking.tourTitle || 'Custom Tour'}</span>
                        </div>
                        {viewingBooking.quantity > 1 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-white/40 uppercase tracking-widest font-bold text-[9px]">Units / Guests</span>
                            <span className="text-white font-bold">{viewingBooking.quantity}</span>
                          </div>
                        )}
                        {viewingBooking.selectedExtras && !Array.isArray(viewingBooking.selectedExtras) && Object.keys(viewingBooking.selectedExtras).length > 0 && (
                          <div className="pt-2 border-t border-white/5">
                            <p className="text-[8px] uppercase tracking-widest text-cyan-400/60 font-bold mb-2">Enhancement Selection</p>
                            <div className="space-y-1.5">
                              {Object.entries(viewingBooking.selectedExtras).map(([id, count]) => {
                                const tour = tours.find(t => t.id === viewingBooking.tourId);
                                const extra = (tour?.extras || []).find((e: any) => e.id === id);
                                return (
                                  <div key={`view-extra-${id}`} className="flex justify-between items-center text-[10px] text-white/70 bg-white/5 p-1.5 rounded-lg">
                                    <span>• {extra?.name || 'Extra'}</span>
                                    <span className="text-cyan-400 font-mono font-bold">×{count as number}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-3">
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-gold mb-2">Fare Breakdown</h4>
                      {viewingBooking.priceBreakdown ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Base Fare</span>
                            <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.base || 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-white/40 uppercase tracking-widest font-bold">{viewingBooking.serviceType === 'hourly' ? 'Hourly Charge' : 'Distance Charge'}</span>
                            </div>
                            <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.distance || 0).toFixed(2)}</span>
                          </div>
                          {viewingBooking.priceBreakdown.waypoints > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Waypoints</span>
                              <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.waypoints || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {viewingBooking.isReturn && viewingBooking.priceBreakdown.returnPrice > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Return Trip (2x)</span>
                              <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.returnPrice || 0).toFixed(2)}</span>
                            </div>
                          )}
                          {viewingBooking.priceBreakdown.discount > 0 && (
                            <div className="flex justify-between items-center text-green-400">
                              <span className="text-xs uppercase tracking-widest font-bold">Discount</span>
                              <span className="text-sm font-bold">-${(viewingBooking.priceBreakdown.discount || 0).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-white/5">
                            {/* Extras row */}
                            {viewingBooking.priceBreakdown.extras > 0 && (
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/40 uppercase tracking-widest font-bold">
                                  Extras
                                </span>
                                <span className="text-sm text-white font-bold">
                                  ${(viewingBooking.priceBreakdown.extras || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {/* Gross Price row */}
                            {systemSettings?.showGrossPrice !== false && viewingBooking.priceBreakdown.gross > 0 && (
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs text-white/40 uppercase tracking-widest font-bold">
                                  Gross Price
                                </span>
                                <span className="text-sm text-white font-bold">
                                  ${(viewingBooking.priceBreakdown.gross || 0).toFixed(2)}
                                </span>
                              </div>
                            )}

                            {/* Net Price row */}
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/60 uppercase tracking-widest font-bold">
                                Net Price
                              </span>
                              <span className="text-sm text-white font-bold">
                                ${(viewingBooking.priceBreakdown.net || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          {viewingBooking.priceBreakdown.tax > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-white/40 uppercase tracking-widest font-bold">Tax</span>
                              <span className="text-sm text-white font-bold">${(viewingBooking.priceBreakdown.tax || 0).toFixed(2)}</span>
                            </div>
                          )}
                          <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                            <span className="text-sm text-gold uppercase tracking-widest font-bold">Total Price</span>
                            <span className="text-xl font-display text-gold">${(Number(viewingBooking.price) || 0).toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gold uppercase tracking-widest font-bold">Total Price</span>
                          <span className="text-xl font-display text-gold">${(Number(viewingBooking.price) || 0).toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Distance Range Based Calculation */}
                    {isAdmin && (
                      <div className="p-4 bg-white/5 rounded-2xl border border-gold/20 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[10px] uppercase tracking-widest font-bold text-gold">
                            {viewingBooking.serviceType === 'hourly' ? 'Hourly Price Calculation' : 'Distance Range Calculation'}
                          </h4>
                          <span className="text-[8px] bg-gold/10 text-gold px-2 py-0.5 rounded font-bold uppercase">
                            {viewingBooking.serviceType === 'hourly' ? 'Fixed Hourly' : (systemSettings?.distanceCalculationType === 'type2' ? 'Type 2: Cumulative' : 'Type 1: Range Rate')}
                          </span>
                        </div>
                        {(() => {
                          const vehicle = fleet.find(v => v.id === viewingBooking.vehicleId);
                          if (!vehicle) return null;

                          const isHourly = viewingBooking.serviceType === 'hourly';
                          const distKm = parseFloat(viewingBooking.distance?.replace(/[^\d.]/g, '') || '0');
                          const rangeCalcs = [];

                          if (isHourly) {
                            rangeCalcs.push({
                              label: 'Hourly',
                              dist: viewingBooking.hours || 1,
                              rate: vehicle.hourlyPrice,
                              total: (Number(vehicle.hourlyPrice) || 0) * (viewingBooking.hours || 1),
                              isHourly: true
                            });
                          } else if (vehicle.kmRanges && vehicle.kmRanges.length > 0) {
                            if (systemSettings?.distanceCalculationType === 'type2') {
                              // Type 2: Cumulative Range Calculation
                              let previousMax = 0;
                              for (const r of vehicle.kmRanges) {
                                if (r.label.includes('+')) {
                                  const min = parseFloat(r.label.replace('+', ''));
                                  if (distKm >= min) {
                                    const balance = distKm - previousMax;
                                    rangeCalcs.push({ label: r.label, dist: balance, rate: r.surcharge, total: balance * Number(r.surcharge) });
                                    break;
                                  }
                                } else {
                                  const [min, max] = r.label.split('-').map(Number);
                                  if (distKm > max) {
                                    const segment = max - previousMax;
                                    rangeCalcs.push({ label: r.label, dist: segment, rate: r.surcharge, total: segment * Number(r.surcharge) });
                                    previousMax = max;
                                  } else if (distKm >= min && distKm <= max) {
                                    const balance = distKm - previousMax;
                                    rangeCalcs.push({ label: r.label, dist: balance, rate: r.surcharge, total: balance * Number(r.surcharge) });
                                    break;
                                  }
                                }
                              }
                            } else {
                              // Type 1: Total Distance * Rate of the range it falls into
                              let selectedRange = null;
                              for (const r of vehicle.kmRanges) {
                                if (r.label.includes('+')) {
                                  const min = parseFloat(r.label.replace('+', ''));
                                  if (distKm >= min) {
                                    selectedRange = r;
                                    break;
                                  }
                                } else {
                                  const [min, max] = r.label.split('-').map(Number);
                                  if (distKm >= min && distKm <= max) {
                                    selectedRange = r;
                                    break;
                                  }
                                }
                              }
                              if (selectedRange) {
                                rangeCalcs.push({
                                  label: selectedRange.label,
                                  dist: distKm,
                                  rate: selectedRange.surcharge,
                                  total: distKm * Number(selectedRange.surcharge)
                                });
                              }
                            }
                          }

                          if (rangeCalcs.length === 0) {
                            return <p className="text-[10px] text-white/30 uppercase tracking-widest">No range-based pricing applied</p>;
                          }

                          return (
                            <div className="space-y-2">
                              {rangeCalcs.map((calc, i) => (
                                <div key={`calc-range-${i}`} className="flex justify-between items-center text-[10px]">
                                  <div className="flex items-center gap-2">
                                    <div className="w-1 h-1 rounded-full bg-gold" />
                                    <span className="text-white font-bold uppercase tracking-tighter">{calc.label} {calc.isHourly ? '' : 'Range'}</span>
                                    <span className="text-white/40">({calc.dist.toFixed(1)} {calc.isHourly ? 'h' : 'km'} × ${calc.rate})</span>
                                  </div>
                                  <span className="text-white font-bold">${calc.total.toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                                <span className="text-[9px] text-gold font-bold uppercase tracking-widest">
                                  {viewingBooking.serviceType === 'hourly' ? 'Total Hourly Charge' : 'Total Distance Charge'}
                                </span>
                                <span className="text-xs text-gold font-bold">${rangeCalcs.reduce((acc, curr) => acc + curr.total, 0).toFixed(2)}</span>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {viewingBooking.waypoints?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Waypoints</h4>
                      <div className="space-y-2">
                        {(viewingBooking.waypoints || []).map((wp: string, idx: number) => (
                          <div key={`view-wp-${idx}`} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-start gap-3">
                            <MapPin size={12} className="text-gold mt-0.5 shrink-0" />
                            <p className="text-[10px] text-white/70">{wp}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewingBooking.selectedExtras?.length > 0 && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Selected Extras</h4>
                      <div className="flex flex-wrap gap-2">
                        {(viewingBooking.selectedExtras || []).map((extraId: string, index: number) => {
                          const extra = extras.find(e => e.id === extraId);
                          return (
                            <span key={`${extraId}-${index}`} className="px-3 py-1 bg-gold/10 border border-gold/20 rounded-full text-[10px] text-gold font-bold uppercase">
                              {extra?.name || 'Extra'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Ride Information</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">Distance (One Way)</p>
                        <p className="text-[10px] text-white font-bold">{viewingBooking.distance || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                        <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold mb-1">ETA (One Way)</p>
                        <p className="text-[10px] text-white font-bold">{viewingBooking.duration || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  {viewingBooking.flightNumber && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Flight Information</h4>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Plane size={16} className="text-gold" />
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Flight Number</p>
                            <div className="flex items-center gap-2">
                              <p className="text-sm text-white font-bold">{viewingBooking.flightNumber}</p>
                              <a
                                href={`https://www.melbourneairport.com.au/flights/departures/${viewingBooking.flightNumber}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gold hover:text-white transition-colors"
                                title="View on Melbourne Airport website"
                              >
                                <Globe size={14} />
                              </a>
                            </div>
                          </div>
                        </div>
                        {viewingBooking.flightStatus && (
                          <div className="text-right">
                            <p className="text-[8px] uppercase tracking-widest text-white/30 font-bold">Status</p>
                            <p className="text-[10px] text-gold font-bold uppercase">{viewingBooking.flightStatus}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {viewingBooking.purpose && (
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">Additional Information</h4>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                        <p className="text-xs text-white/70 leading-relaxed italic">"{viewingBooking.purpose}"</p>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => { setShowViewModal(false); setShowDistanceBreakdown(false); }}
                  className="w-full bg-gold text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                >
                  Close Details
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Route Modal */}
        {showRouteModal && routeBooking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[150] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-4xl glass p-4 md:p-8 rounded-lg md:rounded-sm border border-gold/20 overflow-y-auto custom-scrollbar flex flex-col max-h-[95vh] md:max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <div>
                  <h3 className="text-lg md:text-xl font-display text-gold">Travel Route Path</h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <span className="text-[8px] md:text-[9px] px-2 py-0.5 bg-gold/10 text-gold rounded border border-gold/20 font-bold uppercase tracking-widest">Pickup</span>
                    <p className="text-[9px] md:text-[10px] text-white/70 truncate max-w-[100px] md:max-w-[150px]">{routeBooking.pickup}</p>

                    {routeBooking.waypoints?.length > 0 && (
                      <>
                        <ArrowRight size={10} className="text-white/20" />
                        <span className="text-[8px] md:text-[9px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-400/20 font-bold uppercase tracking-widest">
                          {routeBooking.waypoints.length} Stops
                        </span>
                      </>
                    )}

                    <ArrowRight size={10} className="text-white/20" />
                    <span className="text-[8px] md:text-[9px] px-2 py-0.5 bg-green-500/10 text-green-400 rounded border border-green-500/20 font-bold uppercase tracking-widest">Dropoff</span>
                    <p className={cn("text-[9px] md:text-[10px] truncate max-w-[100px] md:max-w-[150px]", routeBooking.dropoff ? "text-white/70" : "text-white/60 italic")}>
                      {routeBooking.dropoff || (routeBooking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setShowRouteModal(false)} className="text-white/40 hover:text-white p-2">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 min-h-[250px] md:min-h-[350px] relative rounded-xl md:rounded-2xl overflow-hidden border border-white/10 mb-4 md:mb-6">
                {isLoaded ? (
                  <>
                    {isMapLoading && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="text-gold animate-spin" size={32} />
                          <p className="text-[10px] text-gold font-bold uppercase tracking-widest">Calculating Route...</p>
                        </div>
                      </div>
                    )}
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%', minHeight: '350px' }}
                      center={{ lat: -37.8136, lng: 144.9631 }}
                      zoom={12}
                      options={{
                        styles: [
                          { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
                          { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
                          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
                        ],
                        disableDefaultUI: true,
                      }}
                    >
                      {mapDirections && (
                        <DirectionsRenderer
                          options={{
                            directions: mapDirections,
                            polylineOptions: {
                              strokeColor: '#D4AF37',
                              strokeWeight: 5,
                            },
                          }}
                        />
                      )}
                      {!mapDirections && routeBooking.pickup && (
                        <Marker position={{ lat: -37.8136, lng: 144.9631 }} />
                      )}
                    </GoogleMap>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5">
                    <Loader2 className="text-gold animate-spin" size={32} />
                  </div>
                )}
              </div>

              <div className="mb-4 md:mb-6">
                <h4 className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2 md:mb-3">Orderly Route Details</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                    <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] text-gold font-bold">P</span>
                    </div>
                    <p className="text-[10px] text-white/70">{routeBooking.pickup}</p>
                  </div>

                  {routeBooking.waypoints?.map((wp: string, i: number) => (
                    <div key={`route-wp-${i}`} className="flex items-start gap-3 p-2 bg-white/5 rounded-lg border border-white/5 ml-4">
                      <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[10px] text-blue-400 font-bold">{i + 1}</span>
                      </div>
                      <p className="text-[10px] text-white/70">{wp}</p>
                    </div>
                  ))}

                  <div className="flex items-start gap-3 p-2 bg-white/5 rounded-lg border border-white/5">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-[10px] text-green-400 font-bold">D</span>
                    </div>
                    <p className={cn("text-[10px]", routeBooking.dropoff ? "text-white/70" : "text-white/60 italic")}>
                      {routeBooking.dropoff || (routeBooking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                    <Navigation size={20} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Total Distance</p>
                    <p className="text-lg font-display text-white">
                      {(() => {
                        if (!routeBooking.distance) return 'N/A';
                        if (!routeBooking.isReturn) return routeBooking.distance;
                        const num = parseFloat(routeBooking.distance.replace(/[^\d.]/g, ''));
                        return `${(num * 2).toFixed(1)} km`;
                      })()}
                    </p>
                  </div>
                </div>
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center">
                    <Clock size={20} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                      {routeBooking.serviceType === 'hourly' ? 'Selected Duration' : 'Est. Travel Time'}
                    </p>
                    <p className="text-lg font-display text-white">
                      {routeBooking.serviceType === 'hourly' ? `${routeBooking.hours} Hours` : (() => {
                        if (!routeBooking.duration) return 'N/A';
                        if (!routeBooking.isReturn) return routeBooking.duration;
                        const match = routeBooking.duration.match(/(\d+)\s*min/);
                        if (match) {
                          return `${parseInt(match[1]) * 2} mins`;
                        }
                        return routeBooking.duration;
                      })()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => setShowRouteModal(false)}
                  className="flex-1 py-4 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white border border-white/10 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const origin = encodeURIComponent(routeBooking.pickup);
                    const destination = encodeURIComponent(routeBooking.dropoff);
                    const waypoints = (routeBooking.waypoints || []).map((wp: string) => encodeURIComponent(wp)).join('|');
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
                    window.open(url, '_blank');
                  }}
                  className="flex-1 bg-gradient-to-r from-gold to-yellow-600 text-black py-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:from-white hover:to-white transition-all shadow-lg shadow-gold/20 flex items-center justify-center gap-2"
                >
                  <Navigation size={16} fill="currentColor" />
                  Start Ride
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
                      if (confirmDelete.type === 'booking') executeDeleteBooking(confirmDelete.id || '');
                      else if (confirmDelete.type === 'user') executeDeleteUser(confirmDelete.id || '');
                      else if (confirmDelete.type === 'vehicle') executeDeleteVehicle(confirmDelete.id || '');
                      else if (confirmDelete.type === 'coupon') executeDeleteCoupon(confirmDelete.id || '');
                      else if (confirmDelete.type === 'extra') executeDeleteExtra(confirmDelete.id || '');
                      else if (confirmDelete.type === 'page') executeDeletePage(confirmDelete.id || '');
                      else if (confirmDelete.type === 'blog') executeDeleteBlog(confirmDelete.id || '');
                      else if ((confirmDelete.type as string) === 'offer') executeDeleteOffer(confirmDelete.id || '');
                      else if ((confirmDelete.type as string) === 'tour') executeDeleteTour(confirmDelete.id || '');
                      else if ((confirmDelete.type as string) === 'bulk-tours') executeBulkDeleteTours(confirmDelete.ids || []);
                      else if ((confirmDelete.type as string) === 'bulk-offers') executeBulkDeleteOffers(confirmDelete.ids || []);
                      else if ((confirmDelete.type as string) === 'bulk-bookings') executeBulkDeleteBookings(confirmDelete.ids || []);
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

        {/* CSS Editor Modal */}
        <AnimatePresence>
          {showCssModal && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowCssModal(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-5xl glass p-8 rounded-xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
                onClick={e => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-display text-gold">{cssConfig.title}</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest">
                      {cssConfig.type === 'global' ? 'Applies to all CMS pages/blogs' : 'Applies to this specific item only'}
                    </p>
                  </div>
                  <button onClick={() => setShowCssModal(false)} className="p-2 hover:bg-white/5 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    {/* Status Toggle */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10">
                      <div>
                        <p className="text-sm font-bold">CSS Status</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">
                          {cssConfig.isActive ? 'Active and applying styles' : 'Inactive (styles ignored)'}
                        </p>
                      </div>
                      <button
                        onClick={() => setCssConfig({ ...cssConfig, isActive: !cssConfig.isActive })}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative",
                          cssConfig.isActive ? "bg-gold" : "bg-white/10"
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                            cssConfig.isActive ? "right-1" : "left-1"
                          )}
                        />
                      </button>
                    </div>

                    {/* Editor */}
                    <div className="space-y-2 custom-scrollbar">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">CSS Content</label>
                      <div className="relative group">
                        <textarea
                          value={cssConfig.content}
                          onChange={e => setCssConfig({ ...cssConfig, content: e.target.value })}
                          className="w-full h-80 bg-black/50 border border-white/10 rounded-2xl p-6 font-mono text-sm focus:border-gold outline-none transition-all resize-none shadow-inner"
                          placeholder=".custom-class { color: gold; }"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Code2 size={16} className="text-white/20" />
                        </div>
                      </div>
                      <p className="text-[9px] text-white/30 italic">
                        Individual CSS overwrites Global CSS. Use unique selectors to avoid conflicts.
                      </p>
                    </div>

                    <button
                      onClick={handleSaveCss}
                      disabled={cssEditingLoading}
                      className="w-full btn-primary py-4 flex items-center justify-center gap-2"
                    >
                      {cssEditingLoading ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                      <span className="text-xs font-bold uppercase tracking-widest">Save CSS Profile</span>
                    </button>
                  </div>

                  {/* Preview Section */}
                  <div className="space-y-4 flex flex-col h-full">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">SEO Live Style Preview</label>
                      <button
                        onClick={() => {
                          const slug = cssConfig.slug || cssConfig.title?.replace('CSS: ', '').toLowerCase().replace(/\s+/g, '-');
                          const prefix = cssConfig.type === 'blog' ? '/blog/' : '/';
                          window.open(`${prefix}${slug}`, '_blank');
                        }}
                        className="text-[10px] text-gold hover:text-white transition-colors flex items-center gap-1 uppercase tracking-widest font-bold"
                      >
                        <Eye size={12} />
                        View Live Site
                      </button>
                    </div>
                    <div className="flex-1 min-h-[500px] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden relative shadow-2xl">
                      <iframe
                        title="SEO Preview"
                        className="w-full h-full min-h-[500px] border-none"
                        srcDoc={`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <script src="https://cdn.tailwindcss.com"></script>
                              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
                              <script>
                                tailwind.config = {
                                  theme: {
                                    extend: {
                                      colors: {
                                        gold: '#D4AF37',
                                      },
                                      fontFamily: {
                                        display: ['Playfair Display', 'serif'],
                                        sans: ['Inter', 'sans-serif'],
                                      }
                                    }
                                  }
                                }
                              </script>
                              <style type="text/css">
                                body { 
                                  margin: 0; 
                                  padding: 0; 
                                  background: #0a0a0a; 
                                  color: white; 
                                  font-family: 'Inter', sans-serif;
                                  min-height: 100vh;
                                  overflow-x: hidden;
                                }
                                .glass { backdrop-filter: blur(12px); background: rgba(255,255,255,0.03); }
                                
                                /* Site Branding Overlays (Simplified Merlux Look) */
                                .nav-shadow { background: linear-gradient(to bottom, rgba(0,0,0,0.8), transparent); }
                                .footer-shadow { background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); }
                                
                                .content-area h1, .content-area h2, .content-area h3 { font-family: 'Playfair Display', serif; color: #D4AF37; margin-top: 1.5rem; margin-bottom: 1rem; }
                                .content-area p { margin-bottom: 1rem; line-height: 1.8; color: rgba(255,255,255,0.8); }
                                .content-area ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 1rem; color: rgba(255,255,255,0.7); }
                                .content-area strong { color: white; }

                                /* Scrollbar */
                                ::-webkit-scrollbar { width: 4px; }
                                ::-webkit-scrollbar-track { background: transparent; }
                                ::-webkit-scrollbar-thumb { background: #D4AF37; border-radius: 10px; }

                                /* Global SEO CSS */
                                ${systemSettings?.seo?.isGlobalCssActive ? systemSettings?.seo?.globalCmsCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m) => m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')) : ''}
                                
                                /* Current Active CSS (Scoped to this Preview) */
                                ${cssConfig.isActive ? cssConfig.content.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m) => m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')) : ''}
                              </style>
                            </head>
                            <body>
                              {/* Fake Site Header */}
                              <div class="nav-shadow w-full p-6 flex justify-between items-center sticky top-0 z-50">
                                <div class="text-gold font-display text-xl tracking-widest uppercase">MERLUX</div>
                                <div class="flex gap-6 text-[10px] uppercase tracking-widest font-bold text-white/60">
                                  <span>SERVICES</span>
                                  <span>FLEET</span>
                                  <span>BOOKING</span>
                                </div>
                              </div>

                              <div class="max-w-4xl mx-auto p-8 sm:p-12 space-y-12 animate-fade-in">
                                ${cssConfig.type === 'global' ? `
                                  <div class="cms-rendered-content preview-container space-y-8">
                                    <div class="space-y-4">
                                      <h1 class="preview-title text-5xl font-display text-gold leading-tight">Elite Travel Refined</h1>
                                      <p class="preview-text text-xl text-white/40 font-light max-w-2xl">
                                        This Global CSS preview showcases how your styles affect the entire Merlux CMS ecosystem. 
                                        Target classes like <span class="text-gold font-bold">.preview-title</span> or 
                                        <span class="text-gold font-bold">.preview-card</span> below.
                                      </p>
                                    </div>
                                    
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                      <div class="preview-card glass p-8 rounded-3xl border border-white/10 hover:border-gold/30 transition-all">
                                        <div class="w-12 h-12 bg-gold/10 rounded-2xl flex items-center justify-center mb-6">
                                          <div class="w-6 h-6 border-2 border-gold rounded-lg"></div>
                                        </div>
                                        <h3 class="text-xl text-white font-bold mb-3">Service Mastery</h3>
                                        <p class="text-sm text-white/50 leading-relaxed">Experience a new standard in luxury transportation across Melbourne and beyond.</p>
                                      </div>
                                      <div class="preview-card glass p-8 rounded-3xl border border-white/10">
                                        <div class="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                                          <div class="w-2 h-6 bg-white/20"></div>
                                        </div>
                                        <h3 class="text-xl text-white font-bold mb-3">Bespoke Design</h3>
                                        <p class="text-sm text-white/50 leading-relaxed">Every detail of your journey is crafted to ensure comfort, privacy, and punctuality.</p>
                                      </div>
                                    </div>

                                    <button class="preview-button w-full sm:w-auto px-12 py-5 bg-gold text-black rounded-2xl font-bold uppercase tracking-[0.2em] text-xs hover:bg-white transition-all shadow-2xl shadow-gold/20">
                                      Reserve Your Route
                                    </button>
                                  </div>
                                ` : `
                                  <div class="cms-rendered-content actual-content-preview">
                                    <div class="mb-12">
                                      <div class="flex items-center gap-3 text-[10px] text-gold uppercase tracking-[0.3em] font-bold mb-4">
                                        <span class="w-8 h-[1px] bg-gold"></span>
                                        ${cssConfig.type.toUpperCase()} PREVIEW
                                      </div>
                                      <h1 class="text-4xl sm:text-6xl font-display text-white leading-tight mb-6">
                                        ${cssConfig.title?.replace('CSS: ', '')}
                                      </h1>
                                      <div class="flex items-center gap-4 text-white/30 text-xs py-6 border-y border-white/5 uppercase tracking-widest">
                                        <span>BY Merlux Editorial</span>
                                        <span class="w-1 h-1 bg-white/10 rounded-full"></span>
                                        <span>${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                                      </div>
                                    </div>

                                    ${(cssConfig.type === 'page' || cssConfig.type === 'blog') ? `
                                      <div class="rounded-[2rem] overflow-hidden aspect-[21/9] mb-12 border border-white/10">
                                        <img src="\${cssConfig.featuredImage || (cssConfig.type === 'page' ? 'https://picsum.photos/seed/page/1200/600' : 'https://picsum.photos/seed/blog/1200/600')}" class="w-full h-full object-cover opacity-80" />
                                      </div>
                                    ` : ''}

                                    <div class="content-area text-lg text-white/80 leading-relaxed font-light">
                                      ${cssConfig.itemContent || '<p class="italic opacity-20 text-center py-20 border border-dashed border-white/10 rounded-3xl">No content available to preview. Add text in the main blog/page editor to see it here.</p>'}
                                    </div>

                                    <div class="mt-20 p-8 glass rounded-3xl border border-white/10 text-center">
                                      <h4 class="text-gold font-display text-2xl mb-4 italic">Experience the Merlux standard.</h4>
                                      <p class="text-white/40 text-[10px] uppercase tracking-widest font-bold">Professional Chauffeur Services Melbourne</p>
                                    </div>
                                  </div>
                                `}

                                <div class="mt-20 pt-8 border-t border-white/5">
                                  <p class="text-[8px] uppercase tracking-widest font-black text-gold/30 mb-2">Technical Meta Information</p>
                                  <div class="grid grid-cols-2 gap-4 text-[9px] text-white/20 font-bold uppercase tracking-widest">
                                    <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                                      TYPE: ${cssConfig.type}
                                    </div>
                                    <div class="bg-white/5 p-3 rounded-xl border border-white/5">
                                      REF: ${cssConfig.id || 'GLOBAL_ROOT'}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Fake Site Footer */}
                              <div class="footer-shadow w-full p-12 mt-20 border-t border-white/5 text-center">
                                <div class="text-gold/40 font-display text-sm tracking-widest uppercase mb-4">MERLUX LUXURY</div>
                                <p class="text-[8px] text-white/20 uppercase tracking-widest font-medium">Copyright &copy; 2026. All rights reserved.</p>
                              </div>
                            </body>
                          </html>
                        `}
                      />

                      {!cssConfig.isActive && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                          <div className="text-center p-6 glass rounded-2xl border border-white/10">
                            <Ban className="text-red-500 mx-auto mb-2" size={24} />
                            <p className="text-xs font-bold uppercase tracking-widest text-white/60">Preview Disabled</p>
                            <p className="text-[9px] text-white/30 mt-1">Activate CSS to see preview</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
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
                {!editingUser?.id && (
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Password</label>
                    <input
                      type="password"
                      value={editingUser?.password || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Min 6 characters"
                    />
                  </div>
                )}
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
                    disabled={isCreatingUser}
                    onClick={() => {
                      if (editingUser.id) {
                        handleUpdateUser(editingUser.id, editingUser);
                      } else {
                        handleCreateUser(editingUser);
                      }
                    }}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all disabled:opacity-50"
                  >
                    {isCreatingUser ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      editingUser?.id ? 'Save Changes' : 'Create User'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Extra Modal */}
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
              {/* Heading + Active toggle inline */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingExtra?.id ? 'Edit Extra' : 'Add Extra'}
                </h3>

                <div className="flex items-center gap-3">
                  {/* Active toggle inline with heading */}
                  <div className="flex items-center gap-2">
                    {/* State label with colour */}
                    <span
                      className={cn(
                        "text-[10px] font-bold uppercase transition-colors",
                        editingExtra?.active ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {editingExtra?.active ? "Active" : "Inactive"}
                    </span>

                    {/* Toggle button */}
                    <button
                      onClick={() =>
                        setEditingExtra({ ...editingExtra, active: !editingExtra.active })
                      }
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editingExtra?.active ? "bg-green-500" : "bg-red-500/40"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          editingExtra?.active ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setShowExtraModal(false)}
                    className="text-white/40 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Name
                  </label>
                  <input
                    type="text"
                    value={editingExtra?.name || ''}
                    onChange={(e) =>
                      setEditingExtra({ ...editingExtra, name: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                    placeholder="Baby Seat"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Description
                  </label>
                  <textarea
                    value={editingExtra?.description || ''}
                    onChange={(e) =>
                      setEditingExtra({ ...editingExtra, description: e.target.value })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all min-h-[100px]"
                    placeholder="Safe and comfortable baby seat for infants..."
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    value={editingExtra?.price || 0}
                    onChange={(e) =>
                      setEditingExtra({
                        ...editingExtra,
                        price: parseFloat(e.target.value),
                      })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                  />
                </div>

                {/* Action buttons */}
                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowExtraModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      handleUpdateExtra(editingExtra.id, editingExtra)
                    }
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Blog Modal */}
        {showBlogModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingBlog?.id ? 'Edit Blog Post' : 'Add Blog Post'}
                </h3>
                <button onClick={() => setShowBlogModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Post Title</label>
                    <input
                      type="text"
                      value={editingBlog?.title || ''}
                      onChange={(e) => {
                        const title = e.target.value;
                        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        setEditingBlog({ ...editingBlog, title, slug: editingBlog.id ? editingBlog.slug : slug });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="The Ultimate Guide to Melbourne Airport"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">URL Slug</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm">/blog/</span>
                      <input
                        type="text"
                        value={editingBlog?.slug || ''}
                        onChange={(e) => setEditingBlog({ ...editingBlog, slug: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-14 pr-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder="ultimate-guide-melbourne-airport"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Featured Image URL</label>
                    <input
                      type="text"
                      value={editingBlog?.featuredImage || ''}
                      onChange={(e) => setEditingBlog({ ...editingBlog, featuredImage: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Category</label>
                    <select
                      value={editingBlog?.category || 'Travel Tips'}
                      onChange={(e) => setEditingBlog({ ...editingBlog, category: e.target.value })}
                      className="custom-select w-full py-3 text-sm"
                    >
                      {BLOG_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Image Alt Text</label>
                    <input
                      type="text"
                      value={editingBlog?.featuredImageAlt || ''}
                      onChange={(e) => setEditingBlog({ ...editingBlog, featuredImageAlt: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Chauffeur service melbourne airport"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Excerpt</label>
                  <textarea
                    value={editingBlog?.excerpt || ''}
                    onChange={(e) => setEditingBlog({ ...editingBlog, excerpt: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-20"
                    placeholder="Brief summary for the blog list page..."
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Post Content (HTML)</label>
                  <textarea
                    value={editingBlog?.content || ''}
                    onChange={(e) => setEditingBlog({ ...editingBlog, content: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-48 font-mono"
                    placeholder="<p>...</p>"
                  />
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <h4 className="text-sm font-bold text-gold uppercase tracking-widest">SEO Settings</h4>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Meta Title</label>
                    <input
                      type="text"
                      value={editingBlog?.metaTitle || ''}
                      onChange={(e) => setEditingBlog({ ...editingBlog, metaTitle: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="SEO Title for Google"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Meta Description</label>
                    <textarea
                      value={editingBlog?.metaDescription || ''}
                      onChange={(e) => setEditingBlog({ ...editingBlog, metaDescription: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24"
                      placeholder="SEO description for search results..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Keywords (comma separated)</label>
                    <input
                      type="text"
                      value={editingBlog?.keywords || ''}
                      onChange={(e) => setEditingBlog({ ...editingBlog, keywords: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="chauffeur, airport, melbourne"
                    />
                  </div>

                  <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingBlog?.noindex ? "bg-red-500 border-red-500" : "border-white/20 group-hover:border-gold")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingBlog?.noindex || false}
                          onChange={(e) => setEditingBlog({ ...editingBlog, noindex: e.target.checked })}
                        />
                        {editingBlog?.noindex && <CheckCircle size={14} className="text-white" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">No Index</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingBlog?.includeInSitemap ? "bg-gold border-gold" : "border-white/20 group-hover:border-gold")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingBlog?.includeInSitemap || false}
                          onChange={(e) => setEditingBlog({ ...editingBlog, includeInSitemap: e.target.checked })}
                        />
                        {editingBlog?.includeInSitemap && <CheckCircle size={14} className="text-black" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">Include in Sitemap</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowBlogModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateBlog(editingBlog.id || 'new', editingBlog)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingBlog?.id ? 'Save Changes' : 'Publish Post'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Page Modal */}
        {showPageModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-display text-gold">
                  {editingPage?.id ? 'Edit Page' : 'Add Dynamic Page'}
                </h3>
                <button onClick={() => setShowPageModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Page Title</label>
                    <input
                      type="text"
                      value={editingPage?.title || ''}
                      onChange={(e) => {
                        const title = e.target.value;
                        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        setEditingPage({ ...editingPage, title, slug: editingPage.id ? editingPage.slug : slug });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Airport Transfers Melbourne"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">URL Slug</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 text-sm">/</span>
                      <input
                        type="text"
                        value={editingPage?.slug || ''}
                        onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder="airport-transfers-melbourne"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Featured Image URL</label>
                    <input
                      type="text"
                      value={editingPage?.featuredImage || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, featuredImage: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="https://images.unsplash.com/..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Image Alt Text</label>
                    <input
                      type="text"
                      value={editingPage?.featuredImageAlt || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, featuredImageAlt: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Luxury car at Melbourne airport"
                    />
                  </div>
                </div>

                <div className='custom-scrollbar'>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Page Content (HTML)</label>
                  <textarea
                    value={editingPage?.content || ''}
                    onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-48 font-mono"
                    placeholder="<section>...</section>"
                  />
                </div>

                <div className="p-6 bg-white/5 rounded-2xl border border-white/10 space-y-4">
                  <h4 className="text-sm font-bold text-gold uppercase tracking-widest">SEO Settings</h4>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Meta Title</label>
                    <input
                      type="text"
                      value={editingPage?.metaTitle || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, metaTitle: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Best Chauffeur Service in Melbourne | Merlux"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Meta Description</label>
                    <textarea
                      value={editingPage?.metaDescription || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, metaDescription: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24"
                      placeholder="Book luxury chauffeur services in Melbourne..."
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Keywords (comma separated)</label>
                    <input
                      type="text"
                      value={editingPage?.keywords || ''}
                      onChange={(e) => setEditingPage({ ...editingPage, keywords: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="chauffeur, melbourne, airport transfer"
                    />
                  </div>

                  <div className="flex gap-6">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingPage?.noindex ? "bg-red-500 border-red-500" : "border-white/20 group-hover:border-gold")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingPage?.noindex || false}
                          onChange={(e) => setEditingPage({ ...editingPage, noindex: e.target.checked })}
                        />
                        {editingPage?.noindex && <CheckCircle size={14} className="text-white" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">No Index</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingPage?.includeInSitemap ? "bg-gold border-gold" : "border-white/20 group-hover:border-gold")}>
                        <input
                          type="checkbox"
                          className="hidden"
                          checked={editingPage?.includeInSitemap || false}
                          onChange={(e) => setEditingPage({ ...editingPage, includeInSitemap: e.target.checked })}
                        />
                        {editingPage?.includeInSitemap && <CheckCircle size={14} className="text-black" />}
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-white/60">Include in Sitemap</span>
                    </label>
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={() => setShowPageModal(false)}
                    className="flex-1 py-3 text-xs font-bold uppercase border border-white/20 rounded-xl text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdatePage(editingPage.id || 'new', editingPage)}
                    className="flex-1 bg-gold text-black py-3 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-white transition-all"
                  >
                    {editingPage?.id ? 'Save Changes' : 'Create Page'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Offer Modal */}
        {showOfferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-2xl glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-display text-gold">
                    {editingOffer?.id ? 'Edit Offer' : 'Add Special Offer'}
                  </h3>
                  <p className="text-[9px] uppercase tracking-widest text-white/40">Manage package details and fleet rates</p>
                </div>
                <button onClick={() => setShowOfferModal(false)} className="text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Offer Header Name</label>
                    <input
                      type="text"
                      value={editingOffer?.title || ''}
                      onChange={(e) => {
                        const title = e.target.value;
                        const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                        setEditingOffer({ ...editingOffer, title, slug: editingOffer.id ? editingOffer.slug : slug });
                      }}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="e.g. Melbourne Airport to CBD Exclusive"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Image URL</label>
                    <input
                      type="text"
                      value={editingOffer?.image || ''}
                      onChange={(e) => setEditingOffer({ ...editingOffer, image: e.target.value })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Price Tags / Categories (Comma separated)</label>
                    <input
                      type="text"
                      value={editingOffer?.tags?.join(', ') || ''}
                      onChange={(e) => setEditingOffer({ ...editingOffer, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t !== '') })}
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                      placeholder="Featured, Most Picked, Family Favorite"
                    />
                  </div>
                </div>

                {/* Discount Strategy */}
                <div className="bg-white/5 border border-white/5 p-6 rounded-2xl space-y-4">
                  <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold">Discount Logic</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Reduction Type</label>
                      <select
                        value={editingOffer?.discountType || 'percentage'}
                        onChange={(e) => setEditingOffer({ ...editingOffer, discountType: e.target.value })}
                        className="custom-select w-full"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount ($)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Value ({editingOffer?.discountType === 'percentage' ? '%' : '$'})</label>
                      <input
                        type="number"
                        value={editingOffer?.discountValue || ''}
                        onChange={(e) => setEditingOffer({ ...editingOffer, discountValue: Number(e.target.value) })}
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all"
                        placeholder={editingOffer?.discountType === 'percentage' ? '15' : '20'}
                      />
                    </div>
                  </div>
                </div>

                {/* Fleet Options Section */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <h4 className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold flex items-center gap-2">
                      <Car size={14} /> Fleet Options
                    </h4>
                    <button
                      onClick={() => {
                        const newFleets = [...(editingOffer?.fleets || [])];
                        newFleets.push({
                          type: '', image: '', description: '', capacity: '3 Passengers', luggage: '2 Suitcases', basePrice: 0, salePrice: 0, additionalInfo: ''
                        });
                        setEditingOffer({ ...editingOffer, fleets: newFleets });
                      }}
                      className="text-[9px] uppercase tracking-widest font-bold text-gold hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Plus size={12} /> Add Fleet
                    </button>
                  </div>

                  <div className="space-y-4">
                    {(editingOffer?.fleets || []).map((fleet: any, fIdx: number) => (
                      <div key={fIdx} className="bg-white/5 border border-white/5 rounded-2xl p-6 relative group/fleet">
                        <div className="absolute top-4 right-4 flex items-center gap-3">
                          <button
                            onClick={() => {
                              const newFleets = [...editingOffer.fleets];
                              const duplicatedFleet = { ...fleet };
                              newFleets.splice(fIdx + 1, 0, duplicatedFleet);
                              setEditingOffer({ ...editingOffer, fleets: newFleets });
                            }}
                            className="bg-gold/10 text-gold hover:bg-gold hover:text-black px-3 py-1.5 rounded-lg border border-gold/20 transition-all flex items-center gap-1.5"
                            title="Duplicate Fleet"
                          >
                            <Copy size={12} />
                          </button>
                          <button
                            onClick={() => {
                              const newFleets = editingOffer.fleets.filter((_: any, i: number) => i !== fIdx);
                              setEditingOffer({ ...editingOffer, fleets: newFleets });
                            }}
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg border border-red-500/20 transition-all flex items-center gap-1.5"
                            title="Delete Fleet"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Fleet Name</label>
                            <input
                              type="text"
                              value={fleet.type}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].type = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="e.g. Executive Sedan"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Fleet Image URL</label>
                            <input
                              type="text"
                              value={fleet.image}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].image = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="https://..."
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Passengers</label>
                            <input
                              type="text"
                              value={fleet.passengers || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].passengers = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="3 Passengers"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Luggage</label>
                            <input
                              type="text"
                              value={fleet.luggage || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].luggage = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="2 Suitcases"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Standard Price ($)</label>
                            <input
                              type="number"
                              value={fleet.basePrice || ''}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                const base = Number(e.target.value);
                                newFleets[fIdx].basePrice = base;
                                // Auto calculate salePrice
                                if (editingOffer.discountType === 'percentage') {
                                  newFleets[fIdx].salePrice = Math.round(base * (1 - (editingOffer.discountValue || 0) / 100));
                                } else {
                                  newFleets[fIdx].salePrice = Math.max(0, base - (editingOffer.discountValue || 0));
                                }
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="120"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Auto-Calculated Offer Price</label>
                            <div className="flex items-center gap-4">
                              <input
                                type="number"
                                value={fleet.salePrice || ''}
                                readOnly
                                className="flex-1 bg-white/5 border border-gold/20 rounded-lg px-4 py-2 text-sm outline-none text-gold font-bold transition-all"
                              />
                              <p className="text-[8px] text-white/20 uppercase tracking-widest max-w-[100px] leading-tight">
                                Reduced from ${fleet.basePrice} via {editingOffer.discountValue}{editingOffer.discountType === 'percentage' ? '%' : '$'} discount
                              </p>
                            </div>
                          </div>
                          <div className="md:col-span-3">
                            <label className="text-[9px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Additional Info</label>
                            <input
                              type="text"
                              value={fleet.additionalInfo}
                              onChange={(e) => {
                                const newFleets = [...editingOffer.fleets];
                                newFleets[fIdx].additionalInfo = e.target.value;
                                setEditingOffer({ ...editingOffer, fleets: newFleets });
                              }}
                              className="w-full bg-black/20 border-b border-white/10 px-0 py-2 text-sm outline-none focus:border-gold transition-all"
                              placeholder="Free cancellation, bottled water provided"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!editingOffer?.fleets || editingOffer.fleets.length === 0) && (
                      <div className="py-8 text-center bg-white/5 border border-dashed border-white/5 rounded-2xl">
                        <p className="text-white/20 text-[10px] italic">No fleets added yet. click "Add Fleet" to define vehicle specific rates.</p>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-1 block">Overall Description</label>
                  <textarea
                    value={editingOffer?.description || ''}
                    onChange={(e) => setEditingOffer({ ...editingOffer, description: e.target.value })}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-gold transition-all h-24 custom-scrollbar"
                    placeholder="Exclusive fixed rate transfer between Melbourne Airport and the CBD."
                  />
                </div>

                <div className="flex items-center gap-4 py-4 border-t border-white/5">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className={cn("w-5 h-5 rounded border flex items-center justify-center transition-all", editingOffer?.active ? "bg-gold border-gold" : "border-white/20 group-hover:border-gold")}>
                      <input
                        type="checkbox"
                        className="hidden"
                        checked={editingOffer?.active || false}
                        onChange={(e) => setEditingOffer({ ...editingOffer, active: e.target.checked })}
                      />
                      {editingOffer?.active && <CheckCircle size={14} className="text-black" />}
                    </div>
                    <span className="text-xs font-bold uppercase tracking-widest text-white/60">Active Deal</span>
                  </label>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setShowOfferModal(false)}
                    className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest border border-white/10 rounded-2xl text-white/40 hover:text-white hover:border-white/20 transition-all"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={() => handleUpdateOffer(editingOffer.id || 'new', editingOffer)}
                    className="flex-1 bg-gold text-black py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-gold/10"
                  >
                    {editingOffer?.id ? 'Update Package' : 'Publish Offer'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Tour Modal */}
        {showTourModal && editingTour && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-5xl glass-heavy p-0 rounded-2xl border border-gold/20 overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-black/50">
                <div>
                  <h3 className="text-xl font-display text-gold">
                    {editingTour.id ? 'Edit Luxury Tour' : 'Create New Collection'}
                  </h3>
                  <p className="text-[8px] uppercase tracking-[0.3em] text-white/30 font-bold mt-1">Refined Sightseeing Management</p>
                </div>
                <button onClick={() => setShowTourModal(false)} className="text-white/40 hover:text-white bg-white/5 p-2 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              {/* Tabs Navigation */}
              <div className="flex bg-black/30 border-b border-white/5 px-6">
                {[
                  { id: 'general', label: 'General', icon: Info },
                  { id: 'content', label: 'Content', icon: LayoutGrid },
                  { id: 'pricing', label: 'Pricing & Fleets', icon: DollarSign },
                  { id: 'itinerary', label: 'Itinerary', icon: MapPin },
                  { id: 'marketing', label: 'Marketing', icon: Tag }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTourActiveTab(tab.id as any)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-[10px] uppercase font-bold tracking-widest border-b-2 transition-all shrink-0",
                      tourActiveTab === tab.id ? "text-gold border-gold bg-gold/5" : "text-white/30 border-transparent hover:text-white/60"
                    )}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#020202]">
                <div className="max-w-4xl mx-auto space-y-10">

                  {tourActiveTab === 'general' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Tour Name</label>
                          <input
                            type="text"
                            value={editingTour.title || ''}
                            onChange={(e) => setEditingTour({ ...editingTour, title: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all"
                            placeholder="Great Ocean Road Private Tour"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Slug (Custom URL)</label>
                          <input
                            type="text"
                            value={editingTour.slug || ''}
                            onChange={(e) => setEditingTour({ ...editingTour, slug: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all font-mono text-[10px]"
                            placeholder="great-ocean-road-private"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Featured Image URL (Display Header)</label>
                        <div className="relative group">
                          <input
                            type="text"
                            value={editingTour.image || ''}
                            onChange={(e) => setEditingTour({ ...editingTour, image: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-[10px] font-mono outline-none focus:border-gold transition-all"
                            placeholder="https://images.unsplash.com/photo..."
                          />
                          {editingTour.image && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg overflow-hidden border border-white/20">
                              <img src={editingTour.image} className="w-full h-full object-cover" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Duration</label>
                          <input type="text" value={editingTour.duration || ''} onChange={(e) => setEditingTour({ ...editingTour, duration: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="12 Hours" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Max People</label>
                          <input type="number" value={editingTour.maxPeople || ''} onChange={(e) => setEditingTour({ ...editingTour, maxPeople: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="7" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Age Range</label>
                          <input type="text" value={editingTour.ageRange || ''} onChange={(e) => setEditingTour({ ...editingTour, ageRange: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="Any Age" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Start Place</label>
                          <input type="text" value={editingTour.startPlace || ''} onChange={(e) => setEditingTour({ ...editingTour, startPlace: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm" placeholder="Melbourne CBD" />
                        </div>
                      </div>

                      <div className="p-6 bg-gold/5 border border-gold/10 rounded-2xl flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Active Status</h4>
                          <p className="text-[10px] text-white/40 mt-1">Determine if this tour is visible to customers in their dashboard.</p>
                        </div>
                        <button
                          onClick={() => setEditingTour({ ...editingTour, active: !editingTour.active })}
                          className={cn("w-12 h-6 rounded-full transition-all relative", editingTour.active ? "bg-gold" : "bg-white/10")}
                        >
                          <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", editingTour.active ? "right-1" : "left-1")} />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Availability (Start Date)</label>
                          <input type="date" value={editingTour.availability?.startDate || ''} onChange={(e) => setEditingTour({ ...editingTour, availability: { ...editingTour.availability, startDate: e.target.value } })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-white/60 outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Availability (End Date)</label>
                          <input type="date" value={editingTour.availability?.endDate || ''} onChange={(e) => setEditingTour({ ...editingTour, availability: { ...editingTour.availability, endDate: e.target.value } })} className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm text-white/60 outline-none" />
                        </div>
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'content' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Short Summary (Featured Excerpt)</label>
                        <textarea
                          value={editingTour.shortDescription || ''}
                          onChange={(e) => setEditingTour({ ...editingTour, shortDescription: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all h-24 resize-none"
                          placeholder="Brief 1-2 sentence overview..."
                        />
                      </div>
                      <div>
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Full Experience Details</label>
                        <textarea
                          value={editingTour.fullDescription || ''}
                          onChange={(e) => setEditingTour({ ...editingTour, fullDescription: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-5 py-4 text-sm outline-none focus:border-gold transition-all h-48 resize-none"
                          placeholder="Comprehensive description of the tour..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Inclusions
                            <button onClick={() => setEditingTour({ ...editingTour, inclusions: [...(editingTour.inclusions || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.inclusions || []).map((inc: string, idx: number) => (
                              <div key={`inc-${idx}`} className="flex items-center gap-2">
                                <input type="text" value={inc} onChange={(e) => {
                                  const n = [...editingTour.inclusions];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, inclusions: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, inclusions: editingTour.inclusions.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Exclusions
                            <button onClick={() => setEditingTour({ ...editingTour, exclusions: [...(editingTour.exclusions || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.exclusions || []).map((exc: string, idx: number) => (
                              <div key={`exc-${idx}`} className="flex items-center gap-2">
                                <input type="text" value={exc} onChange={(e) => {
                                  const n = [...editingTour.exclusions];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, exclusions: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, exclusions: editingTour.exclusions.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Highlights & Activities
                            <button onClick={() => setEditingTour({ ...editingTour, activities: [...(editingTour.activities || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.activities || []).map((act: string, idx: number) => (
                              <div key={`act-${idx}-${act.slice(0, 5)}`} className="flex items-center gap-2">
                                <input type="text" value={act} onChange={(e) => {
                                  const n = [...editingTour.activities];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, activities: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, activities: editingTour.activities.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block flex items-center justify-between">
                            Places To Visit
                            <button onClick={() => setEditingTour({ ...editingTour, placesToVisit: [...(editingTour.placesToVisit || []), ""] })} className="text-gold hover:text-white transition-colors"><Plus size={14} /></button>
                          </label>
                          <div className="space-y-2">
                            {(editingTour.placesToVisit || []).map((pl: string, idx: number) => (
                              <div key={`pl-${idx}-${pl.slice(0, 5)}`} className="flex items-center gap-2">
                                <input type="text" value={pl} onChange={(e) => {
                                  const n = [...editingTour.placesToVisit];
                                  n[idx] = e.target.value;
                                  setEditingTour({ ...editingTour, placesToVisit: n });
                                }} className="flex-1 bg-white/5 border border-white/5 rounded-lg px-4 py-2 text-xs" />
                                <button onClick={() => setEditingTour({ ...editingTour, placesToVisit: editingTour.placesToVisit.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={14} /></button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'pricing' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div>
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Fleet Specific Pricing</h4>
                          <button onClick={() => setEditingTour({ ...editingTour, fleets: [...(editingTour.fleets || []), { id: Date.now().toString(36), name: '', category: 'luxury', standardPrice: 0, salePrice: 0 }] })} className="btn-primary px-4 py-2 text-[8px]">
                            Add Custom Vehicle
                          </button>
                        </div>
                        <div className="space-y-4">
                          {(editingTour.fleets || []).map((f: any, idx: number) => (
                            <div key={f.id || idx} className="bg-white/5 border border-white/10 rounded-2xl p-6 relative group/row hover:border-gold/30 transition-all">
                              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <button onClick={() => { const n = [...editingTour.fleets]; n.splice(idx + 1, 0, { ...f, id: Date.now().toString(36) }); setEditingTour({ ...editingTour, fleets: n }); }} className="text-white/20 hover:text-gold transition-colors">
                                  <Copy size={16} />
                                </button>
                                <button onClick={() => setEditingTour({ ...editingTour, fleets: editingTour.fleets.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500 transition-colors">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-4">
                                <div className="md:col-span-2">
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Vehicle Name / Custom Identity</label>
                                  <div className="flex gap-2">
                                    <div className="flex-1 relative">
                                      <input
                                        type="text"
                                        value={f.name}
                                        onChange={(e) => {
                                          const n = [...editingTour.fleets]; n[idx].name = e.target.value;
                                          setEditingTour({ ...editingTour, fleets: n });
                                        }}
                                        className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs focus:border-gold outline-none"
                                        placeholder="e.g. Vintage Limousine"
                                      />
                                      <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                                        <ChevronDown size={12} />
                                      </div>
                                    </div>
                                    <select
                                      onChange={(e) => {
                                        const n = [...editingTour.fleets];
                                        const v = fleet.find(item => item.name === e.target.value);
                                        if (v) {
                                          n[idx].name = v.name;
                                          n[idx].image = v.img;
                                          n[idx].category = v.category || 'luxury';
                                        }
                                        setEditingTour({ ...editingTour, fleets: n });
                                      }}
                                      className="w-12 bg-white/5 border border-white/10 rounded-lg flex items-center justify-center text-[8px] custom-select"
                                    >
                                      <option value="">+</option>
                                      {fleet.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Category</label>
                                  <select
                                    value={f.category || 'luxury'}
                                    onChange={(e) => {
                                      const n = [...editingTour.fleets]; n[idx].category = e.target.value;
                                      setEditingTour({ ...editingTour, fleets: n });
                                    }}
                                    className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-[10px] custom-select focus:border-gold outline-none"
                                  >
                                    <option value="luxury">Luxury Estate</option>
                                    <option value="suv">Executive SUV</option>
                                    <option value="sedan">VIP Sedan</option>
                                    <option value="van">People Mover</option>
                                    <option value="classic">Classic / Vintage</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Passengers</label>
                                  <input type="text" value={f.passengers || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].passengers = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" placeholder="e.g. 3 Guests" />
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Luggage</label>
                                  <input type="text" value={f.luggage || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].luggage = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" placeholder="e.g. 2 Large" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Std Price ($)</label>
                                  <input type="number" value={f.standardPrice} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].standardPrice = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" />
                                </div>
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Sale Price ($)</label>
                                  <input type="number" value={f.salePrice} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].salePrice = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" />
                                </div>
                                <div className="md:col-span-2">
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Additional Info</label>
                                  <input type="text" value={f.additionalInfo || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].additionalInfo = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-xs" placeholder="e.g. Free Wifi, Water included" />
                                </div>
                                <div className="md:col-span-4">
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Image URL (Override)</label>
                                  <input type="text" value={f.image || ''} onChange={(e) => { const n = [...editingTour.fleets]; n[idx].image = e.target.value; setEditingTour({ ...editingTour, fleets: n }); }} className="w-full bg-black border border-white/10 rounded-lg px-4 py-2 text-[10px] font-mono text-white/30" placeholder="https://..." />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-12">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Optional Tour Extras</h4>
                          <button onClick={() => setEditingTour({ ...editingTour, extras: [...(editingTour.extras || []), { id: Date.now().toString(36), name: '', description: '', price: 0, availableCount: 1 }] })} className="btn-primary px-4 py-2 text-[8px]">
                            Add Extra Service
                          </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {(editingTour.extras || []).map((e: any, idx: number) => (
                            <div key={e.id || idx} className="bg-white/5 border border-white/5 rounded-2xl p-6 relative group/extra">
                              <button onClick={() => setEditingTour({ ...editingTour, extras: editingTour.extras.filter((_: any, i: any) => i !== idx) })} className="absolute top-4 right-4 text-white/20 hover:text-red-500 opacity-0 group-hover/extra:opacity-100 transition-all">
                                <Trash2 size={14} />
                              </button>
                              <div className="space-y-4">
                                <input type="text" value={e.name} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].name = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-transparent border-b border-white/10 text-xs font-bold py-1 focus:border-gold outline-none" placeholder="Extra Name" />
                                <input type="text" value={e.description} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].description = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-transparent border-b border-white/5 text-[10px] text-white/40 py-1 focus:border-gold outline-none" placeholder="Short Description" />
                                <div className="flex gap-4">
                                  <div className="flex-1">
                                    <label className="text-[8px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Price ($)</label>
                                    <input type="number" value={e.price} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].price = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-black border border-white/5 rounded px-2 py-1 text-[10px]" />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[8px] uppercase tracking-widest font-bold text-white/20 mb-1 block">Available</label>
                                    <input type="number" value={e.availableCount} onChange={(ev) => { const n = [...editingTour.extras]; n[idx].availableCount = ev.target.value; setEditingTour({ ...editingTour, extras: n }); }} className="w-full bg-black border border-white/5 rounded px-2 py-1 text-[10px]" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'itinerary' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-gold/10">
                        <div>
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest">Itinerary Builder</h4>
                          <p className="text-[10px] text-white/40 mt-1">Structure the tour sequence day-by-day or step-by-step.</p>
                        </div>
                        <button onClick={() => setEditingTour({ ...editingTour, itinerary: [...(editingTour.itinerary || []), { id: Date.now().toString(36), name: '', details: '', order: (editingTour.itinerary || []).length }] })} className="btn-primary px-6 py-2 text-[10px]">
                          Add New Step
                        </button>
                      </div>

                      <div className="space-y-6 relative before:absolute before:left-8 before:top-0 before:bottom-0 before:w-px before:bg-gradient-to-b before:from-gold/50 before:via-gold/10 before:to-transparent">
                        {(editingTour.itinerary || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)).map((step: any, idx: number) => (
                          <div key={step.id || idx} className="relative pl-16 group/step">
                            <div className="absolute left-6 top-1 w-4 h-4 rounded-full bg-gold/20 border-2 border-gold flex items-center justify-center z-10">
                              <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                            </div>
                            <div className="bg-white/5 border border-white/5 rounded-2xl p-6 hover:border-gold/20 transition-all">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                  <input type="text" value={step.name} onChange={(e) => { const n = [...editingTour.itinerary]; n[idx].name = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); }} className="w-full bg-transparent border-b border-white/10 text-sm font-bold py-1 focus:border-gold outline-none mb-4" placeholder="Day Title or Step Name" />
                                  <textarea value={step.details} onChange={(e) => { const n = [...editingTour.itinerary]; n[idx].details = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); }} className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-xs h-32 resize-none outline-none focus:border-gold" placeholder="Experience details (HTML supported)..." />
                                </div>
                                <div className="flex flex-col gap-2 ml-6">
                                  <button onClick={() => { const n = [...editingTour.itinerary]; n.splice(idx + 1, 0, { ...step, id: Date.now().toString(36), order: String(Number(step.order) + 1) }); setEditingTour({ ...editingTour, itinerary: n }); }} className="text-white/20 hover:text-gold"><Copy size={16} /></button>
                                  <button onClick={() => setEditingTour({ ...editingTour, itinerary: editingTour.itinerary.filter((_: any, i: any) => i !== idx) })} className="text-white/20 hover:text-red-500"><Trash2 size={16} /></button>
                                  <input type="number" value={step.order} onChange={(e) => { const n = [...editingTour.itinerary]; n[idx].order = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); }} className="w-10 bg-black/50 border border-white/10 rounded h-10 flex items-center justify-center text-[10px] text-center font-bold" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[8px] uppercase tracking-widest font-bold text-white/30 mb-2 block">Step Image URL (Optional)</label>
                                  <input type="text" value={step.image || ''} onChange={(e) => { const n = [...editingTour.itinerary]; n[idx].image = e.target.value; setEditingTour({ ...editingTour, itinerary: n }); }} className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-[10px] font-mono text-white/30" placeholder="https://..." />
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {tourActiveTab === 'marketing' && (
                    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Promo Tag (Ribbon)</label>
                            <input type="text" value={editingTour.promoTag || ''} onChange={(e) => setEditingTour({ ...editingTour, promoTag: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-gold outline-none" placeholder="e.g. Popular, Best Value, 20% OFF" />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Category</label>
                            <select value={editingTour.category || ''} onChange={(e) => setEditingTour({ ...editingTour, category: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm custom-select focus:border-gold outline-none">
                              <option value="">Select Category</option>
                              <option value="luxury">Luxury Estate</option>
                              <option value="wine">Wine & Dine</option>
                              <option value="sightseeing">Sightseeing</option>
                              <option value="private">Private VIP</option>
                              <option value="nature">Nature & Wild</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Gallery Images (One per line)</label>
                            <textarea
                              value={Array.isArray(editingTour.gallery) ? editingTour.gallery.join('\n') : (editingTour.gallery || '')}
                              onChange={(e) => setEditingTour({ ...editingTour, gallery: e.target.value.split('\n').filter(s => s.trim() !== '') })}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[10px] font-mono h-40 resize-none focus:border-gold outline-none"
                              placeholder="https://image1.jpg&#10;https://image2.jpg"
                            />
                            {editingTour.gallery && editingTour.gallery.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3">
                                {editingTour.gallery.map((img: string, i: number) => (
                                  <div key={i} className="w-12 h-12 rounded bg-black border border-white/10 overflow-hidden relative" title={img}>
                                    {img.startsWith('http') ? (
                                      <img src={img} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-[8px] text-white/20 font-bold overflow-hidden px-1 break-all">Err</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-6">
                          <h4 className="text-xs font-bold text-gold uppercase tracking-widest flex items-center justify-between">
                            Tour FAQs
                            <button onClick={() => setEditingTour({ ...editingTour, faqs: [...(editingTour.faqs || []), { id: Date.now().toString(36), question: '', answer: '' }] })} className="text-gold hover:text-white"><Plus size={16} /></button>
                          </h4>
                          <div className="space-y-4">
                            {(editingTour.faqs || []).map((faq: any, idx: number) => (
                              <div key={faq.id || `faq-${idx}`} className="bg-white/5 border border-white/5 rounded-2xl p-4 relative">
                                <button onClick={() => setEditingTour({ ...editingTour, faqs: editingTour.faqs.filter((_: any, i: any) => i !== idx) })} className="absolute top-2 right-2 text-white/10 hover:text-red-500 transition-all"><X size={14} /></button>
                                <input type="text" value={faq.question} onChange={(e) => { const n = [...editingTour.faqs]; n[idx].question = e.target.value; setEditingTour({ ...editingTour, faqs: n }); }} className="w-full bg-transparent border-b border-white/10 text-xs font-bold py-1 mb-2 outline-none" placeholder="Question" />
                                <textarea value={faq.answer} onChange={(e) => { const n = [...editingTour.faqs]; n[idx].answer = e.target.value; setEditingTour({ ...editingTour, faqs: n }); }} className="w-full bg-black/40 border border-white/5 rounded p-2 text-[10px] h-20 resize-none outline-none" placeholder="Detailed answer..." />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-white/5 pt-10">
                        <label className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-3 block">Mandatory Customer Note (Booking Requirements)</label>
                        <textarea value={editingTour.customerNote || ''} onChange={(e) => setEditingTour({ ...editingTour, customerNote: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs h-24 resize-none outline-none focus:border-gold transition-all" placeholder="e.g. Please bring comfortable walking shoes and a windbreaker." />
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-black/50 flex gap-4">
                <button
                  onClick={() => setShowTourModal(false)}
                  className="flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.2em] border border-white/10 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all"
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => handleUpdateTour(editingTour.id || 'new', editingTour)}
                  className="flex-[2] bg-gold text-black py-4 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                >
                  {editingTour.id ? 'Authorize & Sync Changes' : 'Initialize Luxury Tour'}
                </button>
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
              className="w-full max-w-md glass p-8 rounded-xl border border-gold/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
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
                  {/* Active toggle with coloured label */}
                  <div className="flex items-center gap-2 cursor-pointer">
                    <span
                      className={cn(
                        "text-[10px] uppercase tracking-widest font-bold transition-colors",
                        editingCoupon?.active ? "text-green-400" : "text-red-400"
                      )}
                    >
                      {editingCoupon?.active ? "Active" : "Inactive"}
                    </span>
                    <button
                      onClick={() =>
                        setEditingCoupon({ ...editingCoupon, active: !editingCoupon.active })
                      }
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative",
                        editingCoupon?.active ? "bg-green-500" : "bg-red-500/40"
                      )}
                    >
                      <div
                        className={cn(
                          "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                          editingCoupon?.active ? "right-1" : "left-1"
                        )}
                      />
                    </button>
                  </div>

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
                      min={new Date().toISOString().split('T')[0]}
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
                      min={new Date().toISOString().split('T')[0]}
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
            className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-lg glass p-5 sm:p-8 rounded-xl sm:rounded-3xl border border-gold/20 max-h-[90vh] sm:max-h-[80vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg sm:text-xl font-display text-gold">Bookings for {format(selectedDate, 'MMM dd, yyyy')}</h3>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{getBookingsForDate(selectedDate).length} Rides Scheduled</p>
                </div>
                <button onClick={() => setShowDayBookings(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                {getBookingsForDate(selectedDate).map((booking) => (
                  <div key={`day-booking-${booking.id}`} className="glass p-4 rounded-xl border border-white/5 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-bold">{booking.customerName}</p>
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
                        <span className={cn("truncate", !booking.dropoff && "text-white/60 italic")}>
                          {booking.dropoff || (booking.serviceType === 'hourly' ? 'No Drop Off (Optional)' : 'N/A')}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 pt-2 border-t border-white/5">
                      <div className="flex flex-col gap-1 relative order-2 sm:order-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] text-white/40 uppercase font-bold shrink-0">Phone:</p>
                          <p className="text-[10px] text-white/80 whitespace-nowrap">{booking.customerPhone || 'No phone'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-[8px] text-white/40 uppercase font-bold shrink-0">Email:</p>
                          <p className="text-[10px] text-white/60 truncate">{booking.customerEmail}</p>
                        </div>
                        {booking.purpose && (
                          <div className="mt-1 flex items-center gap-1">
                            <p className="text-[8px] text-white/40 uppercase font-bold shrink-0">Notes:</p>
                            <button
                              onMouseEnter={() => setShowNotesPopup(booking.id)}
                              onMouseLeave={() => setShowNotesPopup(null)}
                              className="text-gold/50 hover:text-gold transition-colors"
                            >
                              <Eye size={8} />
                            </button>
                            <p className="text-[9px] text-white/50 truncate italic ml-1">"{booking.purpose}"</p>
                          </div>
                        )}

                        <AnimatePresence>
                          {showNotesPopup === booking.id && booking.purpose && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-0 mb-2 w-48 bg-black p-3 rounded-xl border border-gold/20 z-[110] shadow-2xl"
                            >
                              <p className="text-[8px] uppercase tracking-widest text-gold font-bold mb-2">Additional Info</p>
                              <p className="text-[9px] text-white/70 leading-relaxed italic">"{booking.purpose}"</p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                      <div className="flex sm:flex-col justify-between items-center sm:items-end sm:text-right order-1 sm:order-2">
                        <div className="flex flex-col sm:items-end">
                          <p className="text-[8px] text-white/40 uppercase font-bold">Vehicle</p>
                          <p className="text-[10px] text-white/80">{booking.vehicleId}</p>
                        </div>
                        <div className="text-right sm:mt-1">
                          {booking.serviceType === 'hourly' && (
                            <p className="text-[9px] text-gold font-bold uppercase tracking-widest">{booking.hours} Hours</p>
                          )}
                          <p className="text-[10px] text-gold font-bold">${booking.price}</p>
                        </div>
                      </div>
                    </div>
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => {
                          setActiveTab('bookings');
                          setSearchQuery(booking.customerName || '');
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

      {/* Add Chart Modal */}
      <AnimatePresence>
        {/* CSV Import Modal */}
        {showCsvImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xl glass p-8 rounded-3xl border border-gold/20"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gold/10 rounded-lg">
                    <Upload size={20} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display text-gold">Import {csvImportType === 'offers' ? 'Offers' : 'Tours'}</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Bulk upload via CSV</p>
                  </div>
                </div>
                <button onClick={() => setShowCsvImportModal(false)} className="text-white/40 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Drag & Drop Area */}
                <div
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragActive(false);
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleCsvUpload(csvImportType, e.dataTransfer.files[0]);
                    }
                  }}
                  className={cn(
                    "relative py-8 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-300", // reduced py-12 → py-8
                    dragActive
                      ? "border-gold bg-gold/5 scale-[1.02]"
                      : "border-white/10 bg-white/5 hover:border-gold/30"
                  )}
                >
                  <input
                    type="file"
                    accept=".csv"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleCsvUpload(csvImportType, e.target.files[0]);
                      }
                    }}
                  />
                  <div
                    className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-transform duration-500", // reduced w-16 h-16 → w-12 h-12
                      dragActive ? "bg-gold text-black scale-110 rotate-12" : "bg-white/10 text-gold"
                    )}
                  >
                    {isUploadingCsv ? (
                      <RefreshCw size={24} className="animate-spin" />
                    ) : (
                      <Upload size={24} />
                    )}
                  </div>
                  <p className="text-sm font-bold text-white mb-1">
                    {isUploadingCsv ? 'Uploading...' : 'Drop your CSV here'}
                  </p>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">
                    or click to browse files
                  </p>
                </div>

                {/* Format Sample */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Info size={14} className="text-gold" />
                      <span className="text-[10px] uppercase tracking-widest font-black text-white/60">Required CSV Format</span>
                    </div>
                    <a
                      href={csvImportType === 'offers' ? '/assets/csv/sample-offers.csv' : '/assets/csv/sample-tours.csv'}
                      download
                      className="bg-gold/10 hover:bg-gold hover:text-black text-gold px-3 py-1.5 rounded text-[9px] uppercase tracking-widest font-black transition-all flex items-center gap-1.5"
                    >
                      <Download size={12} /> Download Sample CSV
                    </a>
                  </div>
                  <div className="overflow-x-auto custom-scrollbar border border-white/10 rounded-xl bg-black/40">
                    <table className="w-full border-collapse text-[9px] text-left">
                      <thead>
                        <tr className="bg-gold/10 border-b border-gold/20">
                          {(csvImportType === 'offers'
                            ? ['title', 'description', 'image', 'active', 'tags', 'discounttype', 'discountvalue', 'fleets_data']
                            : ['title', 'image', 'duration', 'maxPeople', 'ageRange', 'startPlace', 'active', 'availabilityStartDate', 'availabilityEndDate', 'shortDescription', 'fullDescription', 'gallery', 'inclusions', 'exclusions', 'activities', 'placesToVisit', 'tags', 'fleets', 'extras', 'itinerary', 'faqs', 'promoTag', 'category', 'customerNote']
                          ).map((h) => (
                            <th key={h} className="px-3 py-2 text-gold font-black uppercase tracking-widest border-r border-gold/10 last:border-0 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white/[0.02]">
                          {(csvImportType === 'offers'
                            ? ['Autumn Special', 'Experience our autumn special.', 'https://...', 'true', 'Seasonal|Featured', 'percentage', '25', 'Sedan|url|Desc|3|2|150|Free Wi-Fi']
                            : ['Wine Tour', 'https://...', '8 Hours', '6', 'Adults', 'CBD', 'true', '2024-01-01', '2024-12-31', 'Short summary.', 'Long text...', 'url1|url2', 'Lunch|Tasting', 'Tips', 'Tasting', 'Valley', 'Luxury', 'Sedan|url|3|2|150|120|Info', 'Photos|Pro|150|10', 'Stop 1|img|desc', 'Q|A', 'Best Seller', 'Wine', 'Note']
                          ).map((v, i) => (
                            <td key={i} className="px-3 py-2 text-white/50 font-mono border-r border-white/5 last:border-0 whitespace-nowrap italic">
                              {v}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[9px] text-white/30 mt-3 italic text-left">
                    * Use ';' for major separations (e.g. lists of fleets or extras) and '|' for internal attributes. Review the sample CSV for exact formatting.
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Bar Setup Modal */}
        {showBarModal && editingBarIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[900] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-4xl glass rounded-[40px] border border-gold/20 overflow-hidden shadow-[0_0_100px_rgba(212,175,55,0.1)] flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20 shadow-inner">
                    <Layout size={24} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display text-gold tracking-tight">Bar Setup</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">Configure your global notification bar</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowBarModal(false); setEditingBarIndex(null); }}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all group"
                >
                  <X size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-12">
                {(() => {
                  const bar = floatingSettings.bars[editingBarIndex];
                  const updateBar = (updates: any) => {
                    setFloatingSettings((prev: any) => {
                      const newBars = [...(prev.bars || [])];
                      newBars[editingBarIndex] = { ...newBars[editingBarIndex], ...updates };
                      return { ...prev, bars: newBars };
                    });
                  };

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      {/* Left: Identity & Content */}
                      <div className="space-y-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Bar Identity</label>
                          <input
                            type="text"
                            value={bar.name || ''}
                            onChange={(e) => updateBar({ name: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-gold/50 shadow-inner transition-all"
                            placeholder="e.g. Summer Sale 2024"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Display Content (HTML Supported)</label>
                          <textarea
                            rows={4}
                            value={bar.content || ''}
                            onChange={(e) => updateBar({ content: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-gold/50 shadow-inner transition-all font-mono"
                            placeholder="<span class='text-gold'>LIMITED:</span> 20% OFF ALL BOOKINGS!"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Promo Code</label>
                            <input
                              type="text"
                              value={bar.promoCode || ''}
                              onChange={(e) => updateBar({ promoCode: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-gold/50 shadow-inner transition-all"
                              placeholder="AUTUMN25"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">CTA Text</label>
                            <input
                              type="text"
                              value={bar.ctaText || ''}
                              onChange={(e) => updateBar({ ctaText: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-gold/50 shadow-inner transition-all"
                              placeholder="Book Now"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">CTA Link</label>
                            <input
                              type="text"
                              value={bar.ctaLink || ''}
                              onChange={(e) => updateBar({ ctaLink: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/10 outline-none focus:border-gold/50 shadow-inner transition-all"
                              placeholder="/offers or https://..."
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Position & Animation</label>
                          <div className="grid grid-cols-2 gap-4">
                            <select
                              value={bar.position || 'top'}
                              onChange={(e) => updateBar({ position: e.target.value })}
                              className="custom-select w-full"
                            >
                              <option value="top">Top Header Row</option>
                              <option value="bottom">Bottom Reveal</option>
                            </select>
                            <select
                              value={bar.animation || 'marquee'}
                              onChange={(e) => updateBar({ animation: e.target.value })}
                              className="custom-select w-full"
                            >
                              <option value="slide">Static Slide</option>
                              <option value="marquee">Scrolling Marquee</option>
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Right: Styling & Logic */}
                      <div className="space-y-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-4 block">Visual Configuration</label>
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-white/40">Background Style</span>
                              <div className="flex gap-2">
                                {['solid', 'gradient'].map(type => (
                                  <button
                                    key={type}
                                    onClick={() => updateBar({ bgType: type })}
                                    className={cn(
                                      "px-3 py-1 rounded-full text-[8px] uppercase font-black border transition-all",
                                      bar.bgType === type ? "bg-gold border-gold text-black" : "border-white/10 text-white/40"
                                    )}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {bar.bgType === 'gradient' ? (
                              <div className="space-y-2">
                                <span className="text-[8px] uppercase font-bold text-white/20 ml-1">Gradient CSS</span>
                                <input
                                  type="text"
                                  value={bar.bgGradient || ''}
                                  onChange={(e) => updateBar({ bgGradient: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-gold outline-none focus:border-gold/50"
                                  placeholder="linear-gradient(...)"
                                />
                                <div className="h-6 w-full rounded-xl border border-white/10 mt-1" style={{ backgroundImage: bar.bgGradient || 'linear-gradient(90deg, #D4AF37, #F1D483)' }} />
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <span className="text-[8px] uppercase font-bold text-white/20">Fill Color</span>
                                <input
                                  type="color"
                                  value={bar.bgColor || '#D4AF37'}
                                  onChange={(e) => updateBar({ bgColor: e.target.value })}
                                  className="w-12 h-6 bg-transparent border-none cursor-pointer"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-2">
                                <span className="text-[8px] uppercase font-bold text-white/20 text-center">Text</span>
                                <input
                                  type="color"
                                  value={bar.textColor || '#000000'}
                                  onChange={(e) => updateBar({ textColor: e.target.value })}
                                  className="w-full h-8 bg-transparent border-none cursor-pointer"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <span className="text-[8px] uppercase font-bold text-white/20 text-center">Promo</span>
                                <input
                                  type="color"
                                  value={bar.promoColor || '#000000'}
                                  onChange={(e) => updateBar({ promoColor: e.target.value })}
                                  className="w-full h-8 bg-transparent border-none cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Active Duration (Validation)</label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase font-bold text-white/20 block ml-1">Starts</span>
                              <input
                                type="date"
                                min={new Date().toISOString().split('T')[0]}
                                value={bar.startDate || ''}
                                onChange={(e) => updateBar({ startDate: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs text-white outline-none focus:border-gold/50"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[8px] uppercase font-bold text-white/20 block ml-1">Ends</span>
                              <input
                                type="date"
                                min={bar.startDate || new Date().toISOString().split('T')[0]}
                                value={bar.endDate || ''}
                                onChange={(e) => updateBar({ endDate: e.target.value })}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs text-white outline-none focus:border-gold/50"
                              />
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Visibility & Timing Rules</label>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[8px] uppercase font-bold text-white/20 block ml-1">Entry Delay (ms)</span>
                                <input
                                  type="number"
                                  step="500"
                                  min="0"
                                  value={bar.delay || 0}
                                  onChange={(e) => updateBar({ delay: parseInt(e.target.value) })}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs text-white outline-none focus:border-gold/50"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] uppercase font-bold text-white/20 block ml-1">Auto Close (ms)</span>
                                <input
                                  type="number"
                                  step="1000"
                                  min="0"
                                  value={bar.autoCloseTime || 0}
                                  onChange={(e) => updateBar({ autoCloseTime: parseInt(e.target.value) })}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-3 text-xs text-white outline-none focus:border-gold/50"
                                />
                              </div>
                            </div>

                            <select
                              value={bar.displayCondition || 'all'}
                              onChange={(e) => updateBar({ displayCondition: e.target.value })}
                              className="custom-select w-full"
                            >
                              <option value="all">Everywhere</option>
                              <option value="landing">Homepage Only</option>
                              <option value="specific">Specific Pages Only</option>
                              <option value="except">Except Specific Pages</option>
                            </select>

                            {bar.displayCondition === 'specific' && (
                              <input
                                type="text"
                                value={bar.specificPages?.join(', ') || ''}
                                onChange={(e) => updateBar({ specificPages: e.target.value.split(',').map(s => s.trim()) })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/60 focus:border-gold outline-none"
                                placeholder="/fleet, /offers, /pricing"
                              />
                            )}
                            {bar.displayCondition === 'except' && (
                              <input
                                type="text"
                                value={bar.exceptPages?.join(', ') || ''}
                                onChange={(e) => updateBar({ exceptPages: e.target.value.split(',').map(s => s.trim()) })}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/60 focus:border-gold outline-none"
                                placeholder="/checkout, /booking"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer Actions */}
              <div className="p-8 border-t border-white/5 bg-black/40 flex justify-end gap-4 shrink-0">
                <button
                  onClick={() => { setShowBarModal(false); setEditingBarIndex(null); }}
                  className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => {
                    handleUpdateFloatingSettings(floatingSettings);
                    setShowBarModal(false);
                    setEditingBarIndex(null);
                  }}
                  className="px-10 py-3 bg-gold text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center gap-2"
                >
                  {isSavingFloatingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save All Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Popup Setup Modal */}
        {showPopupModal && editingPopupIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[900] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-4xl glass rounded-[40px] border border-white/5 overflow-hidden shadow-[0_0_100px_rgba(168,85,247,0.1)] flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gold/10 flex items-center justify-center border border-gold/20 shadow-inner">
                    <MessageSquare size={24} className="text-gold" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display text-white tracking-tight">Popup Setup</h3>
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-black">Targeted engagement modal</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowPopupModal(false); setEditingPopupIndex(null); }}
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all group"
                >
                  <X size={20} className="group-hover:rotate-90 transition-transform duration-500" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-12">
                {(() => {
                  const popup = floatingSettings.popups[editingPopupIndex];
                  const updatePopup = (updates: any) => {
                    setFloatingSettings((prev: any) => {
                      const newPopups = [...(prev.popups || [])];
                      newPopups[editingPopupIndex] = { ...newPopups[editingPopupIndex], ...updates };
                      return { ...prev, popups: newPopups };
                    });
                  };

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 text-left">
                      {/* Left: Content & Structure */}
                      <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Popup Type</label>
                            <select
                              value={popup.type || 'sales'}
                              onChange={(e) => updatePopup({ type: e.target.value })}
                              className="custom-select w-full"
                            >
                              <option value="sales">Sales & Offers</option>
                              <option value="news">Recent News</option>
                              <option value="instruction">Instructions</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Position</label>
                            <select
                              value={popup.position || 'center'}
                              onChange={(e) => updatePopup({ position: e.target.value })}
                              className="custom-select w-full"
                            >
                              <option value="center">Screen Center</option>
                              <option value="bottom-right">Bottom Right</option>
                              <option value="bottom-left">Bottom Left</option>
                              <option value="top-right">Top Right</option>
                              <option value="top-left">Top Left</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Main Title</label>
                          <input
                            type="text"
                            value={popup.title || ''}
                            onChange={(e) => updatePopup({ title: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                            placeholder="Big Sale Headline"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Subtitle / Caption</label>
                          <input
                            type="text"
                            value={popup.subtitle || ''}
                            onChange={(e) => updatePopup({ subtitle: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                            placeholder="Short and catchy..."
                          />
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Description / Details</label>
                          <textarea
                            rows={3}
                            value={popup.details || ''}
                            onChange={(e) => updatePopup({ details: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                            placeholder="Detailed message or instruction..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Promo Code</label>
                            <input
                              type="text"
                              value={popup.promoCode || ''}
                              onChange={(e) => updatePopup({ promoCode: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                              placeholder="OFF50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Entry Delay (ms)</label>
                            <input
                              type="number"
                              step="500"
                              min="0"
                              value={popup.delay || 2000}
                              onChange={(e) => updatePopup({ delay: parseInt(e.target.value) })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Auto Close (ms)</label>
                            <input
                              type="number"
                              step="1000"
                              min="0"
                              value={popup.autoCloseTime || 0}
                              onChange={(e) => updatePopup({ autoCloseTime: parseInt(e.target.value) })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                              placeholder="0 (Off)"
                            />
                            <p className="text-[8px] text-white/30 mt-1 italic">0 meant disabled</p>
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Width (px)</label>
                            <input
                              type="number"
                              step="10"
                              min="200"
                              value={popup.width || 400}
                              onChange={(e) => updatePopup({ width: parseInt(e.target.value) })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Max Height (px)</label>
                            <input
                              type="number"
                              step="10"
                              min="200"
                              value={popup.height || 600}
                              onChange={(e) => updatePopup({ height: parseInt(e.target.value) })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-gold/50"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Custom HTML Area (Optional)</label>
                          <textarea
                            rows={2}
                            value={popup.htmlContent || ''}
                            onChange={(e) => updatePopup({ htmlContent: e.target.value })}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-[10px] font-mono text-white/60 outline-none focus:border-gold/50"
                            placeholder="Add generic HTML content..."
                          />
                        </div>
                      </div>

                      {/* Right: Style & Behavior */}
                      <div className="space-y-8">
                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">CTA Action</label>
                          <div className="grid grid-cols-2 gap-4">
                            <input
                              type="text"
                              value={popup.ctaText || ''}
                              onChange={(e) => updatePopup({ ctaText: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-gold/50"
                              placeholder="Button Text"
                            />
                            <input
                              type="text"
                              value={popup.ctaLink || ''}
                              onChange={(e) => updatePopup({ ctaLink: e.target.value })}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-gold/50"
                              placeholder="/offers"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-4 block">Visual Style</label>
                          <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase font-bold text-white/40">Background</span>
                              <div className="flex gap-2">
                                {['solid', 'gradient'].map(type => (
                                  <button
                                    key={type}
                                    onClick={() => updatePopup({ bgType: type })}
                                    className={cn(
                                      "px-3 py-1 rounded-full text-[8px] uppercase font-black border transition-all",
                                      popup.bgType === type ? "bg-gold border-gold text-black" : "border-white/10 text-white/40"
                                    )}
                                  >
                                    {type}
                                  </button>
                                ))}
                              </div>
                            </div>
                            {popup.bgType === 'gradient' ? (
                              <div className="space-y-2">
                                <span className="text-[8px] uppercase font-bold text-white/20 ml-1">Gradient CSS</span>
                                <input
                                  type="text"
                                  value={popup.bgGradient || ''}
                                  onChange={(e) => updatePopup({ bgGradient: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-[10px] font-mono text-gold outline-none focus:border-gold/50"
                                  placeholder="linear-gradient(...)"
                                />
                                <div className="h-6 w-full rounded-xl border border-white/10 mt-1" style={{ backgroundImage: popup.bgGradient || 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' }} />
                              </div>
                            ) : (
                              <div className="flex justify-between items-center">
                                <span className="text-[8px] uppercase font-bold text-white/20">Source Color</span>
                                <input
                                  type="color"
                                  value={popup.bgColor || '#1a1a1a'}
                                  onChange={(e) => updatePopup({ bgColor: e.target.value })}
                                  className="w-10 h-6 bg-transparent border-none cursor-pointer"
                                />
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-2">
                                <span className="text-[8px] uppercase font-bold text-white/20">Text Color</span>
                                <input
                                  type="color"
                                  value={popup.textColor || '#FFFFFF'}
                                  onChange={(e) => updatePopup({ textColor: e.target.value })}
                                  className="w-full h-8 bg-transparent border-none cursor-pointer"
                                />
                              </div>
                              <div className="flex flex-col gap-2">
                                <span className="text-[8px] uppercase font-bold text-white/20">Accent/Button</span>
                                <input
                                  type="color"
                                  value={popup.accentColor || '#D4AF37'}
                                  onChange={(e) => updatePopup({ accentColor: e.target.value })}
                                  className="w-full h-8 bg-transparent border-none cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Animation & Dates</label>
                          <div className="space-y-4">
                            <select
                              value={popup.animation || 'scale'}
                              onChange={(e) => updatePopup({ animation: e.target.value })}
                              className="custom-select w-full"
                            >
                              <option value="fade">Simple Fade</option>
                              <option value="slide">Slide From Bottom</option>
                              <option value="scale">Bounce Scale</option>
                              <option value="zoom">Zoom Focus</option>
                            </select>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-[8px] uppercase font-bold text-white/20 block ml-1">Starts</span>
                                <input
                                  type="date"
                                  min={new Date().toISOString().split('T')[0]}
                                  value={popup.startDate || ''}
                                  onChange={(e) => updatePopup({ startDate: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white"
                                />
                              </div>
                              <div className="space-y-1">
                                <span className="text-[8px] uppercase font-bold text-white/20 block ml-1">Ends</span>
                                <input
                                  type="date"
                                  min={popup.startDate || new Date().toISOString().split('T')[0]}
                                  value={popup.endDate || ''}
                                  onChange={(e) => updatePopup({ endDate: e.target.value })}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white"
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="text-[10px] uppercase tracking-widest font-black text-gold mb-3 block">Visibility Rules</label>
                          <select
                            value={popup.displayCondition || 'all'}
                            onChange={(e) => updatePopup({ displayCondition: e.target.value })}
                            className="custom-select w-full mb-4"
                          >
                            <option value="all">Everywhere</option>
                            <option value="specific">Specific Pages Only</option>
                            <option value="landing">Homepage Only</option>
                            <option value="except">Except Specific Pages</option>
                          </select>
                          {popup.displayCondition === 'specific' && (
                            <input
                              type="text"
                              value={popup.specificPages?.join(', ') || ''}
                              onChange={(e) => updatePopup({ specificPages: e.target.value.split(',').map(s => s.trim()) })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/60 focus:border-gold outline-none"
                              placeholder="/fleet, /offers"
                            />
                          )}
                          {popup.displayCondition === 'except' && (
                            <input
                              type="text"
                              value={popup.exceptPages?.join(', ') || ''}
                              onChange={(e) => updatePopup({ exceptPages: e.target.value.split(',').map(s => s.trim()) })}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white/60 focus:border-gold outline-none"
                              placeholder="/checkout, /payment"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="p-8 border-t border-white/5 bg-black/40 flex justify-end gap-4 shrink-0">
                <button
                  onClick={() => { setShowPopupModal(false); setEditingPopupIndex(null); }}
                  className="px-8 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-white hover:bg-white/10 transition-all"
                >
                  Discard Changes
                </button>
                <button
                  onClick={() => {
                    handleUpdateFloatingSettings(floatingSettings);
                    setShowPopupModal(false);
                    setEditingPopupIndex(null);
                  }}
                  className="px-10 py-3 bg-gold text-black rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_20px_rgba(212,175,55,0.3)] flex items-center gap-2"
                >
                  {isSavingFloatingSettings ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save All Settings
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
