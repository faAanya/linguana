import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/src/components/Auth/AuthContext";
import TopBar from "@/app/src/components/TopBar/TopBar";

export const metadata: Metadata = {
  title: "LinguaFlash — Vocabulary Flashcards",
  description: "Upload vocabulary notes and practice with AI-generated flashcards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <TopBar />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
