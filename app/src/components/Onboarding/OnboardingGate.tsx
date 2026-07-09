"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/Auth/AuthContext";
import Onboarding from "@/components/Onboarding/Onboarding";

// Wrap the app. If a logged-in user hasn't set languages yet, force onboarding.
export default function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Reset the local dismiss flag whenever the user changes (e.g. logout/login)
  useEffect(() => {
    setDismissed(false);
  }, [user?.id]);

  const needsOnboarding =
    !loading &&
    user &&
    (!user.learningLanguages?.length || !user.nativeLanguages?.length) &&
    !dismissed;

  return (
    <>
      {children}
      {needsOnboarding && (
        <Onboarding
          onComplete={async () => {
            setDismissed(true);
            // Re-fetch user so language arrays are up to date app-wide
            await refresh();
          }}
        />
      )}
    </>
  );
}
