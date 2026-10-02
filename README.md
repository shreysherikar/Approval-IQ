# ApprovalIQ

<p align="center">
  <strong>Enterprise-Grade Industrial Regulatory Clearance & Compliance Orchestration Platform</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.9-blue.svg?style=flat-square&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20+-green.svg?style=flat-square&logo=node.js" alt="Node.js" />
  <img src="https://img.shields.io/badge/NestJS-10-red.svg?style=flat-square&logo=nestjs" alt="NestJS" />
  <img src="https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react" alt="React" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791.svg?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748.svg?style=flat-square&logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Anthropic_Claude-AI-purple.svg?style=flat-square" alt="Anthropic Claude" />
  <img src="https://img.shields.io/badge/Tauri_2-Desktop_.exe-orange.svg?style=flat-square&logo=tauri" alt="Tauri" />
  <img src="https://img.shields.io/badge/Capacitor_7-Android_.apk-119EFF.svg?style=flat-square&logo=capacitor" alt="Capacitor" />
  <img src="https://img.shields.io/badge/Tests-115%2F115_Passing-brightgreen.svg?style=flat-square" alt="Tests" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square" alt="License" />
</p>

---

## Executive Overview

**ApprovalIQ** is an end-to-end industrial regulatory compliance and clearance orchestration platform engineered to streamline and accelerate statutory clearances for industrial enterprises (manufacturing, chemical, food & beverage, and heavy industry). 

By unifying a **deterministic regulatory rules engine**, **multimodal AI document intelligence**, **predictive risk and timeline models**, and a **two-sided collaboration portal for businesses and government officers**, ApprovalIQ automates complex statutory pathways across central, state, and municipal authorities—eliminating bureaucratic latency, cross-document discrepancies, and regulatory non-compliance.

---

## Key Capabilities & Features

### 1. Deterministic Regulatory Compliance Engine
- **Directed Acyclic Graph (DAG) Dependency Resolution:** Evaluates facility technical profiles (plot area, boiler load, hazardous chemicals, effluent discharge, power draw) to dynamically compute prerequisite trees and statutory clearance sequences across 10+ regulatory authorities (MPCB, DISH, State Excise, Fire Services, PESO, FSSAI).
- **Finite State Machine (FSM) Lifecycle:** Rigorously governs clearance statuses (`BLOCKED` &rarr; `AVAILABLE` &rarr; `SUBMITTED` &rarr; `IN_PROGRESS` &rarr; `APPROVED`) with mathematical state transition integrity and immutable audit logging.

### 2. Multimodal AI Document Intelligence & Consistency Comparator
- **Structured LLM Extraction Worker:** Asynchronous background worker leveraging the Anthropic Claude API to parse complex statutory filings (Lease Deeds, Factory Layouts, Environmental Clearances, NOCs) into validated, schema-enforced JSON with confidence scoring and page-level evidence citations.
- **Deterministic Numerical Tolerance Engine:** Cross-validates extracted document parameters against declared facility profiles and across separate filings (e.g., detecting a 1,000 sq.ft. disparity between an executed lease deed, municipal trade license, and floor plan before official government submission).
- **Centralized Document Vault & Entity Reuse:** Automatically links verified statutory documents across multiple agency filings, eliminating 70%+ redundant documentation submissions.

### 3. "What-If" Sensitivity & Policy Sandbox
- **Real-Time Regulatory Impact Simulation:** Allows plant planners to tweak operational variables (e.g., shifting fuel from diesel to biomass, adjusting solar rooftop capacity, expanding cold storage, or relocating across industrial zones) to immediately project changes in required permits, statutory fees, environmental categorizations (Red/Orange/Green/White), and timeline SLAs.

### 4. Explainable Statutory Risk Engine (Risk Factory)
- **Multi-Factor Risk Scoring:** Synthesizes facility hazard classifications, chemical inventories, environmental sensitivity zones, and cross-document validation issues into actionable `SubmissionRisk` and `RegulatoryComplexity` scores.
- **Explainable Scrutiny Recommendations:** Provides government officers and applicants with itemized statutory gap analyses, missing prerequisite citations, and prescriptive mitigation actions.

### 5. Predictive Cost & Timeline Forecasting Engine
- **Statutory Fee & RTS Timeline Predictor:** Calculates exact official government application fees, security deposits, and legal scrutiny charges based on gazetted state schedules.
- **Critical-Path Bottleneck Forecasting:** Applies statistical modeling against Right to Services (RTS) Act statutory timeframes to compute critical paths, identify agency bottlenecks, and project the exact date when a facility will be legally commissioned.

### 6. Interactive Spatial & Market Intelligence Map
- **Industrial Zoning & Cluster Analytics:** Interactive GIS mapping displaying designated industrial zones, MIDC industrial estates, eco-sensitive buffer zones, water bodies, and proximity to municipal fire stations and transport corridors.
- **Jurisdictional Boundary Mapping:** Automatically identifies exact municipal wards, regional pollution control offices, and judicial districts governing the industrial plot.

### 7. Two-Sided Regulatory Officer Scrutiny Portal
- **Officer Scrutiny Workspace:** Dedicated, role-based scrutiny portal for regulatory officers across municipal and state departments with tabbed dossier review, document verification grids, and automated consistency discrepancy alerts.
- **Threaded Clarification Inquiry System:** Enables officers to issue official clarification notices directly on specific document lines or application parameters, with applicant document re-submission and complete legal audit trails.

### 8. Multi-Agency Joint Site Inspection Planner
- **Synchronized Multi-Department Scheduling:** Consolidates on-site inspections across multiple agencies (Pollution Control Board, Directorate of Industrial Safety & Health, Fire Services) into a single coordinated site inspection date.
- **Harmonized Inspection Checklists:** Unifies compliance inspection checklists from all participating authorities to eliminate redundant inspector visits and reduce pre-commissioning delays by weeks.

### 9. Statutory Grievance Redressal & SLA Escalation
- **Right to Services (RTS) SLA Tracking:** Real-time countdown tracking against statutory decision deadlines established under state Right to Services legislation.
- **Automated Escalation Workflows:** Flags impending SLA breaches and generates formal grievance dossiers with automated escalation to departmental Appellate Authorities.

### 10. Continuous Regulatory Change Management
- **Gazette Notification & Amendment Tracker:** Monitors and ingests statutory updates, policy changes, and revised fee schedules from state and central regulatory bodies.
- **Automated Facility Impact Dashboard:** Automatically maps new gazetted circulars against registered facility profiles to identify affected approvals, altered compliance standards, and required corrective filings.

### 11. Government Schemes & Industrial Subsidies Matcher
- **Incentive Eligibility Engine:** Analyzes investment brackets, female workforce participation, green energy generation, and district backwardness categories to match facilities with state and central industrial policies (Package Scheme of Incentives, DPIIT Startup Recognition, MSMED 45-day payment protections, and capital subsidies).

### 12. Context-Aware AI Assistant & Voice Guidance
- **Facility-Grounded Copilot:** An interactive, slide-in AI assistant grounded directly in the facility's profile, roadmap milestones, and document vault.
- **Voice-Enabled Guidance:** Hands-free speech interaction allowing factory managers and field operators to query compliance statuses, statutory requirements, and clearance prerequisites in real time.

---

## Cross-Platform Architecture

ApprovalIQ is engineered as a responsive, multi-platform ecosystem with shared design tokens, unified business logic, and enterprise-grade execution across web, desktop, and mobile:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ApprovalIQ Ecosystem                             │
├───────────────────────┬─────────────────────────────┬───────────────────────┤
│    Web Application    │   Windows Desktop Shell     │  Android Mobile App   │
│   (React 18 / Vite)   │   (Tauri 2 / Rust .exe)     │  (Capacitor 7 .apk)   │
├───────────────────────┴─────────────────────────────┴───────────────────────┤
│                               Shared Core UI                                │
│       Tailwind CSS • Lucide Icons • Responsive Layouts • Safe-Area Insets    │
├─────────────────────────────────────────────────────────────────────────────┤
│                          Decoupled Service Engines                          │
│   ┌──────────────────────────┐  ┌───────────────────────────────────────┐   │
│   │ @approvaliq/approval-    │  │ @approvaliq/document-engine           │   │
│   │ engine (Pure DAG/FSM)    │  │ (Anthropic Claude + Tolerance Engine) │   │
│   └──────────────────────────┘  └───────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────────────┤
│                         Backend API & Data Layer                            │
│   NestJS • Prisma ORM • PostgreSQL 16 • Asynchronous Job Worker (SKIP LOCKED) │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Web Application (`apps/web`):** Full-featured responsive SPA built with React 18, Vite, React Router 6, and Tailwind CSS.
- **Windows Desktop Shell (`apps/desktop-shell`):** Native Windows executable (`approvaliq.exe`, ~8.8 MB) compiled with Tauri 2 and Rust, featuring low memory footprint, instant cold starts, and seamless desktop operating system integration.
- **Android Mobile Application (`apps/mobile-shell`):** Native Android package (`app-debug.apk`, ~4.2 MB) compiled via Capacitor 7 with target SDK 35, edge-to-edge safe-area inset adaptation, and hardware back-button navigation.

---

## Technical Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend Clients** | React 18, TypeScript 5.9, Vite, Tailwind CSS, Lucide Icons, React Router 6 |
| **Native Shells** | Tauri 2 (Rust MSVC backend) for Windows `.exe`, Capacitor 7 for Android `.apk` |
| **Backend API** | NestJS 10, Node.js 20 LTS, TypeScript, Fastify/Express, REST, Google OAuth 2.0 |
| **Database & ORM** | PostgreSQL 16, Prisma ORM 6, Composite Indexing, Foreign-Key Cascades, ACID Transactions |
| **Task Queue & Workers** | PostgreSQL-backed asynchronous `Job` queue with atomic `FOR UPDATE SKIP LOCKED` polling |
| **AI & Document Extraction** | Anthropic Claude API (Sonnet), Structured JSON Schema validation, Mathematical Tolerance Engine |
| **Monorepo & Build Tooling** | `pnpm` workspaces (12 packages), TypeScript project references, Docker Compose |
| **Testing & CI/CD** | Node.js Test Runner, Jest, GitHub Actions, ESLint 9, Prettier |

---

## Engineering Standards & Code Quality

- **Pure Functional Domain Cores:** Core regulatory evaluation (`@approvaliq/approval-engine`) and document intelligence algorithms are decoupled from network and database I/O as pure, deterministic functions, guaranteeing 100% reproducible outcomes.
- **Enterprise-Grade Type Safety:** Strict TypeScript compilation across all 12 monorepo packages with shared domain contracts (`@approvaliq/domain-types`, `@approvaliq/contracts`).
- **Resilient Queue Architecture:** Asynchronous extraction worker implements exponential backoff, dead-letter state tracking, and atomic polling locks (`SKIP LOCKED`) to handle high-volume processing without external queue dependencies.
- **Zero-Flakiness CI/CD & Automated Test Suite:**
  - **115 / 115 Automated Tests Passing** (39 API Unit + 42 Document Engine + 34 Approval Engine).
  - SHA-256 fixture hashing and deterministic execution engines ensure continuous integration checks run swiftly without flakiness or external network dependencies.
- **Granular Role-Based Access Control (RBAC) & DPDP Act 2023 Consent Model:** Strict data isolation and query scoping across Applicant, Officer, and Administrator personas, coupled with granular per-purpose data reuse consent (`ConsentGrant`) compliant with India's Digital Personal Data Protection (DPDP) Act 2023.

---

## Project Structure

```text
approvaliq/
├── apps/
│   ├── web/                    # React 18 + Vite responsive web application
│   ├── desktop-shell/          # Tauri 2 + Rust Windows desktop application (.exe)
│   └── mobile-shell/           # Capacitor 7 Android mobile application (.apk)
├── services/
│   ├── api/                    # NestJS REST API, authentication, RBAC, background jobs
│   ├── approval-engine/        # Pure functional DAG rules engine & FSM clearance state
│   ├── document-engine/        # Claude AI extraction, JSON schemas, tolerance comparator
│   └── workflow-engine/        # Workflow automation & SLA lifecycle coordinator
├── packages/
│   ├── domain-types/           # Shared TypeScript domain models & DTOs
│   ├── contracts/              # Shared API validation contracts & schemas
│   ├── storage/                # S3/Local artifact storage abstraction
│   └── test-fixtures/          # Deterministic test data & SHA-256 hashed fixtures
├── database/                   # Seed files, sample data, and schema definitions
└── infra/                      # Docker Compose, environment configs, and CI/CD pipelines
```

---

## Quickstart & Local Setup

### Prerequisites
- **Node.js:** v20+ LTS
- **pnpm:** v9+
- **Docker & Docker Compose** (for PostgreSQL database)

### Installation & Launch

1. **Clone the repository and install dependencies:**
   ```bash
   git clone https://github.com/shreysherikar/Approval-IQ.git
   cd Approval-IQ
   pnpm install
   ```

2. **Start the database:**
   ```bash
   docker compose up -d
   ```

3. **Deploy database migrations and seed operational enterprise dataset:**
   ```bash
   pnpm --filter api prisma migrate deploy
   pnpm seed:demo:reset
   ```
   *This seeds full-scale enterprise profiles (Pune Craft Brewery), 10 live regulatory clearance evaluations, automated document extractions with precision tolerance validation, interactive officer clarification threads, and scheduled multi-agency joint inspections.*

4. **Launch the development environment:**
   ```bash
   pnpm dev
   ```
   - **Frontend Web Portal:** [http://localhost:5173](http://localhost:5173)
   - **Backend REST API:** [http://localhost:3001](http://localhost:3001)

### Pre-Configured Enterprise Accounts & Roles

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Applicant** | `applicant@approvaliq.dev` | `Password123!` | Industrial Applicant (Pune Craft Brewery) |
| **Officer** | `officer@approvaliq.dev` | `Password123!` | Regulatory Scrutiny Officer (MPCB, DISH, Fire, Excise) |
| **Admin** | `admin@approvaliq.dev` | `Password123!` | Full System & Regulatory Knowledge Base Admin |

---

## Building Native Clients

### Windows Desktop (`.exe`)
```bash
pnpm --filter @approvaliq/web build
pnpm --filter @approvaliq/desktop-shell build
```
*Output executable: `apps/desktop-shell/src-tauri/target/release/approvaliq.exe`*

### Android Mobile (`.apk`)
```bash
pnpm --filter @approvaliq/web build
pnpm --filter @approvaliq/mobile-shell cap:sync
pnpm --filter @approvaliq/mobile-shell build:apk
```
*Output package: `apps/mobile-shell/android/app/build/outputs/apk/debug/app-debug.apk`*

---

## Testing & Quality Assurance

Run the comprehensive test and typecheck pipeline across all monorepo workspaces:

```bash
# Typecheck all 12 workspace packages
pnpm typecheck

# Run all unit and pure engine test suites (115/115 tests)
pnpm test

# Full continuous integration verification check
pnpm ci:check
```

---

## Author & Acknowledgements

- **Developer:** [Shreya Sherikar](https://github.com/shreysherikar)
- **LinkedIn:** [linkedin.com/in/shreya-sherikar](https://linkedin.com/in/shreya-sherikar)
