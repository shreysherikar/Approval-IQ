import React, { useState } from 'react';
import { ScrollProgressBar } from './ScrollProgressBar';
import { DynamicScrollBackground } from './DynamicScrollBackground';
import { Navbar } from './Navbar';
import { HeroSection } from './HeroSection';
import { MetricsStrip } from './MetricsStrip';
import { HeliverCapsuleLens } from './HeliverCapsuleLens';
import { LiveEngineShowcaseSection } from './LiveEngineShowcaseSection';
import { RoleSwitcherSection } from './RoleSwitcherSection';
import { CrossMinistryMatrixSection } from './CrossMinistryMatrixSection';
import { IndustriesSection } from './IndustriesSection';
import { WorkflowSection } from './WorkflowSection';
import { DemoModal } from './DemoModal';
import { CommandPaletteModal } from './CommandPaletteModal';
import { Footer } from './Footer';

export const LandingPage: React.FC = () => {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  return (
    <div className="min-h-screen bg-transparent text-ink flex flex-col font-sans selection:bg-ocean-100 selection:text-ocean-900 relative">
      {/* Top Scroll Reading Progress Line */}
      <ScrollProgressBar />

      {/* Dynamic Ambient Scroll-Driven Color Changing Canvas */}
      <DynamicScrollBackground />

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

        {/* Heliver-Style Interactive Frosted Glass Capsule Lens */}
        <HeliverCapsuleLens />

        {/* Live Engine Capabilities: Document → Decision + Live Audit Feed */}
        <LiveEngineShowcaseSection />

        {/* Tailored Experiences: Applicant vs Officer vs Admin */}
        <RoleSwitcherSection />

        {/* Brand New Feature: Topological Cross-Ministry Clearance DAG Matrix */}
        <CrossMinistryMatrixSection />

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

