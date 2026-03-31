import type { Metadata } from "next";
import { Inter, Lora } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-lora",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PaperGrade — AI Academic Paper Grader",
  description: "Upload your academic paper and get AI-powered feedback, grading, and citations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${lora.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
