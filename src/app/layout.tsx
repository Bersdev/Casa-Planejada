import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import Shell from "@/components/Shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Casa Planejada",
  description: "Planejamento financeiro da casa: rendas, contas, cartões, obras e reservas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Casa Planejada", statusBarStyle: "default" },
  icons: { icon: "/icons/app-192.png", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1, viewportFit: "cover",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#141922" }],
};

// Aplica o tema antes da primeira pintura, para não piscar
const themeScript = `try{var t=localStorage.getItem("cp-theme")||"system";if(t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="font-sans antialiased">
        <AppProvider><Shell>{children}</Shell></AppProvider>
      </body>
    </html>
  );
}
