import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MapPin, Calendar, Clock, Car, User,
  ChevronRight, ChevronLeft, CheckCircle,
  Plane, Briefcase, Heart, Map, Info,
  Navigation, AlertCircle, Search, Loader2,
  CreditCard, Banknote, Plus, Trash2, Percent, Tag, RotateCcw
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';
import { cn } from '../lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, getDocs, updateDoc, setDoc, query, where } from 'firebase/firestore';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { fetchFlightStatus, FlightStatus } from '../services/flightService';
import Logo from '../components/layout/Logo';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const libraries: ("places" | "drawing" | "geometry" | "visualization")[] = ["places"];

const mapContainerStyle = {
  width: '100%',
  height: '300px',
  borderRadius: '8px',
};

const center = {
  lat: -37.8136,
  lng: 144.9631, // Melbourne
};

const steps = [
  { id: 1, name: 'Service', icon: Info },
  { id: 2, name: 'Details', icon: MapPin },
  { id: 3, name: 'Vehicle', icon: Car },
  { id: 4, name: 'Payment', icon: CheckCircle },
];

const serviceTypes = [
  { id: 'airport', name: 'Airport Transfer', icon: Plane, desc: 'To or from Melbourne Airport' },
  { id: 'corporate', name: 'Corporate Travel', icon: Briefcase, desc: 'Professional business transport' },
  { id: 'wedding', name: 'Wedding Service', icon: Heart, desc: 'Luxury for your special day' },
  { id: 'tour', name: 'Private Tour', icon: Map, desc: 'Bespoke regional Victoria tours' },
  { id: 'hourly', name: 'Hourly Hire', icon: Clock, desc: 'Chauffeur at your disposal' },
];

const vehicles = [
  {
    id: 'sedan',
    name: 'Luxury Sedan',
    model: 'Mercedes E-Class',
    pax: 3,
    bags: 2,
    price: 95,
    img: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'suv',
    name: 'Business SUV',
    model: 'Audi Q7 / BMW X5',
    pax: 4,
    bags: 4,
    price: 125,
    img: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'first',
    name: 'First Class',
    model: 'Mercedes S-Class',
    pax: 2,
    bags: 2,
    price: 180,
    img: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=2070&auto=format&fit=crop'
  },
  {
    id: 'van',
    name: 'Executive Van',
    model: 'Mercedes V-Class',
    pax: 7,
    bags: 7,
    price: 150,
    img: 'https://images.unsplash.com/photo-1532581291347-9c39cf10a73c?q=80&w=2070&auto=format&fit=crop'
  },
];

export default function Booking() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialState = location.state as { service?: string; step?: number } | null;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: libraries,
  });

  const [step, setStep] = useState(initialState?.step || 1);
  const [user, setUser] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingFlight, setIsVerifyingFlight] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash'>('card');
  const [flightInfo, setFlightInfo] = useState<FlightStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fleet, setFleet] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [extras, setExtras] = useState<any[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const [formData, setFormData] = useState({
    serviceType: initialState?.service || '',
    pickup: '',
    dropoff: '',
    date: '',
    time: '',
    vehicle: '',
    passengers: 1,
    flightNumber: '',
    notes: '',
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestPassword: '', // For registration
    isReturn: false,
    returnDate: '',
    returnTime: '',
    waypoints: [] as string[],
    hours: 1,
    purpose: '',
    couponCode: '',
    selectedExtras: [] as string[],
  });

  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');

  const calculatePrice = useCallback((vehicleId: string) => {
    const vehicle = fleet.find(v => v.id === vehicleId);
    if (!vehicle) return { base: 0, distance: 0, extras: 0, waypoints: 0, tax: 0, discount: 0, stripe: 0, total: 0, net: 0 };

    const distanceKm = parseFloat(distance.replace(/[^\d.]/g, '')) || 0;
    let baseFare = Number(vehicle.basePrice) || 0;
    let distancePrice = 0;

    if (formData.serviceType === 'hourly') {
      baseFare = 0; // Base price 0 for hourly
      distancePrice = (Number(vehicle.hourlyPrice) || 0) * (formData.hours || 1);
    } else {
      distancePrice = (Number(vehicle.distanceKm) || 0);
    }

    // Add KM-based surcharge if ranges exist
    if (vehicle.kmRanges && vehicle.kmRanges.length > 0) {
      let previousMax = 0;

      for (const r of vehicle.kmRanges) {
        if (r.label.includes('+')) {
          const min = parseFloat(r.label.replace('+', ''));
          if (distanceKm >= min) {
            const balance = distanceKm - previousMax;
            distancePrice += balance * Number(r.surcharge);
            break;
          }
        } else {
          const [min, max] = r.label.split('-').map(Number);
          if (distanceKm > max) {
            previousMax = max;
          } else if (distanceKm >= min && distanceKm <= max) {
            const balance = distanceKm - previousMax;
            distancePrice += balance * Number(r.surcharge);
            break;
          }
        }
      }
    }

    // Waypoint Price
    const waypointCount = formData.waypoints.filter(wp => wp.length > 5).length;
    const waypointPriceTotal = waypointCount * (Number(settings?.waypointPrice) || 0);

    // Extras Price
    const extrasPrice = formData.selectedExtras.reduce((sum, extraId) => {
      const extra = extras.find(e => e.id === extraId);
      return sum + (Number(extra?.price) || 0);
    }, 0);

    let subtotal = baseFare + distancePrice + waypointPriceTotal + extrasPrice;

    // Return trip logic (Double the price)
    if (formData.isReturn) {
      subtotal *= 2;
    }

    // Apply coupon discount
    let discount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.type === 'percentage') {
        discount = subtotal * (appliedCoupon.value / 100);
      } else {
        discount = appliedCoupon.value;
      }
    }

    const netPrice = Math.max(0, subtotal - discount);

    // Add tax
    let tax = 0;
    if (settings?.taxPercentage) {
      tax = netPrice * (Number(settings.taxPercentage) / 100);
    }

    let stripeFees = 0;
    if (paymentMethod === 'card') {
      const feePercent = Number(settings?.stripeFeePercentage) || 4.0;
      stripeFees = (netPrice + tax) * (feePercent / 100);
    }

    const total = Math.round(netPrice + tax + stripeFees);

    return {
      base: baseFare,
      distance: distancePrice,
      waypoints: waypointPriceTotal,
      extras: extrasPrice,
      tax: tax,
      discount: discount,
      stripe: stripeFees,
      net: netPrice,
      total: total
    };
  }, [fleet, extras, distance, settings, formData.serviceType, formData.hours, formData.isReturn, formData.selectedExtras, formData.waypoints, appliedCoupon, paymentMethod]);

  // Filter State
  const [typeFilter, setTypeFilter] = useState('all');
  const [paxFilter, setPaxFilter] = useState(0);
  const [bagsFilter, setBagsFilter] = useState(0);
  const [priceSort, setPriceSort] = useState<'asc' | 'desc' | null>(null);

  const filteredFleet = useMemo(() => {
    let result = fleet.length > 0 ? [...fleet] : [...vehicles];

    if (typeFilter !== 'all') {
      result = result.filter(v => v.id.includes(typeFilter) || v.name.toLowerCase().includes(typeFilter.toLowerCase()));
    }

    if (paxFilter > 0) {
      result = result.filter(v => v.pax >= paxFilter);
    }

    if (bagsFilter > 0) {
      result = result.filter(v => v.bags >= bagsFilter);
    }

    if (priceSort) {
      result.sort((a, b) => {
        const priceA = calculatePrice(a.id).total;
        const priceB = calculatePrice(b.id).total;
        return priceSort === 'asc' ? priceA - priceB : priceB - priceA;
      });
    }

    return result;
  }, [fleet, typeFilter, paxFilter, bagsFilter, priceSort, calculatePrice]);

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [debouncedPickup, setDebouncedPickup] = useState(formData.pickup);
  const [debouncedDropoff, setDebouncedDropoff] = useState(formData.dropoff);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPickup(formData.pickup);
      setDebouncedDropoff(formData.dropoff);
    }, 1000);
    return () => clearTimeout(timer);
  }, [formData.pickup, formData.dropoff]);

  useEffect(() => {
    const fetchFleet = async () => {
      try {
        const fleetSnap = await getDocs(collection(db, 'fleet'));
        setFleet(fleetSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error fetching fleet:', err);
      }
    };

    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'system'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };

    const fetchCoupons = async () => {
      try {
        const couponsSnap = await getDocs(collection(db, 'coupons'));
        setCoupons(couponsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        console.error('Error fetching coupons:', err);
      }
    };

    const fetchExtras = async () => {
      try {
        const extrasSnap = await getDocs(query(collection(db, 'extras'), where('active', '==', true)));
        setExtras(extrasSnap.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) })));
      } catch (err) {
        console.error('Error fetching extras:', err);
      }
    };

    fetchFleet();
    fetchSettings();
    fetchCoupons();
    fetchExtras();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      const fetchUserDetails = async () => {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setFormData(prev => ({
              ...prev,
              guestName: prev.guestName || userData.name || user.displayName || '',
              guestEmail: prev.guestEmail || userData.email || user.email || '',
              guestPhone: prev.guestPhone || userData.phone || '',
            }));
          }
        } catch (err) {
          console.error('Error fetching user details:', err);
        }
      };
      fetchUserDetails();
    }
  }, [user]);

  const minDate = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format

  const minTime = useMemo(() => {
    if (formData.date === minDate) {
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      if (sixHoursLater.toLocaleDateString('en-CA') > minDate) {
        return "23:59";
      }
      return sixHoursLater.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    }
    return undefined;
  }, [formData.date, minDate]);

  const nextStep = () => {
    setError(null);
    if (step === 2) {
      if (!formData.pickup || !formData.dropoff || !formData.date || !formData.time) {
        setError('Please fill in all required fields');
        return;
      }

      const selectedDateTime = new Date(`${formData.date}T${formData.time}`);
      const now = new Date();
      const sixHoursLater = new Date(now.getTime() + 6 * 60 * 60 * 1000);

      if (selectedDateTime < now) {
        setError('The selected date and time have already passed. Please choose a future time.');
        return;
      }

      if (selectedDateTime < sixHoursLater) {
        setError('For operational reasons, bookings must be made at least 6 hours in advance. Please choose a later time.');
        return;
      }
    }
    setStep(s => Math.min(s + 1, 4));
  };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const updateForm = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (field === 'pickup' || field === 'dropoff') {
      setError(null);
      setDirections(null);
      setDistance('');
      setDuration('');
    }
  };

  const directionsCallback = useCallback((result: google.maps.DirectionsResult | null, status: google.maps.DirectionsStatus) => {
    if (result !== null) {
      if (status === 'OK') {
        setDirections(result);
        const route = result.routes[0].legs[0];
        setDistance(route.distance?.text || '');
        setDuration(route.duration?.text || '');
        setError(null);
      } else {
        // Only log critical errors, ignore NOT_FOUND/ZERO_RESULTS as they are handled in UI
        if (status !== 'NOT_FOUND' && status !== 'ZERO_RESULTS') {
          console.error('Directions request failed:', status);
        }

        if (status === 'ZERO_RESULTS') {
          setError('No driving route found between these locations.');
        } else if (status === 'NOT_FOUND') {
          setError('One of the addresses could not be found. Please check your entry.');
        } else {
          setError('Could not calculate directions. Please try a different address.');
        }
        setDirections(null);
        setDistance('');
        setDuration('');
      }
    }
  }, []);

  const directionsOptions = useMemo(() => {
    if (!debouncedPickup || !debouncedDropoff) return null;
    if (debouncedPickup.length < 5 || debouncedDropoff.length < 5) return null;

    const waypoints = formData.waypoints
      .filter(wp => wp.length > 5)
      .map(wp => ({ location: wp, stopover: true }));

    return {
      destination: debouncedDropoff,
      origin: debouncedPickup,
      waypoints: waypoints,
      travelMode: 'DRIVING' as google.maps.TravelMode,
    };
  }, [debouncedPickup, debouncedDropoff, formData.waypoints]);

  const handleVerifyFlight = async () => {
    if (!formData.flightNumber || !formData.date) {
      setError('Please enter flight number and date first');
      return;
    }

    setIsVerifyingFlight(true);
    setError(null);
    try {
      const info = await fetchFlightStatus(formData.flightNumber, formData.date);
      if (info) {
        setFlightInfo(info);
        // If we have an estimated arrival, we could suggest updating the pickup time
        // but for now we just store it.
      } else {
        setError('Could not find flight information. Please check the number and date.');
        setFlightInfo(null);
      }
    } catch (err) {
      setError('Error verifying flight. Please try again later.');
    } finally {
      setIsVerifyingFlight(false);
    }
  };

  const handleValidateCoupon = () => {
    if (!formData.couponCode) return;
    setIsValidatingCoupon(true);
    setCouponError(null);
    setAppliedCoupon(null);

    const coupon = coupons.find(c => c.code.toUpperCase() === formData.couponCode.toUpperCase());

    if (!coupon) {
      setCouponError('Invalid coupon code');
      setIsValidatingCoupon(false);
      return;
    }

    if (!coupon.active) {
      setCouponError('This coupon is no longer active');
      setIsValidatingCoupon(false);
      return;
    }

    const now = new Date();
    if (coupon.startDate && new Date(coupon.startDate) > now) {
      setCouponError('This coupon is not yet valid');
      setIsValidatingCoupon(false);
      return;
    }

    if (coupon.endDate && new Date(coupon.endDate) < now) {
      setCouponError('This coupon has expired');
      setIsValidatingCoupon(false);
      return;
    }

    if (coupon.usageLimit > 0 && (coupon.usedCount || 0) >= coupon.usageLimit) {
      setCouponError('This coupon has reached its usage limit');
      setIsValidatingCoupon(false);
      return;
    }

    if (coupon.serviceIds?.length > 0 && !coupon.serviceIds.includes(formData.serviceType)) {
      setCouponError('This coupon is not valid for the selected service');
      setIsValidatingCoupon(false);
      return;
    }

    setAppliedCoupon(coupon);
    setIsValidatingCoupon(false);
  };

  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      let currentUserId = user?.uid;

      // Handle User Registration if not logged in
      if (!user) {
        if (!formData.guestPassword || formData.guestPassword.length < 6) {
          throw new Error('Please provide a password (min 6 characters) to create your account.');
        }

        try {
          const userCredential = await createUserWithEmailAndPassword(auth, formData.guestEmail, formData.guestPassword);
          currentUserId = userCredential.user.uid;

          // Create user document
          await setDoc(doc(db, 'users', currentUserId), {
            id: currentUserId,
            name: formData.guestName,
            email: formData.guestEmail.toLowerCase(),
            phone: formData.guestPhone,
            role: 'customer',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
            throw new Error('This email is already registered. Please log in first.');
          }
          throw authErr;
        }
      }

      const priceDetails = calculatePrice(formData.vehicle);
      const totalPrice = priceDetails.total;
      const selectedVehicle = fleet.find(v => v.id === formData.vehicle) || vehicles.find(v => v.id === formData.vehicle);

      const bookingData: any = {
        serviceType: formData.serviceType,
        pickup: formData.pickup,
        dropoff: formData.dropoff,
        waypoints: formData.waypoints.filter(wp => wp.length > 5),
        date: formData.date,
        time: formData.time,
        isReturn: formData.isReturn,
        returnDate: formData.returnDate || null,
        returnTime: formData.returnTime || null,
        hours: formData.hours || null,
        purpose: formData.purpose || '',
        vehicleId: formData.vehicle,
        price: totalPrice,
        priceBreakdown: priceDetails,
        status: 'pending',
        flightNumber: formData.flightNumber,
        flightStatus: flightInfo?.status || null,
        flightETA: flightInfo?.estimatedArrival || flightInfo?.scheduledArrival || null,
        passengers: formData.passengers,
        distance: distance,
        duration: duration,
        paymentStatus: 'unpaid',
        paymentMethod: paymentMethod,
        guestName: formData.guestName,
        guestEmail: formData.guestEmail.toLowerCase(),
        guestPhone: formData.guestPhone,
        couponCode: appliedCoupon?.code || null,
        selectedExtras: formData.selectedExtras,
        userId: currentUserId,
      };

      if (paymentMethod === 'card') {
        // Create Stripe Checkout Session
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingData,
            vehicleName: selectedVehicle?.name,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create checkout session');
        }

        const { url } = await response.json();

        if (url) {
          window.location.href = url;
        } else {
          throw new Error('No checkout URL received');
        }
      } else {
        // Cash on Pickup - Create booking directly in Firestore
        try {
          const docRef = await addDoc(collection(db, 'bookings'), {
            ...bookingData,
            read: false,
            createdAt: serverTimestamp(),
          });

          // Update coupon usage if applicable
          if (appliedCoupon) {
            await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
              usedCount: (appliedCoupon.usedCount || 0) + 1
            });
          }

          navigate(`/payment/success?booking_id=${docRef.id}&method=cash`);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, 'bookings');
        }
      }
    } catch (err: any) {
      console.error('Booking error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-red-500 flex items-center gap-2">
          <AlertCircle size={24} />
          <span>Error loading Google Maps. Please try again later.</span>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" size={48} />
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-[#050505]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <Logo className="justify-center mb-8" />
          <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Reservation</span>
          <h1 className="text-4xl md:text-6xl font-display mb-6">Book Your Chauffeur</h1>

          {/* Progress Bar */}
          <div className="flex items-center justify-center gap-4 md:gap-8 mt-12">
            {steps.map((s) => (
              <div key={s.id} className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all",
                  step >= s.id ? "bg-gold text-black" : "bg-white/10 text-white/40"
                )}>
                  {step > s.id ? <CheckCircle size={16} /> : s.id}
                </div>
                <span className={cn(
                  "hidden md:block text-xs uppercase tracking-widest font-bold",
                  step >= s.id ? "text-gold" : "text-white/20"
                )}>
                  {s.name}
                </span>
                {s.id !== 4 && <div className="w-4 md:w-8 h-px bg-white/10" />}
              </div>
            ))}
          </div>
        </div>

        <div className="glass p-8 md:p-12">
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-center gap-3"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {serviceTypes.map((type) => (
                  <button
                    key={type.id}
                    onClick={() => {
                      updateForm('serviceType', type.id);
                      nextStep();
                    }}
                    className={cn(
                      "flex items-center gap-6 p-6 border rounded-lg transition-all text-left group",
                      formData.serviceType === type.id
                        ? "border-gold bg-gold/5"
                        : "border-white/10 hover:border-gold/50 bg-white/5"
                    )}
                  >
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center group-hover:bg-gold transition-colors">
                      <type.icon className="text-gold group-hover:text-black" size={24} />
                    </div>
                    <div>
                      <h3 className="font-display text-xl mb-1">{type.name}</h3>
                      <p className="text-white/40 text-xs">{type.desc}</p>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-gold font-bold">Pickup Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                      <Autocomplete
                        onLoad={(autocomplete) => {
                          autocomplete.addListener('place_changed', () => {
                            const place = autocomplete.getPlace();
                            const address = place.formatted_address || '';
                            updateForm('pickup', address);
                            setDebouncedPickup(address);
                          });
                        }}
                        options={{
                          componentRestrictions: settings?.limitCountry ? { country: settings.limitCountry } : undefined,
                          types: ['address']
                        }}
                      >
                        <input
                          type="text"
                          placeholder="Enter address or airport"
                          className="w-full bg-white/5 border border-white/10 rounded-lg py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                          value={formData.pickup}
                          onChange={(e) => updateForm('pickup', e.target.value)}
                        />
                      </Autocomplete>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-gold font-bold">Dropoff Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                      <Autocomplete
                        onLoad={(autocomplete) => {
                          autocomplete.addListener('place_changed', () => {
                            const place = autocomplete.getPlace();
                            const address = place.formatted_address || '';
                            updateForm('dropoff', address);
                            setDebouncedDropoff(address);
                          });
                        }}
                        options={{
                          componentRestrictions: settings?.limitCountry ? { country: settings.limitCountry } : undefined,
                          types: ['address']
                        }}
                      >
                        <input
                          type="text"
                          placeholder={formData.serviceType === 'hourly' ? "Enter destination (Optional)" : "Enter destination"}
                          className="w-full bg-white/5 border border-white/10 rounded-lg py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                          value={formData.dropoff}
                          onChange={(e) => updateForm('dropoff', e.target.value)}
                        />
                      </Autocomplete>
                    </div>
                  </div>
                </div>

                {/* Waypoints */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs uppercase tracking-widest text-gold font-bold">Waypoints (Optional)</label>
                    <button
                      onClick={() => updateForm('waypoints', [...formData.waypoints, ''])}
                      className="text-gold hover:text-white transition-colors flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest"
                    >
                      <Plus size={14} /> Add Waypoint
                    </button>
                  </div>
                  {formData.waypoints.map((wp, idx) => (
                    <div key={`wp-${idx}`} className="relative flex gap-2">
                      <div className="relative flex-1">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/30" size={16} />
                        <Autocomplete
                          onLoad={(autocomplete) => {
                            autocomplete.addListener('place_changed', () => {
                              const place = autocomplete.getPlace();
                              const address = place.formatted_address || '';
                              const newWps = [...formData.waypoints];
                              newWps[idx] = address;
                              updateForm('waypoints', newWps);
                            });
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Enter waypoint address"
                            className="w-full bg-white/5 border border-white/10 py-3 pl-12 pr-4 focus:border-gold outline-none transition-all text-sm"
                            value={wp}
                            onChange={(e) => {
                              const newWps = [...formData.waypoints];
                              newWps[idx] = e.target.value;
                              updateForm('waypoints', newWps);
                            }}
                          />
                        </Autocomplete>
                      </div>
                      <button
                        onClick={() => updateForm('waypoints', formData.waypoints.filter((_, i) => i !== idx))}
                        className="p-3 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-white transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-gold font-bold">Pickup Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                      <input
                        type="date"
                        min={minDate}
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                        value={formData.date}
                        onChange={(e) => updateForm('date', e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-gold font-bold">Pickup Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                      <input
                        type="time"
                        min={minTime}
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                        value={formData.time}
                        onChange={(e) => updateForm('time', e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Hourly Options */}
                {formData.serviceType === 'hourly' && (
                  <div className="space-y-2">
                    <label className="text-xs uppercase tracking-widest text-gold font-bold">Duration (Hours)</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                      <select
                        value={formData.hours}
                        onChange={(e) => updateForm('hours', parseInt(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg py-4 pl-12 pr-4 focus:border-gold outline-none transition-all appearance-none"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 24].map(h => (
                          <option key={h} value={h} className="bg-black">{h} {h === 1 ? 'Hour' : 'Hours'}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Return Trip Toggle */}
                <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gold/10 rounded-full flex items-center justify-center">
                        <RotateCcw className="text-gold" size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Return Trip</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Book your journey back</p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={formData.isReturn}
                        onChange={(e) => updateForm('isReturn', e.target.checked)}
                      />
                      <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gold"></div>
                    </label>
                  </div>

                  {formData.isReturn && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/5"
                    >
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Return Date</label>
                        <input
                          type="date"
                          min={formData.date || minDate}
                          className="w-full bg-white/5 border border-white/10 py-3 px-4 focus:border-gold outline-none text-sm"
                          value={formData.returnDate}
                          onChange={(e) => updateForm('returnDate', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Return Time</label>
                        <input
                          type="time"
                          className="w-full bg-white/5 border border-white/10 py-3 px-4 focus:border-gold outline-none text-sm"
                          value={formData.returnTime}
                          onChange={(e) => updateForm('returnTime', e.target.value)}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Map and Route Info */}
                <div className="space-y-4">
                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-sm justify-center p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                  <div className="relative">
                    <GoogleMap
                      mapContainerStyle={mapContainerStyle}
                      center={center}
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
                      {directionsOptions && (
                        <DirectionsService
                          options={directionsOptions}
                          callback={directionsCallback}
                        />
                      )}
                      {directions && (
                        <DirectionsRenderer
                          options={{
                            directions: directions,
                            polylineOptions: {
                              strokeColor: '#D4AF37',
                              strokeWeight: 5,
                            },
                          }}
                        />
                      )}
                    </GoogleMap>
                  </div>

                  {distance && duration && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-between p-4 bg-white/5 border border-white/10 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Navigation className="text-gold" size={18} />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/40">Distance</p>
                          <p className="text-sm font-bold">{distance}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="text-gold" size={18} />
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-white/40">Est. Time</p>
                          <p className="text-sm font-bold">{duration}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {formData.serviceType === 'airport' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-gold font-bold">Flight Number (Optional)</label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Plane className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                          <input
                            type="text"
                            placeholder="e.g. QF400"
                            className="w-full bg-white/5 border border-white/10 rounded-lg py-4 pl-12 pr-4 focus:border-gold outline-none transition-all uppercase"
                            value={formData.flightNumber}
                            onChange={(e) => {
                              updateForm('flightNumber', e.target.value.toUpperCase());
                              setFlightInfo(null);
                            }}
                          />
                        </div>
                        <button
                          onClick={handleVerifyFlight}
                          disabled={isVerifyingFlight || !formData.flightNumber}
                          className="bg-white/5 border border-white/10 px-6 hover:border-gold hover:text-gold transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {isVerifyingFlight ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
                          <span className="hidden md:inline text-xs uppercase tracking-widest font-bold">Verify</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-white/40 italic">We track your flight to adjust for delays automatically.</p>
                    </div>

                    {flightInfo && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="p-4 bg-gold/5 border border-gold/20 rounded-lg space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <Plane size={16} className="text-gold" />
                            <span className="text-sm font-bold">{flightInfo.flightNumber}</span>
                          </div>
                          <span className={cn(
                            "text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded",
                            flightInfo.status.toLowerCase().includes('landed') ? "bg-green-500/20 text-green-500" : "bg-blue-500/20 text-blue-500"
                          )}>
                            {flightInfo.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-white/40">Scheduled Arrival</p>
                            <p className="text-xs font-medium">
                              {new Date(flightInfo.scheduledArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {flightInfo.estimatedArrival && (
                            <div>
                              <p className="text-[10px] uppercase tracking-widest text-white/40">Estimated Arrival</p>
                              <p className="text-xs font-bold text-gold">
                                {new Date(flightInfo.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          )}
                        </div>
                        {(flightInfo.terminal || flightInfo.gate) && (
                          <div className="pt-2 border-t border-white/5 flex gap-4">
                            {flightInfo.terminal && (
                              <p className="text-[10px] text-white/60">Terminal: <span className="text-white font-bold">{flightInfo.terminal}</span></p>
                            )}
                            {flightInfo.gate && (
                              <p className="text-[10px] text-white/60">Gate: <span className="text-white font-bold">{flightInfo.gate}</span></p>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                )}

                <div className="flex justify-between pt-6">
                  <button onClick={prevStep} className="btn-outline py-3 px-8">Back</button>
                  <button onClick={nextStep} className="btn-primary py-3 px-12">Continue</button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 lg:grid-cols-3 gap-8"
              >
                <div className="lg:col-span-2 space-y-6">
                  {/* Vehicle Filters */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Type</label>
                      <select
                        className="w-full bg-black/50 border border-white/10 text-[10px] py-2 px-2 outline-none focus:border-gold"
                        onChange={(e) => setTypeFilter(e.target.value)}
                        value={typeFilter}
                      >
                        <option value="all">All Types</option>
                        <option value="sedan">Sedan</option>
                        <option value="suv">SUV</option>
                        <option value="van">Van</option>
                        <option value="luxury">Luxury</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Passengers</label>
                      <select
                        className="w-full bg-black/50 border border-white/10 text-[10px] py-2 px-2 outline-none focus:border-gold"
                        onChange={(e) => setPaxFilter(parseInt(e.target.value))}
                        value={paxFilter}
                      >
                        <option value={0}>Any</option>
                        <option value={2}>2+ Pax</option>
                        <option value={4}>4+ Pax</option>
                        <option value={6}>6+ Pax</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Bags</label>
                      <select
                        className="w-full bg-black/50 border border-white/10 text-[10px] py-2 px-2 outline-none focus:border-gold"
                        onChange={(e) => setBagsFilter(parseInt(e.target.value))}
                        value={bagsFilter}
                      >
                        <option value={0}>Any</option>
                        <option value={2}>2+ Bags</option>
                        <option value={4}>4+ Bags</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] uppercase tracking-widest text-white/40 font-bold">Sort By</label>
                      <select
                        className="w-full bg-black/50 border border-white/10 text-[10px] py-2 px-2 outline-none focus:border-gold"
                        onChange={(e) => setPriceSort(e.target.value as any)}
                        value={priceSort || ''}
                      >
                        <option value="">Default</option>
                        <option value="asc">Price: Low to High</option>
                        <option value="desc">Price: High to Low</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredFleet.map((v) => {
                      const priceDetails = calculatePrice(v.id);
                      return (
                        <button
                          key={v.id}
                          onClick={() => updateForm('vehicle', v.id)}
                          className={cn(
                            "flex flex-col p-4 border transition-all text-left overflow-hidden group",
                            formData.vehicle === v.id
                              ? "border-gold bg-gold/5"
                              : "border-white/10 hover:border-gold/50 bg-white/5"
                          )}
                        >
                          <div className="relative aspect-[16/9] mb-4 overflow-hidden rounded-sm">
                            <img src={v.img || null} alt={v.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" referrerPolicy="no-referrer" />
                            <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-3 py-1 rounded border border-white/10">
                              <span className="text-gold font-bold text-lg">${priceDetails.total}</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="font-display text-xl mb-1">{v.name}</h3>
                            <p className="text-white/40 text-[10px] uppercase tracking-widest mb-4">{v.model}</p>
                            <div className="flex gap-4">
                              <div className="flex items-center gap-2 text-white/60 text-[10px] uppercase tracking-widest font-bold">
                                <User size={12} className="text-gold" /> {v.pax} Pax
                              </div>
                              <div className="flex items-center gap-2 text-white/60 text-[10px] uppercase tracking-widest font-bold">
                                <Briefcase size={12} className="text-gold" /> {v.bags} Bags
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                    {filteredFleet.length === 0 && (
                      <div className="col-span-full text-center py-12 border border-dashed border-white/10 rounded-xl">
                        <Car size={48} className="text-white/10 mx-auto mb-4" />
                        <p className="text-white/40 text-sm">No vehicles match your filters.</p>
                        <button
                          onClick={() => {
                            setTypeFilter('all');
                            setPaxFilter(0);
                            setBagsFilter(0);
                            setPriceSort(null);
                          }}
                          className="text-gold text-xs font-bold uppercase tracking-widest mt-4 hover:text-white transition-colors"
                        >
                          Clear Filters
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Extras Section */}
                  {extras.length > 0 && (
                    <div className="space-y-4 pt-8 border-t border-white/5">
                      <div className="flex items-center gap-3 mb-6">
                        <Plus className="text-gold" size={20} />
                        <h3 className="text-xl font-display text-gold">Extra Options</h3>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {extras.map((extra) => (
                          <button
                            key={extra.id}
                            onClick={() => {
                              const isSelected = formData.selectedExtras.includes(extra.id);
                              updateForm('selectedExtras', isSelected
                                ? formData.selectedExtras.filter(id => id !== extra.id)
                                : [...formData.selectedExtras, extra.id]
                              );
                            }}
                            className={cn(
                              "flex items-center justify-between p-4 rounded-2xl border transition-all text-left",
                              formData.selectedExtras.includes(extra.id)
                                ? "bg-gold/10 border-gold"
                                : "bg-white/5 border-white/10 hover:border-gold/30"
                            )}
                          >
                            <div className="flex-1">
                              <p className="text-sm font-bold text-white">{extra.name}</p>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest line-clamp-1">{extra.description}</p>
                            </div>
                            <div className="text-right ml-4">
                              <p className="text-sm font-display text-gold">${extra.price}</p>
                              <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center mt-1 ml-auto",
                                formData.selectedExtras.includes(extra.id) ? "bg-gold border-gold" : "border-white/20"
                              )}>
                                {formData.selectedExtras.includes(extra.id) && <CheckCircle size={10} className="text-black" />}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar Summary */}
                <div className="space-y-6">
                  <div className="glass p-6 sticky top-32 border border-white/10">
                    <h3 className="text-gold text-xs uppercase tracking-widest font-bold mb-6 border-b border-white/5 pb-4">Booking Summary</h3>
                    
                    <div className="space-y-4 mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                          <MapPin size={14} className="text-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] uppercase tracking-widest text-white/40">Pickup</p>
                          <p className="text-[10px] text-white truncate">{formData.pickup}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                          <MapPin size={14} className="text-gold" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] uppercase tracking-widest text-white/40">Dropoff</p>
                          <p className="text-[10px] text-white truncate">{formData.dropoff || 'Hourly Hire'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                          <Calendar size={14} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-[8px] uppercase tracking-widest text-white/40">Date & Time</p>
                          <p className="text-[10px] text-white">{formData.date} at {formData.time}</p>
                        </div>
                      </div>
                      {formData.isReturn && (
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center">
                            <RotateCcw size={14} className="text-gold" />
                          </div>
                          <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/40">Return Trip</p>
                            <p className="text-[10px] text-white">{formData.returnDate} at {formData.returnTime}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {formData.vehicle && (
                      <div className="space-y-3 pt-6 border-t border-white/5">
                        {settings?.showPriceBreakdown !== false && (
                          <div className="space-y-2">
                            {(() => {
                              const details = calculatePrice(formData.vehicle);
                              return (
                                <>
                                  {settings?.showBasePrice !== false && (
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                      <span>Base Fare</span>
                                      <span>${details.base.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {settings?.showDistancePrice !== false && (
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                      <span>{formData.serviceType === 'hourly' ? `Hourly (${formData.hours}h)` : 'Distance'}</span>
                                      <span>${details.distance.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {details.waypoints > 0 && (
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                      <span>Waypoints</span>
                                      <span>${details.waypoints.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {settings?.showExtrasPrice !== false && details.extras > 0 && (
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                      <span>Extras</span>
                                      <span>${details.extras.toFixed(2)}</span>
                                    </div>
                                  )}
                                  {formData.isReturn && (
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest text-gold font-bold">
                                      <span>Return Trip (2x)</span>
                                      <span>Included</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between pt-4 border-t border-white/10">
                                    <span className="text-white font-bold text-xs uppercase tracking-widest">Total</span>
                                    <span className="text-gold font-bold text-xl">${details.total}</span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-col gap-3 mt-8">
                      <button onClick={nextStep} className="btn-primary w-full py-3 text-xs" disabled={!formData.vehicle}>Continue</button>
                      <button onClick={prevStep} className="btn-outline w-full py-3 text-xs">Back</button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-20 h-20 bg-gold rounded-full flex items-center justify-center mx-auto mb-8">
                  <CheckCircle size={40} className="text-black" />
                </div>
                <h2 className="text-3xl font-display mb-4">Confirm Your Booking</h2>
                <p className="text-white/60 mb-10 max-w-md mx-auto">
                  Please review your details. A confirmation email will be sent once payment is processed.
                </p>

                <div className="bg-white/5 p-6 text-left space-y-4 mb-10 border border-white/10">
                  <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                    <h3 className="text-gold text-xs uppercase tracking-widest font-bold mb-4">Contact Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest text-white/40">Full Name</label>
                        <input
                          type="text"
                          className="w-full bg-white/5 border border-white/10 py-2 px-4 focus:border-gold outline-none text-sm"
                          value={formData.guestName}
                          onChange={(e) => updateForm('guestName', e.target.value)}
                          placeholder="Your Name"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest text-white/40">Email</label>
                        <input
                          type="email"
                          className="w-full bg-white/5 border border-white/10 py-2 px-4 focus:border-gold outline-none text-sm"
                          value={formData.guestEmail}
                          onChange={(e) => updateForm('guestEmail', e.target.value)}
                          placeholder="Email Address"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase tracking-widest text-white/40">Phone</label>
                        <input
                          type="tel"
                          className="w-full bg-white/5 border border-white/10 py-2 px-4 focus:border-gold outline-none text-sm"
                          value={formData.guestPhone}
                          onChange={(e) => updateForm('guestPhone', e.target.value)}
                          placeholder="Phone Number"
                          required
                        />
                      </div>
                      {!user && (
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase tracking-widest text-white/40">Create Password</label>
                          <input
                            type="password"
                            className="w-full bg-white/5 border border-white/10 py-2 px-4 focus:border-gold outline-none text-sm"
                            value={formData.guestPassword}
                            onChange={(e) => updateForm('guestPassword', e.target.value)}
                            placeholder="Min 6 characters"
                            required
                          />
                          <p className="text-[8px] text-white/40 italic">An account will be created for you.</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 pt-2">
                      <label className="text-[10px] uppercase tracking-widest text-white/40">Additional information</label>
                      <textarea
                        className="w-full bg-white/5 border border-white/10 py-2 px-4 focus:border-gold outline-none text-sm min-h-[80px]"
                        value={formData.purpose}
                        onChange={(e) => updateForm('purpose', e.target.value)}
                        placeholder="Optional: Share extra information to make your trip smoother"
                      />
                    </div>
                  </div>

                  {/* Coupon Section */}
                  <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                    <h3 className="text-gold text-xs uppercase tracking-widest font-bold mb-4">Discount Coupon</h3>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gold/50" size={14} />
                        <input
                          type="text"
                          placeholder="Enter coupon code"
                          className="w-full bg-white/5 border border-white/10 py-2 pl-10 pr-4 focus:border-gold outline-none text-sm uppercase"
                          value={formData.couponCode}
                          onChange={(e) => updateForm('couponCode', e.target.value.toUpperCase())}
                        />
                      </div>
                      <button
                        onClick={handleValidateCoupon}
                        disabled={isValidatingCoupon || !formData.couponCode}
                        className="bg-gold text-black px-4 text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50"
                      >
                        {isValidatingCoupon ? <Loader2 size={14} className="animate-spin" /> : 'Apply'}
                      </button>
                    </div>
                    {couponError && <p className="text-red-500 text-[10px]">{couponError}</p>}
                    {appliedCoupon && (
                      <div className="flex items-center justify-between bg-gold/10 border border-gold/20 p-2 rounded">
                        <div className="flex items-center gap-2 text-gold text-[10px] font-bold uppercase tracking-widest">
                          <CheckCircle size={14} />
                          Coupon Applied: {appliedCoupon.code}
                        </div>
                        <button
                          onClick={() => {
                            setAppliedCoupon(null);
                            updateForm('couponCode', '');
                          }}
                          className="text-white/40 hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-6 mb-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <Info size={20} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-gold font-bold text-sm">{serviceTypes.find(t => t.id === formData.serviceType)?.name}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Service Type</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <Car size={20} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-gold font-bold text-sm">{(fleet.find(v => v.id === formData.vehicle) || vehicles.find(v => v.id === formData.vehicle))?.name}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Selected Vehicle</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl md:col-span-2">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <MapPin size={20} className="text-gold" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{formData.pickup}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Pickup Location</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl md:col-span-2">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <MapPin size={20} className="text-gold" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{formData.dropoff || 'Hourly Hire'}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Dropoff Location</p>
                        </div>
                      </div>

                      {formData.waypoints.filter(wp => wp.length > 5).length > 0 && (
                        <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl md:col-span-2">
                          <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                            <Navigation size={20} className="text-gold" />
                          </div>
                          <div className="flex-1 space-y-2">
                            {formData.waypoints.filter(wp => wp.length > 5).map((wp, idx) => (
                              <p key={idx} className="text-white text-sm font-medium">{wp}</p>
                            ))}
                            <p className="text-[10px] text-white/40 uppercase tracking-widest">Waypoints</p>
                          </div>
                        </div>
                      )}

                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <Calendar size={20} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{formData.date}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Pickup Date</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <Clock size={20} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">{formData.time}</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Pickup Time</p>
                        </div>
                      </div>

                      {formData.isReturn && (
                        <>
                          <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                              <Calendar size={20} className="text-gold" />
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{formData.returnDate}</p>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest">Return Date</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                            <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                              <Clock size={20} className="text-gold" />
                            </div>
                            <div>
                              <p className="text-white text-sm font-medium">{formData.returnTime}</p>
                              <p className="text-[10px] text-white/40 uppercase tracking-widest">Return Time</p>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <Navigation size={20} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {(() => {
                              const distVal = parseFloat(distance.replace(/[^\d.]/g, '')) || 0;
                              return formData.isReturn ? `${(distVal * 2).toFixed(1)} km` : distance;
                            })()}
                          </p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Total Distance</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-4 p-4 bg-white/5 border border-white/10 rounded-2xl">
                        <div className="w-10 h-10 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                          <Clock size={20} className="text-gold" />
                        </div>
                        <div>
                          <p className="text-white text-sm font-medium">
                            {(() => {
                              if (!duration) return 'N/A';
                              const match = duration.match(/(\d+)\s*min/);
                              if (match && formData.isReturn) {
                                const mins = parseInt(match[1]);
                                return `${mins * 2} mins`;
                              }
                              return duration;
                            })()}
                          </p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Est. Travel Time</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  {settings?.showPriceBreakdown !== false && (
                    <div className="space-y-2 pt-4 border-t border-white/10">
                      <h3 className="text-gold text-[10px] uppercase tracking-widest font-bold mb-2">Price Breakdown</h3>
                      {(() => {
                        const details = calculatePrice(formData.vehicle);
                        return (
                          <>
                            {settings?.showBasePrice !== false && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                <span>Base Fare</span>
                                <span>${details.base.toFixed(2)}</span>
                              </div>
                            )}
                            {settings?.showDistancePrice !== false && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                <span>{formData.serviceType === 'hourly' ? `Hourly Charge (${formData.hours}h)` : 'Distance Charge'}</span>
                                <span>${details.distance.toFixed(2)}</span>
                              </div>
                            )}
                            {settings?.showExtrasPrice !== false && details.extras > 0 && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                <span>Extra Options</span>
                                <span>${details.extras.toFixed(2)}</span>
                              </div>
                            )}
                            {formData.isReturn && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                <span>Return Trip (2x)</span>
                                <span>Included</span>
                              </div>
                            )}
                            {settings?.showDiscount !== false && details.discount > 0 && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-green-500">
                                <span>Discount ({appliedCoupon?.code})</span>
                                <span>-${details.discount.toFixed(2)}</span>
                              </div>
                            )}
                            {settings?.showNetPrice !== false && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40 border-t border-white/5 pt-2">
                                <span>Net Price</span>
                                <span>${details.net.toFixed(2)}</span>
                              </div>
                            )}
                            {settings?.showTax !== false && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                <span>Tax ({settings?.taxPercentage || 0}%)</span>
                                <span>${details.tax.toFixed(2)}</span>
                              </div>
                            )}
                            {settings?.showStripeFees !== false && details.stripe > 0 && (
                              <div className="flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                                <span>Stripe Fees</span>
                                <span>${details.stripe.toFixed(2)}</span>
                              </div>
                            )}
                            {settings?.showGrossPrice !== false && (
                              <div className="flex justify-between pt-4 pb-6 border-b border-white/10">
                                <span className="text-white font-bold">Total Price</span>
                                <span className="text-gold font-bold text-2xl">${details.total.toFixed(2)}</span>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}

                  <div className="pt-6 space-y-4">
                    <h3 className="text-gold text-xs uppercase tracking-widest font-bold mb-4">Payment Method</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setPaymentMethod('card')}
                        className={cn(
                          "flex items-center gap-4 p-4 border transition-all text-left",
                          paymentMethod === 'card'
                            ? "border-gold bg-gold/5"
                            : "border-white/10 hover:border-gold/50 bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          paymentMethod === 'card' ? "bg-gold text-black" : "bg-white/10 text-white/60"
                        )}>
                          <CreditCard size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Credit/Debit Card</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Secure via Stripe</p>
                        </div>
                      </button>

                      <button
                        onClick={() => setPaymentMethod('cash')}
                        className={cn(
                          "flex items-center gap-4 p-4 border transition-all text-left",
                          paymentMethod === 'cash'
                            ? "border-gold bg-gold/5"
                            : "border-white/10 hover:border-gold/50 bg-white/5"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center",
                          paymentMethod === 'cash' ? "bg-gold text-black" : "bg-white/10 text-white/60"
                        )}>
                          <Banknote size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Cash on Pickup</p>
                          <p className="text-[10px] text-white/40 uppercase tracking-widest">Pay the driver</p>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {error && (
                    <div className="flex items-center gap-2 text-red-500 text-sm justify-center mb-4">
                      <AlertCircle size={16} />
                      {error}
                    </div>
                  )}
                  <button
                    onClick={handleConfirmBooking}
                    disabled={isSubmitting || (!user && (!formData.guestName || !formData.guestEmail || !formData.guestPhone))}
                    className="btn-primary w-full py-4 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      paymentMethod === 'card' ? 'Pay & Confirm Booking' : 'Confirm Booking'
                    )}
                  </button>
                  <button onClick={prevStep} className="text-white/40 hover:text-white text-xs uppercase tracking-widest transition-colors">Edit Details</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
