--
-- PostgreSQL database dump
--

\restrict hNrZHZtFSCsjZKU2YFSKK7gvNLNtVVlzEIro6gv3DVCWMryRpMBtGC1c8DoEFr8

-- Dumped from database version 18.6 (Homebrew)
-- Dumped by pg_dump version 18.6 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: document_mismatch_findings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_mismatch_findings (
    id character varying(100) NOT NULL,
    document_id character varying(100) NOT NULL,
    student_id character varying(50) NOT NULL,
    field_name character varying(100) NOT NULL,
    field_label character varying(150) NOT NULL,
    document_value text NOT NULL,
    database_value text NOT NULL,
    raw_evidence text,
    finding_type character varying(100) NOT NULL,
    severity character varying(20) DEFAULT 'WARNING'::character varying NOT NULL,
    explanation text NOT NULL,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: institutions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.institutions (
    id character varying(50) NOT NULL,
    aicte_code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    state character varying(100),
    city character varying(100),
    type character varying(100),
    established_year integer,
    contact_email character varying(150),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: programmes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programmes (
    id integer NOT NULL,
    institution_id character varying(50) NOT NULL,
    programme_id character varying(50) NOT NULL,
    programme_name character varying(200) NOT NULL,
    degree_type character varying(50) NOT NULL,
    approved_intake integer DEFAULT 60 NOT NULL,
    reported_enrolment integer DEFAULT 0 NOT NULL,
    active_batches integer DEFAULT 4 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: programmes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.programmes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: programmes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.programmes_id_seq OWNED BY public.programmes.id;


--
-- Name: student_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_documents (
    id character varying(100) NOT NULL,
    student_id character varying(50) NOT NULL,
    original_filename character varying(255) NOT NULL,
    mime_type character varying(100) NOT NULL,
    file_extension character varying(20) NOT NULL,
    file_size integer NOT NULL,
    storage_key character varying(255) NOT NULL,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL,
    processing_status character varying(50) DEFAULT 'UPLOADED'::character varying NOT NULL,
    review_status character varying(50) DEFAULT 'PENDING'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    extracted_text text,
    extracted_at timestamp with time zone,
    ocr_error text,
    page_count integer DEFAULT 1,
    ocr_confidence numeric(5,2),
    CONSTRAINT student_documents_file_size_check CHECK ((file_size > 0))
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    id character varying(50) NOT NULL,
    apaar_test_id character varying(50),
    full_name character varying(150) NOT NULL,
    institution_id character varying(50),
    institution_name character varying(200),
    programme_id character varying(50),
    programme_name character varying(200),
    academic_year character varying(20),
    semester integer,
    admission_quota character varying(100),
    validation_status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    discrepancy_note text DEFAULT ''::text,
    last_updated timestamp with time zone DEFAULT now(),
    gender character varying(50),
    dob character varying(50),
    category character varying(50)
);


--
-- Name: validation_issues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.validation_issues (
    id character varying(100) NOT NULL,
    record_id character varying(50) NOT NULL,
    student_name character varying(150),
    apaar_test_id character varying(50),
    institution_id character varying(50),
    institution_name character varying(200),
    programme_name character varying(200),
    issue_type character varying(50) NOT NULL,
    severity character varying(20) NOT NULL,
    reason text NOT NULL,
    recommended_action text,
    status character varying(20) DEFAULT 'OPEN'::character varying NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: programmes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes ALTER COLUMN id SET DEFAULT nextval('public.programmes_id_seq'::regclass);


--
-- Data for Name: document_mismatch_findings; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.document_mismatch_findings VALUES ('FIND-278b7ead-institutionName', 'DOC-1792952832974-278b7ead', 'DEMO-STU-001', 'institutionName', 'Enrolled Institution', 'Example Technical Institute (Fictional)', 'National Institute of Technology & Engineering, New Delhi', 'Institution Example Technical Institute (Fictional)', 'INSTITUTION_MISMATCH', 'WARNING', 'Document institution "Example Technical Institute (Fictional)" does not match enrolled institution "National Institute of Technology & Engineering, New Delhi".', 'RESOLVED', '2026-10-26 01:03:55.658749+05:30', '2026-10-26 02:31:02.477193+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-4f6e25c8-apaarTestId', 'DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'apaarTestId', 'Synthetic APAAR ID', '1111-2222-3333', '8241-9952-1403', 'Synthetic APAAR-like Test ID 1111-2222-3333', 'APAAR_ID_MISMATCH', 'HIGH', 'Synthetic APAAR ID in document ("1111-2222-3333") does not match registered test ID ("8241-9952-1403").', 'OPEN', '2026-10-26 01:21:08.528454+05:30', '2026-10-26 01:55:24.163175+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-278b7ead-programmeName', 'DOC-1792952832974-278b7ead', 'DEMO-STU-001', 'programmeName', 'Academic Programme', 'B.Tech — Computer Science (Demo)', 'B.Tech - Computer Science & Engineering', 'Programme B.Tech — Computer Science (Demo)', 'PROGRAMME_MISMATCH', 'WARNING', 'Document programme "B.Tech — Computer Science (Demo)" does not match registered programme "B.Tech - Computer Science & Engineering".', 'RESOLVED', '2026-10-26 01:03:55.659155+05:30', '2026-10-26 02:31:02.477449+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-278b7ead-academicYear', 'DOC-1792952832974-278b7ead', 'DEMO-STU-001', 'academicYear', 'Academic Year', '2026-2027', '2024-2025', 'Academic Year 2026-2027', 'ACADEMIC_YEAR_MISMATCH', 'WARNING', 'Document academic year "2026-2027" differs from registered academic year "2024-2025".', 'OPEN', '2026-10-26 01:03:55.680842+05:30', '2026-10-26 02:31:02.477705+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-278b7ead-semester', 'DOC-1792952832974-278b7ead', 'DEMO-STU-001', 'semester', 'Enrolled Semester', '2', '3', 'Semester 2', 'SEMESTER_MISMATCH', 'WARNING', 'Document indicates semester 2, whereas student record is enrolled for semester 3.', 'OPEN', '2026-10-26 01:03:55.681591+05:30', '2026-10-26 02:31:02.478042+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-278b7ead-studentName', 'DOC-1792952832974-278b7ead', 'DEMO-STU-001', 'studentName', 'Student Full Name', 'Aarav Demo', 'Aarav Sharma', 'Student Name Aarav Demo', 'NAME_MISMATCH', 'HIGH', 'Document student name "Aarav Demo" does not match registered student name "Aarav Sharma".', 'OPEN', '2026-10-26 01:03:55.650834+05:30', '2026-10-26 02:31:02.476664+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-278b7ead-apaarTestId', 'DOC-1792952832974-278b7ead', 'DEMO-STU-001', 'apaarTestId', 'Synthetic APAAR ID', '1111-2222-3333', '9182-3746-5120', 'Synthetic APAAR-like Test ID 1111-2222-3333', 'APAAR_ID_MISMATCH', 'HIGH', 'Synthetic APAAR ID in document ("1111-2222-3333") does not match registered test ID ("9182-3746-5120").', 'RESOLVED', '2026-10-26 01:03:55.658031+05:30', '2026-10-26 02:31:02.476939+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-4f6e25c8-institutionName', 'DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'institutionName', 'Enrolled Institution', 'Example Technical Institute (Fictional)', 'National Institute of Technology & Engineering, New Delhi', 'Institution Example Technical Institute (Fictional)', 'INSTITUTION_MISMATCH', 'WARNING', 'Document institution "Example Technical Institute (Fictional)" does not match enrolled institution "National Institute of Technology & Engineering, New Delhi".', 'OPEN', '2026-10-26 01:21:08.529338+05:30', '2026-10-26 01:55:24.16374+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-4f6e25c8-programmeName', 'DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'programmeName', 'Academic Programme', 'B.Tech — Computer Science (Demo)', 'B.Tech - Artificial Intelligence & Data Science', 'Programme B.Tech — Computer Science (Demo)', 'PROGRAMME_MISMATCH', 'WARNING', 'Document programme "B.Tech — Computer Science (Demo)" does not match registered programme "B.Tech - Artificial Intelligence & Data Science".', 'OPEN', '2026-10-26 01:21:08.530256+05:30', '2026-10-26 01:55:24.164178+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-4f6e25c8-academicYear', 'DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'academicYear', 'Academic Year', '2026-2027', '2024-2025', 'Academic Year 2026-2027', 'ACADEMIC_YEAR_MISMATCH', 'WARNING', 'Document academic year "2026-2027" differs from registered academic year "2024-2025".', 'OPEN', '2026-10-26 01:21:08.531143+05:30', '2026-10-26 01:55:24.164584+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-4f6e25c8-studentName', 'DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'studentName', 'Student Full Name', 'Aarav Demo', 'Ananya Iyer', 'Student Name Aarav Demo', 'NAME_MISMATCH', 'HIGH', 'Document student name "Aarav Demo" does not match registered student name "Ananya Iyer".', 'OPEN', '2026-10-26 01:21:08.525619+05:30', '2026-10-26 01:55:24.161196+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-4f6e25c8-studentId', 'DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'studentId', 'Synthetic Student ID', 'DEMO-STU-001', 'DEMO-STU-002', 'Synthetic Student ID DEMO-STU-001', 'ID_MISMATCH', 'HIGH', 'Document student ID "DEMO-STU-001" does not match registered student ID "DEMO-STU-002".', 'OPEN', '2026-10-26 01:21:08.527646+05:30', '2026-10-26 01:55:24.162541+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-4f6e25c8-semester', 'DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'semester', 'Enrolled Semester', '2', '1', 'Semester 2', 'SEMESTER_MISMATCH', 'WARNING', 'Document indicates semester 2, whereas student record is enrolled for semester 1.', 'OPEN', '2026-10-26 01:21:08.531838+05:30', '2026-10-26 01:55:24.164959+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-15b11a20-apaarTestId', 'DOC-1792957973979-15b11a20', 'DEMO-STU-101', 'apaarTestId', 'Synthetic APAAR ID', '2222-3333-4444', '9210-4819-2041', 'Synthetic APAAR-like Test ID 2222-3333-4444', 'APAAR_ID_MISMATCH', 'HIGH', 'Synthetic APAAR ID in document ("2222-3333-4444") does not match registered test ID ("9210-4819-2041").', 'RESOLVED', '2026-10-26 01:23:00.758118+05:30', '2026-10-26 01:56:27.797571+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-15b11a20-institutionName', 'DOC-1792957973979-15b11a20', 'DEMO-STU-101', 'institutionName', 'Enrolled Institution', 'Example Technical Institute (Fictional)', 'National Institute of Technology & Engineering, New Delhi', 'Institution Example Technical Institute (Fictional)', 'INSTITUTION_MISMATCH', 'WARNING', 'Document institution "Example Technical Institute (Fictional)" does not match enrolled institution "National Institute of Technology & Engineering, New Delhi".', 'RESOLVED', '2026-10-26 01:23:00.759892+05:30', '2026-10-26 01:56:32.49626+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-15b11a20-programmeName', 'DOC-1792957973979-15b11a20', 'DEMO-STU-101', 'programmeName', 'Academic Programme', 'B.Tech — Computer Science (Demo)', 'B.Tech - Computer Science & Engineering', 'Programme B.Tech — Computer Science (Demo)', 'PROGRAMME_MISMATCH', 'WARNING', 'Document programme "B.Tech — Computer Science (Demo)" does not match registered programme "B.Tech - Computer Science & Engineering".', 'OPEN', '2026-10-26 01:23:00.760606+05:30', '2026-10-26 01:56:27.799282+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-15b11a20-academicYear', 'DOC-1792957973979-15b11a20', 'DEMO-STU-101', 'academicYear', 'Academic Year', '2026-2027', '2024-2025', 'Academic Year 2026-2027', 'ACADEMIC_YEAR_MISMATCH', 'WARNING', 'Document academic year "2026-2027" differs from registered academic year "2024-2025".', 'OPEN', '2026-10-26 01:23:00.763707+05:30', '2026-10-26 01:56:27.80008+05:30');
INSERT INTO public.document_mismatch_findings VALUES ('FIND-15b11a20-semester', 'DOC-1792957973979-15b11a20', 'DEMO-STU-101', 'semester', 'Enrolled Semester', '2', '', 'Semester 2', 'SEMESTER_MISMATCH', 'WARNING', 'Document indicates semester "2", whereas student record specifies "".', 'OPEN', '2026-10-26 01:23:00.764259+05:30', '2026-10-26 01:56:27.800656+05:30');


--
-- Data for Name: institutions; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.institutions VALUES ('DEMO-INST-001', 'AICTE-1-4928172', 'National Institute of Technology & Engineering, New Delhi', 'Delhi (NCT)', 'New Delhi', 'Government Autonomous', 1988, 'registrar@demo-nite-delhi.edu.in', '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.institutions VALUES ('DEMO-INST-002', 'AICTE-1-7821943', 'Maharashtra College of Technology & Applied Research', 'Maharashtra', 'Pune', 'Government Aided', 1994, 'academic.dean@demo-mct-pune.org', '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.institutions VALUES ('DEMO-INST-003', 'AICTE-1-3920194', 'Karnataka Institute of Advanced Technical Sciences', 'Karnataka', 'Bengaluru', 'Self-Financing Technical', 2002, 'admissions@demo-kiats-blr.ac.in', '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.institutions VALUES ('DEMO-INST-004', 'AICTE-1-5820491', 'Tamil Nadu College of Engineering & Poly-Studies', 'Tamil Nadu', 'Coimbatore', 'Government Autonomous', 1976, 'director@demo-tnce-cbe.edu.in', '2026-10-25 22:16:42.582596+05:30');


--
-- Data for Name: programmes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.programmes VALUES (1, 'DEMO-INST-001', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 120, 120, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (2, 'DEMO-INST-001', 'PROG-AI-DS', 'B.Tech - Artificial Intelligence & Data Science', 'B.Tech', 60, 65, 3, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (3, 'DEMO-INST-001', 'PROG-ECE', 'B.Tech - Electronics & Communication Engineering', 'B.Tech', 120, 114, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (4, 'DEMO-INST-001', 'PROG-ME', 'B.Tech - Mechanical Engineering', 'B.Tech', 60, 38, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (5, 'DEMO-INST-001', 'PROG-MCA', 'Master of Computer Applications (MCA)', 'MCA', 60, 60, 2, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (6, 'DEMO-INST-002', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 180, 180, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (7, 'DEMO-INST-002', 'PROG-ECE', 'B.Tech - Electronics & Communication Engineering', 'B.Tech', 120, 126, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (8, 'DEMO-INST-002', 'PROG-EE', 'B.Tech - Electrical Engineering', 'B.Tech', 60, 58, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (9, 'DEMO-INST-002', 'PROG-CE', 'B.Tech - Civil Engineering', 'B.Tech', 60, 41, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (10, 'DEMO-INST-003', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 240, 238, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (11, 'DEMO-INST-003', 'PROG-AI-DS', 'B.Tech - Artificial Intelligence & Data Science', 'B.Tech', 120, 120, 3, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (12, 'DEMO-INST-003', 'PROG-IT', 'B.Tech - Information Technology', 'B.Tech', 120, 124, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (13, 'DEMO-INST-003', 'PROG-MCA', 'Master of Computer Applications (MCA)', 'MCA', 60, 59, 2, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (14, 'DEMO-INST-004', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 120, 119, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (15, 'DEMO-INST-004', 'PROG-ME', 'B.Tech - Mechanical Engineering', 'B.Tech', 120, 102, 4, '2026-10-25 22:16:42.582596+05:30');
INSERT INTO public.programmes VALUES (16, 'DEMO-INST-004', 'PROG-ROBO', 'B.Tech - Robotics & Automation', 'B.Tech', 60, 60, 2, '2026-10-25 22:16:42.582596+05:30');


--
-- Data for Name: student_documents; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.student_documents VALUES ('DOC-1792957603474-4f6e25c8', 'DEMO-STU-002', 'eduverify_synthetic_student_test_document.pdf', 'application/pdf', 'pdf', 27906, 'DOC-1792957603474-4f6e25c8.pdf', '2026-10-26 01:16:43.476898+05:30', 'COMPLETED', 'PENDING', '2026-10-26 01:16:43.476898+05:30', '2026-10-26 01:55:22.74687+05:30', 'EDUVERIFY — SYNTHETIC STUDENT TEST
DOCUMENT
Fictional sample created solely to test document upload and OCR workflows
TEST DATA ONLY — NOT AN OFFICIAL DOCUMENT
All names, identifiers, institutions, and academic details below are fictional. This is not an APAAR card,
Aadhaar document, academic transcript, or proof of identity.
Sample Student Details
Field Fictional Value
Student Name Aarav Demo
Synthetic Student ID DEMO-STU-001
Synthetic APAAR-like Test ID 1111-2222-3333
Institution Example Technical Institute (Fictional)
Programme B.Tech — Computer Science (Demo)
Academic Year 2026-2027
Semester 2
Document Label SYNTHETIC TEST DATA
Suggested upload test
Upload this PDF against a synthetic student record in the EduVerify development environment. The name
and identifiers are test values only; they may intentionally differ from your chosen student record so later
OCR and mismatch-detection phases can be tested.
Do not use this file for real admissions, official identity verification, or submission to any authority.

-- 1 of 1 --', '2026-10-26 01:55:22.74687+05:30', NULL, 1, 100.00);
INSERT INTO public.student_documents VALUES ('DOC-1792957973979-15b11a20', 'DEMO-STU-101', 'aarushi_singhania_synthetic_test_document.pdf', 'application/pdf', 'pdf', 27988, 'DOC-1792957973979-15b11a20.pdf', '2026-10-26 01:22:53.982066+05:30', 'COMPLETED', 'PENDING', '2026-10-26 01:22:53.982066+05:30', '2026-10-26 01:56:27.096621+05:30', 'EDUVERIFY — SYNTHETIC STUDENT TEST DOCUMENT
TEST DATA ONLY — NOT AN OFFICIAL DOCUMENT
Purpose: This fictional sample is intended only for testing document upload, OCR extraction, and
rule-based mismatch detection in the EduVerify development environment.
Important: All values below are synthetic. This is not an APAAR card, Aadhaar document, academic
transcript, or proof of identity. Do not submit it to any institution or government authority.
Sample Student Details
Field Fictional Value
Student Name Aarushi Singhania
Synthetic Student ID DEMO-STU-101
Synthetic APAAR-like Test ID 2222-3333-4444
Institution Example Technical Institute (Fictional)
Programme B.Tech — Computer Science (Demo)
Academic Year 2026-2027
Semester 2
Document Label SYNTHETIC TEST DATA
Suggested Upload Test
Upload this PDF against synthetic student record DEMO-STU-101 (Aarushi Singhania). The sample
includes fictional values that may differ from values stored in your selected database record. OCR output
is unverified text; mismatch findings must be reviewed by a human.
This document was generated for software testing only. It does not represent a real student record and must not be used for
admissions, identity verification, or regulatory submissions.

-- 1 of 1 --', '2026-10-26 01:56:27.096621+05:30', NULL, 1, 100.00);
INSERT INTO public.student_documents VALUES ('DOC-1792952832974-278b7ead', 'DEMO-STU-001', 'eduverify_synthetic_student_test_document.pdf', 'application/pdf', 'pdf', 27906, 'DOC-1792952832974-278b7ead.pdf', '2026-10-25 23:57:12.976722+05:30', 'COMPLETED', 'PENDING', '2026-10-25 23:57:12.976722+05:30', '2026-10-26 02:31:02.451356+05:30', 'EDUVERIFY — SYNTHETIC STUDENT TEST
DOCUMENT
Fictional sample created solely to test document upload and OCR workflows
TEST DATA ONLY — NOT AN OFFICIAL DOCUMENT
All names, identifiers, institutions, and academic details below are fictional. This is not an APAAR card,
Aadhaar document, academic transcript, or proof of identity.
Sample Student Details
Field Fictional Value
Student Name Aarav Demo
Synthetic Student ID DEMO-STU-001
Synthetic APAAR-like Test ID 1111-2222-3333
Institution Example Technical Institute (Fictional)
Programme B.Tech — Computer Science (Demo)
Academic Year 2026-2027
Semester 2
Document Label SYNTHETIC TEST DATA
Suggested upload test
Upload this PDF against a synthetic student record in the EduVerify development environment. The name
and identifiers are test values only; they may intentionally differ from your chosen student record so later
OCR and mismatch-detection phases can be tested.
Do not use this file for real admissions, official identity verification, or submission to any authority.

-- 1 of 1 --', '2026-10-26 02:31:02.451356+05:30', NULL, 1, 100.00);


--
-- Data for Name: students; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.students VALUES ('DEMO-STU-002', '8241-9952-1403', 'Ananya Iyer', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'PROG-AI-DS', 'B.Tech - Artificial Intelligence & Data Science', '2024-2025', 1, 'All India AICTE', 'REQUIRES_REVIEW', 'Issue resolved by administrator review.', '2026-10-26 01:55:11.380139+05:30', 'Female', '2005-07-22', 'General');
INSERT INTO public.students VALUES ('DEMO-STU-101', '9210-4819-2041', 'Aarushi Singhania', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', '2024-2025', NULL, 'State Merit', 'REQUIRES_REVIEW', '', '2026-10-26 01:56:22.436848+05:30', 'Female', NULL, NULL);
INSERT INTO public.students VALUES ('DEMO-STU-102', '8491-3820-1193', 'Devansh Joshi', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', '2024-2025', NULL, 'State Merit', 'VALIDATED', '', '2026-10-25 21:53:24.294822+05:30', 'Male', NULL, NULL);
INSERT INTO public.students VALUES ('DEMO-STU-104', '9182-3746-5120', 'Mihir Saxena', 'DEMO-INST-003', 'Karnataka Institute of Advanced Technical Sciences', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', '2024-2025', NULL, 'Management', 'REQUIRES_REVIEW', 'Issue resolved by administrator review.', '2026-10-25 22:21:49.524842+05:30', 'Male', NULL, NULL);
INSERT INTO public.students VALUES ('DEMO-STU-103', '7104-9281-5520', 'Ritika Choudhary', 'DEMO-INST-002', 'Maharashtra College of Technology & Applied Research', 'PROG-ECE', 'B.Tech - Electronics & Communication Engineering', '2024-2025', NULL, 'All India AICTE', 'VALIDATED', 'Issue resolved by administrator review.', '2026-10-25 23:19:25.786556+05:30', 'Female', NULL, NULL);
INSERT INTO public.students VALUES ('DEMO-STU-001', '9182-3746-5120', 'Aarav Sharma', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', '2024-2025', 3, 'State Merit', 'REQUIRES_REVIEW', 'Automated test note', '2026-10-26 02:31:02.367087+05:30', 'Male', '2004-03-14', 'General');


--
-- Data for Name: validation_issues; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.validation_issues VALUES ('ISS-INTAKE-DEMO-INST-003-PROG-IT', 'BATCH-DEMO-INST-003-PROG-IT', 'B.Tech - Information Technology Enrolment Batch', 'BATCH-AUDIT', 'DEMO-INST-003', 'Karnataka Institute of Advanced Technical Sciences', 'B.Tech - Information Technology', 'INTAKE_DISCREPANCY', 'HIGH', 'Reported batch enrolment of 124 students exceeds AICTE approved intake ceiling of 120 seats by +4 in B.Tech - Information Technology at Karnataka Institute of Advanced Technical Sciences.', 'Audit institute admission ledger to flag non-sanctioned seats or verify supernumerary quota approval.', 'RESOLVED', '2026-10-25 22:20:15.757382+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-INVALID-SEM-DEMO-STU-101', 'DEMO-STU-101', 'Aarushi Singhania', '9210-4819-2041', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'B.Tech - Computer Science & Engineering', 'INVALID_FORMAT', 'LOW', 'Semester value "(Empty)" is missing or outside valid academic range (1-12).', 'Verify curriculum cohort and record valid active semester (1-12).', 'OPEN', '2026-10-25 22:20:15.755377+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-INTAKE-DEMO-INST-002-PROG-ECE', 'DEMO-STU-103', 'Ritika Choudhary', '7104-9281-5520', 'DEMO-INST-002', 'Maharashtra College of Technology & Applied Research', 'B.Tech - Electronics & Communication Engineering', 'INTAKE_DISCREPANCY', 'HIGH', 'Reported batch enrolment of 126 students exceeds AICTE approved intake ceiling of 120 seats by +6 in B.Tech - Electronics & Communication Engineering at Maharashtra College of Technology & Applied Research.', 'Audit institute admission ledger to flag non-sanctioned seats or verify supernumerary quota approval.', 'RESOLVED', '2026-10-25 22:20:15.757059+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-INVALID-SEM-DEMO-STU-102', 'DEMO-STU-102', 'Devansh Joshi', '8491-3820-1193', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'B.Tech - Computer Science & Engineering', 'INVALID_FORMAT', 'LOW', 'Semester value "(Empty)" is missing or outside valid academic range (1-12).', 'Verify curriculum cohort and record valid active semester (1-12).', 'OPEN', '2026-10-25 22:20:15.755774+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-INVALID-SEM-DEMO-STU-103', 'DEMO-STU-103', 'Ritika Choudhary', '7104-9281-5520', 'DEMO-INST-002', 'Maharashtra College of Technology & Applied Research', 'B.Tech - Electronics & Communication Engineering', 'INVALID_FORMAT', 'LOW', 'Semester value "(Empty)" is missing or outside valid academic range (1-12).', 'Verify curriculum cohort and record valid active semester (1-12).', 'OPEN', '2026-10-25 22:20:15.756114+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-DUP-DEMO-STU-001', 'DEMO-STU-001', 'Aarav Sharma', '9182-3746-5120', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'B.Tech - Computer Science & Engineering', 'DUPLICATE_RECORD', 'HIGH', 'Synthetic APAAR ID collision detected with student Mihir Saxena (DEMO-STU-104) across different institution (Karnataka Institute of Advanced Technical Sciences).', 'Trigger APAAR deduplication review to re-verify enrolment documents and regenerate test registry ID.', 'OPEN', '2026-10-25 22:20:15.751746+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-INVALID-SEM-DEMO-STU-104', 'DEMO-STU-104', 'Mihir Saxena', '9182-3746-5120', 'DEMO-INST-003', 'Karnataka Institute of Advanced Technical Sciences', 'B.Tech - Computer Science & Engineering', 'INVALID_FORMAT', 'LOW', 'Semester value "(Empty)" is missing or outside valid academic range (1-12).', 'Verify curriculum cohort and record valid active semester (1-12).', 'OPEN', '2026-10-25 22:20:15.756447+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-DUP-DEMO-STU-104', 'DEMO-STU-104', 'Mihir Saxena', '9182-3746-5120', 'DEMO-INST-003', 'Karnataka Institute of Advanced Technical Sciences', 'B.Tech - Computer Science & Engineering', 'DUPLICATE_RECORD', 'HIGH', 'Synthetic APAAR ID collision detected with student Aarav Sharma (DEMO-STU-001) across different institution (National Institute of Technology & Engineering, New Delhi).', 'Trigger APAAR deduplication review to re-verify enrolment documents and regenerate test registry ID.', 'OPEN', '2026-10-25 22:20:15.754901+05:30');
INSERT INTO public.validation_issues VALUES ('ISS-INTAKE-DEMO-INST-001-PROG-AI-DS', 'DEMO-STU-002', 'Ananya Iyer', '8241-9952-1403', 'DEMO-INST-001', 'National Institute of Technology & Engineering, New Delhi', 'B.Tech - Artificial Intelligence & Data Science', 'INTAKE_DISCREPANCY', 'HIGH', 'Reported batch enrolment of 65 students exceeds AICTE approved intake ceiling of 60 seats by +5 in B.Tech - Artificial Intelligence & Data Science at National Institute of Technology & Engineering, New Delhi.', 'Audit institute admission ledger to flag non-sanctioned seats or verify supernumerary quota approval.', 'RESOLVED', '2026-10-25 22:20:15.756757+05:30');


--
-- Name: programmes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.programmes_id_seq', 112, true);


--
-- Name: document_mismatch_findings document_mismatch_findings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_mismatch_findings
    ADD CONSTRAINT document_mismatch_findings_pkey PRIMARY KEY (id);


--
-- Name: institutions institutions_aicte_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_aicte_code_key UNIQUE (aicte_code);


--
-- Name: institutions institutions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.institutions
    ADD CONSTRAINT institutions_pkey PRIMARY KEY (id);


--
-- Name: programmes programmes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT programmes_pkey PRIMARY KEY (id);


--
-- Name: student_documents student_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_documents
    ADD CONSTRAINT student_documents_pkey PRIMARY KEY (id);


--
-- Name: student_documents student_documents_storage_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_documents
    ADD CONSTRAINT student_documents_storage_key_key UNIQUE (storage_key);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: programmes unique_inst_prog; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT unique_inst_prog UNIQUE (institution_id, programme_id);


--
-- Name: document_mismatch_findings uq_doc_field_finding; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_mismatch_findings
    ADD CONSTRAINT uq_doc_field_finding UNIQUE (document_id, field_name);


--
-- Name: validation_issues validation_issues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.validation_issues
    ADD CONSTRAINT validation_issues_pkey PRIMARY KEY (id);


--
-- Name: idx_doc_findings_doc_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_findings_doc_id ON public.document_mismatch_findings USING btree (document_id);


--
-- Name: idx_doc_findings_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_findings_status ON public.document_mismatch_findings USING btree (status);


--
-- Name: idx_doc_findings_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doc_findings_student_id ON public.document_mismatch_findings USING btree (student_id);


--
-- Name: idx_student_docs_processing_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_docs_processing_status ON public.student_documents USING btree (processing_status);


--
-- Name: idx_student_docs_review_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_docs_review_status ON public.student_documents USING btree (review_status);


--
-- Name: idx_student_docs_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_student_docs_student_id ON public.student_documents USING btree (student_id);


--
-- Name: idx_val_issues_record; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_val_issues_record ON public.validation_issues USING btree (record_id);


--
-- Name: idx_val_issues_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_val_issues_status ON public.validation_issues USING btree (status);


--
-- Name: idx_val_issues_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_val_issues_type ON public.validation_issues USING btree (issue_type);


--
-- Name: document_mismatch_findings document_mismatch_findings_document_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_mismatch_findings
    ADD CONSTRAINT document_mismatch_findings_document_id_fkey FOREIGN KEY (document_id) REFERENCES public.student_documents(id) ON DELETE CASCADE;


--
-- Name: document_mismatch_findings document_mismatch_findings_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_mismatch_findings
    ADD CONSTRAINT document_mismatch_findings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: programmes programmes_institution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT programmes_institution_id_fkey FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;


--
-- Name: student_documents student_documents_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_documents
    ADD CONSTRAINT student_documents_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict hNrZHZtFSCsjZKU2YFSKK7gvNLNtVVlzEIro6gv3DVCWMryRpMBtGC1c8DoEFr8

