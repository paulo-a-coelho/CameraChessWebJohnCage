import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev
export default defineConfig({
  base: '/CameraChessWebJohnCage/', // Using relative path injection to keep asset folder links local
  define: {
    "process.env": {},
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline', // Safely inlines register hooks to avoid pathing blocks
      workbox: {
        globPatterns: ["**/*"],
        maximumFileSizeToCacheInBytes: 5000000
      },
      includeAssets: [
          "**/*",
      ],
      manifest: {
        "name": "ChessCam",
        "short_name": "ChessCam",
        "start_url": ".",
        "scope": ".",
        "icons": [
          {
              "src": "./android-chrome-192x192.png",
              "sizes": "192x192",
              "type": "image/png"
          },
          {
              "src": "./android-chrome-512x512.png",
              "sizes": "512x512",
              "type": "image/png"
          }
        ],
        "theme_color": "#ffffff",
        "background_color": "#ffffff",
        "display": "standalone"
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 2000, 
  },
});
