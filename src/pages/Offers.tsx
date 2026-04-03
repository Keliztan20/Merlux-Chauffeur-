import { useState, FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plane, Car, ArrowRight, Tag, MapPin, Star, CheckCircle2, User, Mail, Phone, Calendar, Clock, CreditCard } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '../lib/utils';
import Logo from '../components/layout/Logo';

const OFFERS = [
  {
    id: 'mel-city',
    title: "Airport to Melbourne CBD",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop",
    description: "Fixed rate transfer between Melbourne Airport and the CBD.",
    fleets: [
      { type: 'Executive Sedan', basePrice: 120, salePrice: 99, capacity: '3 Passengers' },
      { type: 'Premium SUV', basePrice: 180, salePrice: 159, capacity: '6 Passengers' },
      { type: 'Luxury Van', basePrice: 220, salePrice: 195, capacity: '7 Passengers' },
      { type: 'Luxury Van', basePrice: 220, salePrice: 195, capacity: '7 Passengers' }
    ]
  },
  {
    id: 'mel-suburbs',
    title: "Airport to Eastern Suburbs",
    image: "https://images.unsplash.com/photo-1542362567-b058c02b9ac1?q=80&w=2070&auto=format&fit=crop",
    description: "Premium transfer to Box Hill, Glen Waverley, and surrounding areas.",
    fleets: [
      { type: 'Executive Sedan', basePrice: 150, salePrice: 129, capacity: '3 Passengers' },
      { type: 'Premium SUV', basePrice: 210, salePrice: 189, capacity: '6 Passengers' },
      { type: 'Luxury Van', basePrice: 250, salePrice: 225, capacity: '7 Passengers' }
    ]
  },
  {
    id: 'mel-mornington',
    title: "Airport to Mornington Peninsula",
    image: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=2070&auto=format&fit=crop",
    description: "Long distance luxury transfer to the beautiful Mornington Peninsula.",
    fleets: [
      { type: 'Executive Sedan', basePrice: 280, salePrice: 249, capacity: '3 Passengers' },
      { type: 'Premium SUV', basePrice: 340, salePrice: 309, capacity: '6 Passengers' },
      { type: 'Luxury Van', basePrice: 380, salePrice: 345, capacity: '7 Passengers' }
    ]
  }
];

export default function Offers() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [selectedFleet, setSelectedFleet] = useState<any>(null);
  const [details, setDetails] = useState({
    name: '',
    email: '',
    phone: '',
    pickup: '',
    dropoff: '',
    date: '',
    time: ''
  });

  const handlePackageSelect = (pkg: any) => {
    setSelectedPackage(pkg);
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

  const reset = () => {
    setStep(1);
    setSelectedPackage(null);
    setSelectedFleet(null);
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
            Exclusive Deals
          </motion.span>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-display mb-6"
          >
            Special <span className="text-gold italic">Offers</span>
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
              {OFFERS.map((pkg) => (
                <div 
                  key={pkg.id}
                  onClick={() => handlePackageSelect(pkg)}
                  className="group bg-white/5 border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-gold/50 transition-all duration-500 cursor-pointer"
                >
                  <div className="aspect-[16/10] overflow-hidden">
                    <img src={pkg.image} alt={pkg.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  </div>
                  <div className="p-8">
                    <h3 className="text-2xl font-display mb-4">{pkg.title}</h3>
                    <p className="text-white/60 text-sm mb-6 leading-relaxed">{pkg.description}</p>
                    <div className="flex items-center gap-2 text-gold font-bold uppercase tracking-widest text-[10px]">
                      Select Package <ArrowRight size={14} />
                    </div>
                  </div>
                </div>
              ))}
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
                <ArrowRight size={14} className="rotate-180" /> Back to Packages
              </button>
              <h2 className="text-3xl font-display mb-8">Select <span className="text-gold italic">Fleet Type</span></h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {selectedPackage.fleets.map((fleet: any) => (
                  <div 
                    key={fleet.type}
                    onClick={() => handleFleetSelect(fleet)}
                    className="bg-white/5 border border-white/10 p-8 rounded-3xl hover:border-gold/50 transition-all cursor-pointer group"
                  >
                    <p className="text-gold text-[10px] uppercase tracking-widest font-bold mb-2">{fleet.capacity}</p>
                    <h4 className="text-xl font-bold mb-4">{fleet.type}</h4>
                    <div className="mb-6">
                      <p className="text-white/30 text-xs line-through">${fleet.basePrice}</p>
                      <p className="text-3xl font-display text-white">${fleet.salePrice}</p>
                    </div>
                    <div className="w-full bg-white/10 py-3 rounded-xl text-center text-[10px] uppercase tracking-widest font-bold group-hover:bg-gold group-hover:text-black transition-all">
                      Select
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
                <ArrowRight size={14} className="rotate-180" /> Back to Fleet
              </button>
              <h2 className="text-3xl font-display mb-8">Enter <span className="text-gold italic">Details</span></h2>
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
                        onChange={(e) => setDetails({...details, name: e.target.value})}
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
                        onChange={(e) => setDetails({...details, email: e.target.value})}
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
                      onChange={(e) => setDetails({...details, phone: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all" 
                      placeholder="+61 400 000 000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Pickup Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                      <input 
                        required
                        type="text" 
                        value={details.pickup}
                        onChange={(e) => setDetails({...details, pickup: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all" 
                        placeholder="Melbourne Airport"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Dropoff Address</label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                      <input 
                        required
                        type="text" 
                        value={details.dropoff}
                        onChange={(e) => setDetails({...details, dropoff: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all" 
                        placeholder="123 Collins St, Melbourne"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest font-bold text-white/40">Pickup Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={16} />
                      <input 
                        required
                        type="date" 
                        value={details.date}
                        onChange={(e) => setDetails({...details, date: e.target.value})}
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
                        onChange={(e) => setDetails({...details, time: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 focus:border-gold outline-none transition-all" 
                      />
                    </div>
                  </div>
                </div>
                <button type="submit" className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-2xl shadow-gold/20">
                  Confirm Details
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
                <h2 className="text-3xl font-display mb-4">Booking <span className="text-gold italic">Summary</span></h2>
                <div className="space-y-4 mb-10 text-left bg-black/40 p-8 rounded-2xl border border-white/5">
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Service</span>
                    <span className="text-white font-bold">{selectedPackage.title}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Vehicle</span>
                    <span className="text-white font-bold">{selectedFleet.type}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Pickup</span>
                    <span className="text-white font-bold">{details.pickup}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-4">
                    <span className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Date & Time</span>
                    <span className="text-white font-bold">{details.date} at {details.time}</span>
                  </div>
                  <div className="flex justify-between pt-4">
                    <span className="text-gold text-sm uppercase tracking-widest font-bold">Total Amount</span>
                    <span className="text-3xl font-display text-white">${selectedFleet.salePrice}</span>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/payment/success')}
                  className="w-full bg-gold text-black py-5 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white transition-all shadow-2xl shadow-gold/20 mb-4"
                >
                  Pay Now & Finalize
                </button>
                <button onClick={reset} className="text-white/40 uppercase tracking-widest text-[10px] font-bold hover:text-white transition-colors">
                  Cancel & Start Over
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Trust Badges */}
      <section className="bg-white/5 py-16 border-y border-white/10 mt-24">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { icon: Tag, title: "Fixed Rates", desc: "No surge pricing" },
            { icon: Plane, title: "Flight Tracking", desc: "We wait for you" },
            { icon: Car, title: "Premium Fleet", desc: "Late model luxury" },
            { icon: Star, title: "5-Star Service", desc: "Professional drivers" }
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
