import "./globals.css";
import { Lato } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { I18nProvider } from "../components/i18n-provider";

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
  variable: "--font-lato"
});

export const metadata = {
  title: "Groopin | Where paths cross, adventures begin",
  description:
    "Groopin connects you with like-minded people to share passions across sports, culture, travel, dining, and more.",
  icons: {
    icon: "/assets/favicon/favicon.ico",
    shortcut: "/assets/favicon/favicon.ico",
    apple: "/assets/favicon/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/assets/favicon/favicon-96x96.png",
        sizes: "96x96"
      },
      {
        rel: "icon",
        url: "/assets/favicon/favicon.svg",
        type: "image/svg+xml"
      },
      {
        rel: "manifest",
        url: "/assets/favicon/site.webmanifest"
      }
    ]
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={lato.variable}>
      <body className="bg-white text-charcoal-900 font-sans antialiased">
        <I18nProvider>{children}</I18nProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
