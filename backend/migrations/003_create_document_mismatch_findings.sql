-- Migration: 003_create_document_mismatch_findings.sql
-- Phase 2C: Rule-Based Document Mismatch Detection Findings Table
-- Safe and idempotent: creates document_mismatch_findings table and indexes without modifying existing tables.

CREATE TABLE IF NOT EXISTS document_mismatch_findings (
    id VARCHAR(100) PRIMARY KEY,
    document_id VARCHAR(100) NOT NULL REFERENCES student_documents(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(150) NOT NULL,
    document_value TEXT NOT NULL,
    database_value TEXT NOT NULL,
    raw_evidence TEXT,
    finding_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'WARNING',
    explanation TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_doc_field_finding UNIQUE (document_id, field_name)
);

CREATE INDEX IF NOT EXISTS idx_doc_findings_doc_id ON document_mismatch_findings(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_findings_student_id ON document_mismatch_findings(student_id);
CREATE INDEX IF NOT EXISTS idx_doc_findings_status ON document_mismatch_findings(status);
