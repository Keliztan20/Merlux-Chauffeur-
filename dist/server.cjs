var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_vite = require("vite");
var import_path = __toESM(require("path"), 1);
var import_url = require("url");
var import_stripe = __toESM(require("stripe"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_firebase_admin = __toESM(require("firebase-admin"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_twilio = __toESM(require("twilio"), 1);
var import_nodemailer = __toESM(require("nodemailer"), 1);
var import_meta = {};
import_dotenv.default.config();
var currentDirName = "";
try {
  if (typeof __dirname !== "undefined" && __dirname) {
    currentDirName = __dirname;
  } else {
    currentDirName = import_path.default.dirname((0, import_url.fileURLToPath)(import_meta.url));
  }
} catch (e) {
  try {
    currentDirName = import_path.default.dirname((0, import_url.fileURLToPath)(import_meta.url));
  } catch (err) {
  }
}
var __dirnameResolved = currentDirName || ".";
if (!import_firebase_admin.default.apps.length) {
  const config = JSON.parse(import_fs.default.readFileSync("./firebase-applet-config.json", "utf-8"));
  const projectId = config.projectId;
  const databaseId = config.firestoreDatabaseId;
  console.log(`Initializing Firebase Admin for project: ${projectId}, database: ${databaseId}`);
  delete process.env.FIREBASE_CONFIG;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  import_firebase_admin.default.initializeApp({
    projectId
  });
  console.log(`Firebase Admin initialized with project: ${projectId}`);
  if (databaseId) {
    import_firebase_admin.default.firestore().settings({ databaseId });
  }
}
var dbAdmin = import_firebase_admin.default.firestore();
var stripeClient = null;
function getStripe() {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not configured.");
    }
    stripeClient = new import_stripe.default(key);
  }
  return stripeClient;
}
async function startServer() {
  const app = (0, import_express.default)();
  app.set("trust proxy", true);
  const PORT = 3e3;
  app.use((0, import_cors.default)());
  app.use(import_express.default.json());
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { bookingData, vehicleName, cancelUrl } = req.body;
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error("STRIPE_SECRET_KEY is not set");
      }
      const bookingDataString = JSON.stringify(bookingData);
      const description = bookingData.dropoff && bookingData.dropoff !== "N/A" ? `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup} to ${bookingData.dropoff}` : `${bookingData.serviceType.toUpperCase()} - ${bookingData.pickup}`;
      const session = await getStripe().checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: {
                name: `Chauffeur Service: ${vehicleName}`,
                description
              },
              unit_amount: Math.round(bookingData.price * 100)
              // Stripe expects cents
            },
            quantity: 1
          }
        ],
        mode: "payment",
        success_url: `${process.env.APP_URL || "http://localhost:3000"}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env.APP_URL || "http://localhost:3000"}/booking`,
        metadata: {
          bookingDataChunk1: bookingDataString.substring(0, 450),
          bookingDataChunk2: bookingDataString.substring(450, 900),
          bookingDataChunk3: bookingDataString.substring(900, 1350),
          bookingDataChunk4: bookingDataString.substring(1350, 1800)
        }
      });
      res.json({ id: session.id, url: session.url });
    } catch (error) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/api/checkout-session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const session = await getStripe().checkout.sessions.retrieve(sessionId);
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/admin/create-user", async (req, res) => {
    try {
      const { email, password, displayName, role, phone, address } = req.body;
      console.log(`Attempting to create user: ${email} in project ${import_firebase_admin.default.app().options.projectId}`);
      const userRecord = await import_firebase_admin.default.auth().createUser({
        email: email.toLowerCase(),
        password,
        displayName,
        phoneNumber: phone || void 0
      });
      await dbAdmin.collection("users").doc(userRecord.uid).set({
        id: userRecord.uid,
        name: displayName,
        email: email.toLowerCase(),
        phone: phone || "",
        address: address || "",
        role: role || "customer",
        createdAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
        updatedAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true, uid: userRecord.uid });
    } catch (error) {
      console.error("Error creating user:", error);
      const errStr = String(error.message || error);
      if (errStr.includes("identitytoolkit") || errStr.includes("Identity Toolkit") || errStr.includes("SERVICE_DISABLED") || errStr.includes("PERMISSION_DENIED") || error.code === "auth/api-error") {
        console.warn("Identity Toolkit/Auth API is disabled. Bypassing Auth layer and saving to Firestore...");
        try {
          const { email, displayName, role, phone, address } = req.body;
          const fallbackUid = "local-user-" + Math.random().toString(36).substring(2, 11) + "-" + Date.now().toString(36);
          await dbAdmin.collection("users").doc(fallbackUid).set({
            id: fallbackUid,
            name: displayName || email.split("@")[0],
            email: email.toLowerCase(),
            phone: phone || "",
            address: address || "",
            role: role || "customer",
            emailVerified: false,
            createdAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
            updatedAt: import_firebase_admin.default.firestore.FieldValue.serverTimestamp(),
            authDisabledFallback: true
          });
          return res.json({
            success: true,
            uid: fallbackUid,
            warning: "Identity Toolkit API is disabled in your project. Bypassed authentication layer: user profile created directly in database, so this user can be assigned driver roles or booking references."
          });
        } catch (dbError) {
          console.error("Failed to create fallback user in Firestore:", dbError);
          return res.status(500).json({ error: `Database fallback creation failed: ${dbError.message}` });
        }
      }
      res.status(500).json({ error: error.message || String(error), code: error.code });
    }
  });
  app.post("/api/admin/delete-user", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) {
        return res.status(400).json({ error: "User ID is required" });
      }
      console.log(`Attempting to delete user: ${userId}`);
      try {
        await import_firebase_admin.default.auth().deleteUser(userId);
        console.log(`Deleted user ${userId} from Auth`);
      } catch (authError) {
        console.warn(`Auth deletion skipped/failed for user ${userId}:`, authError.message || String(authError));
      }
      await dbAdmin.collection("users").doc(userId).delete();
      console.log(`Deleted user document ${userId} from Firestore`);
      res.json({ success: true });
    } catch (error) {
      console.error("Error in delete user handler:", error);
      res.status(500).json({ error: error.message || String(error) });
    }
  });
  app.post("/api/send-sms", async (req, res) => {
    try {
      const { to, message } = req.body;
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        console.warn("Twilio configuration is missing in environment variables.");
        return res.status(400).json({ error: "Twilio configuration is missing" });
      }
      const client = (0, import_twilio.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const response = await client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      res.json({ success: true, sid: response.sid });
    } catch (error) {
      if (error.code === 20003) {
        console.error("Twilio Auth Error: Invalid API keys. Please verify your TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.");
        return res.status(401).json({ error: "Twilio Authentication Failed" });
      }
      console.error("Twilio SMS Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html } = req.body;
      if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS || !process.env.SMTP_FROM) {
        console.warn("SMTP configuration is missing in environment variables.");
        return res.status(400).json({ error: "SMTP configuration is missing" });
      }
      const transporter = import_nodemailer.default.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT),
        secure: parseInt(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: Array.isArray(to) ? to.join(",") : to,
        subject,
        html
      });
      res.json({ success: true, messageId: info.messageId });
    } catch (error) {
      console.error("Email Send Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });
  app.get("/favicon.ico", async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection("settings").doc("system").get();
      const favicon = settingsSnap.data()?.seo?.favicon;
      if (favicon) {
        return res.redirect(favicon);
      }
    } catch (e) {
    }
    next();
  });
  app.get("/logo.png", async (req, res, next) => {
    try {
      const settingsSnap = await dbAdmin.collection("settings").doc("system").get();
      const logo = settingsSnap.data()?.seo?.logo;
      if (logo) {
        return res.redirect(logo);
      }
    } catch (e) {
    }
    next();
  });
  const getSiteUrl = (req) => {
    let SITE_URL = process.env.VITE_SITE_URL || "";
    if (!SITE_URL) {
      const host = req.get("host") || "";
      const isLocalhost = host.includes("localhost") || host.includes("127.0.0.1") || host.includes("0.0.0.0");
      const protocol = req.secure || req.headers["x-forwarded-proto"] === "https" || !isLocalhost ? "https" : "http";
      SITE_URL = `${protocol}://${host}`;
    }
    if (SITE_URL.endsWith("/")) {
      SITE_URL = SITE_URL.slice(0, -1);
    }
    return SITE_URL;
  };
  const getFormatDate = (val) => {
    if (!val) return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    try {
      let d;
      if (val.seconds !== void 0) {
        d = new Date(val.seconds * 1e3);
      } else if (val._seconds !== void 0) {
        d = new Date(val._seconds * 1e3);
      } else if (val.toDate && typeof val.toDate === "function") {
        d = val.toDate();
      } else {
        d = new Date(val);
      }
      if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
      }
    } catch (e) {
    }
    return (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  };
  app.get("/sitemap_index.xml", async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const todayString = getFormatDate(null);
      const [pagesSnap, blogsSnap, offersSnap, toursSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection("pages").get(),
        dbAdmin.collection("blogs").get(),
        dbAdmin.collection("offers").get(),
        dbAdmin.collection("tours").get(),
        dbAdmin.collection("metadata").get()
      ]);
      const pages = pagesSnap.docs.map((doc) => ({ id: doc.id, type: "Page", ...doc.data() }));
      const blogs = blogsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const offers = offersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const tours = toursSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const metadataDocs = metadataSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const staticPages = [
        { title: "Home", slug: "", path: "/" },
        { title: "Offers", slug: "offers", path: "/offers" },
        { title: "Tours", slug: "tours", path: "/tours" },
        { title: "Services", slug: "services", path: "/services" },
        { title: "Blog", slug: "blog", path: "/blog" },
        { title: "Fleet", slug: "fleet", path: "/fleet" },
        { title: "FAQ", slug: "faq", path: "/faq" },
        { title: "About", slug: "about", path: "/about" },
        { title: "Contact", slug: "contact", path: "/contact" },
        { title: "Terms and Conditions", slug: "terms", path: "/terms" }
      ];
      const getMetadataOverride = (routeSlug) => {
        const normSlug = (routeSlug || "").toLowerCase();
        const replaced = normSlug.replace(/\//g, "_");
        let override = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug);
        if (!override && replaced) {
          override = metadataDocs.find((d) => d.slug === replaced || d.id === replaced);
        }
        return override;
      };
      let pageCount = 0;
      let blogCount = 0;
      let offerCount = 0;
      let tourCount = 0;
      const registeredPaths = /* @__PURE__ */ new Set();
      pages.forEach((p) => {
        const routeSlug = p.slug || "home";
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = p.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : p.noindex || false);
        const active = p.active !== false;
        if (!noindex && active) {
          const cleanPath = p.slug === "home" || p.slug === "" ? "/" : `/${p.slug}`;
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            pageCount++;
          }
        }
      });
      staticPages.forEach((sp) => {
        const cleanPath = sp.path || "/";
        const routeSlug = sp.slug || "home";
        const docOverride = getMetadataOverride(routeSlug);
        if (docOverride?.noindex === true) return;
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          pageCount++;
        }
      });
      blogs.forEach((b) => {
        const routeSlug = `blog/${b.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = b.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : b.noindex || false);
        const active = b.active !== false;
        if (!noindex && active) {
          blogCount++;
        }
      });
      offers.forEach((o) => {
        const routeSlug = `offers/${o.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = o.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : o.noindex || false);
        const active = o.active !== false;
        if (!noindex && active) {
          offerCount++;
        }
      });
      tours.forEach((t) => {
        const routeSlug = `tours/${t.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = t.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : t.noindex || false);
        const active = t.active !== false;
        if (!noindex && active) {
          tourCount++;
        }
      });
      const sitemapsToInclude = [
        { name: "page-sitemap.xml", count: pageCount },
        { name: "blog-sitemap.xml", count: blogCount },
        { name: "offer-sitemap.xml", count: offerCount },
        { name: "tours-sitemap.xml", count: tourCount }
      ];
      const sitemapsXML = sitemapsToInclude.filter((s) => s.count > 0).map((s) => `  <sitemap>
    <loc>${SITE_URL}/${s.name}</loc>
    <lastmod>${todayString}</lastmod>
  </sitemap>`).join("\n");
      const indexXml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapsXML}
</sitemapindex>`.trim();
      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(indexXml);
    } catch (err) {
      console.error("Error generating dynamic sitemap index:", err);
      const indexSitemapPath = import_path.default.join(process.cwd(), "dist", "sitemap_index.xml");
      if (import_fs.default.existsSync(indexSitemapPath)) {
        res.set("Content-Type", "application/xml; charset=utf-8");
        return res.sendFile(indexSitemapPath);
      }
      return res.status(500).send("Error generating sitemap index");
    }
  });
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [pagesSnap, blogsSnap, offersSnap, toursSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection("pages").get(),
        dbAdmin.collection("blogs").get(),
        dbAdmin.collection("offers").get(),
        dbAdmin.collection("tours").get(),
        dbAdmin.collection("metadata").get()
      ]);
      const pages = pagesSnap.docs.map((doc) => ({ id: doc.id, type: "Page", ...doc.data() }));
      const blogs = blogsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const offers = offersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const tours = toursSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const metadataDocs = metadataSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const staticPages = [
        { title: "Home", slug: "", path: "/" },
        { title: "Offers", slug: "offers", path: "/offers" },
        { title: "Tours", slug: "tours", path: "/tours" },
        { title: "Services", slug: "services", path: "/services" },
        { title: "Blog", slug: "blog", path: "/blog" },
        { title: "Fleet", slug: "fleet", path: "/fleet" },
        { title: "FAQ", slug: "faq", path: "/faq" },
        { title: "About", slug: "about", path: "/about" },
        { title: "Contact", slug: "contact", path: "/contact" },
        { title: "Terms and Conditions", slug: "terms", path: "/terms" }
      ];
      const getMetadataOverride = (routeSlug) => {
        const normSlug = (routeSlug || "").toLowerCase();
        const replaced = normSlug.replace(/\//g, "_");
        let override = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug);
        if (!override && replaced) {
          override = metadataDocs.find((d) => d.slug === replaced || d.id === replaced);
        }
        return override;
      };
      const sitemapEntries = [];
      const registeredPaths = /* @__PURE__ */ new Set();
      pages.forEach((p) => {
        const routeSlug = p.slug || "home";
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = p.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : p.noindex || false);
        const active = p.active !== false;
        if (!noindex && active) {
          const cleanPath = p.slug === "home" || p.slug === "" ? "/" : `/${p.slug}`;
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            const updatedAt = docOverride?.updatedAt || p.updatedAt || p.createdAt || null;
            sitemapEntries.push({
              path: cleanPath,
              lastmod: getFormatDate(updatedAt),
              changefreq: cleanPath === "/" ? "daily" : "weekly",
              priority: cleanPath === "/" ? "1.0" : "0.8"
            });
          }
        }
      });
      staticPages.forEach((sp) => {
        const cleanPath = sp.path || "/";
        const routeSlug = sp.slug || "home";
        const docOverride = getMetadataOverride(routeSlug);
        if (docOverride?.noindex === true) return;
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(docOverride?.updatedAt),
            changefreq: cleanPath === "/" ? "daily" : "weekly",
            priority: cleanPath === "/" ? "1.0" : "0.8"
          });
        }
      });
      blogs.forEach((b) => {
        const routeSlug = `blog/${b.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = b.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : b.noindex || false);
        const active = b.active !== false;
        if (!noindex && active) {
          const cleanPath = `/blog/${b.slug}`;
          const updatedAt = docOverride?.updatedAt || b.updatedAt || b.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: "weekly",
            priority: "0.8"
          });
        }
      });
      offers.forEach((o) => {
        const routeSlug = `offers/${o.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = o.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : o.noindex || false);
        const active = o.active !== false;
        if (!noindex && active) {
          const cleanPath = `/offers/${o.slug}`;
          const updatedAt = docOverride?.updatedAt || o.updatedAt || o.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: "weekly",
            priority: "0.8"
          });
        }
      });
      tours.forEach((t) => {
        const routeSlug = `tours/${t.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = t.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : t.noindex || false);
        const active = t.active !== false;
        if (!noindex && active) {
          const cleanPath = `/tours/${t.slug}`;
          const updatedAt = docOverride?.updatedAt || t.updatedAt || t.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: "weekly",
            priority: "0.8"
          });
        }
      });
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>`.trim();
      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(xml);
    } catch (err) {
      console.error("Error generating dynamic flat sitemap fallback:", err);
      const fallbackPath = import_path.default.join(process.cwd(), "dist", "sitemap.xml");
      if (import_fs.default.existsSync(fallbackPath)) {
        res.set("Content-Type", "application/xml; charset=utf-8");
        return res.sendFile(fallbackPath);
      }
      res.status(500).send("Error generating sitemap");
    }
  });
  app.get("/page-sitemap.xml", async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [pagesSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection("pages").get(),
        dbAdmin.collection("metadata").get()
      ]);
      const pages = pagesSnap.docs.map((doc) => ({ id: doc.id, type: "Page", ...doc.data() }));
      const metadataDocs = metadataSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const staticPages = [
        { title: "Home", slug: "", path: "/" },
        { title: "Offers", slug: "offers", path: "/offers" },
        { title: "Tours", slug: "tours", path: "/tours" },
        { title: "Services", slug: "services", path: "/services" },
        { title: "Blog", slug: "blog", path: "/blog" },
        { title: "Fleet", slug: "fleet", path: "/fleet" },
        { title: "FAQ", slug: "faq", path: "/faq" },
        { title: "About", slug: "about", path: "/about" },
        { title: "Contact", slug: "contact", path: "/contact" },
        { title: "Terms and Conditions", slug: "terms", path: "/terms" }
      ];
      const getMetadataOverride = (routeSlug) => {
        const normSlug = (routeSlug || "").toLowerCase();
        const replaced = normSlug.replace(/\//g, "_");
        let override = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug);
        if (!override && replaced) {
          override = metadataDocs.find((d) => d.slug === replaced || d.id === replaced);
        }
        return override;
      };
      const sitemapEntries = [];
      const registeredPaths = /* @__PURE__ */ new Set();
      pages.forEach((p) => {
        const routeSlug = p.slug || "home";
        const docOverride = getMetadataOverride(routeSlug);
        const noindex = p.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : p.noindex || false);
        const active = p.active !== false;
        if (!noindex && active) {
          const cleanPath = p.slug === "home" || p.slug === "" ? "/" : `/${p.slug}`;
          if (!registeredPaths.has(cleanPath)) {
            registeredPaths.add(cleanPath);
            const updatedAt = docOverride?.updatedAt || p.updatedAt || p.createdAt || null;
            sitemapEntries.push({
              path: cleanPath,
              lastmod: getFormatDate(updatedAt),
              changefreq: cleanPath === "/" ? "daily" : "weekly",
              priority: cleanPath === "/" ? "1.0" : "0.8"
            });
          }
        }
      });
      staticPages.forEach((sp) => {
        const cleanPath = sp.path || "/";
        const routeSlug = sp.slug || "home";
        const docOverride = getMetadataOverride(routeSlug);
        if (docOverride?.noindex === true) return;
        if (!registeredPaths.has(cleanPath)) {
          registeredPaths.add(cleanPath);
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(docOverride?.updatedAt),
            changefreq: cleanPath === "/" ? "daily" : "weekly",
            priority: cleanPath === "/" ? "1.0" : "0.8"
          });
        }
      });
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>`.trim();
      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(xml);
    } catch (err) {
      console.error("Error generating page sitemap:", err);
      const sitemapPath = import_path.default.join(process.cwd(), "dist", "page-sitemap.xml");
      if (import_fs.default.existsSync(sitemapPath)) {
        res.set("Content-Type", "application/xml; charset=utf-8");
        return res.sendFile(sitemapPath);
      }
      res.status(500).send("Error generating sitemap");
    }
  });
  app.get("/blog-sitemap.xml", async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [blogsSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection("blogs").get(),
        dbAdmin.collection("metadata").get()
      ]);
      const blogs = blogsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const metadataDocs = metadataSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sitemapEntries = [];
      blogs.forEach((b) => {
        const routeSlug = `blog/${b.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = b.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : b.noindex || false);
        const active = b.active !== false;
        if (!noindex && active) {
          const cleanPath = `/blog/${b.slug}`;
          const updatedAt = docOverride?.updatedAt || b.updatedAt || b.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: "weekly",
            priority: "0.8"
          });
        }
      });
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>`.trim();
      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(xml);
    } catch (err) {
      console.error("Error generating blog sitemap:", err);
      const sitemapPath = import_path.default.join(process.cwd(), "dist", "blog-sitemap.xml");
      if (import_fs.default.existsSync(sitemapPath)) {
        res.set("Content-Type", "application/xml; charset=utf-8");
        return res.sendFile(sitemapPath);
      }
      res.status(500).send("Error generating sitemap");
    }
  });
  app.get("/offer-sitemap.xml", async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [offersSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection("offers").get(),
        dbAdmin.collection("metadata").get()
      ]);
      const offers = offersSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const metadataDocs = metadataSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sitemapEntries = [];
      offers.forEach((o) => {
        const routeSlug = `offers/${o.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = o.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : o.noindex || false);
        const active = o.active !== false;
        if (!noindex && active) {
          const cleanPath = `/offers/${o.slug}`;
          const updatedAt = docOverride?.updatedAt || o.updatedAt || o.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: "weekly",
            priority: "0.8"
          });
        }
      });
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>`.trim();
      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(xml);
    } catch (err) {
      console.error("Error generating offer sitemap:", err);
      const sitemapPath = import_path.default.join(process.cwd(), "dist", "offer-sitemap.xml");
      if (import_fs.default.existsSync(sitemapPath)) {
        res.set("Content-Type", "application/xml; charset=utf-8");
        return res.sendFile(sitemapPath);
      }
      res.status(500).send("Error generating sitemap");
    }
  });
  app.get("/tours-sitemap.xml", async (req, res) => {
    try {
      const SITE_URL = getSiteUrl(req);
      const [toursSnap, metadataSnap] = await Promise.all([
        dbAdmin.collection("tours").get(),
        dbAdmin.collection("metadata").get()
      ]);
      const tours = toursSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const metadataDocs = metadataSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const sitemapEntries = [];
      tours.forEach((t) => {
        const routeSlug = `tours/${t.slug}`;
        const docOverride = metadataDocs.find((d) => d.slug === routeSlug || d.id === routeSlug.replace(/\//g, "_"));
        const noindex = t.active === false || (docOverride?.noindex !== void 0 ? docOverride.noindex : t.noindex || false);
        const active = t.active !== false;
        if (!noindex && active) {
          const cleanPath = `/tours/${t.slug}`;
          const updatedAt = docOverride?.updatedAt || t.updatedAt || t.createdAt || null;
          sitemapEntries.push({
            path: cleanPath,
            lastmod: getFormatDate(updatedAt),
            changefreq: "weekly",
            priority: "0.8"
          });
        }
      });
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.map((entry) => `  <url>
    <loc>${SITE_URL}${entry.path}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join("\n")}
</urlset>`.trim();
      res.set("Content-Type", "application/xml; charset=utf-8");
      return res.send(xml);
    } catch (err) {
      console.error("Error generating tours sitemap:", err);
      const sitemapPath = import_path.default.join(process.cwd(), "dist", "tours-sitemap.xml");
      if (import_fs.default.existsSync(sitemapPath)) {
        res.set("Content-Type", "application/xml; charset=utf-8");
        return res.sendFile(sitemapPath);
      }
      res.status(500).send("Error generating tours sitemap");
    }
  });
  app.get(["/sitemap", "/sitemap.html"], (req, res) => {
    let sitemapHtmlPath = import_path.default.join(process.cwd(), "dist", "sitemap.html");
    if (!import_fs.default.existsSync(sitemapHtmlPath)) {
      sitemapHtmlPath = import_path.default.join(process.cwd(), "public", "sitemap.html");
    }
    if (import_fs.default.existsSync(sitemapHtmlPath)) {
      res.header("Content-Type", "text/html");
      return res.sendFile(sitemapHtmlPath);
    }
    res.status(404).send("Sitemap HTML directory not found. Please run build first.");
  });
  app.get("/robots.txt", (req, res) => {
    const SITE_URL = getSiteUrl(req);
    const robotsPath = import_path.default.join(process.cwd(), "dist", "robots.txt");
    if (import_fs.default.existsSync(robotsPath)) {
      return res.sendFile(robotsPath);
    }
    res.send(`User-agent: *
Allow: /
Sitemap: ${SITE_URL}/sitemap_index.xml
Sitemap: ${SITE_URL}/sitemap.xml`);
  });
  const injectSEO = async (html, req) => {
    try {
      const url = req.originalUrl;
      const SITE_URL = getSiteUrl(req);
      const settingsSnap = await dbAdmin.collection("settings").doc("system").get();
      const globalSettings = settingsSnap.exists ? settingsSnap.data() : null;
      const globalSeo = globalSettings?.seo || {};
      let slug = url.split("?")[0].split("/").pop() || "";
      let isBlog = url.includes("/blog/");
      let isOffer = url.includes("/offers/");
      let isTour = url.includes("/tours/");
      let seoData = null;
      if (isBlog) {
        const snap = await dbAdmin.collection("blogs").where("slug", "==", slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else if (isOffer) {
        const snap = await dbAdmin.collection("offers").where("slug", "==", slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else if (isTour) {
        const snap = await dbAdmin.collection("tours").where("slug", "==", slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else if (slug) {
        const snap = await dbAdmin.collection("pages").where("slug", "==", slug).limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      } else {
        const snap = await dbAdmin.collection("pages").where("slug", "==", "home").limit(1).get();
        if (!snap.empty) seoData = snap.docs[0].data();
      }
      const siteName = globalSeo.siteName || "Merlux Chauffeur Services";
      const defaultTitle = globalSeo.defaultTitle || "Luxury Chauffeur Melbourne";
      const titleTemplate = globalSeo.titleTemplate || `%s | ${siteName}`;
      let title = seoData?.metaTitle || seoData?.title || defaultTitle;
      if (title !== defaultTitle && !title.includes(siteName)) {
        title = titleTemplate.replace("%s", title);
      }
      const desc = seoData?.metaDescription || seoData?.seoDescription || seoData?.description || seoData?.shortDescription || globalSeo.defaultDescription || "";
      const seoKeywords = Array.isArray(seoData?.keywords) ? seoData.keywords : typeof seoData?.keywords === "string" ? seoData.keywords.split(",").map((k) => k.trim()) : [];
      const defaultKeywords = Array.isArray(globalSeo.defaultKeywords) ? globalSeo.defaultKeywords : typeof globalSeo.defaultKeywords === "string" ? globalSeo.defaultKeywords.split(",").map((k) => k.trim()) : [];
      const keywords = [...seoKeywords, ...defaultKeywords].filter((k) => k !== "").join(", ");
      const favicon = globalSeo.favicon ? `<link rel="icon" href="${globalSeo.favicon}" />` : "";
      const ogImage = seoData?.ogImage || seoData?.featuredImage || globalSeo.ogImage || globalSeo.logo || "";
      const canonical = seoData?.canonicalUrl || `${SITE_URL}${url}`;
      const noindex = seoData?.noindex ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';
      const pageSchema = seoData?.schema ? `<script type="application/ld+json">${JSON.stringify(seoData.schema)}</script>` : "";
      const orgSchema = globalSeo.organizationSchema ? `<script type="application/ld+json">${JSON.stringify(globalSeo.organizationSchema)}</script>` : "";
      const gaScript = globalSeo.googleAnalyticsId ? `
        <script async src="https://www.googletagmanager.com/gtag/js?id=${globalSeo.googleAnalyticsId}"></script>
        <script>
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${globalSeo.googleAnalyticsId}');
        </script>
      ` : "";
      const scMeta = globalSeo.searchConsoleId ? `<meta name="google-site-verification" content="${globalSeo.searchConsoleId}" />` : "";
      const seoTags = `
    <title data-rh="true">${title}</title>
    <meta data-rh="true" name="description" content="${desc}" />
    <meta data-rh="true" name="keywords" content="${keywords}" />
    <link data-rh="true" rel="canonical" href="${canonical}" />
    <link rel="sitemap" type="application/xml" title="Sitemap" href="${SITE_URL}/sitemap_index.xml" />
    ${favicon.replace("<link", '<link data-rh="true"')}
    ${noindex.replace("<meta", '<meta data-rh="true"')}
    ${scMeta.replace("<meta", '<meta data-rh="true"')}
    <meta data-rh="true" property="og:title" content="${title}" />
    <meta data-rh="true" property="og:description" content="${desc}" />
    <meta data-rh="true" property="og:type" content="website" />
    <meta data-rh="true" property="og:url" content="${canonical}" />
    <meta data-rh="true" property="og:image" content="${ogImage}" />
    <meta data-rh="true" name="twitter:card" content="summary_large_image" />
    ${orgSchema}
    ${pageSchema}
    ${gaScript}
      `;
      return html.replace(/<title data-rh="true">.*?<\/title>/, "").replace(/<title>.*?<\/title>/, "").replace("</head>", `${seoTags}</head>`);
    } catch (error) {
      console.error("SEO Injection Error:", error);
      return html;
    }
  };
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      if (url.includes(".") || url.startsWith("/api/")) return next();
      try {
        let template = import_fs.default.readFileSync(import_path.default.resolve(__dirnameResolved, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        const html = await injectSEO(template, req);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath, { index: false }));
    app.get("*", async (req, res) => {
      try {
        const template = import_fs.default.readFileSync(import_path.default.join(distPath, "index.html"), "utf-8");
        const html = await injectSEO(template, req);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        res.status(500).end("Internal Server Error");
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
