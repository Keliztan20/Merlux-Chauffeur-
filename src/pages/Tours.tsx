import { useState, FormEvent, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Clock, Users, ArrowRight, Star, Calendar, User, Mail, Phone, CreditCard, Minus, Plus } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import Logo from '../components/layout/Logo';

export default function Tours() {
  const navigate = useNavigate();
  const [tours, setTours] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [selectedTour, setSelectedTour] = useState<any>(null);
  const [selectedFleet, setSelectedFleet] = useState<any>(null);
  const [quantity, setQuantity] = useState(1);
  const [details, setDetails] = useState({
    name: '',
    email: '',
    phone: '',
    pickup: '',
    date: '',
    time: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'tours'), where('active', '==', true));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const parsedTours = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTours(parsedTours);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleTourSelect = (tour: any) => {
    setSelectedTour(tour);
    // Auto-select a fleet based on tour data
    setSelectedFleet({
      type: '8-Seater Mercedes',
      pricePerVehicle: tour.price,
      capacity: `1-${tour.capacity} Passengers`
    });
    setStep(2);
  };

  const handleFleetSelect = (fleet: any) => {
    setSelectedFleet(fleet);
    setStep(3);
  };

  const handleDetailsSubmit = (e: FormEvent) => {
    e.preventDefault();
    setStep(4);
  };

  const totalPrice = selectedFleet ? selectedFleet.pricePerVehicle * quantity : 0;

  const reset = () => {
    setStep(1);
    setSelectedTour(null);
    setSelectedFleet(null);
    setQuantity(1);
  };

  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      <section className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <Logo className="justify-center mb-8" />
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block"
          >
            Luxury Experiences
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-display mb-6"
          >
            Private <span className="text-gold italic">Tours</span>
          </motion.h1>

          {/* Progress Bar */}
          <div className="flex items-center justify-center gap-4 mb-12">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all duration-500",
                  step >= s ? "bg-gold text-black" : "bg-white/10 text-white/40"
                )}>
                  {s}
                </div>
                {s < 4 && <div className={cn("w-8 h-px", step > s ? "bg-gold" : "bg-white/10")} />}
              </div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              {isLoading ? (
                <div className="col-span-full flex flex-col items-center justify-center py-24">
                  <div className="w-12 h-12 border-4 border-gold/20 border-t-gold rounded-full animate-spin mb-4" />
                  <p className="text-white/40 uppercase tracking-[0.2em] text-[10px] font-bold">Loading exclusive tours...</p>
                </div>
              ) : tours.length > 0 ? (
                tours.map((tour) => (
                  <div
                    key={tour.id}
                    onClick={() => handleTourSelect(tour)}
                    className="group bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-gold/50 transition-all duration-500 cursor-pointer"
                  >
                    <div className="aspect-[16/10] overflow-hidden">
                      <img src={tour.image || null} alt={tour.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                    </div>
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="flex items-center gap-1 text-gold text-[10px] uppercase tracking-widest font-bold">
                          <Clock size={12} /> {tour.duration}
                        </div>
                      </div>
                      <h3 className="text-2xl font-display mb-4">{tour.title}</h3>
                      <p className="text-white/60 text-sm mb-6 leading-relaxed italic line-clamp-2">"{tour.description}"</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gold font-bold uppercase tracking-widest text-[10px]">
                          View Packages <ArrowRight size={14} />
                        </div>
                        <p className="text-xl font-display text-white">From ${tour.price}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-24 text-center glass rounded-3xl border border-white/5">
                  <p className="text-white/40 italic">No luxury tours currently available for booking.</p>
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <button onClick={() => setStep(1)} className="text-gold mb-8 flex items-center gap-2 uppercase tracking-widest text-[10px] font-bold">
                <ArrowRight size={14} className="rotate-180" /> Back to Tours
              </button>
              <h2 className="text-3xl font-display mb-8">Select <span className="text-gold italic">Vehicle & Quantity</span></h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {(selectedTour?.fleets && Array.isArray(selectedTour.fleets) ? selectedTour.fleets : [
                  { type: '8-Seater Mercedes', pricePerVehicle: selectedTour?.price || 0, capacity: `1-${selectedTour?.capacity || 7} Passengers` },
                  { type: '12-Seater Vehicle', pricePerVehicle: Math.round((selectedTour?.price || 0) * 1.25), capacity: '8-11 Passengers' }
                ]).map((fleet: any, idx: number) => (
                  <div
                    key={`${fleet.type}-${idx}`}
                    onClick={() => handleFleetSelect(fleet)}
                    className="bg-white/5 border border-white/10 p-10 rounded-[2.5rem] hover:border-gold/50 transition-all cursor-pointer group relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 bg-gold text-black px-6 py-2 rounded-bl-2xl font-bold text-[10px] uppercase tracking-widest">
                      {fleet.capacity}
                    </div>
                    <h4 className="text-2xl font-display mb-6">{fleet.type}</h4>
                    <div className="mb-8">
                      <p className="text-white/40 text-xs uppercase tracking-widest font-bold mb-1">Price per vehicle</p>
                      <p className="text-4xl font-display text-white">${fleet.pricePerVehicle}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between bg-black/40 p-4 rounded-2xl border border-white/5">
                        <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Quantity</span>
                        <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setQuantity(Math.max(1, quantity - 1))}
                            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="text-xl font-display w-8 text-center">{quantity}</span>
                          <button
                            onClick={() => setQuantity(quantity + 1)}
                            className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center hover:bg-gold hover:text-black transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-4 border-t border-white/10">
                        <span className="text-gold text-[10px] uppercase tracking-widest font-bold">Total</span>
                        <span className="text-2xl font-display text-white">${(fleet.pricePerVehicle * quantity).toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-8 w-full bg-white/10 py-4 rounded-2xl text-center text-[10px] uppercase tracking-widest font-bold group-hover:bg-gold group-hover:text-black transition-all">
                      Select This Option
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-2xl mx-auto"
            >
              <button onClick={() => setStep(2)} className="text-gold mb-8 flex items-center gap-2 uppercase tracking-widest text-[10px] font-bold">
                <ArrowRight size={14} className="rotate-180" /> Back to Vehicle
              </button>
              <h2 className="text-3xl font-display mb-8">Booking <span className="text-gold italic">Details</span></h2>
              <form onSubmit={handleDetailsSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                      <input
                        required
                        type="text"
                        value={details.name}
                        onChange={(e) => setDetails({ ...details, name: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                      <input
                        required
                        type="email"
                        value={details.email}
                        onChange={(e) => setDetails({ ...details, email: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                    <input
                      required
                      type="tel"
                      value={details.phone}
                      onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                      placeholder="+61 400 000 000"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Pickup Address</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                    <input
                      required
                      type="text"
                      value={details.pickup}
                      onChange={(e) => setDetails({ ...details, pickup: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                      placeholder="Hotel or Residential Address"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Tour Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                      <input
                        required
                        type="date"
                        value={details.date}
                        onChange={(e) => setDetails({ ...details, date: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Pickup Time</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                      <input
                        required
                        type="time"
                        value={details.time}
                        onChange={(e) => setDetails({ ...details, time: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-2xl shadow-gold/20">
                  Confirm Booking Details
                </button>
              </form>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div
              key="step4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-xl mx-auto"
            >
              <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 text-center">
                <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-gold/20">
                  <CreditCard className="text-gold" size={32} />
                </div>
                <h2 className="text-3xl font-display mb-4">Tour <span className="text-gold italic">Summary</span></h2>
                <div className="space-y-4 mb-10 text-left bg-black/40 p-8 rounded-2xl border border-white/5">
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Tour</span>
                    <span className="text-white font-bold">{selectedTour.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Vehicle</span>
                    <span className="text-white font-bold">{selectedFleet.type}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Quantity</span>
                    <span className="text-white font-bold">{quantity} Vehicle(s)</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Date & Time</span>
                    <span className="text-white font-bold">{details.date} at {details.time}</span>
                  </div>
                  <div className="flex justify-between pt-4">
                    <span className="text-gold text-sm uppercase tracking-widest font-bold">Total Amount</span>
                    <span className="text-3xl font-display text-white">${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/payment/success')}
                  className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-2xl shadow-gold/20 mb-4"
                >
                  Pay Now & Book Tour
                </button>
                <button onClick={reset} className="text-white/40 uppercase tracking-widest text-[10px] font-bold hover:text-white transition-colors">
                  Cancel & Start Over
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Features */}
      <section className="bg-white/5 py-16 border-y border-white/10 mt-24">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: MapPin, title: "Custom Routes", desc: "Personalized itineraries" },
            { icon: Clock, title: "Flexible Time", desc: "No rushing allowed" },
            { icon: Users, title: "Private Groups", desc: "Just you and yours" },
            { icon: Star, title: "Expert Guides", desc: "Local knowledge" }
          ].map((item, i) => (
            <div key={i} className="text-center">
              <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center mx-auto mb-4 border border-gold/20">
                <item.icon className="text-gold" size={20} />
              </div>
              <h4 className="text-sm font-bold uppercase tracking-widest mb-1">{item.title}</h4>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
