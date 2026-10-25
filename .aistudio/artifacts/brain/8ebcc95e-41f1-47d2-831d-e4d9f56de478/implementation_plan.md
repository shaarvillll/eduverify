# EduVerify: APAAR-Based Student Data Management & Verification System

EduVerify is an enterprise-grade administration and verification platform tailored for AICTE-approved educational institutions. It provides academic administrators, registrar offices, and regulatory auditors with a centralized interface to validate synthetic APAAR identifiers, audit approved program intakes against reported enrolments, inspect format anomalies, and simulate batch data ingestion entirely client-side.

### User Review & Critical Decisions

> [!IMPORTANT]
> The following user preferences were confirmed in Phase 1 and govern the core functional specification:

- **Institutional Focus**: Standard AICTE technical and engineering institutions (B.Tech, M.Tech, MCA, Polytechnic Diplomas) with realistic intake ceilings (e.g., 60, 120, 180 seats per batch).
- **Validation Engine Workflow**: Inline issue flagging with one-click resolution recommendations (e.g., mask correction, intake flag override, format patch simulation) within the preview and verification tables.
- **Compliance Reporting**: Interactive visual summaries paired with instant client-side CSV exports for AICTE audit packs and institution performance registers.
- **Environment & Boundary**: Purely client-side frontend prototype with synthetic, non-PII test identifiers (`DEMO-APAAR-XXXX-XXXX`, `DEMO-STU-XXX`, `DEMO-INST-XXX`). No external backend, database, or real API calls.

---

### 1. Overview & Core Concept

- **What It Does**: EduVerify provides a secure, streamlined portal for verifying student enrolment records against simulated AICTE approved intakes and APAAR (Automated Permanent Academic Account Registry) identifier standards. Administrators can search, filter, and inspect student dossiers, upload and parse local CSV batches directly in the browser, review discrepancy alerts (duplicate records, invalid formats, intake cap overflows), and export standardized audit summaries.
- **Target Audience / Persona**: Institutional Nodal Officers, University Registrars, and AICTE Regional Scrutiny Committee Members who require fast, reliable oversight of student numbers and data compliance.
- **Key Value**: Replaces scattered spreadsheets with an intuitive, unified verification console that prevents intake violations, catches malformed identifiers prior to official regulatory filings, and ensures 100% data transparency.

---

### 2. User Experience & Visual Design

#### Key User Flows
1. **Executive Oversight (Overview)**: Administrator lands on the KPI dashboard to review total enrolled students, affiliated institutions, verified records, and pending compliance flags. Inspects intake distribution charts and recent validation alerts.
2. **Student Directory & Detail Dossier (Student Records)**: Administrator filters by institution, degree programme, or validation status. Clicks any student row to slide out a comprehensive audit drawer showing masked APAAR test IDs, academic history, admission quota, and verification log.
3. **In-Browser Batch Upload (Data Upload)**: User drags a CSV batch into the dropzone (or downloads the provided sample template). The client-side parser scans headers, validates synthetic APAAR formats, checks intake bounds, and displays an interactive pre-commit preview with valid rows, rejected anomalies, and one-click fix suggestions.
4. **Discrepancy Remediation (Validation Issues)**: Administrator navigates flagged records categorized by Duplicate Records, Missing Mandatory Fields, Invalid ID Format, and Intake Discrepancies. Each item presents a suggested next action (e.g., "Mark as Resolved", "Request Institutional Rectification").
5. **Institutional Capacity Audit (Institutions)**: Compares sanctioned AICTE intake versus active enrolled students per branch, color-coding over-enrolment warnings.
6. **Regulatory Reports & Data Export (Reports)**: Generates category breakdown charts, validation ratios, and enables instantaneous one-click CSV export of the verified student ledger and audit discrepancy report.

#### Visual Identity & Theme
- **Aesthetic Direction**: Dignified, modern Government-Tech / Administrative Enterprise UI. Clean high-contrast typography, crisp borders, and zero gratuitous flair or distracting decorative animations.
- **Color Palette**:
  - Dominant Neutral Canvas (`#F8FAFC` slate-50 / `#FFFFFF` pure white)
  - Navy Primary Sidebar & Brand Surfaces (`#0F172A` slate-900 / `#1E293B` slate-800)
  - Subtle Structural Borders (`#E2E8F0` slate-200)
  - Restrained Academic Blue Accents (`#2563EB` blue-600 / `#1D4ED8` blue-700)
  - Semantic Status Accents:
    - Validated / Compliant: Emerald Green (`#059669` emerald-600 / `#ECFDF5` emerald-50)
    - Review Required / Warning: Amber (`#D97706` amber-600 / `#FFFBEB` amber-50)
    - Discrepancy / Rejected: Rose Red (`#DC2626` rose-600 / `#FEF2F2` rose-50)
- **Typography & Layout Math**:
  - Headings: `Plus Jakarta Sans` / `Outfit` display hierarchy (`text-lg` to `text-2xl font-semibold`)
  - Body & Form Controls: `DM Sans` / `Plus Jakarta Sans` (`text-sm`, `14px`)
  - Identifiers, Dates & Quantities: Tabular monospace figures (`font-mono tabular-nums`)
  - Strict 60-30-10 color allocation and anti-slop restraint (no floating scorecards, no fake background engine tickers, no decorative pulsing dots).

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Client-Side CSV Parsing vs Backend Simulation**
  - *Chosen Approach*: Lightweight, native in-browser CSV parser using standard Web APIs (`FileReader`) that processes uploaded files directly into React state with zero external network requests.
  - *Why*: Keeps data strictly local, satisfies the prompt's offline/synthetic requirement, and offers instantaneous feedback with preview tables.
  - *Alternatives Considered*: Server API proxy (rejected due to frontend-only scope).
- **Decision 2: Realistic Synthetic APAAR Identifier Masking**
  - *Chosen Approach*: Display synthetic APAAR identifiers in masked format (e.g., `••••-••••-4891`) with an explicit "Synthetic Test Value" badge and an eye toggle to reveal the demo string.
  - *Why*: Reinforces government privacy best practices while assuring users that no real personal identification numbers are processed.
- **Decision 3: Single Source of Truth for Synthetic State**
  - *Chosen Approach*: Centralized in-memory state initialized with rich synthetic datasets, exposed via a clean React Context / hook system.
  - *Why*: Allows actions taken on the "Validation Issues" or "Data Upload" pages (e.g., resolving an anomaly, committing a CSV batch) to immediately update the "Overview" KPI metrics and "Student Records" tables without page reloads.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│                                App Shell                               │
├────────────────────┬───────────────────────────────────────────────────┤
│    Left Sidebar    │                   Top Navigation                  │
│  - Logo & Brand    │  - Search Query Filter                            │
│  - Navigation Menu │  - Notification Center (Mock alerts)              │
│  - Collapse Toggle │  - Administrator Profile Badge                    │
├────────────────────┴───────────────────────────────────────────────────┤
│                       View Router & Context Provider                   │
│                                                                        │
│  ┌───────────────┬────────────────┬───────────────┬─────────────────┐  │
│  │   Overview    │ Student Records│  Data Upload  │Validation Issues│  │
│  │ - Metric KPIs │ - Multi-Filter │ - Dropzone    │ - Category Tabs │  │
│  │ - Intake Chart│ - Paginated Tbl│ - CSV Parser  │ - Action Drawer │  │
│  │ - Status Ring │ - Detail Modal │ - Inline Fixes│ - Status Toggle │  │
│  └───────────────┴────────────────┴───────────────┴─────────────────┘  │
│  ┌────────────────────────────────┬─────────────────────────────────┐  │
│  │       Institutions View        │          Reports View           │  │
│  │ - Sanctioned vs Enrolled Table │ - Program Intake Distribution   │  │
│  │ - Over-Capacity Warning Badges │ - Audit Log & CSV Downloader    │  │
│  └────────────────────────────────┴─────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

#### Data Entities & Schema
- **Student Record**: `id`, `name`, `apaarTestId`, `gender`, `dob`, `category`, `institutionId`, `institutionName`, `programmeId`, `programmeName`, `academicYear`, `currentSemester`, `enrolmentDate`, `validationStatus` (`'VALIDATED' | 'REQUIRES_REVIEW' | 'REJECTED' | 'PENDING'`), `discrepancyType` (optional), `notes`.
- **Institution**: `id`, `code`, `name`, `state`, `district`, `aicteApprovalYear`, `programmes` array.
- **Programme Intake**: `programmeId`, `programmeName`, `approvedIntake`, `reportedEnrolment`, `discrepancyStatus` (`'NORMAL' | 'OVER_INTAKE' | 'CRITICAL_VACANCY'`).
- **Validation Issue**: `id`, `recordId`, `studentName`, `institutionName`, `issueType` (`'DUPLICATE_RECORD' | 'MISSING_FIELD' | 'INVALID_FORMAT' | 'INTAKE_DISCREPANCY'`), `severity` (`'HIGH' | 'MEDIUM' | 'LOW'`), `description`, `recommendation`, `resolvedState`.

#### Interactive Component & State Mapping
- **Search Bar**: Debounced text search filtering across students by name, ID, or masked APAAR identifier.
- **Filter Bar**: Reactive dropdowns for Institution, Academic Year, and Validation Status that automatically recompute page indices.
- **Student Detail Modal**: Deep dive modal revealing academic verification steps, quota categorization, and a demo "Mark as Verified" toggle that updates global state.
- **CSV Importer Engine**: Validates uploaded files against column schema, classifies rows into valid/warning/error groups, and enables users to commit accepted rows directly into the student dataset.
- **Report Downloader**: Generates a standard RFC 4180 CSV blob in-memory and triggers a clean browser download.
