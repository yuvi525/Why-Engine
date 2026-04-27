import { Geist_Mono, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/src/components/ui/toast-provider";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "WHY Engine — AI Cost Intelligence",
  description:
    "Detect AI cost anomalies, identify root causes, and get clear actions to reduce spend.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className="bg-[#0B0F14] text-[#F9FAFB] min-h-screen flex flex-col antialiased">
        <ToastProvider>
          <div className="flex min-h-screen flex-col">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
