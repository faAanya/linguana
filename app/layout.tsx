import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/Auth/AuthContext";
import TopBar from "@/components/TopBar/TopBar";
import OnboardingGate from "@/components/Onboarding/OnboardingGate";

export const metadata: Metadata = {
  title: "Linguana — AI Vocabulary Flashcards",
  description: "Learn languages faster with AI-generated flashcards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <OnboardingGate>
            <TopBar />
            {children}
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}