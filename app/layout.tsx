import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/src/components/Auth/AuthContext";
import AppShell from "@/app/src/components/AppShell/AppShell";
import OnboardingGate from "@/app/src/components/Onboarding/OnboardingGate";

export const metadata: Metadata = {
  title: "Linguana — AI Vocabulary Flashcards",
  description: "Learn languages faster with AI-generated flashcards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AuthProvider>
          <OnboardingGate>
            <AppShell>{children}</AppShell>
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}
