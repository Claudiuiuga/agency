import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Scalero — Websites, Ads & Automation for Local Service Businesses",
  description:
    "Scalero builds premium 3D websites, manages your Google & Meta ads, and automates your entire customer journey — so local service businesses wake up to a full schedule. Live in 48 hours.",
  keywords: [
    "local business marketing",
    "HVAC marketing agency",
    "plumbing website design",
    "dental marketing automation",
    "Google Ads for service businesses",
    "AI receptionist",
    "missed call text back",
    "GoHighLevel agency",
    "local SEO",
    "service business automation",
  ],
  authors: [{ name: "Scalero" }],
  creator: "Scalero",
  metadataBase: new URL("https://scalero.co"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://scalero.co",
    siteName: "Scalero",
    title: "Scalero — Websites, Ads & Automation for Local Service Businesses",
    description:
      "Premium 3D websites, paid ads management, and full marketing automation — built and run for local service businesses. Live in 48 hours.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Scalero — Websites, Ads & Automation for Local Service Businesses",
    description:
      "Premium 3D websites, paid ads management, and full marketing automation — built and run for local service businesses. Live in 48 hours.",
    creator: "@scalero",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "ProfessionalService",
  name: "Scalero",
  url: "https://scalero.co",
  description:
    "Done-for-you marketing systems for local service businesses. We build premium websites, manage ads, and automate your entire customer journey.",
  serviceType: [
    "Web Design",
    "Digital Marketing",
    "Marketing Automation",
    "AI Receptionist",
    "CRM Setup",
    "Paid Ads Management",
  ],
  areaServed: {
    "@type": "Country",
    name: "United States",
  },
  priceRange: "$300–$3,500/mo",
  offers: [
    {
      "@type": "Offer",
      name: "Foundation",
      price: "300",
      priceCurrency: "USD",
      description: "High-converting website, online booking, CRM setup, hosting & maintenance.",
    },
    {
      "@type": "Offer",
      name: "Booked Jobs",
      description: "Paid ads management, website, CRM, automated follow-up, missed-call text-back, review automation.",
    },
    {
      "@type": "Offer",
      name: "Growth System",
      description: "Everything in Booked Jobs plus AI receptionist, reactivation campaigns, and advanced reporting.",
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="canonical" href="https://scalero.co" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${playfair.variable} ${dmSans.variable} antialiased`}>
        {children}
        <Analytics />
        <Script src="https://assets.calendly.com/assets/external/widget.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
