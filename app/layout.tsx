import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/src/components/Auth/AuthContext";
import TopBar from "@/app/src/components/TopBar/TopBar";
import Sidebar from "@/app/src/components/Nav/Sidebar";
import OnboardingGate from "@/app/src/components/Onboarding/OnboardingGate";
import styles from "./layout.module.css";

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
            <Sidebar />
            <div className={styles.content}>{children}</div>
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}
