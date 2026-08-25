import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/ai-security-benchmark-web/",
  plugins: [react()],
});
