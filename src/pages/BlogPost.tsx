import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Calendar, User, ArrowLeft, Clock, Share2 } from 'lucide-react';

const BLOG_POSTS = [
  {
    id: 1,
    title: "The Ultimate Guide to Melbourne Airport Transfers",
    content: `
      <p>Navigating Melbourne Airport (MEL) can be a daunting task, especially after a long flight. Whether you're a business traveler with a tight schedule or a tourist looking to start your vacation on the right foot, the mode of transport you choose can significantly impact your experience.</p>
      
      <h3>Why Choose a Chauffeur?</h3>
      <p>While taxis and ride-sharing apps are available, they often involve long queues and unpredictable vehicle quality. A pre-booked chauffeur service like Merlux offers several key advantages:</p>
      <ul>
        <li><strong>Punctuality:</strong> Your driver monitors your flight status in real-time and will be waiting for you at the arrivals hall, even if your flight is delayed.</li>
        <li><strong>Professionalism:</strong> Our chauffeurs are highly trained, well-dressed, and committed to providing a superior level of service.</li>
        <li><strong>Comfort:</strong> Travel in a late-model luxury vehicle that is meticulously maintained and cleaned.</li>
        <li><strong>Fixed Pricing:</strong> No surge pricing or hidden fees. You know exactly what you're paying upfront.</li>
      </ul>

      <h3>The Arrival Experience</h3>
      <p>Upon landing, you'll receive a text message from your chauffeur. They will be waiting at the designated meeting point with a digital sign featuring your name. From there, they will assist with your luggage and guide you to your waiting vehicle parked in the premium chauffeur area.</p>
      
      <h3>Conclusion</h3>
      <p>Investing in a professional airport transfer is more than just a ride; it's a commitment to your peace of mind. Next time you fly into Melbourne, experience the Merlux difference.</p>
    `,
    author: "James Harrison",
    date: "March 28, 2026",
    category: "Travel Tips",
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109c0f3?q=80&w=2070&auto=format&fit=crop",
    readTime: "5 min read"
  },
  // Add more as needed, but for now, we'll use a fallback for others
];

export default function BlogPost() {
  const { id } = useParams();
  const post = BLOG_POSTS.find(p => p.id === Number(id)) || BLOG_POSTS[0];

  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      <article className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Link to="/blog" className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold mb-8 hover:gap-4 transition-all">
            <ArrowLeft size={14} /> Back to Journal
          </Link>
          
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-white/40 font-bold mb-6">
            <span className="bg-gold/10 text-gold px-3 py-1 rounded-full">{post.category}</span>
            <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {post.readTime}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-display leading-tight mb-12">
            {post.title}
          </h1>

          <div className="rounded-[3rem] overflow-hidden aspect-[21/9] mb-16">
            <img 
              src={post.image} 
              alt={post.title} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            <div className="lg:col-span-1">
              <div className="sticky top-32 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10">
                    <User size={20} className="text-gold" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase text-white/40 font-bold">Written by</p>
                    <p className="text-sm font-bold">{post.author}</p>
                  </div>
                </div>
                <div className="pt-8 border-t border-white/10">
                  <p className="text-[10px] uppercase text-white/40 font-bold mb-4">Share this article</p>
                  <div className="flex gap-4">
                    <button className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center hover:bg-gold hover:text-black transition-all">
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-3">
              <div 
                className="prose prose-invert prose-gold max-w-none prose-p:text-white/60 prose-p:leading-relaxed prose-headings:font-display prose-headings:text-white prose-li:text-white/60"
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
              
              <div className="mt-20 pt-12 border-t border-white/10">
                <h3 className="text-2xl font-display mb-8">Related <span className="text-gold italic">Articles</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Sample related posts */}
                  <div className="group">
                    <div className="rounded-2xl overflow-hidden aspect-video mb-4">
                      <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <h4 className="font-display text-lg group-hover:text-gold transition-colors">Why Corporate Travel Demands a Chauffeur Service</h4>
                  </div>
                  <div className="group">
                    <div className="rounded-2xl overflow-hidden aspect-video mb-4">
                      <img src="https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                    <h4 className="font-display text-lg group-hover:text-gold transition-colors">Planning Your Dream Wedding: The Role of Luxury Transport</h4>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </article>
    </div>
  );
}
