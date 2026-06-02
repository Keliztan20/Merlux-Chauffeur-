import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, limit, startAfter } from 'firebase/firestore';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

let SITE_URL = process.env.VITE_SITE_URL || 'https://merlux.au';
if (!SITE_URL.startsWith('http')) {
  SITE_URL = `https://${SITE_URL}`;
}
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DIST_DIR = path.join(process.cwd(), 'dist');

// Load Firebase config from firebase-applet-config.json
let firebaseConfig;
try {
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error('⚠️ Could not load firebase-applet-config.json:', err);
}

if (!firebaseConfig) {
  console.error('❌ Firebase configuration not found. Cannot generate sitemap.');
  process.exit(1);
}

// Initialize Firebase Client
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const getRouteSlug = (item: any) => {
  if (item.type === 'Page') {
    return item.slug || 'home';
  } else if (item.type === 'Blog') {
    return `blog/${item.slug}`;
  } else if (item.type === 'Offer') {
    return `offers/${item.slug}`;
  } else if (item.type === 'Tour') {
    return `tours/${item.slug}`;
  }
  return item.slug || '';
};

const getFullPath = (item: any) => {
  const routeSlug = getRouteSlug(item);
  if (routeSlug === 'home') return '/';
  return `/${routeSlug}`;
};

const formatDate = (val: any): string => {
  if (!val) return new Date().toISOString().split('T')[0];
  try {
    let d: Date;
    if (val.seconds !== undefined) {
      d = new Date(val.seconds * 1000);
    } else if (val._seconds !== undefined) {
      d = new Date(val._seconds * 1000);
    } else if (val.toDate && typeof val.toDate === 'function') {
      d = val.toDate();
    } else {
      d = new Date(val);
    }
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}
  return new Date().toISOString().split('T')[0];
};

// Scalable helper to stream collections in batch segments to optimize memory
async function* streamCollection(collectionName: string, batchSize = 100) {
  let lastDoc: any = null;
  let hasMore = true;

  while (hasMore) {
    let q;
    if (lastDoc) {
      q = query(collection(db, collectionName), startAfter(lastDoc), limit(batchSize));
    } else {
      q = query(collection(db, collectionName), limit(batchSize));
    }
    const snap = await getDocs(q);
    if (snap.empty) {
      hasMore = false;
      break;
    }
    yield snap.docs;
    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.docs.length < batchSize) {
      hasMore = false;
    }
  }
}

async function generateSitemap() {
  console.log('🚀 Starting Scalable Streaming Multiple Sitemap Generation matching MetaTab.tsx rules...');

  try {
    if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

    const pageTempPath = path.join(PUBLIC_DIR, 'page-sitemap.xml.tmp');
    const blogTempPath = path.join(PUBLIC_DIR, 'blog-sitemap.xml.tmp');
    const offerTempPath = path.join(PUBLIC_DIR, 'offer-sitemap.xml.tmp');
    const toursTempPath = path.join(PUBLIC_DIR, 'tours-sitemap.xml.tmp');

    const pageStream = fs.createWriteStream(pageTempPath, { encoding: 'utf8' });
    const blogStream = fs.createWriteStream(blogTempPath, { encoding: 'utf8' });
    const offerStream = fs.createWriteStream(offerTempPath, { encoding: 'utf8' });
    const toursStream = fs.createWriteStream(toursTempPath, { encoding: 'utf8' });

    const writeHeader = (stream: fs.WriteStream) => {
      stream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
      stream.write('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');
    };

    writeHeader(pageStream);
    writeHeader(blogStream);
    writeHeader(offerStream);
    writeHeader(toursStream);

    let maxLastmodPage = formatDate(null);
    let maxLastmodBlog = formatDate(null);
    let maxLastmodOffer = formatDate(null);
    let maxLastmodTour = formatDate(null);

    const outputPages: { path: string, label: string }[] = [];
    const outputBlogs: { path: string, label: string }[] = [];
    const outputOffers: { path: string, label: string }[] = [];
    const outputTours: { path: string, label: string }[] = [];

    const writeUrlEntryWithTracking = (
      stream: fs.WriteStream, 
      path: string, 
      lastmod: string, 
      changefreq: string, 
      priority: string,
      category: 'page' | 'blog' | 'offer' | 'tour',
      label: string
    ) => {
      stream.write(`  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>\n`);

      if (category === 'page') {
        maxLastmodPage = lastmod > maxLastmodPage ? lastmod : maxLastmodPage;
        outputPages.push({ path, label });
      } else if (category === 'blog') {
        maxLastmodBlog = lastmod > maxLastmodBlog ? lastmod : maxLastmodBlog;
        outputBlogs.push({ path, label });
      } else if (category === 'offer') {
        maxLastmodOffer = lastmod > maxLastmodOffer ? lastmod : maxLastmodOffer;
        outputOffers.push({ path, label });
      } else if (category === 'tour') {
        maxLastmodTour = lastmod > maxLastmodTour ? lastmod : maxLastmodTour;
        outputTours.push({ path, label });
      }
    };

    // 1. Accumulate metadata overrides in a memory-efficient Map
    console.log('📦 Loading metadata overrides incrementally...');
    const metadataMap = new Map<string, { noindex?: boolean; updatedAt?: any }>();
    for await (const docs of streamCollection('metadata', 200)) {
      (docs as any[]).forEach((doc: any) => {
        const data = doc.data() as any;
        const slugVal = (data.slug || '').toLowerCase();
        const idVal = doc.id.toLowerCase();
        const record = {
          noindex: data.noindex,
          updatedAt: data.updatedAt
        };
        if (slugVal) {
          metadataMap.set(slugVal, record);
        }
        if (idVal) {
          metadataMap.set(idVal, record);
        }
      });
    }

    const getMetadataOverride = (routeSlug: string) => {
      const normSlug = (routeSlug || '').toLowerCase();
      const replaced = normSlug.replace(/\//g, '_');
      let override = metadataMap.get(normSlug);
      if (!override && replaced) {
        override = metadataMap.get(replaced);
      }
      return override;
    };

    const registeredPaths = new Set<string>();

    // 2. Stream and process the Dynamic 'pages' collection (purely dynamic records)
    console.log('📄 Processing dynamic pages streaming...');
    for await (const docs of streamCollection('pages', 100)) {
      (docs as any[]).forEach((doc: any) => {
        const p = { id: doc.id, type: 'Page', ...(doc.data() as any) } as any;
        const routeSlug = p.slug || 'home';
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = p.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (p.noindex || false));
        const active = p.active !== false;
        const updatedAt = docOverride?.updatedAt || p.updatedAt || p.createdAt || null;
        const createdAt = p.createdAt || null;

        const cleanPath = getFullPath(p);
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          if (!noindex && active) {
            const lastmod = formatDate(updatedAt || createdAt);
            const label = p.title || p.name || p.id || 'Untitled Page';
            writeUrlEntryWithTracking(
              pageStream, 
              cleanPath, 
              lastmod, 
              cleanPath === '/' ? 'daily' : 'weekly', 
              cleanPath === '/' ? '1.0' : '0.8', 
              'page', 
              label
            );
          }
        }
      });
    }

    // 3. Stream 'blogs' collection
    console.log('✍️ Processing blog posts streaming...');
    for await (const docs of streamCollection('blogs', 100)) {
      (docs as any[]).forEach((doc: any) => {
        const b = { id: doc.id, type: 'Blog', ...(doc.data() as any) } as any;
        const routeSlug = `blog/${b.slug}`;
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = b.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (b.noindex || false));
        const active = b.active !== false;
        const updatedAt = docOverride?.updatedAt || b.updatedAt || b.createdAt || null;
        const createdAt = b.createdAt || null;

        const cleanPath = getFullPath(b);
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          if (!noindex && active) {
            const lastmod = formatDate(updatedAt || createdAt);
            const label = b.title || b.name || b.id || 'Untitled Post';
            writeUrlEntryWithTracking(blogStream, cleanPath, lastmod, 'weekly', '0.8', 'blog', label);
          }
        }
      });
    }

    // 4. Stream 'offers' collection
    console.log('🏷️ Processing promo offers streaming...');
    for await (const docs of streamCollection('offers', 100)) {
      (docs as any[]).forEach((doc: any) => {
        const o = { id: doc.id, type: 'Offer', ...(doc.data() as any) } as any;
        const routeSlug = `offers/${o.slug}`;
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = o.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (o.noindex || false));
        const active = o.active !== false;
        const updatedAt = docOverride?.updatedAt || o.updatedAt || o.createdAt || null;
        const createdAt = o.createdAt || null;

        const cleanPath = getFullPath(o);
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          if (!noindex && active) {
            const lastmod = formatDate(updatedAt || createdAt);
            const label = o.title || o.name || o.id || 'Special Offer';
            writeUrlEntryWithTracking(offerStream, cleanPath, lastmod, 'weekly', '0.8', 'offer', label);
          }
        }
      });
    }

    // 5. Stream 'tours' collection
    console.log('🗺️ Processing private tours streaming...');
    for await (const docs of streamCollection('tours', 100)) {
      (docs as any[]).forEach((doc: any) => {
        const t = { id: doc.id, type: 'Tour', ...(doc.data() as any) } as any;
        const routeSlug = `tours/${t.slug}`;
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = t.active === false || (docOverride?.noindex !== undefined ? docOverride.noindex : (t.noindex || false));
        const active = t.active !== false;
        const updatedAt = docOverride?.updatedAt || t.updatedAt || t.createdAt || null;
        const createdAt = t.createdAt || null;

        const cleanPath = getFullPath(t);
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          if (!noindex && active) {
            const lastmod = formatDate(updatedAt || createdAt);
            const label = t.title || t.name || t.id || 'Tour';
            writeUrlEntryWithTracking(toursStream, cleanPath, lastmod, 'weekly', '0.8', 'tour', label);
          }
        }
      });
    }

    const endSitemapStream = async (stream: fs.WriteStream) => {
      stream.write('</urlset>');
      stream.end();
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', (err) => reject(err));
      });
    };

    console.log('💾 Finalizing sub-sitemap files...');
    await Promise.all([
      endSitemapStream(pageStream),
      endSitemapStream(blogStream),
      endSitemapStream(offerStream),
      endSitemapStream(toursStream)
    ]);

    console.log('🗂️ Generating sitemap_index.xml...');
    const indexTempPath = path.join(PUBLIC_DIR, 'sitemap_index.xml.tmp');
    const indexStream = fs.createWriteStream(indexTempPath, { encoding: 'utf8' });
    indexStream.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    indexStream.write('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n');

    const subSitemapFiles = [
      { name: 'page-sitemap.xml', lastmod: maxLastmodPage },
      { name: 'blog-sitemap.xml', lastmod: maxLastmodBlog },
      { name: 'offer-sitemap.xml', lastmod: maxLastmodOffer },
      { name: 'tours-sitemap.xml', lastmod: maxLastmodTour }
    ];

    subSitemapFiles.forEach(file => {
      indexStream.write(`  <sitemap>
    <loc>${SITE_URL}/${file.name}</loc>
    <lastmod>${file.lastmod}</lastmod>
  </sitemap>\n`);
    });

    indexStream.write('</sitemapindex>');
    indexStream.end();

    await new Promise<void>((resolve, reject) => {
      indexStream.on('finish', () => resolve());
      indexStream.on('error', (err) => reject(err));
    });

    // 6. Generate HTML Sitemap (sitemap.html)
    console.log('📁 Generating parallel sitemap.html diagram for user view...');
    
    const generateHtmlList = (items: { path: string, label: string }[]) => {
      if (items.length === 0) {
        return '            <li class="text-center text-white/30 text-xs py-4 font-light italic">No dynamic records published.</li>';
      }
      return items.map(item => `              <li class="group">
                <a href="${item.path}" class="flex flex-col sm:flex-row sm:items-baseline justify-between py-2 border-b border-white/5 group-hover:border-[#d4af37]/20 transition-all">
                  <span class="text-white group-hover:text-[#d4af37] text-sm sm:text-base font-normal tracking-wide transition-colors">${item.label}</span>
                  <span class="text-white/40 text-[10px] uppercase tracking-widest font-mono">${item.path}</span>
                </a>
              </li>`).join('\n');
    };

    const sitemapHtmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sitemap | Merlux Luxury Tours & Services</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap');
    
    body {
      font-family: 'Inter', sans-serif;
      background-color: #0b0b0b;
      color: #f3f4f6;
    }
    
    .font-serif {
      font-family: 'Playfair Display', serif;
    }
    
    /* custom-scrollbar */
    .custom-scrollbar::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: #d4af37; /* Gold accent */
      border-radius: 3px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: #f3e5ab;
    }
    
    /* Firefox support */
    .custom-scrollbar {
      scrollbar-width: thin;
      scrollbar-color: #d4af37 rgba(255, 255, 255, 0.03);
    }
  </style>
</head>
<body class="min-h-screen py-12 px-4 sm:px-6 lg:px-8 flex flex-col justify-between">
  <!-- Content wrapper -->
  <div class="max-w-6xl w-full mx-auto">
    <!-- Header -->
    <header class="text-center mb-16 border-b border-white/10 pb-8">
      <div class="inline-block mb-3 px-3 py-1 border border-[#d4af37]/30 rounded-full bg-[#d4af37]/5">
        <span class="text-xs font-semibold tracking-widest text-[#d4af37] uppercase">Directory Overview</span>
      </div>
      <h1 class="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-white mb-4">Sitemap</h1>
      <p class="text-white/60 text-sm sm:text-base max-w-lg mx-auto font-light leading-relaxed">
        Explore luxury private tours, premium chauffeured charter fleet services, and exclusive promotions across Australia.
      </p>
    </header>

    <!-- Categories Grid -->
    <main class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
      
      <!-- Category 1: Pages -->
      <section class="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-[#d4af37]/30 transition-all duration-300">
        <div>
          <div class="flex items-center gap-3 mb-6">
            <div class="w-2 h-6 bg-[#d4af37] rounded-full"></div>
            <h2 class="font-serif text-xl sm:text-2xl font-semibold text-white">Dynamic Pages</h2>
          </div>
          <div class="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
            <ul class="space-y-3">
${generateHtmlList(outputPages)}
            </ul>
          </div>
        </div>
      </section>

      <!-- Category 2: Private Tours -->
      <section class="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-[#d4af37]/30 transition-all duration-300">
        <div>
          <div class="flex items-center gap-3 mb-6">
            <div class="w-2 h-6 bg-[#d4af37] rounded-full"></div>
            <h2 class="font-serif text-xl sm:text-2xl font-semibold text-white">Luxury Tours</h2>
          </div>
          <div class="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
            <ul class="space-y-3">
${generateHtmlList(outputTours)}
            </ul>
          </div>
        </div>
      </section>

      <!-- Category 3: Special Offers -->
      <section class="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-[#d4af37]/30 transition-all duration-300">
        <div>
          <div class="flex items-center gap-3 mb-6">
            <div class="w-2 h-6 bg-[#d4af37] rounded-full"></div>
            <h2 class="font-serif text-xl sm:text-2xl font-semibold text-white">Exclusive Offers</h2>
          </div>
          <div class="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
            <ul class="space-y-3">
${generateHtmlList(outputOffers)}
            </ul>
          </div>
        </div>
      </section>

      <!-- Category 4: Travel Blog -->
      <section class="bg-white/[0.02] border border-white/5 rounded-2xl p-6 sm:p-8 flex flex-col justify-between hover:border-[#d4af37]/30 transition-all duration-300">
        <div>
          <div class="flex items-center gap-3 mb-6">
            <div class="w-2 h-6 bg-[#d4af37] rounded-full"></div>
            <h2 class="font-serif text-xl sm:text-2xl font-semibold text-white">Travel Journal & Blog</h2>
          </div>
          <div class="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
            <ul class="space-y-3">
${generateHtmlList(outputBlogs)}
            </ul>
          </div>
        </div>
      </section>

    </main>
  </div>

  <!-- Footer -->
  <footer class="text-center text-white/30 text-xs mt-12 border-t border-white/5 pt-8 max-w-6xl w-full mx-auto">
    <p class="mb-2">© 2026 Merlux Luxury Tours. All rights reserved.</p>
    <p>
      XML Sitemaps: 
      <a href="/sitemap_index.xml" class="text-[#d4af37] hover:underline mx-1">Index</a> • 
      <a href="/page-sitemap.xml" class="text-[#d4af37] hover:underline mx-1">Pages</a> • 
      <a href="/tours-sitemap.xml" class="text-[#d4af37] hover:underline mx-1">Tours</a> • 
      <a href="/offer-sitemap.xml" class="text-[#d4af37] hover:underline mx-1">Offers</a> • 
      <a href="/blog-sitemap.xml" class="text-[#d4af37] hover:underline mx-1">Blog</a>
    </p>
  </footer>
</body>
</html>`;

    // Write html sitemap to file
    fs.writeFileSync(path.join(PUBLIC_DIR, 'sitemap.html'), sitemapHtmlBody, 'utf8');
    fs.writeFileSync(path.join(DIST_DIR, 'sitemap.html'), sitemapHtmlBody, 'utf8');
    console.log('✨ sitemap.html generated successfully in public/ and dist/');

    // Move completed sitemaps into public/ and dist/
    const filesToCopy = [
      { temp: pageTempPath, name: 'page-sitemap.xml' },
      { temp: blogTempPath, name: 'blog-sitemap.xml' },
      { temp: offerTempPath, name: 'offer-sitemap.xml' },
      { temp: toursTempPath, name: 'tours-sitemap.xml' },
      { temp: indexTempPath, name: 'sitemap_index.xml' },
      { temp: indexTempPath, name: 'sitemap.xml' } // Copy index as sitemap.xml for legacy compatibility
    ];

    filesToCopy.forEach(f => {
      fs.copyFileSync(f.temp, path.join(PUBLIC_DIR, f.name));
      fs.copyFileSync(f.temp, path.join(DIST_DIR, f.name));
    });

    // Clean up temporary files unique paths at the end
    const uniqueTemps = Array.from(new Set(filesToCopy.map(f => f.temp)));
    uniqueTemps.forEach(tempPath => {
      try {
        fs.unlinkSync(tempPath);
      } catch (e) {}
    });

    console.log('✨ All sitemaps (index and sub-sitemaps) generated successfully in public/ and dist/');

    // Generate Robots.txt
    const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${SITE_URL}/sitemap_index.xml
`;
    fs.writeFileSync(path.join(PUBLIC_DIR, 'robots.txt'), robotsTxt);
    fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robotsTxt);
    console.log('✨ robots.txt generated successfully in public/ and dist/');

  } catch (error) {
    console.error('❌ Error generating sitemaps:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

generateSitemap();
