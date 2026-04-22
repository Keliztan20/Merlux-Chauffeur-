import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSettings } from '../lib/SettingsContext';

export default function DynamicPage() {
  const { slug } = useParams();
  const { settings } = useSettings();
  const [pageData, setPageData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, 'pages'), where('slug', '==', slug), limit(1));
        const snap = await getDocs(q);
        
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setPageData(data);
          setError(false);

          // SEO Metadata Updates
          document.title = `${data.metaTitle || data.title} | Merlux`;
          
          let metaDesc = document.querySelector('meta[name="description"]');
          if (!metaDesc) {
            metaDesc = document.createElement('meta');
            metaDesc.setAttribute('name', 'description');
            document.head.appendChild(metaDesc);
          }
          metaDesc.setAttribute('content', data.metaDescription || '');

          let metaKeywords = document.querySelector('meta[name="keywords"]');
          if (!metaKeywords) {
            metaKeywords = document.createElement('meta');
            metaKeywords.setAttribute('name', 'keywords');
            document.head.appendChild(metaKeywords);
          }
          const keywordsStr = Array.isArray(data.keywords) ? data.keywords.join(', ') : (data.keywords || '');
          metaKeywords.setAttribute('content', keywordsStr);

          // Robots noindex
          let metaRobots = document.querySelector('meta[name="robots"]');
          if (data.noindex) {
            if (!metaRobots) {
              metaRobots = document.createElement('meta');
              metaRobots.setAttribute('name', 'robots');
              document.head.appendChild(metaRobots);
            }
            metaRobots.setAttribute('content', 'noindex, nofollow');
          } else if (metaRobots) {
            metaRobots.setAttribute('content', 'index, follow');
          }
          
          window.scrollTo(0, 0);

          // Global CMS CSS Injection
          const globalStyleId = 'global-cms-css';
          let globalStyleTag = document.getElementById(globalStyleId);
          if (settings?.seo?.globalCmsCss && settings?.seo?.isGlobalCssActive !== false) {
            if (!globalStyleTag) {
              globalStyleTag = document.createElement('style');
              globalStyleTag.id = globalStyleId;
              document.head.appendChild(globalStyleTag);
            }
            // Scope CSS to content area
            const scopedGlobal = settings.seo.globalCmsCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m: string) => 
              m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')
            );
            globalStyleTag.innerHTML = scopedGlobal;
          } else if (globalStyleTag) {
            globalStyleTag.remove();
          }

          // Individual CSS Injection
          const styleId = `page-css-${slug}`;
          let styleTag = document.getElementById(styleId);
          if (data.customCss && data.isCustomCssActive !== false) {
            if (!styleTag) {
              styleTag = document.createElement('style');
              styleTag.id = styleId;
              document.head.appendChild(styleTag);
            }
            // Scope CSS to content area
            const scopedIndividual = data.customCss.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (m: string) => 
              m.split(',').map(s => s.trim() ? `.cms-rendered-content ${s.trim()}` : s).join(', ')
            );
            styleTag.innerHTML = scopedIndividual;
          } else if (styleTag) {
            styleTag.remove();
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching dynamic page:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (slug) fetchPage();

    return () => {
      // Individual CSS cleanup
      const styleId = `page-css-${slug}`;
      const styleTag = document.getElementById(styleId);
      if (styleTag) styleTag.remove();
      
      // Global CSS cleanup
      const globalStyleId = 'global-cms-css';
      const globalStyleTag = document.getElementById(globalStyleId);
      if (globalStyleTag) globalStyleTag.remove();
    };
  }, [slug, settings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-gold animate-spin" size={40} />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-black pt-32 px-6 text-center">
        <h1 className="text-4xl font-display mb-6">Page Not Found</h1>
        <p className="text-white/60 mb-8">The luxury experience you're looking for might have moved.</p>
        <Link to="/" className="bg-gold text-black px-8 py-3 rounded-full font-bold uppercase tracking-widest text-xs hover:bg-white transition-all">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <div className="pt-32 pb-24 bg-black min-h-screen">
      <article className="max-w-4xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Link to="/" className="inline-flex items-center gap-2 text-gold text-[10px] uppercase tracking-widest font-bold mb-8 hover:gap-4 transition-all">
            <ArrowLeft size={14} /> Back Home
          </Link>
          
          <h1 className="text-4xl md:text-6xl font-display leading-tight mb-12">
            {pageData.title}
          </h1>

          {(pageData.featuredImage || pageData.ogImage) && (
            <div className="rounded-[3rem] overflow-hidden aspect-[21/9] mb-16">
              <img 
                src={pageData.featuredImage || pageData.ogImage} 
                alt={pageData.featuredImageAlt || pageData.title} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          )}

          <div className="cms-rendered-content prose prose-invert prose-gold max-w-none prose-p:text-white/60 prose-p:leading-relaxed prose-headings:font-display prose-headings:text-white prose-li:text-white/60">
            <div dangerouslySetInnerHTML={{ __html: pageData.content }} />
          </div>
        </motion.div>
      </article>
    </div>
  );
}
