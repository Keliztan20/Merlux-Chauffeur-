import { motion } from 'motion/react';
import { Calendar, User, ArrowRight, Search, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';

const BLOG_POSTS = [
  {
    id: 1,
    title: "The Ultimate Guide to Melbourne Airport Transfers",
    excerpt: "Navigating Melbourne Airport can be stressful. Discover why a pre-booked chauffeur is the ultimate solution for a seamless arrival and departure experience.",
    author: "James Harrison",
    date: "March 28, 2026",
    category: "Travel Tips",
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109c0f3?q=80&w=2070&auto=format&fit=crop",
    readTime: "5 min read"
  },
  {
    id: 2,
    title: "Why Corporate Travel Demands a Chauffeur Service",
    excerpt: "Efficiency, professionalism, and comfort. Learn how Merlux elevates your business travel experience across Melbourne and regional Victoria.",
    author: "Sarah Jenkins",
    date: "March 24, 2026",
    category: "Business",
    image: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop",
    readTime: "4 min read"
  },
  {
    id: 3,
    title: "Planning Your Dream Wedding: The Role of Luxury Transport",
    excerpt: "From the grand arrival to the getaway car, luxury transport adds a touch of elegance to your special day. Here's how to choose the perfect vehicle.",
    author: "Elena Rossi",
    date: "March 20, 2026",
    category: "Weddings",
    image: "https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2070&auto=format&fit=crop",
    readTime: "6 min read"
  },
  {
    id: 4,
    title: "Exploring Victoria's Wine Regions in Style",
    excerpt: "A private tour of the Yarra Valley or Mornington Peninsula is best enjoyed from the back of a luxury sedan. Discover our bespoke tour options.",
    author: "Marcus Thorne",
    date: "March 15, 2026",
    category: "Tours",
    image: "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=2070&auto=format&fit=crop",
    readTime: "7 min read"
  },
  {
    id: 5,
    title: "The Evolution of Luxury Chauffeur Services",
    excerpt: "From traditional limousines to modern executive sedans, explore how the industry has evolved to meet the needs of today's discerning travelers.",
    author: "James Harrison",
    date: "March 10, 2026",
    category: "Industry",
    image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?q=80&w=2070&auto=format&fit=crop",
    readTime: "5 min read"
  },
  {
    id: 6,
    title: "Safety First: Our Commitment to Passenger Security",
    excerpt: "Learn about our rigorous driver screening processes and vehicle maintenance standards that ensure your safety on every journey.",
    author: "Sarah Jenkins",
    date: "March 05, 2026",
    category: "Safety",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop",
    readTime: "4 min read"
  }
];

const CATEGORIES = ["All", "Travel Tips", "Business", "Weddings", "Tours", "Industry", "Safety"];

export default function Blog() {
  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 mb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-end">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-gold uppercase tracking-[0.3em] text-xs font-bold mb-4 block">Insights & News</span>
            <h1 className="text-5xl md:text-7xl font-display leading-tight">
              The Merlux <span className="text-gold italic">Journal</span>
            </h1>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:pb-4"
          >
            <p className="text-white/60 text-lg leading-relaxed max-w-md">
              Discover the latest trends in luxury travel, corporate transport, and bespoke regional tours across Victoria.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Filter & Search */}
      <section className="max-w-7xl mx-auto px-6 mb-16">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 border-y border-white/10 py-8">
          <div className="flex flex-wrap gap-4 justify-center md:justify-start">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className="text-[10px] uppercase tracking-widest font-bold px-6 py-2 rounded-full border border-white/10 hover:border-gold hover:text-gold transition-all"
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={16} />
            <input
              type="text"
              placeholder="Search articles..."
              className="w-full bg-white/5 border border-white/10 rounded-full py-3 pl-12 pr-6 text-sm focus:border-gold outline-none transition-all"
            />
          </div>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
          {BLOG_POSTS.map((post, i) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="group flex flex-col h-full"
            >
              <Link to={`/blog/${post.id}`} className="block overflow-hidden rounded-3xl mb-6 aspect-[16/10] relative">
                <img
                  src={post.image}
                  alt={post.title}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-4 left-4">
                  <span className="bg-gold text-black text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                    {post.category}
                  </span>
                </div>
              </Link>
              <div className="flex-grow">
                <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-white/40 font-bold mb-4">
                  <span className="flex items-center gap-1"><Calendar size={12} /> {post.date}</span>
                  <span className="flex items-center gap-1"><User size={12} /> {post.author}</span>
                </div>
                <h3 className="text-2xl font-display mb-4 group-hover:text-gold transition-colors leading-snug">
                  <Link to={`/blog/${post.id}`}>{post.title}</Link>
                </h3>
                <p className="text-white/50 text-sm leading-relaxed mb-6 line-clamp-3">
                  {post.excerpt}
                </p>
              </div>
              <Link
                to={`/blog/${post.id}`}
                className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold group-hover:gap-4 transition-all"
              >
                Read Full Article <ArrowRight size={14} />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="max-w-7xl mx-auto px-6 mt-32">
        <div className="bg-gold rounded-[3rem] p-12 md:p-20 text-black text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white blur-[120px] rounded-full rotate-45" />
          </div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <span className="uppercase tracking-[0.3em] text-[10px] font-bold mb-4 block">Stay Updated</span>
            <h2 className="text-4xl md:text-6xl font-display mb-8">Join the <span className="italic">Inner Circle</span></h2>
            <p className="text-black/70 mb-10 text-lg leading-relaxed">
              Subscribe to our newsletter for exclusive travel tips, regional insights, and special offers.
            </p>
            <form className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Your Email Address"
                className="flex-grow bg-white/20 border border-black/10 rounded-2xl px-6 py-4 text-sm focus:border-black outline-none transition-all placeholder:text-black/40"
              />
              <button className="bg-black text-white px-8 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all">
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
