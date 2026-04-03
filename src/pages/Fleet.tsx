import { motion } from 'motion/react';
import { User, Briefcase, Check, Star } from 'lucide-react';
import { Link } from 'react-router-dom';

const fleet = [
  {
    id: 'sedan',
    name: 'Luxury Sedan',
    model: 'Mercedes-Benz E-Class',
    pax: 3,
    bags: 2,
    features: ['Leather Interior', 'Climate Control', 'Bottled Water', 'WiFi'],
    img: 'https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?q=80&w=2070&auto=format&fit=crop',
    desc: 'Perfect for corporate travel and airport transfers for up to 3 passengers.'
  },
  {
    id: 'suv',
    name: 'Business SUV',
    model: 'Audi Q7 / BMW X5',
    pax: 4,
    bags: 4,
    features: ['Spacious Cabin', 'Panoramic Roof', 'Extra Luggage Space', 'Heated Seats'],
    img: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=2070&auto=format&fit=crop',
    desc: 'Ideal for small groups or families requiring extra luggage capacity.'
  },
  {
    id: 'first',
    name: 'First Class',
    model: 'Mercedes-Benz S-Class',
    pax: 2,
    bags: 2,
    features: ['Rear Seat Entertainment', 'Massage Seats', 'Privacy Blinds', 'Premium Sound'],
    img: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?q=80&w=2070&auto=format&fit=crop',
    desc: 'The ultimate in luxury and comfort for VIP clients and special occasions.'
  },
  {
    id: 'van',
    name: 'Executive Van',
    model: 'Mercedes-Benz V-Class',
    pax: 7,
    bags: 7,
    features: ['Conference Seating', 'Dual Sliding Doors', 'Large Luggage Area', 'USB Ports'],
    img: 'https://images.unsplash.com/photo-1532581291347-9c39cf10a73c?q=80&w=2070&auto=format&fit=crop',
    desc: 'Versatile transport for larger groups, corporate teams, or wedding parties.'
  }
];

export default function Fleet() {
  return (
    <div className="pt-32 pb-24 bg-black">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-20">
          <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Our Fleet</span>
          <h1 className="text-5xl md:text-7xl font-display mb-6">Exquisite Vehicles</h1>
          <p className="text-white/50 max-w-2xl mx-auto font-light tracking-wide">
            Experience the pinnacle of automotive engineering with our meticulously maintained fleet of premium vehicles.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-24">
          {fleet.map((car, i) => (
            <motion.div
              key={car.id}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className={cn(
                "flex flex-col lg:flex-row gap-12 items-center",
                i % 2 === 1 ? "lg:flex-row-reverse" : ""
              )}
            >
              <div className="flex-1 relative group">
                <div className="absolute -inset-4 bg-gold/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <img
                  src={car.img}
                  alt={car.name}
                  className="relative w-full h-[400px] object-cover rounded-sm border border-white/10"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex-1 space-y-8">
                <div>
                  <h2 className="text-4xl md:text-5xl font-display mb-2">{car.name}</h2>
                  <p className="text-gold font-bold tracking-widest uppercase text-sm">{car.model}</p>
                </div>
                
                <p className="text-white/60 leading-relaxed">
                  {car.desc}
                </p>

                <div className="grid grid-cols-2 gap-6">
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
                      <User size={18} className="text-gold" />
                    </div>
                    <span className="text-sm">{car.pax} Passengers</span>
                  </div>
                  <div className="flex items-center gap-3 text-white/80">
                    <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center">
                      <Briefcase size={18} className="text-gold" />
                    </div>
                    <span className="text-sm">{car.bags} Suitcases</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-widest font-bold text-white/40">Key Features</h4>
                  <div className="grid grid-cols-2 gap-y-2">
                    {car.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2 text-sm text-white/70">
                        <Check size={14} className="text-gold" /> {feature}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <Link to="/booking" className="btn-primary inline-block">
                    Book This Vehicle
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
