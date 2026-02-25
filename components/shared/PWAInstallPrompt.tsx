"use client";

import { useEffect, useRef, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already running as a PWA — no banner needed
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // User previously dismissed
    if (localStorage.getItem("pwa-install-dismissed") === "1") return;

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible) return null;

  async function handleInstall() {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt.current = null;
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem("pwa-install-dismissed", "1");
    setVisible(false);
  }

  return (
    <div
      className="fixed bottom-16 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-[2000] rounded-xl shadow-2xl flex items-center gap-3 px-4 py-3"
      style={{ backgroundColor: "#1a1a24", border: "1px solid #2a2a38" }}
      role="banner"
      aria-label="Install RoadPulse app"
    >
      <span aria-hidden="true" className="text-2xl flex-none">🛣️</span>
      <p className="flex-1 text-sm font-medium" style={{ color: "#f0f0f5" }}>
        Install RoadPulse for quick access
      </p>
      <button
        onClick={handleInstall}
        className="flex-none text-xs font-bold px-3 py-1.5 rounded-lg"
        style={{ backgroundColor: "#4096ff", color: "#ffffff" }}
      >
        Add to Home Screen
      </button>
      <button
        onClick={handleDismiss}
        className="flex-none"
        style={{ color: "#6a6a8a" }}
        aria-label="Dismiss install prompt"
      >
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
