import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Amazon Roaster",
  description: "Scrape an Amazon listing, roast it with Ollama MiniMax M2.5 cloud, and hear it with Noiz.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("h-full", "antialiased", inter.variable, jetbrainsMono.variable)}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <Toaster
          richColors
          position="top-right"
          toastOptions={{
            classNames: {
              toast:
                "!rounded-none !border !border-border !bg-card !text-card-foreground !shadow-xs",
              title: "!text-sm !font-semibold !text-foreground",
              description: "!text-xs !text-muted-foreground",
              actionButton:
                "!rounded-none !bg-primary !text-primary-foreground hover:!bg-primary/90",
              cancelButton: "!rounded-none !bg-muted !text-foreground hover:!bg-muted/80",
              success: "!border-primary/30",
              error: "!border-destructive/35 !text-destructive",
              warning: "!border-primary/35",
              info: "!border-border",
            },
          }}
        />
      </body>
    </html>
  );
}
