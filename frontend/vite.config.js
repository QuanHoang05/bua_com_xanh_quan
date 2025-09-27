// frontend/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,             // cho phép truy cập từ LAN/ngrok
    port: 5173,
    allowedHosts: [
      "ef6f28df4a6b.ngrok-free.app", // đổi thành subdomain ngrok của bạn nếu thay #sửa ở đây để chạy momo
    ],
    proxy: {
      "/api": {
        target: "http://localhost:4000", // backend dev local
        changeOrigin: true,
        secure: false,
      },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
  },
});
