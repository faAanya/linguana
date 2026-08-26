import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/app/src/components/Auth/AuthContext";
import AppShell from "@/app/src/components/AppShell/AppShell";
import OnboardingGate from "@/app/src/components/Onboarding/OnboardingGate";

export const metadata: Metadata = {
  title: "StudyWally — AI Vocabulary Flashcards",
  description: "Learn languages faster with AI-generated flashcards",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* Apply the saved (or system) theme before paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.getItem('theme');" +
              "if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}" +
              "document.documentElement.setAttribute('data-theme',t);}catch(e){}})();",
          }}
        />
        <AuthProvider>
          <OnboardingGate>
            <AppShell>{children}</AppShell>
          </OnboardingGate>
        </AuthProvider>
      </body>
    </html>
  );
}
