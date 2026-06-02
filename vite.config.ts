import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  return {
    plugins: [react(), tailwindcss()],
    define: {
      "process.env.GEMINI_API_KEY": JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== "true",
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("node_modules/react-router-dom"))
              return "reactRouter";
            if (id.includes("node_modules/motion")) return "animations";
            if (id.includes("node_modules/firebase")) return "firebase";
            if (id.includes("node_modules/recharts")) return "recharts";
            if (
              id.includes("node_modules/@stripe") ||
              id.includes("node_modules/stripe-js")
            )
              return "stripe";
            if (id.includes("node_modules/twilio")) return "twilio";
            if (id.includes("node_modules/@react-google-maps"))
              return "googleMaps";
            if (id.includes("node_modules/@google/genai")) return "genai";
            if (id.includes("node_modules/date-fns")) return "dateFns";
            if (id.includes("node_modules/lucide-react")) return "lucide";
            return "vendor";
          },
        },
      },
    },
  };
});
