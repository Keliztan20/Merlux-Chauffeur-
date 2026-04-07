import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MapPin, Calendar, Clock, Car, User, 
  ChevronRight, ChevronLeft, CheckCircle, 
  Plane, Briefcase, Heart, Map, Info,
  Navigation, AlertCircle, Search, Loader2,
  CreditCard, Banknote
} from 'lucide-react';
import { GoogleMap, useJsApiLoader, DirectionsService, DirectionsRenderer, Autocomplete } from '@react-google-maps/api';
import { cn } from '../lib/utils';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDoc, doc, getDocs } from 'firebase/firestore';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
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
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [distance, setDistance] = useState<string>('');
  const [duration, setDuration] = useState<string>('');
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

    fetchFleet();
    fetchSettings();
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
    // Only trigger if addresses seem reasonably complete to avoid NOT_FOUND errors while typing
    if (debouncedPickup.length < 5 || debouncedDropoff.length < 5) return null;
    
    return {
      destination: debouncedDropoff,
      origin: debouncedPickup,
      travelMode: 'DRIVING' as google.maps.TravelMode,
    };
  }, [debouncedPickup, debouncedDropoff]);

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

  const calculatePrice = useCallback((vehicleId: string) => {
    const vehicle = fleet.find(v => v.id === vehicleId);
    if (!vehicle) return 0;

    const distanceKm = parseFloat(distance.replace(/[^\d.]/g, '')) || 0;
    let price = Number(vehicle.price) || 0; // Base price

    // Add KM-based surcharge
    if (vehicle.kmRanges && vehicle.kmRanges.length > 0) {
      const range = vehicle.kmRanges.find((r: any) => {
        // Handle labels like "0-25", "25-50", "50+"
        if (r.label.includes('+')) {
          const min = parseFloat(r.label.replace('+', ''));
          return distanceKm >= min;
        }
        const [min, max] = r.label.split('-').map(Number);
        return distanceKm >= min && distanceKm <= max;
      });
      if (range) {
        price += Number(range.surcharge);
      }
    }

    // Add tax
    if (settings?.taxPercentage) {
      price = price * (1 + Number(settings.taxPercentage) / 100);
    }

    return Math.round(price);
  }, [fleet, distance, settings]);

  const handleConfirmBooking = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const totalPrice = calculatePrice(formData.vehicle);
      const selectedVehicle = fleet.find(v => v.id === formData.vehicle) || vehicles.find(v => v.id === formData.vehicle);
      const bookingData: any = {
        serviceType: formData.serviceType,
        pickup: formData.pickup,
        dropoff: formData.dropoff,
        date: formData.date,
        time: formData.time,
        vehicleId: formData.vehicle,
        price: totalPrice,
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
        guestEmail: formData.guestEmail,
        guestPhone: formData.guestPhone,
      };

      if (user) {
        bookingData.userId = user.uid;
      }

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
      <div className="max-w-4xl mx-auto px-6">
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
                        "flex items-center gap-6 p-6 border transition-all text-left group",
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
                              setDebouncedPickup(address); // Update immediately on selection
                            });
                          }}
                        >
                          <input 
                            type="text" 
                            placeholder="Enter address or airport"
                            className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
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
                              setDebouncedDropoff(address); // Update immediately on selection
                            });
                          }}
                        >
                          <input 
                            type="text" 
                            placeholder="Enter destination"
                            className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                            value={formData.dropoff}
                            onChange={(e) => updateForm('dropoff', e.target.value)}
                          />
                        </Autocomplete>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-gold font-bold">Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                        <input 
                          type="date" 
                          min={minDate}
                          className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                          value={formData.date}
                          onChange={(e) => updateForm('date', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs uppercase tracking-widest text-gold font-bold">Time</label>
                      <div className="relative">
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold/50" size={18} />
                        <input 
                          type="time" 
                          min={minTime}
                          className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                          value={formData.time}
                          onChange={(e) => updateForm('time', e.target.value)}
                        />
                      </div>
                    </div>
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
                              className="w-full bg-white/5 border border-white/10 py-4 pl-12 pr-4 focus:border-gold outline-none transition-all uppercase"
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
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 gap-4">
                  {(fleet.length > 0 ? fleet : vehicles).map((v) => (
                    <button
                      key={v.id}
                      onClick={() => updateForm('vehicle', v.id)}
                      className={cn(
                        "flex flex-col md:flex-row items-center gap-6 p-4 border transition-all text-left overflow-hidden",
                        formData.vehicle === v.id 
                          ? "border-gold bg-gold/5" 
                          : "border-white/10 hover:border-gold/50 bg-white/5"
                      )}
                    >
                      <img src={v.img} alt={v.name} className="w-full md:w-48 h-32 object-cover rounded-sm" referrerPolicy="no-referrer" />
                      <div className="flex-1 p-2">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-display text-2xl">{v.name}</h3>
                          <div className="text-right">
                            <span className="text-gold font-bold text-xl">${calculatePrice(v.id) || v.price}</span>
                            <p className="text-[8px] text-white/40 uppercase font-bold">Estimated</p>
                          </div>
                        </div>
                        <p className="text-white/40 text-sm mb-4">{v.model}</p>
                        <div className="flex gap-6">
                          <div className="flex items-center gap-2 text-white/60 text-xs">
                            <User size={14} className="text-gold" /> {v.pax} Passengers
                          </div>
                          <div className="flex items-center gap-2 text-white/60 text-xs">
                            <Briefcase size={14} className="text-gold" /> {v.bags} Bags
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                  </div>

                  <div className="flex justify-between pt-6">
                    <button onClick={prevStep} className="btn-outline py-3 px-8">Back</button>
                    <button onClick={nextStep} className="btn-primary py-3 px-12" disabled={!formData.vehicle}>Continue</button>
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
                      </div>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40 text-xs uppercase tracking-widest">Service</span>
                      <span className="text-gold font-bold">{serviceTypes.find(t => t.id === formData.serviceType)?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40 text-xs uppercase tracking-widest">Vehicle</span>
                      <span className="text-gold font-bold">{(fleet.find(v => v.id === formData.vehicle) || vehicles.find(v => v.id === formData.vehicle))?.name}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40 text-xs uppercase tracking-widest">Pickup</span>
                      <span className="text-white text-sm">{formData.pickup}</span>
                    </div>
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <span className="text-white/40 text-xs uppercase tracking-widest">Dropoff</span>
                      <span className="text-white text-sm">{formData.dropoff}</span>
                    </div>
                    {distance && (
                      <div className="flex justify-between border-b border-white/5 pb-2">
                        <span className="text-white/40 text-xs uppercase tracking-widest">Distance</span>
                        <span className="text-white text-sm">{distance}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-4 pb-6 border-b border-white/10">
                      <span className="text-white font-bold">Total Price</span>
                      <span className="text-gold font-bold text-2xl">${calculatePrice(formData.vehicle)}</span>
                    </div>

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
