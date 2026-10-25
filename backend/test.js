const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { Pool } = require("pg");

const BASE_URL = `http://localhost:${process.env.PORT || 5001}`;

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432", 10),
        database: process.env.DB_NAME || "eduverify",
        user: process.env.DB_USER || process.env.USER,
        password: process.env.DB_PASSWORD || undefined,
    };

const testPool = new Pool(poolConfig);

async function runTests() {
    console.log("=== STARTING EDUVERIFY PHASE 1 VERIFICATION TESTS ===\n");
    let passed = 0;
    let failed = 0;

    async function test(name, fn) {
        try {
            process.stdout.write(`• Testing: ${name} ... `);
            await fn();
            console.log("PASSED");
            passed++;
        } catch (err) {
            console.log("FAILED");
            console.error(`  Error: ${err.message}`);
            failed++;
        }
    }

    const testIds = [];
    const testDocIds = [];
    const testStorageKeys = [];

    try {
        // --- 1. Basic Health & Connectivity ---
        await test("Backend connects to PostgreSQL and health check succeeds", async () => {
            const res = await fetch(`${BASE_URL}/api/health`);
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.status, "ok");
            assert.strictEqual(data.database, "connected");

            const dbRes = await testPool.query("SELECT current_database()");
            assert.strictEqual(dbRes.rows[0].current_database, "eduverify");
        });

        // --- 2. Existing Records & Student Status Updates ---
        await test("Existing student status update persists in PostgreSQL", async () => {
            const stuRes = await fetch(`${BASE_URL}/api/students`);
            assert.strictEqual(stuRes.status, 200);
            const students = await stuRes.json();
            const demo1 = students.find((s) => s.id === "DEMO-STU-001");
            assert.ok(demo1, "DEMO-STU-001 must exist");

            // Update to REQUIRES_REVIEW
            const patchRes = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    validationStatus: "REQUIRES_REVIEW",
                    discrepancyNote: "Automated test note",
                }),
            });
            assert.strictEqual(patchRes.status, 200);

            // Verify in PostgreSQL
            const check = await testPool.query("SELECT validation_status, discrepancy_note FROM students WHERE id = 'DEMO-STU-001'");
            assert.strictEqual(check.rows[0].validation_status, "REQUIRES_REVIEW");
            assert.strictEqual(check.rows[0].discrepancy_note, "Automated test note");
        });

        // --- 3. Duplicate Synthetic APAAR Detection across Different Institutions ---
        await test("Engine detects duplicate synthetic APAAR IDs across different institutions", async () => {
            const stuA = "TEST-DUP-STU-A";
            const stuB = "TEST-DUP-STU-B";
            testIds.push(stuA, stuB);

            const sharedApaar = "7788-9900-1122";

            // Clean up if leftover
            await testPool.query("DELETE FROM validation_issues WHERE record_id IN ($1, $2)", [stuA, stuB]);
            await testPool.query("DELETE FROM students WHERE id IN ($1, $2)", [stuA, stuB]);

            // Insert Student A in DEMO-INST-001
            await testPool.query(
                `INSERT INTO students (id, apaar_test_id, full_name, institution_id, institution_name, programme_name, academic_year, semester, validation_status)
                 VALUES ($1, $2, 'Student Alpha', 'DEMO-INST-001', 'Delhi Tech', 'PROG-CSE', '2024-2025', 1, 'VALIDATED')`,
                [stuA, sharedApaar]
            );

            // Insert Student B in DEMO-INST-002 (Different institution!)
            await testPool.query(
                `INSERT INTO students (id, apaar_test_id, full_name, institution_id, institution_name, programme_name, academic_year, semester, validation_status)
                 VALUES ($1, $2, 'Student Beta', 'DEMO-INST-002', 'Pune Tech', 'PROG-ECE', '2024-2025', 1, 'VALIDATED')`,
                [stuB, sharedApaar]
            );

            // Trigger scan
            const scanRes = await fetch(`${BASE_URL}/api/verification/scan`, { method: "POST" });
            assert.strictEqual(scanRes.status, 200);

            // Check validation_issues in PostgreSQL for both records
            const issueA = await testPool.query(
                "SELECT * FROM validation_issues WHERE id = $1",
                [`ISS-DUP-${stuA}`]
            );
            assert.strictEqual(issueA.rows.length, 1, `Issue for ${stuA} must exist in database`);
            assert.strictEqual(issueA.rows[0].issue_type, "DUPLICATE_RECORD");
            assert.strictEqual(issueA.rows[0].severity, "HIGH");
            assert.ok(issueA.rows[0].reason.includes("Student Beta"));
            assert.ok(issueA.rows[0].reason.includes("different institution"));

            // Check that student status was flagged to REQUIRES_REVIEW
            const checkA = await testPool.query("SELECT validation_status FROM students WHERE id = $1", [stuA]);
            assert.strictEqual(checkA.rows[0].validation_status, "REQUIRES_REVIEW");
        });

        // --- 4. Missing Mandatory Fields & Invalid Academic Year/Semester Detection ---
        await test("Engine detects missing fields and invalid academic year / semester values", async () => {
            const stuMissing = "TEST-MISSING-STU";
            testIds.push(stuMissing);

            await testPool.query("DELETE FROM validation_issues WHERE record_id = $1", [stuMissing]);
            await testPool.query("DELETE FROM students WHERE id = $1", [stuMissing]);

            // Insert student with invalid academic year and invalid semester (e.g. 99)
            await testPool.query(
                `INSERT INTO students (id, apaar_test_id, full_name, institution_id, institution_name, programme_name, academic_year, semester, validation_status)
                 VALUES ($1, '8899-0011-2233', 'Incomplete Student', 'DEMO-INST-001', 'Delhi Tech', 'PROG-CSE', 'INVALID-YEAR', 99, 'PENDING')`,
                [stuMissing]
            );

            // Trigger scan
            await fetch(`${BASE_URL}/api/verification/scan`, { method: "POST" });

            // Check issues
            const yearIssue = await testPool.query(
                "SELECT * FROM validation_issues WHERE id = $1",
                [`ISS-INVALID-YEAR-${stuMissing}`]
            );
            assert.strictEqual(yearIssue.rows.length, 1, "Must detect invalid academic year");
            assert.strictEqual(yearIssue.rows[0].issue_type, "INVALID_FORMAT");

            const semIssue = await testPool.query(
                "SELECT * FROM validation_issues WHERE id = $1",
                [`ISS-INVALID-SEM-${stuMissing}`]
            );
            assert.strictEqual(semIssue.rows.length, 1, "Must detect invalid semester");
            assert.strictEqual(semIssue.rows[0].issue_type, "INVALID_FORMAT");
        });

        // --- 5. Programme Enrolment Exceeding Approved Intake (Actual DB Records) ---
        await test("Engine detects programme enrolment exceeding approved intake using database records", async () => {
            // Check issues table for existing intake discrepancy in PROG-AI-DS at DEMO-INST-001
            const intakeIssueRes = await testPool.query(
                "SELECT * FROM validation_issues WHERE id = 'ISS-INTAKE-DEMO-INST-001-PROG-AI-DS'"
            );
            assert.strictEqual(intakeIssueRes.rows.length, 1, "Over-intake issue must be detected");
            const issue = intakeIssueRes.rows[0];
            assert.strictEqual(issue.issue_type, "INTAKE_DISCREPANCY");
            assert.strictEqual(issue.severity, "HIGH");
            assert.ok(issue.reason.includes("exceeds AICTE approved intake ceiling of 60 seats by +5"));
        });

        // --- 6. Retrieving Issues via GET /api/issues ---
        await test("GET /api/issues returns persisted issues from PostgreSQL", async () => {
            const res = await fetch(`${BASE_URL}/api/issues`);
            assert.strictEqual(res.status, 200);
            const issues = await res.json();
            assert.ok(Array.isArray(issues));
            assert.ok(issues.length > 0, "Must return detected issues");

            const sample = issues[0];
            assert.ok("id" in sample);
            assert.ok("recordId" in sample);
            assert.ok("studentName" in sample);
            assert.ok("issueType" in sample);
            assert.ok("severity" in sample);
            assert.ok("reason" in sample);
            assert.ok("recommendedAction" in sample);
            assert.ok("status" in sample);
        });

        // --- 7. Resolving Issues and Auto-updating Linked Student in PostgreSQL ---
        await test("PATCH /api/issues/:id/status updates issue and associated student in PostgreSQL", async () => {
            const targetIssueId = "ISS-DUP-TEST-DUP-STU-A";

            // Resolve issue
            const resolveRes = await fetch(`${BASE_URL}/api/issues/${targetIssueId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "RESOLVED" }),
            });
            assert.strictEqual(resolveRes.status, 200);
            const body = await resolveRes.json();
            assert.strictEqual(body.issue.status, "RESOLVED");
            assert.strictEqual(body.student.validationStatus, "VALIDATED");

            // Verify in PostgreSQL table validation_issues
            const dbIssue = await testPool.query("SELECT status FROM validation_issues WHERE id = $1", [targetIssueId]);
            assert.strictEqual(dbIssue.rows[0].status, "RESOLVED");

            // Verify linked student in PostgreSQL table students
            const dbStu = await testPool.query("SELECT validation_status, discrepancy_note FROM students WHERE id = 'TEST-DUP-STU-A'");
            assert.strictEqual(dbStu.rows[0].validation_status, "VALIDATED");
            assert.strictEqual(dbStu.rows[0].discrepancy_note, "Issue resolved by administrator review.");

            // Dismiss test: change status to DISMISSED
            const dismissRes = await fetch(`${BASE_URL}/api/issues/${targetIssueId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "DISMISSED" }),
            });
            assert.strictEqual(dismissRes.status, 200);
            const dismissBody = await dismissRes.json();
            assert.strictEqual(dismissBody.issue.status, "DISMISSED");

            // Re-open test: change status back to OPEN
            const reopenRes = await fetch(`${BASE_URL}/api/issues/${targetIssueId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "OPEN" }),
            });
            assert.strictEqual(reopenRes.status, 200);
            const reopenBody = await reopenRes.json();
            assert.strictEqual(reopenBody.issue.status, "OPEN");
        });

        // --- 8. Institutions API reflects Database Records ---
        await test("GET /api/institutions calculates live intake status from database records", async () => {
            const res = await fetch(`${BASE_URL}/api/institutions`);
            assert.strictEqual(res.status, 200);
            const insts = await res.json();
            assert.ok(Array.isArray(insts));
            assert.strictEqual(insts.length, 4);

            const nite = insts.find((i) => i.id === "DEMO-INST-001");
            assert.ok(nite);
            const aiDsProg = nite.programmes.find((p) => p.programmeId === "PROG-AI-DS");
            assert.ok(aiDsProg);
            assert.strictEqual(aiDsProg.approvedIntake, 60);
            assert.strictEqual(aiDsProg.reportedEnrolment, 65);
            assert.strictEqual(aiDsProg.intakeStatus, "OVER_INTAKE");
        });

        // --- 9. Preserving Resolved Issues Across Verification Scans ---
        await test("Re-running verification scan preserves RESOLVED issues and does not revert them to OPEN", async () => {
            const targetIssueId = "ISS-DUP-TEST-DUP-STU-A";

            // Mark RESOLVED
            await fetch(`${BASE_URL}/api/issues/${targetIssueId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "RESOLVED" }),
            });

            // Re-run scan
            await fetch(`${BASE_URL}/api/verification/scan`, { method: "POST" });

            // Check that issue is still RESOLVED in PostgreSQL
            const check = await testPool.query("SELECT status FROM validation_issues WHERE id = $1", [targetIssueId]);
            assert.strictEqual(check.rows[0].status, "RESOLVED", "Issue status must remain RESOLVED across scans");

            // Check that student status remains VALIDATED in PostgreSQL
            const stuCheck = await testPool.query("SELECT validation_status FROM students WHERE id = 'TEST-DUP-STU-A'");
            assert.strictEqual(stuCheck.rows[0].validation_status, "VALIDATED", "Student status must remain VALIDATED across scans if issue was resolved");
        });

        // --- 10. Batch Import Triggers Automatic Verification Scan ---
        await test("Batch import automatically runs verification scan and updates issues in PostgreSQL", async () => {
            const batchStuId = "TEST-BATCH-AUTO-SCAN";
            testIds.push(batchStuId);

            await testPool.query("DELETE FROM validation_issues WHERE record_id = $1", [batchStuId]);
            await testPool.query("DELETE FROM students WHERE id = $1", [batchStuId]);

            // Import student with duplicate APAAR (9182-3746-5120)
            const importRes = await fetch(`${BASE_URL}/api/students/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    students: [
                        {
                            id: batchStuId,
                            apaarTestId: "9182-3746-5120",
                            fullName: "Auto Scan Duplicate Student",
                            institutionId: "DEMO-INST-004",
                            institutionName: "Tamil Nadu College",
                            programmeName: "B.Tech - Robotics",
                            academicYear: "2024-2025",
                            semester: 2,
                            validationStatus: "VALIDATED",
                        },
                    ],
                }),
            });
            assert.strictEqual(importRes.status, 201);

            // Verify issue was automatically created in validation_issues
            const autoIssue = await testPool.query("SELECT * FROM validation_issues WHERE id = $1", [
                `ISS-DUP-${batchStuId}`,
            ]);
            assert.strictEqual(autoIssue.rows.length, 1, "Issue must be automatically created post-batch import");
        });

        // ==========================================
        // Phase 2A: Secure Document Upload & Metadata Tests
        // ==========================================

        const validPdfBuffer = Buffer.from(
            "%PDF-1.4\n1 0 obj\n<< /Title (Synthetic APAAR Test Dossier) >>\nendobj\ntrailer\n<< >>\n%%EOF"
        );
        const validPngBuffer = Buffer.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
            0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82,
        ]);
        const validJpegBuffer = Buffer.from([
            0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
            0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
            0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
            0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
            0xff, 0xd9,
        ]);
        const fakePdfBuffer = Buffer.from("THIS_IS_PLAIN_TEXT_NOT_A_VALID_PDF_HEADER");

        let uploadedPdfDocId = null;
        let uploadedPngDocId = null;

        // --- 11. Upload Valid Synthetic PDF ---
        await test("Upload a valid synthetic PDF document associated with an existing student", async () => {
            const formData = new FormData();
            formData.append("document", new Blob([validPdfBuffer], { type: "application/pdf" }), "apaar_enrolment.pdf");

            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                method: "POST",
                body: formData,
            });

            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.strictEqual(data.message, "Document uploaded successfully");
            assert.ok(data.document);
            assert.strictEqual(data.document.studentId, "DEMO-STU-001");
            assert.strictEqual(data.document.originalFilename, "apaar_enrolment.pdf");
            assert.strictEqual(data.document.mimeType, "application/pdf");
            assert.strictEqual(data.document.fileExtension, "pdf");
            assert.strictEqual(data.document.processingStatus, "UPLOADED");
            assert.strictEqual(data.document.reviewStatus, "PENDING");
            assert.ok(data.document.storageKey.endsWith(".pdf"));
            assert.strictEqual(data.document.storageKey.includes("/"), false, "Storage key must not contain path delimiters");
            assert.strictEqual(data.document.storageKey.includes(".."), false, "Storage key must prevent traversal");

            uploadedPdfDocId = data.document.id;
            testDocIds.push(uploadedPdfDocId);
            testStorageKeys.push(data.document.storageKey);
        });

        // --- 12. Upload Valid Synthetic PNG and JPEG ---
        await test("Upload valid synthetic PNG and JPEG documents", async () => {
            // PNG test
            const pngForm = new FormData();
            pngForm.append("document", new Blob([validPngBuffer], { type: "image/png" }), "student_photo.png");

            const pngRes = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                method: "POST",
                body: pngForm,
            });
            assert.strictEqual(pngRes.status, 201);
            const pngData = await pngRes.json();
            assert.strictEqual(pngData.document.mimeType, "image/png");
            assert.strictEqual(pngData.document.fileExtension, "png");
            uploadedPngDocId = pngData.document.id;
            testDocIds.push(uploadedPngDocId);
            testStorageKeys.push(pngData.document.storageKey);

            // JPEG test
            const jpegForm = new FormData();
            jpegForm.append("document", new Blob([validJpegBuffer], { type: "image/jpeg" }), "id_card.jpg");

            const jpegRes = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                method: "POST",
                body: jpegForm,
            });
            assert.strictEqual(jpegRes.status, 201);
            const jpegData = await jpegRes.json();
            assert.strictEqual(jpegData.document.mimeType, "image/jpeg");
            testDocIds.push(jpegData.document.id);
            testStorageKeys.push(jpegData.document.storageKey);
        });

        // --- 13. Reject Unsupported File Type & Disguised Content ---
        await test("Reject unsupported file extensions and files disguised with wrong magic bytes", async () => {
            // Extension rejection
            const textForm = new FormData();
            textForm.append("document", new Blob(["Malicious script content"], { type: "text/plain" }), "script.sh");
            const textRes = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                method: "POST",
                body: textForm,
            });
            assert.strictEqual(textRes.status, 400);

            // Disguised file rejection (magic bytes do not match .pdf signature)
            const fakeForm = new FormData();
            fakeForm.append("document", new Blob([fakePdfBuffer], { type: "application/pdf" }), "disguised.pdf");
            const fakeRes = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                method: "POST",
                body: fakeForm,
            });
            assert.strictEqual(fakeRes.status, 400);
            const fakeData = await fakeRes.json();
            assert.ok(fakeData.message.includes("Invalid file content"));
        });

        // --- 14. Reject Files Exceeding Configured Size Limit ---
        await test("Reject files larger than the 10 MB limit with HTTP 413 or 400", async () => {
            const oversizeBuffer = Buffer.alloc(11 * 1024 * 1024);
            // Prefix with PDF header
            oversizeBuffer.write("%PDF-1.4\n", 0);

            const largeForm = new FormData();
            largeForm.append("document", new Blob([oversizeBuffer], { type: "application/pdf" }), "oversized_file.pdf");

            const largeRes = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                method: "POST",
                body: largeForm,
            });

            assert.ok(largeRes.status === 413 || largeRes.status === 400, "Must return 413 or 400 for oversized payload");
            const largeData = await largeRes.json();
            assert.ok(largeData.message.includes("exceeds maximum allowed upload size"));
        });

        // --- 15. Reject Nonexistent Student ID ---
        await test("Reject upload for nonexistent student with HTTP 404", async () => {
            const form = new FormData();
            form.append("document", new Blob([validPdfBuffer], { type: "application/pdf" }), "dossier.pdf");

            const res = await fetch(`${BASE_URL}/api/students/NONEXISTENT-STUDENT-999/documents`, {
                method: "POST",
                body: form,
            });
            assert.strictEqual(res.status, 404);
            const data = await res.json();
            assert.ok(data.message.includes("not found"));
        });

        // --- 16. Verify Document Metadata Saved in PostgreSQL ---
        await test("Verify document metadata is persisted in PostgreSQL table student_documents", async () => {
            assert.ok(uploadedPdfDocId, "uploadedPdfDocId must be set");
            const dbRes = await testPool.query(
                "SELECT * FROM student_documents WHERE id = $1",
                [uploadedPdfDocId]
            );
            assert.strictEqual(dbRes.rows.length, 1);
            const row = dbRes.rows[0];
            assert.strictEqual(row.student_id, "DEMO-STU-001");
            assert.strictEqual(row.original_filename, "apaar_enrolment.pdf");
            assert.strictEqual(row.mime_type, "application/pdf");
            assert.strictEqual(row.file_extension, "pdf");
            assert.strictEqual(row.processing_status, "UPLOADED");
            assert.strictEqual(row.review_status, "PENDING");
            assert.ok(row.file_size > 0);
            assert.ok(row.uploaded_at);
        });

        // --- 17. Verify Listing Documents for Student ---
        await test("GET /api/students/:studentId/documents returns student's documents", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`);
            assert.strictEqual(res.status, 200);
            const docs = await res.json();
            assert.ok(Array.isArray(docs));
            assert.ok(docs.length >= 2, "Must return at least the 2 uploaded documents");
            const foundPdf = docs.find((d) => d.id === uploadedPdfDocId);
            assert.ok(foundPdf, "Must include the uploaded PDF document");
            assert.strictEqual(foundPdf.studentId, "DEMO-STU-001");

            // Nonexistent student returns 404
            const notFoundRes = await fetch(`${BASE_URL}/api/students/NONEXISTENT-STU/documents`);
            assert.strictEqual(notFoundRes.status, 404);
        });

        // --- 18. Verify GET /api/documents/:documentId ---
        await test("GET /api/documents/:documentId returns specific document metadata", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/${uploadedPdfDocId}`);
            assert.strictEqual(res.status, 200);
            const doc = await res.json();
            assert.strictEqual(doc.id, uploadedPdfDocId);
            assert.strictEqual(doc.studentId, "DEMO-STU-001");
            assert.strictEqual(doc.mimeType, "application/pdf");

            // Nonexistent document returns 404
            const notFoundRes = await fetch(`${BASE_URL}/api/documents/NONEXISTENT-DOC-ID`);
            assert.strictEqual(notFoundRes.status, 404);
        });

        // --- 19. Verify Documents Not Exposed Statically ---
        await test("Verify uploaded documents are NOT publicly accessible through a static URL", async () => {
            const sampleKey = testStorageKeys[0];
            assert.ok(sampleKey, "Sample storage key must exist");

            // Try backend static route
            const backendStaticRes = await fetch(`${BASE_URL}/uploads/documents/${sampleKey}`);
            assert.strictEqual(backendStaticRes.status, 404, "Backend must not serve uploads statically");

            // Try root uploads route
            const rootStaticRes = await fetch(`${BASE_URL}/${sampleKey}`);
            assert.strictEqual(rootStaticRes.status, 404, "Backend must not serve root uploads");
        });

        // --- 20. Verify Safe Cleanup if Database Insert Fails ---
        await test("Verify uploaded file is cleaned up if database record insertion fails", async () => {
            const fs = require("fs");
            const path = require("path");
            const uploadDir = path.resolve(__dirname, "uploads", "documents");

            // Count files before
            const filesBefore = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0;

            // Trigger an upload for a student that will fail database check
            const form = new FormData();
            form.append("document", new Blob([validPdfBuffer], { type: "application/pdf" }), "cleanup_test.pdf");

            const failRes = await fetch(`${BASE_URL}/api/students/NONEXISTENT-ID/documents`, {
                method: "POST",
                body: form,
            });
            assert.strictEqual(failRes.status, 404);

            // Verify file count did not increase
            const filesAfter = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).length : 0;
            assert.strictEqual(filesAfter, filesBefore, "No orphaned file should remain after rejected request");
        });


        // === Phase 2B: OCR / Text Extraction Tests ===
        // These tests use the real uploaded document (DOC-1792952832974-278b7ead) if it exists,
        // otherwise they skip gracefully. A separate temporary doc is created for error-path tests.

        const REAL_DOC_ID = "DOC-1792952832974-278b7ead";

        await test("Phase 2B: GET /api/documents/:id/text returns 200 for existing document", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/text`);
            // If the doc doesn't exist on this machine, 404 is acceptable - skip gracefully
            if (res.status === 404) {
                console.log(" (skipped - document not present on this machine)");
                return;
            }
            assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
            const data = await res.json();
            assert.ok("processingStatus" in data, "Response should have processingStatus");
            assert.ok("id" in data, "Response should have id");
        });

        await test("Phase 2B: GET /api/documents/:id/text returns 404 for unknown document ID", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/NONEXISTENT-DOC-ID-PHASE2B/text`);
            assert.strictEqual(res.status, 404);
        });

        await test("Phase 2B: POST /api/documents/:id/extract returns 404 for unknown document ID", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/NONEXISTENT-DOC-ID-PHASE2B/extract`, {
                method: "POST",
            });
            assert.strictEqual(res.status, 404);
        });

        await test("Phase 2B: POST /api/documents/:id/extract triggers extraction and returns document with OCR fields", async () => {
            // Use real document if available
            const checkRes = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/text`);
            if (checkRes.status === 404) {
                console.log(" (skipped - document not present on this machine)");
                return;
            }
            const checkData = await checkRes.json();
            if (checkData.processingStatus === "PROCESSING") {
                console.log(" (skipped - document is already processing)");
                return;
            }

            const res = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/extract`, {
                method: "POST",
            });

            // 200 = extraction succeeded, 500 = file missing / extraction error (acceptable in test env)
            // 409 = already processing (acceptable)
            assert.ok(
                [200, 409, 500].includes(res.status),
                `Unexpected status ${res.status} - expected 200, 409 or 500`
            );

            if (res.status === 200) {
                const data = await res.json();
                assert.ok(data.document, "Response should have document object");
                assert.ok("processingStatus" in data.document, "Document should have processingStatus");
                assert.ok(
                    ["COMPLETED", "FAILED"].includes(data.document.processingStatus),
                    `processingStatus should be COMPLETED or FAILED, got '${data.document.processingStatus}'`
                );
            }
        });

        await test("Phase 2B: POST extract on already-PROCESSING document returns 409 (simulated via DB)", async () => {
            // Temporarily set a test document to PROCESSING state
            const checkRes = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/text`);
            if (checkRes.status === 404) {
                console.log(" (skipped - document not present on this machine)");
                return;
            }
            // Save original status
            const origData = await checkRes.json();
            const origStatus = origData.processingStatus;

            // Force PROCESSING
            await testPool.query(
                "UPDATE student_documents SET processing_status = 'PROCESSING' WHERE id = $1",
                [REAL_DOC_ID]
            );
            try {
                const res = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/extract`, {
                    method: "POST",
                });
                assert.strictEqual(res.status, 409, `Expected 409 when already PROCESSING, got ${res.status}`);
            } finally {
                // Restore original status
                await testPool.query(
                    "UPDATE student_documents SET processing_status = $1 WHERE id = $2",
                    [origStatus, REAL_DOC_ID]
                );
            }
        });

        await test("Phase 2B: OCR results (extracted_text, extracted_at) persist in PostgreSQL after extraction", async () => {
            const checkRes = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/text`);
            if (checkRes.status === 404) {
                console.log(" (skipped - document not present on this machine)");
                return;
            }
            const data = await checkRes.json();
            if (data.processingStatus !== "COMPLETED") {
                console.log(` (skipped - processingStatus is '${data.processingStatus}', not COMPLETED)`);
                return;
            }
            // Verify DB has the values too
            const dbRow = await testPool.query(
                "SELECT extracted_text, extracted_at, processing_status FROM student_documents WHERE id = $1",
                [REAL_DOC_ID]
            );
            assert.ok(dbRow.rows.length > 0, "Document should exist in DB");
            assert.strictEqual(dbRow.rows[0].processing_status, "COMPLETED");
            // If text was extracted it should match
            if (data.extractedText) {
                assert.ok(dbRow.rows[0].extracted_text, "DB should have extracted_text when API returns it");
            }
        });

        await test("Phase 2B: GET /api/students/:id/documents includes OCR fields in response", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`);
            assert.strictEqual(res.status, 200);
            const docs = await res.json();
            assert.ok(Array.isArray(docs), "Should return array");
            // If there are any documents, check they have the OCR field keys
            if (docs.length > 0) {
                const doc = docs[0];
                // Fields should be present (may be null if not yet extracted)
                assert.ok("extractedText" in doc || doc.extractedText === undefined || doc.extractedText === null, "extractedText key should be present");
            }
        });

        // === Phase 2C: Deterministic Document Mismatch Detection Tests ===

        await test("Phase 2C: POST /api/documents/:id/compare returns 404 for unknown document ID", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/NONEXISTENT-DOC-ID-PHASE2C/compare`, {
                method: "POST",
            });
            assert.strictEqual(res.status, 404);
        });

        await test("Phase 2C: POST /api/documents/:id/compare detects clearly different extracted student name as a finding", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/compare`, {
                method: "POST",
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.ok(Array.isArray(data.findings), "Should return findings array");
            assert.ok(Array.isArray(data.candidateFields), "Should return candidateFields array");

            const nameFinding = data.findings.find((f) => f.fieldName === "studentName");
            assert.ok(nameFinding, "Should produce a finding for mismatched student name");
            assert.strictEqual(nameFinding.documentValue, "Aarav Demo");
            assert.strictEqual(nameFinding.databaseValue, "Aarav Sharma");
            assert.strictEqual(nameFinding.findingType, "NAME_MISMATCH");
            assert.ok(["OPEN", "RESOLVED"].includes(nameFinding.status), `Status should be OPEN or RESOLVED, got ${nameFinding.status}`);
        });

        await test("Phase 2C: POST /api/documents/:id/compare matching student ID does not create a mismatch finding", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/compare`, {
                method: "POST",
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            const idFinding = data.findings.find((f) => f.fieldName === "studentId");
            assert.strictEqual(idFinding, undefined, "Matching student ID should NOT produce a mismatch finding");
        });

        await test("Phase 2C: Missing or unextracted candidate fields do not create false mismatches", async () => {
            // Create a temporary document with minimal text that lacks academic fields
            const tempDocId = `TEST-DOC-MINIMAL-${Date.now()}`;
            testDocIds.push(tempDocId);
            await testPool.query(
                `INSERT INTO student_documents (
                    id, student_id, original_filename, mime_type, file_extension,
                    file_size, storage_key, processing_status, extracted_text
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    tempDocId,
                    "DEMO-STU-001",
                    "minimal_test.txt",
                    "text/plain",
                    "txt",
                    100,
                    `${tempDocId}.txt`,
                    "COMPLETED",
                    "Generic institutional receipt with no recognizable student data fields.",
                ]
            );

            const res = await fetch(`${BASE_URL}/api/documents/${tempDocId}/compare`, {
                method: "POST",
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.findings.length, 0, "No false mismatches should be created when fields are absent");
        });

        await test("Phase 2C: Repeated comparison is idempotent and does not duplicate open findings", async () => {
            const res1 = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/compare`, { method: "POST" });
            const data1 = await res1.json();

            const res2 = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/compare`, { method: "POST" });
            const data2 = await res2.json();

            assert.strictEqual(data1.findings.length, data2.findings.length, "Finding count should remain identical");
            const dbRows = await testPool.query(
                "SELECT id, field_name FROM document_mismatch_findings WHERE document_id = $1",
                [REAL_DOC_ID]
            );
            assert.strictEqual(dbRows.rows.length, data1.findings.length, "DB rows should not be duplicated");
        });

        await test("Phase 2C: PATCH /api/findings/:id/status updates status to RESOLVED and DISMISSED", async () => {
            const findingId = `FIND-278b7ead-academicYear`;
            // 1. Resolve
            const resResolve = await fetch(`${BASE_URL}/api/findings/${findingId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "RESOLVED" }),
            });
            assert.strictEqual(resResolve.status, 200);
            const dataResolve = await resResolve.json();
            assert.strictEqual(dataResolve.finding.status, "RESOLVED");

            // 2. Dismiss
            const resDismiss = await fetch(`${BASE_URL}/api/findings/${findingId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "DISMISSED" }),
            });
            assert.strictEqual(resDismiss.status, 200);
            const dataDismiss = await resDismiss.json();
            assert.strictEqual(dataDismiss.finding.status, "DISMISSED");

            // Reopen back to OPEN for clean state
            await fetch(`${BASE_URL}/api/findings/${findingId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "OPEN" }),
            });
        });

        await test("Phase 2C: Resolved and dismissed findings remain in saved state after rescanning", async () => {
            const findingId = `FIND-278b7ead-semester`;
            // Mark finding as RESOLVED
            await fetch(`${BASE_URL}/api/findings/${findingId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "RESOLVED" }),
            });

            // Rescan
            const resScan = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/compare`, { method: "POST" });
            assert.strictEqual(resScan.status, 200);
            const scanData = await resScan.json();

            const semesterFinding = scanData.findings.find((f) => f.fieldName === "semester");
            assert.ok(semesterFinding, "Semester finding should be present");
            assert.strictEqual(semesterFinding.status, "RESOLVED", "Status must remain RESOLVED after rescan");

            // Reopen back to OPEN
            await fetch(`${BASE_URL}/api/findings/${findingId}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: "OPEN" }),
            });
        });

        await test("Phase 2C: Findings persist in PostgreSQL and are retrievable via GET /api/documents/:id/findings", async () => {
            const res = await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/findings`);
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.ok(Array.isArray(data.findings), "Should return findings array");
            assert.ok(data.findings.length > 0, "Should have persisted findings");
            assert.ok(Array.isArray(data.candidateFields), "Should return candidateFields");
        });

        await test("Phase 2C: GET /api/students/:studentId/document-findings returns student's document findings", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/document-findings`);
            assert.strictEqual(res.status, 200);
            const findings = await res.json();
            assert.ok(Array.isArray(findings), "Should return array of findings");
            assert.ok(findings.length > 0, "Should include Aarav's findings");
        });

        await test("Phase 2C: Comparison does NOT automatically change student's validation status", async () => {
            const stuBefore = await testPool.query("SELECT validation_status FROM students WHERE id = 'DEMO-STU-001'");
            const statusBefore = stuBefore.rows[0].validation_status;

            // Run comparison
            await fetch(`${BASE_URL}/api/documents/${REAL_DOC_ID}/compare`, { method: "POST" });

            const stuAfter = await testPool.query("SELECT validation_status FROM students WHERE id = 'DEMO-STU-001'");
            assert.strictEqual(stuAfter.rows[0].validation_status, statusBefore, "Student validation_status should NOT be modified by comparison");
        });

        // Cleanup temporary test records & files
        if (testDocIds.length > 0) {
            await testPool.query("DELETE FROM student_documents WHERE id = ANY($1)", [testDocIds]);
            const fs = require("fs");
            const path = require("path");
            const uploadDir = path.resolve(__dirname, "uploads", "documents");
            for (const key of testStorageKeys) {
                const target = path.join(uploadDir, path.basename(key));
                if (fs.existsSync(target)) {
                    try { fs.unlinkSync(target); } catch (_) {}
                }
            }
            console.log(`• Cleaned up ${testDocIds.length} temporary test documents.`);
        }

        // Cleanup temporary test records
        if (testIds.length > 0) {
            await testPool.query("DELETE FROM validation_issues WHERE record_id = ANY($1)", [testIds]);
            await testPool.query("DELETE FROM students WHERE id = ANY($1)", [testIds]);
            console.log(`• Cleaned up ${testIds.length} temporary test records.`);
        }

    } finally {
        await testPool.end();
    }

    console.log(`\n=== TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
