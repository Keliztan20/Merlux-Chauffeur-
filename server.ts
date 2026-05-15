import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';
import cors from 'cors';
import dotenv from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import twilio from 'twilio';
import nodemailer from 'nodemailer';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId;

  console.log(`Initializing Firebase Admin for project: ${projectId}, database: ${databaseId}`);
  
  // CRITICAL: Explicitly clear environment-level Firebase configuration to force SDK 
  // to use the provided project ID instead of environment-detected one.
  delete process.env.FIREBASE_CONFIG;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  
  admin.initializeApp({
    projectId: projectId,
  });
  console.log(`Firebase Admin initialized with project: ${projectId}`);

  if (databaseId) {
    admin.firestore().settings({ databaseId });
  }
}

const dbAdmin = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

const firestoreEnvPresent = Boolean(
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  process.env.FIRESTORE_EMULATOR_HOST ||
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.FIREBASE_CONFIG
);
let firestoreAvailable = firestoreEnvPresent;
if (!firestoreAvailable) {
  console.info('Firestore disabled: no credentials or emulator config found');
}
const safeFirestore = async <T>(operation: () => Promise<T>): Promise<T | null> => {
  if (!firestoreAvailable) return null;
  try {
    return await operation();
  } catch (error: any) {
    firestoreAvailable = false;
    if (firestoreEnvPresent) {
      console.warn(`Firestore unavailable, disabling Firestore-dependent routes: ${error?.message || error}`);
    }
    return null;
  }
};

const formatLastMod = (value: any) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') {
    value = value.toDate();
  }
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

const buildUrlXml = (loc: string, priority: string, lastmod?: string) => {
  return `\n  <url>\n    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n    <priority>${priority}</priority>\n  </url>`;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Stripe Checkout Session Endpoint
  app.post('/api/create-checkout-session', async (req, res) => {
    try {
      const { bookingData, vehicleName, cancelUrl } = req.body;

      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set');
      }

      const bookingDataString = JSON.stringify(bookingData);

      const description = bookingData.dropoff && bookingData.dropoff !== 'N/A' 
        ? `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup} to ${bookingData.dropoff}`
        : `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'aud',
              product_data: {
                name: `Chauffeur Service: ${vehicleName}`,
                description: description,
              },
              unit_amount: Math.round(bookingData.price * 100), // Stripe expects cents
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${process.env.APP_URL || 'http://localhost:3000'}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.APP_URL || 'http://localhost:3000'}/booking`,
        metadata: {
          bookingDataChunk1: bookingDataString.substring(0, 450),
          bookingDataChunk2: bookingDataString.substring(450, 900),
          bookingDataChunk3: bookingDataString.substring(900, 1350),
          bookingDataChunk4: bookingDataString.substring(1350, 1800),
        },
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error('Stripe Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/checkout-session/:sessionId', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      res.json(session);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create User in Auth
  app.post('/api/admin/create-user', async (req, res) => {
    try {
      const { email, password, displayName, role, phone, address } = req.body;
      
      console.log(`Attempting to create user: ${email} in project ${admin.app().options.projectId}`);

      // Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email: email.toLowerCase(),
        password,
        displayName,
        phoneNumber: phone || undefined,
      });

      // Create user document in Firestore
      await dbAdmin.collection('users').doc(userRecord.uid).set({
        id: userRecord.uid,
        name: displayName,
        email: email.toLowerCase(),
        phone: phone || '',
        address: address || '',
        role: role || 'customer',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (error: any) {
      console.error('Error creating user:', error);
      res.status(500).json({ error: error.message + ': ' + JSON.stringify(req.body), code: error.code });
    }
  });

  // Twilio SMS Notification Endpoint
  app.post('/api/send-sms', async (req, res) => {
    try {
      const { to, message } = req.body;

      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.warn('Twilio configuration is missing in environment variables.');
        return res.status(400).json({ error: 'Twilio configuration is missing' });
      }

      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

      const response = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to,
      });

      res.json({ success: true, sid: response.sid });
    } catch (error: any) {
      if (error.code === 20003) {
        console.error('Twilio Auth Error: Invalid API keys. Please verify your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
        return res.status(401).json({ error: 'Twilio Authentication Failed' });
      }
      console.error('Twilio SMS Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Email Notification Endpoint
  app.post('/api/send-email', async (req, res) => {
    try {
      const { to, subject, html } = req.body;

      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
        console.warn('SMTP configuration is missing in environment variables.');
        return res.status(400).json({ error: 'SMTP configuration is missing' });
      }

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: Array.isArray(to) ? to.join(',') : to,
        subject,
        html,
      });

      res.json({ success: true, messageId: info.messageId });
    } catch (error: any) {
      console.error('Email Send Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Favicon Redirect
  app.get('/favicon.ico', async (req, res, next) => {
    try {
      const settingsSnap = await safeFirestore(() => dbAdmin.collection('settings').doc('system').get());
      const favicon = settingsSnap?.data()?.seo?.favicon;
      if (favicon) {
        return res.redirect(favicon);
      }
    } catch (e) {}
    next();
  });

  // Logo Redirect
  app.get('/logo.png', async (req, res, next) => {
    try {
      const settingsSnap = await safeFirestore(() => dbAdmin.collection('settings').doc('system').get());
      const logo = settingsSnap?.data()?.seo?.logo;
      if (logo) {
        return res.redirect(logo);
      }
    } catch (e) {}
    next();
  });

  // Sitemap Generator
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const pagesSnap = await safeFirestore(() => dbAdmin.collection('pages').get());
      const blogsSnap = await safeFirestore(() => dbAdmin.collection('blogs').get());
      const offersSnap = await safeFirestore(() => dbAdmin.collection('offers').get());
      const toursSnap = await safeFirestore(() => dbAdmin.collection('tours').get());

      const baseUrl = process.env.APP_URL || 'https://merlux.au';

      let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

      const staticRoutes = [
        { path: '/', priority: '1.0', label: 'Home' },
        { path: '/booking', priority: '0.8', label: 'Booking' },
        { path: '/fleet', priority: '0.8', label: 'Fleet' },
        { path: '/services', priority: '0.8', label: 'Services' },
        { path: '/offers', priority: '0.8', label: 'Offers' },
        { path: '/tours', priority: '0.8', label: 'Tours' },
        { path: '/faq', priority: '0.7', label: 'FAQ' },
        { path: '/about', priority: '0.7', label: 'About' },
        { path: '/contact', priority: '0.7', label: 'Contact' },
        { path: '/blog', priority: '0.7', label: 'Blog' },
      ];

      staticRoutes.forEach(route => {
        xml += buildUrlXml(`${baseUrl}${route.path}`, route.priority);
      });

      pagesSnap?.forEach(doc => {
        const data = doc.data();
        if (data.noindex !== true && data.includeInSitemap !== false) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          xml += buildUrlXml(`${baseUrl}/${data.slug}`, '0.6', lastmod || undefined);
        }
      });

      offersSnap?.forEach(doc => {
        const data = doc.data();
        if (data.slug && data.active !== false && data.noindex !== true && data.includeInSitemap !== false) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          xml += buildUrlXml(`${baseUrl}/offers/${data.slug}`, '0.6', lastmod || undefined);
        }
      });

      toursSnap?.forEach(doc => {
        const data = doc.data();
        if (data.slug && data.active !== false && data.noindex !== true && data.includeInSitemap !== false) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          xml += buildUrlXml(`${baseUrl}/tours/${data.slug}`, '0.6', lastmod || undefined);
        }
      });

      blogsSnap?.forEach(doc => {
        const data = doc.data();
        if (data.slug) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          xml += buildUrlXml(`${baseUrl}/blog/${data.slug}`, '0.5', lastmod || undefined);
        }
      });

      xml += '\n</urlset>';

      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error) {
      console.error('Sitemap generation error:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  app.get('/sitemap.html', async (req, res) => {
    try {
      const pagesSnap = await safeFirestore(() => dbAdmin.collection('pages').get());
      const blogsSnap = await safeFirestore(() => dbAdmin.collection('blogs').get());
      const offersSnap = await safeFirestore(() => dbAdmin.collection('offers').get());
      const toursSnap = await safeFirestore(() => dbAdmin.collection('tours').get());

      const baseUrl = process.env.APP_URL || 'https://merlux.au';

      const links: string[] = [];
      const staticRoutes = [
        { path: '/', label: 'Home' },
        { path: '/booking', label: 'Booking' },
        { path: '/fleet', label: 'Fleet' },
        { path: '/services', label: 'Services' },
        { path: '/offers', label: 'Offers' },
        { path: '/tours', label: 'Tours' },
        { path: '/faq', label: 'FAQ' },
        { path: '/about', label: 'About' },
        { path: '/contact', label: 'Contact' },
        { path: '/blog', label: 'Blog' },
      ];

      staticRoutes.forEach(route => {
        links.push(`<li><a href="${baseUrl}${route.path}">${route.label}</a></li>`);
      });

      pagesSnap?.forEach(doc => {
        const data = doc.data();
        if (data.noindex !== true && data.includeInSitemap !== false) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          links.push(`<li><a href="${baseUrl}/${data.slug}">${data.title || data.slug}</a>${lastmod ? ` <small>(${lastmod})</small>` : ''}</li>`);
        }
      });

      offersSnap?.forEach(doc => {
        const data = doc.data();
        if (data.slug && data.active !== false && data.noindex !== true && data.includeInSitemap !== false) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          links.push(`<li><a href="${baseUrl}/offers/${data.slug}">${data.title || data.slug}</a>${lastmod ? ` <small>(${lastmod})</small>` : ''}</li>`);
        }
      });

      toursSnap?.forEach(doc => {
        const data = doc.data();
        if (data.slug && data.active !== false && data.noindex !== true && data.includeInSitemap !== false) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          links.push(`<li><a href="${baseUrl}/tours/${data.slug}">${data.title || data.slug}</a>${lastmod ? ` <small>(${lastmod})</small>` : ''}</li>`);
        }
      });

      blogsSnap?.forEach(doc => {
        const data = doc.data();
        if (data.slug) {
          const lastmod = formatLastMod(data.updatedAt) || formatLastMod(data.createdAt);
          links.push(`<li><a href="${baseUrl}/blog/${data.slug}">${data.title || data.slug}</a>${lastmod ? ` <small>(${lastmod})</small>` : ''}</li>`);
        }
      });

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Merlux Sitemap</title>
  <style>body{font-family:Arial,sans-serif;padding:24px;background:#111;color:#eee}a{color:#4fd1c5;text-decoration:none}a:hover{text-decoration:underline}small{color:#999}</style>
</head>
<body>
  <h1>Sitemap</h1>
  <p>Generated sitemap with clickable URLs and last modified dates.</p>
  <ul>${links.join('')}</ul>
</body>
</html>`;

      res.header('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      console.error('Sitemap HTML generation error:', error);
      res.status(500).send('Error generating sitemap HTML');
    }
  });

  // Robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = process.env.APP_URL || 'https://merlux.au';
    res.header('Content-Type', 'text/plain');
    res.send(`User-agent: *
Allow: /
Sitemap: ${baseUrl}/sitemap.xml`);
  });

  // Helper for SEO injection
  const injectSEO = async (html: string, url: string) => {
    try {
      const settingsSnap = await safeFirestore(() => dbAdmin.collection('settings').doc('system').get());
      const globalSettings = settingsSnap?.exists ? settingsSnap.data() : null;
      const globalSeo = globalSettings?.seo || {};

      let slug = url.split('?')[0].split('/').pop() || '';
      let isBlog = url.includes('/blog/');

      let seoData: any = null;

      if (isBlog) {
        const snap = await safeFirestore(() => dbAdmin.collection('blogs').where('slug', '==', slug).limit(1).get());
        if (snap && !snap.empty) seoData = snap.docs[0].data();
      } else if (slug) {
        const snap = await safeFirestore(() => dbAdmin.collection('pages').where('slug', '==', slug).limit(1).get());
        if (snap && !snap.empty) seoData = snap.docs[0].data();
      } else {
        // Home page or other static pages without dynamic slug
        const snap = await safeFirestore(() => dbAdmin.collection('pages').where('slug', '==', 'home').limit(1).get());
        if (snap && !snap.empty) seoData = snap.docs[0].data();
      }

      const siteName = globalSeo.siteName || 'Merlux Chauffeur Services';
      const defaultTitle = globalSeo.defaultTitle || 'Luxury Chauffeur Melbourne';
      const titleTemplate = globalSeo.titleTemplate || `%s | ${siteName}`;

      let title = seoData?.metaTitle || seoData?.title || defaultTitle;
      if (title !== defaultTitle && !title.includes(siteName)) {
        title = titleTemplate.replace('%s', title);
      }

      const desc = seoData?.metaDescription || globalSeo.defaultDescription || '';
      const seoKeywords = Array.isArray(seoData?.keywords) ? seoData.keywords : (typeof seoData?.keywords === 'string' ? seoData.keywords.split(',').map((k: string) => k.trim()) : []);
      const defaultKeywords = Array.isArray(globalSeo.defaultKeywords) ? globalSeo.defaultKeywords : (typeof globalSeo.defaultKeywords === 'string' ? globalSeo.defaultKeywords.split(',').map((k: string) => k.trim()) : []);
      const keywords = [...seoKeywords, ...defaultKeywords].filter(k => k !== '').join(', ');
      const favicon = globalSeo.favicon ? `<link rel="icon" href="${globalSeo.favicon}" />` : '';
      const ogImage = seoData?.ogImage || seoData?.featuredImage || globalSeo.ogImage || globalSeo.logo || '';
      const canonical = seoData?.canonicalUrl || `${process.env.APP_URL || ''}${url}`;
      const noindex = seoData?.noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';

      const pageSchema = seoData?.schema ? `<script type="application/ld+json">${JSON.stringify(seoData.schema)}</script>` : '';
      const orgSchema = globalSeo.organizationSchema ? `<script type="application/ld+json">${JSON.stringify(globalSeo.organizationSchema)}</script>` : '';
      
      const gaScript = globalSeo.googleAnalyticsId ? `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${globalSeo.googleAnalyticsId}"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${globalSeo.googleAnalyticsId}');
        </script>
      ` : '';

      const scMeta = globalSeo.searchConsoleId ? `<meta name="google-site-verification" content="${globalSeo.searchConsoleId}" />` : '';

      const seoTags = `
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="keywords" content="${keywords}" />
    <link rel="canonical" href="${canonical}" />
    ${favicon}
    ${noindex}
    ${scMeta}
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta name="twitter:card" content="summary_large_image" />
    ${orgSchema}
    ${pageSchema}
    ${gaScript}
      `;

      // Replace default title and add other tags
      return html
        .replace(/<title>.*?<\/title>/, '')
        .replace('</head>', `${seoTags}</head>`);
    } catch (error) {
      console.error('SEO Injection Error:', error);
      return html;
    }
  };

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);

    // SEO injection in dev mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.includes('.') || url.startsWith('/api/')) return next();

      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        const html = await injectSEO(template, url);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));

    app.get('*', async (req, res) => {
      try {
        const template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const html = await injectSEO(template, req.originalUrl);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        res.status(500).end('Internal Server Error');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
