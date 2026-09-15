import React, { useState } from 'react';
import { ScrollProgressBar } from './ScrollProgressBar';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { MetricsStrip } from './MetricsStrip';
import { LiveEngineShowcaseSection } from './LiveEngineShowcaseSection';
import { RoleSwitcherSection } from './RoleSwitcherSection';
import { IndustriesSection } from './IndustriesSection';
import { WorkflowSection } from './WorkflowSection';
import { DemoModal } from './DemoModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { Footer } from './Footer';

export const LandingPage: React.FC = () => {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* Top Scroll Reading Progress Line */}
      <ScrollProgressBar />

      {/* Sticky Glassmorphism Navigation Bar */}
      <Navbar
        onOpenDemo={() => setIsDemoOpen(true)}
        onOpenCommandPalette={() => setIsPaletteOpen(true)}
      />

      {/* Main Landing Page Content */}
      <main className="flex-1">
        {/* Full-width Hero Section with Dynamic Rotating Image Showcase */}
        <HeroSection
          onOpenDemo={() => setIsDemoOpen(true)}
          onOpenCommandPalette={() => setIsPaletteOpen(true)}
        />

        {/* Floating Animated Metrics Strip */}
        <MetricsStrip />

        {/* Live Engine Capabilities: Document → Decision + Live Audit Feed */}
        <LiveEngineShowcaseSection />

        {/* Tailored Experiences: Applicant vs Officer vs Admin */}
        <RoleSwitcherSection />

        {/* Interactive Industries Section */}
        <IndustriesSection />

        {/* Intelligent Workflow Pipeline Section */}
        <WorkflowSection />
      </main>

      {/* Enterprise SaaS Footer */}
      <Footer />

      {/* Interactive Demo Preview Modal */}
      <DemoModal isOpen={isDemoOpen} onClose={() => setIsDemoOpen(false)} />

      {/* Command Palette (⌘K) Modal */}
      <CommandPaletteModal
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onOpenDemo={() => setIsDemoOpen(true)}
      />
    </div>
  );
};

