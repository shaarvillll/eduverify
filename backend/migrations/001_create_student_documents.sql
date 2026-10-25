-- Migration: 001_create_student_documents.sql
-- Phase 2A: Safe, idempotent migration to create student_documents metadata table.
-- Preserves all existing records across students, institutions, programmes, and validation_issues.

CREATE TABLE IF NOT EXISTS student_documents (
    id VARCHAR(100) PRIMARY KEY,
    student_id VARCHAR(50) NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_extension VARCHAR(20) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size > 0),
    storage_key VARCHAR(255) NOT NULL UNIQUE,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_status VARCHAR(50) NOT NULL DEFAULT 'UPLOADED',
    review_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_student_docs_student_id ON student_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_docs_processing_status ON student_documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_student_docs_review_status ON student_documents(review_status);
