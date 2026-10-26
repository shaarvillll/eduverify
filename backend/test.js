const assert = require("assert");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const { Pool } = require("pg");
const { startServer } = require("./server");

const PORT = parseInt(process.env.PORT || "5001", 10);
const BASE_URL = `http://localhost:${PORT}`;

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

async function loginUser(email, password = "Password123!") {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(`Login failed for ${email}: ${body.message} (HTTP ${res.status})`);
    }
    const data = await res.json();
    return {
        token: data.token,
        headers: {
            "Authorization": `Bearer ${data.token}`,
            "Content-Type": "application/json",
        },
        authHeaderOnly: {
            "Authorization": `Bearer ${data.token}`,
        },
        user: data.user,
    };
}

async function runTests() {
    console.log("=== STARTING EDUVERIFY MULTI-TENANT RBAC & VERIFICATION TEST SUITE ===\n");
    let passed = 0;
    let failed = 0;

    let serverInstance = null;
    try {
        // Check if server is already running
        const probe = await fetch(`${BASE_URL}/api/health`).catch(() => null);
        if (!probe || !probe.ok) {
            console.log("Starting backend server instance for test execution...");
            serverInstance = await startServer();
            await new Promise((r) => setTimeout(r, 600));
        }
    } catch (err) {
        console.log("Starting backend server...");
        serverInstance = await startServer();
        await new Promise((r) => setTimeout(r, 600));
    }

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
    const testUserIds = [];
    const testFindingIds = [];

    try {
        // ==========================================
        // SECTION 1: PUBLIC HEALTH & BASIC DB CONNECTIVITY
        // ==========================================
        await test("Backend connects to PostgreSQL and health check succeeds (non-disclosing)", async () => {
            const res = await fetch(`${BASE_URL}/api/health`);
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.status, "ok");
            assert.strictEqual(data.database, "connected");
            assert.strictEqual(data.password, undefined, "Must not leak database credentials");
            assert.strictEqual(data.connectionString, undefined, "Must not leak connection string");
        });

        // ==========================================
        // SECTION 2: AUTHENTICATION & SESSION HANDLING
        // ==========================================
        await test("Unauthenticated requests to protected endpoints return 401 Unauthorized", async () => {
            const endpoints = [
                { method: "GET", url: `${BASE_URL}/api/students` },
                { method: "GET", url: `${BASE_URL}/api/students/DEMO-STU-001` },
                { method: "PATCH", url: `${BASE_URL}/api/students/DEMO-STU-001/status`, body: {} },
                { method: "POST", url: `${BASE_URL}/api/students/batch`, body: { students: [] } },
                { method: "GET", url: `${BASE_URL}/api/students/DEMO-STU-001/documents` },
                { method: "GET", url: `${BASE_URL}/api/documents/DOC-FAKE` },
                { method: "GET", url: `${BASE_URL}/api/documents/DOC-FAKE/file` },
                { method: "GET", url: `${BASE_URL}/api/issues` },
                { method: "PATCH", url: `${BASE_URL}/api/issues/ISS-FAKE/status`, body: { status: "RESOLVED" } },
                { method: "GET", url: `${BASE_URL}/api/institutions` },
                { method: "GET", url: `${BASE_URL}/api/admin/users` },
                { method: "GET", url: `${BASE_URL}/api/admin/system-health` },
            ];

            for (const ep of endpoints) {
                const res = await fetch(ep.url, {
                    method: ep.method,
                    headers: ep.body ? { "Content-Type": "application/json" } : {},
                    body: ep.body ? JSON.stringify(ep.body) : undefined,
                });
                assert.strictEqual(res.status, 401, `Expected 401 for ${ep.method} ${ep.url}, got ${res.status}`);
            }
        });

        await test("Login with valid credentials issues signed JWT token containing role and tenant", async () => {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "inst1@nitdelhi.ac.in", password: "Password123!" }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.ok(data.token, "JWT token must be returned");
            assert.strictEqual(data.user.role, "INSTITUTION_MEMBER");
            assert.strictEqual(data.user.institutionId, "DEMO-INST-001");
            assert.strictEqual(data.user.password_hash, undefined, "Password hash must never be returned");
        });

        await test("Login with invalid password fails with 401 and generic error message", async () => {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "inst1@nitdelhi.ac.in", password: "WrongPassword999!" }),
            });
            assert.strictEqual(res.status, 401);
            const data = await res.json();
            assert.strictEqual(data.message, "Invalid email or password");
        });

        await test("Login with non-existent user fails with 401 without account enumeration", async () => {
            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: "ghost.user@doesnotexist.ac.in", password: "Password123!" }),
            });
            assert.strictEqual(res.status, 401);
            const data = await res.json();
            assert.strictEqual(data.message, "Invalid email or password");
        });

        await test("Deactivated user account cannot log in and returns 403 Forbidden", async () => {
            const testDeactId = `USER-DEACT-${Date.now()}`;
            const deactEmail = `deactivated.${Date.now()}@nitdelhi.ac.in`;
            testUserIds.push(testDeactId);
            const bcrypt = require("bcryptjs");
            const hash = await bcrypt.hash("Password123!", 10);

            await testPool.query(
                `INSERT INTO users (id, email, password_hash, role, institution_id, full_name, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, 'INSTITUTION_MEMBER', 'DEMO-INST-001', 'Deactivated Test User', FALSE, NOW(), NOW())`,
                [testDeactId, deactEmail, hash]
            );

            const res = await fetch(`${BASE_URL}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: deactEmail, password: "Password123!" }),
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("deactivated"));
        });

        await test("GET /api/auth/me returns active user profile with institution details", async () => {
            const inst1 = await loginUser("inst1@nitdelhi.ac.in");
            const res = await fetch(`${BASE_URL}/api/auth/me`, {
                headers: inst1.headers,
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.email, "inst1@nitdelhi.ac.in");
            assert.strictEqual(data.role, "INSTITUTION_MEMBER");
            assert.strictEqual(data.institutionId, "DEMO-INST-001");
            assert.ok(data.institutionName.includes("National Institute of Technology"));
        });

        await test("POST /api/auth/logout records audit log and acknowledges termination", async () => {
            const inst1 = await loginUser("inst1@nitdelhi.ac.in");
            const res = await fetch(`${BASE_URL}/api/auth/logout`, {
                method: "POST",
                headers: inst1.headers,
            });
            assert.strictEqual(res.status, 200);

            // Verify audit log entry in PostgreSQL
            const check = await testPool.query(
                "SELECT action, user_email FROM audit_logs WHERE user_email = 'inst1@nitdelhi.ac.in' AND action = 'LOGOUT' ORDER BY created_at DESC LIMIT 1"
            );
            assert.ok(check.rowCount > 0, "LOGOUT action must be recorded in audit_logs");
        });

        // ==========================================
        // SECTION 3: MULTI-TENANT ISOLATION (INSTITUTION A vs INSTITUTION B)
        // ==========================================
        const inst1 = await loginUser("inst1@nitdelhi.ac.in"); // DEMO-INST-001
        const inst2 = await loginUser("inst2@mctar.ac.in");    // DEMO-INST-002
        const reviewer = await loginUser("reviewer@aicte-india.org"); // Reviewer (unauthorized for docs)
        const reviewerAuth = await loginUser("reviewer.auth@aicte-india.org"); // Reviewer (authorized for docs)
        const admin = await loginUser("admin@aicte-india.org"); // System Admin

        await test("Institution Member A sees ONLY students of Institution A (strict tenant isolation)", async () => {
            const res = await fetch(`${BASE_URL}/api/students`, {
                headers: inst1.headers,
            });
            assert.strictEqual(res.status, 200);
            const students = await res.json();
            assert.ok(students.length > 0, "Institution 1 should have students");
            for (const s of students) {
                assert.strictEqual(s.institutionId, "DEMO-INST-001", "Must belong only to DEMO-INST-001");
            }

            // Verify Institution 2 student (DEMO-STU-103) is completely absent
            const hasInst2Student = students.some((s) => s.id === "DEMO-STU-103");
            assert.strictEqual(hasInst2Student, false, "DEMO-STU-103 (Institution 2) must not appear for Institution 1");
        });

        await test("Institution Member A cannot query other institutions via query parameter spoofing", async () => {
            const res = await fetch(`${BASE_URL}/api/students?institutionId=DEMO-INST-002`, {
                headers: inst1.headers,
            });
            assert.strictEqual(res.status, 200);
            const students = await res.json();
            for (const s of students) {
                assert.strictEqual(s.institutionId, "DEMO-INST-001", "Query parameter must be ignored for Institution Member");
            }
        });

        await test("Institution Member A gets 404 Not Found when directly requesting an Institution B student record", async () => {
            // DEMO-STU-103 belongs to DEMO-INST-002
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-103`, {
                headers: inst1.headers,
            });
            assert.strictEqual(res.status, 404, "Cross-institution student details must return non-disclosing 404");
        });

        await test("Institution Member B sees ONLY students of Institution B", async () => {
            const res = await fetch(`${BASE_URL}/api/students`, {
                headers: inst2.headers,
            });
            assert.strictEqual(res.status, 200);
            const students = await res.json();
            assert.ok(students.length > 0, "Institution 2 should have students");
            for (const s of students) {
                assert.strictEqual(s.institutionId, "DEMO-INST-002", "Must belong only to DEMO-INST-002");
            }

            // Verify Institution 1 student (DEMO-STU-001) is completely absent
            const hasInst1Student = students.some((s) => s.id === "DEMO-STU-001");
            assert.strictEqual(hasInst1Student, false, "DEMO-STU-001 (Institution 1) must not appear for Institution 2");
        });

        await test("Institution Member B gets 404 Not Found when requesting Institution A student record", async () => {
            // DEMO-STU-001 belongs to DEMO-INST-001
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001`, {
                headers: inst2.headers,
            });
            assert.strictEqual(res.status, 404);
        });

        // ==========================================
        // SECTION 4: ROLE WORKFLOWS & STATUS MUTATION AUTHORIZATION
        // ==========================================
        await test("Institution Member cannot self-approve records to VALIDATED (returns 403 Forbidden)", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: inst1.headers,
                body: JSON.stringify({ validationStatus: "VALIDATED" }),
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("Institution members cannot grant final regulatory validation"));
        });

        await test("Institution Member cannot self-reject records to REJECTED (returns 403 Forbidden)", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: inst1.headers,
                body: JSON.stringify({ validationStatus: "REJECTED" }),
            });
            assert.strictEqual(res.status, 403);
        });

        await test("Institution Member can submit records for regulatory review (REQUIRES_REVIEW / PENDING)", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: inst1.headers,
                body: JSON.stringify({
                    validationStatus: "REQUIRES_REVIEW",
                    discrepancyNote: "Submitted by NIT Delhi member for review",
                }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.student.validationStatus, "REQUIRES_REVIEW");

            // Verify audit trail in PostgreSQL
            const check = await testPool.query(
                "SELECT action, user_email FROM audit_logs WHERE resource_id = 'DEMO-STU-001' AND action = 'STUDENT_RECORD_SUBMITTED' ORDER BY created_at DESC LIMIT 1"
            );
            assert.ok(check.rowCount > 0, "Audit trail must record STUDENT_RECORD_SUBMITTED");
        });

        await test("System Administrator cannot make regulatory determinations on student records (returns 403 Forbidden)", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: admin.headers,
                body: JSON.stringify({ validationStatus: "VALIDATED" }),
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("System administrators manage system operations and do not record regulatory validation determinations"));
        });

        await test("Regulatory Reviewer can record formal verification determinations (VALIDATED) with audit logging", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: reviewer.headers,
                body: JSON.stringify({
                    validationStatus: "VALIDATED",
                    discrepancyNote: "Cleared after document verification",
                }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.student.validationStatus, "VALIDATED");
            assert.ok(data.student.discrepancyNote.includes("Regulatory Review"));

            // Verify in PostgreSQL
            const check = await testPool.query(
                "SELECT validation_status, discrepancy_note FROM students WHERE id = 'DEMO-STU-001'"
            );
            assert.strictEqual(check.rows[0].validation_status, "VALIDATED");
            assert.ok(check.rows[0].discrepancy_note.includes("Regulatory Review"));
        });

        // ==========================================
        // SECTION 5: BATCH INGESTION AUTHORIZATION & ISOLATION
        // ==========================================
        await test("Regulatory Reviewer cannot ingest student batch records (returns 403 Forbidden)", async () => {
            const res = await fetch(`${BASE_URL}/api/students/batch`, {
                method: "POST",
                headers: reviewer.headers,
                body: JSON.stringify({
                    students: [
                        {
                            id: `TEST-BATCH-${Date.now()}`,
                            fullName: "Unauthorized Batch Student",
                            institutionId: "DEMO-INST-001",
                        },
                    ],
                }),
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("Regulatory Reviewers cannot ingest student records"));
        });

        await test("Institution Member A cannot upload student records for Institution B (returns 403 Forbidden)", async () => {
            const testId = `TEST-SPOOF-${Date.now()}`;
            const res = await fetch(`${BASE_URL}/api/students/batch`, {
                method: "POST",
                headers: inst1.headers,
                body: JSON.stringify({
                    students: [
                        {
                            id: testId,
                            fullName: "Spoofed Student",
                            institutionId: "DEMO-INST-002", // Trying to upload for Maharashtra Tech while authenticated as NIT Delhi
                        },
                    ],
                }),
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("Cannot upload records for another institution"));
        });

        await test("Institution Member A successfully ingests student batch, derived to Institution A", async () => {
            const testId = `TEST-NIT-BATCH-${Date.now()}`;
            testIds.push(testId);

            const res = await fetch(`${BASE_URL}/api/students/batch`, {
                method: "POST",
                headers: inst1.headers,
                body: JSON.stringify({
                    students: [
                        {
                            id: testId,
                            apaarTestId: "9911-2233-4455",
                            fullName: "Pooja Hegde",
                            programmeName: "B.Tech - Computer Science & Engineering",
                            academicYear: "2024-2025",
                            validationStatus: "VALIDATED", // Client tries to mark validated
                        },
                    ],
                }),
            });
            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.strictEqual(data.insertedCount, 1);
            const inserted = data.students[0];
            assert.strictEqual(inserted.id, testId);
            assert.strictEqual(inserted.institutionId, "DEMO-INST-001", "Institution ID must be derived from authenticated user");
            assert.strictEqual(inserted.validationStatus, "PENDING", "Institution Member cannot inject VALIDATED status");

            // Verify in PostgreSQL
            const check = await testPool.query("SELECT institution_id, validation_status FROM students WHERE id = $1", [testId]);
            assert.strictEqual(check.rows[0].institution_id, "DEMO-INST-001");
            assert.strictEqual(check.rows[0].validation_status, "PENDING");
        });

        // ==========================================
        // SECTION 6: DOCUMENT VAULT ISOLATION & ACCESS CLEARANCE
        // ==========================================
        let testDocId = null;

        await test("Institution Member A uploads document for Institution A student successfully", async () => {
            const form = new FormData();
            form.append(
                "document",
                new Blob([Buffer.from("%PDF-1.4 Test PDF Content For EduVerify Vault")], { type: "application/pdf" }),
                "student_certificate.pdf"
            );

            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${inst1.token}`,
                },
                body: form,
            });

            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.ok(data.document.id);
            testDocId = data.document.id;
            testDocIds.push(testDocId);
            testStorageKeys.push(data.document.storageKey);
        });

        await test("Institution Member B gets 404 when querying Institution A student documents", async () => {
            const res = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/documents`, {
                headers: inst2.headers,
            });
            assert.strictEqual(res.status, 404);
        });

        await test("Institution Member B gets 404 when requesting Institution A document file download", async () => {
            assert.ok(testDocId, "testDocId must exist");
            const res = await fetch(`${BASE_URL}/api/documents/${testDocId}/file`, {
                headers: inst2.headers,
            });
            assert.strictEqual(res.status, 404);
        });

        await test("Regulatory Reviewer WITHOUT document clearance gets 403 Forbidden on document file download", async () => {
            assert.ok(testDocId, "testDocId must exist");
            const res = await fetch(`${BASE_URL}/api/documents/${testDocId}/file`, {
                headers: reviewer.headers,
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("Document inspection requires explicit regulatory authorization"));
        });

        await test("System Administrator WITHOUT document clearance gets 403 Forbidden on document file download", async () => {
            assert.ok(testDocId, "testDocId must exist");
            const res = await fetch(`${BASE_URL}/api/documents/${testDocId}/file`, {
                headers: admin.headers,
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("System administrators do not receive unrestricted access to student documents"));
        });

        await test("Authorized Regulatory Reviewer WITH document clearance downloads document file successfully", async () => {
            assert.ok(testDocId, "testDocId must exist");
            const res = await fetch(`${BASE_URL}/api/documents/${testDocId}/file`, {
                headers: reviewerAuth.headers,
            });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
            const buf = await res.arrayBuffer();
            assert.ok(buf.byteLength > 0);

            // Verify DOCUMENT_ACCESSED audit log recorded
            const check = await testPool.query(
                "SELECT action, user_email FROM audit_logs WHERE resource_id = $1 AND action = 'DOCUMENT_ACCESSED' ORDER BY created_at DESC LIMIT 1",
                [testDocId]
            );
            assert.ok(check.rowCount > 0, "Audit log must record DOCUMENT_ACCESSED");
        });

        await test("Institution Member A can download their own student document file", async () => {
            assert.ok(testDocId, "testDocId must exist");
            const res = await fetch(`${BASE_URL}/api/documents/${testDocId}/file`, {
                headers: inst1.headers,
            });
            assert.strictEqual(res.status, 200);
        });

        // ==========================================
        // SECTION 7: VALIDATION ISSUES & FINDINGS ISOLATION
        // ==========================================
        await test("Institution Member A gets ONLY issues for Institution A in GET /api/issues", async () => {
            const res = await fetch(`${BASE_URL}/api/issues`, {
                headers: inst1.headers,
            });
            assert.strictEqual(res.status, 200);
            const issues = await res.json();
            for (const iss of issues) {
                assert.strictEqual(iss.institutionId, "DEMO-INST-001");
            }
        });

        await test("Institution Member cannot resolve or dismiss validation issues (returns 403 Forbidden)", async () => {
            const check = await testPool.query("SELECT id FROM validation_issues WHERE institution_id = 'DEMO-INST-001' LIMIT 1");
            if (check.rowCount > 0) {
                const issueId = check.rows[0].id;
                const res = await fetch(`${BASE_URL}/api/issues/${issueId}/status`, {
                    method: "PATCH",
                    headers: inst1.headers,
                    body: JSON.stringify({ status: "RESOLVED" }),
                });
                assert.strictEqual(res.status, 403);
            }
        });

        await test("Regulatory Reviewer can resolve and dismiss validation issues with audit trail", async () => {
            const check = await testPool.query("SELECT id FROM validation_issues WHERE institution_id = 'DEMO-INST-001' LIMIT 1");
            if (check.rowCount > 0) {
                const issueId = check.rows[0].id;
                const res = await fetch(`${BASE_URL}/api/issues/${issueId}/status`, {
                    method: "PATCH",
                    headers: reviewer.headers,
                    body: JSON.stringify({ status: "RESOLVED" }),
                });
                assert.strictEqual(res.status, 200);
                const data = await res.json();
                assert.strictEqual(data.issue.status, "RESOLVED");

                // Verify audit trail
                const auditCheck = await testPool.query(
                    "SELECT action, user_email FROM audit_logs WHERE resource_id = $1 AND action = 'ISSUE_STATUS_UPDATED' ORDER BY created_at DESC LIMIT 1",
                    [issueId]
                );
                assert.ok(auditCheck.rowCount > 0);
            }
        });

        // ==========================================
        // SECTION 7B: DOCUMENT MISMATCH FINDINGS RESOLUTION & PRIVILEGE SEPARATION
        // ==========================================
        const testFindingId1 = `FIND-TEST-${Date.now()}-1`;
        const testFindingId2 = `FIND-TEST-${Date.now()}-2`;
        testFindingIds.push(testFindingId1, testFindingId2);

        await testPool.query(
            `INSERT INTO document_mismatch_findings (
                id, document_id, student_id, field_name, field_label,
                document_value, database_value, raw_evidence,
                finding_type, severity, explanation, status,
                created_at, updated_at
            ) VALUES
            ($1, $2, 'DEMO-STU-001', 'semester', 'Enrolled Semester', '2', '3', 'Semester 2', 'SEMESTER_MISMATCH', 'WARNING', 'Test discrepancy 1', 'OPEN', NOW(), NOW()),
            ($3, $2, 'DEMO-STU-001', 'academicYear', 'Academic Year', '2026-2027', '2024-2025', 'Academic Year 2026', 'ACADEMIC_YEAR_MISMATCH', 'WARNING', 'Test discrepancy 2', 'OPEN', NOW(), NOW())`,
            [testFindingId1, testDocId, testFindingId2]
        );

        await test("Institution Member cannot resolve or dismiss document discrepancy findings (returns 403 Forbidden)", async () => {
            const res = await fetch(`${BASE_URL}/api/findings/${testFindingId1}/status`, {
                method: "PATCH",
                headers: inst1.headers,
                body: JSON.stringify({ status: "RESOLVED" }),
            });
            assert.strictEqual(res.status, 403);
            const data = await res.json();
            assert.ok(data.message.includes("Institution members cannot resolve or dismiss regulatory discrepancy findings"));

            // Verify in DB that status is still OPEN
            const check = await testPool.query("SELECT status FROM document_mismatch_findings WHERE id = $1", [testFindingId1]);
            assert.strictEqual(check.rows[0].status, "OPEN");
        });

        await test("System Administrator cannot resolve or dismiss document discrepancy findings (returns 403 Forbidden)", async () => {
            const res = await fetch(`${BASE_URL}/api/findings/${testFindingId1}/status`, {
                method: "PATCH",
                headers: admin.headers,
                body: JSON.stringify({ status: "RESOLVED" }),
            });
            assert.strictEqual(res.status, 403);

            // Verify in DB that status is still OPEN
            const check = await testPool.query("SELECT status FROM document_mismatch_findings WHERE id = $1", [testFindingId1]);
            assert.strictEqual(check.rows[0].status, "OPEN");
        });

        await test("Regulatory Reviewer can resolve and dismiss document discrepancy findings with audit trail and DB persistence", async () => {
            // 1. Resolve finding
            const resResolve = await fetch(`${BASE_URL}/api/findings/${testFindingId1}/status`, {
                method: "PATCH",
                headers: reviewer.headers,
                body: JSON.stringify({ status: "RESOLVED" }),
            });
            assert.strictEqual(resResolve.status, 200);
            const dataResolve = await resResolve.json();
            assert.strictEqual(dataResolve.finding.status, "RESOLVED");

            // Verify PostgreSQL update
            const checkResolve = await testPool.query("SELECT status FROM document_mismatch_findings WHERE id = $1", [testFindingId1]);
            assert.strictEqual(checkResolve.rows[0].status, "RESOLVED");

            // Verify audit trail
            const auditCheck = await testPool.query(
                "SELECT action, user_email FROM audit_logs WHERE resource_id = $1 AND action = 'FINDING_STATUS_UPDATED' ORDER BY created_at DESC LIMIT 1",
                [testFindingId1]
            );
            assert.ok(auditCheck.rowCount > 0, "Audit trail must record FINDING_STATUS_UPDATED");

            // 2. Dismiss finding
            const resDismiss = await fetch(`${BASE_URL}/api/findings/${testFindingId1}/status`, {
                method: "PATCH",
                headers: reviewer.headers,
                body: JSON.stringify({ status: "DISMISSED" }),
            });
            assert.strictEqual(resDismiss.status, 200);
            const dataDismiss = await resDismiss.json();
            assert.strictEqual(dataDismiss.finding.status, "DISMISSED");

            const checkDismiss = await testPool.query("SELECT status FROM document_mismatch_findings WHERE id = $1", [testFindingId1]);
            assert.strictEqual(checkDismiss.rows[0].status, "DISMISSED");
        });

        await test("Resolving one document discrepancy finding does NOT modify other findings or student records", async () => {
            // Verify finding 2 is still OPEN
            const checkF2 = await testPool.query("SELECT status FROM document_mismatch_findings WHERE id = $1", [testFindingId2]);
            assert.strictEqual(checkF2.rows[0].status, "OPEN", "Finding 2 must remain unchanged");

            // Verify student record DEMO-STU-001 was not mutated by finding resolution
            const checkStu = await testPool.query("SELECT id, institution_id FROM students WHERE id = 'DEMO-STU-001'");
            assert.strictEqual(checkStu.rows[0].id, "DEMO-STU-001");
            assert.strictEqual(checkStu.rows[0].institution_id, "DEMO-INST-001");
        });

        await test("Regulatory Reviewer can reject (REJECTED) and flag (REQUIRES_REVIEW) student records", async () => {
            // Test REJECTED
            const resReject = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: reviewer.headers,
                body: JSON.stringify({
                    validationStatus: "REJECTED",
                    discrepancyNote: "Certificate signature could not be verified against nodal registry",
                }),
            });
            assert.strictEqual(resReject.status, 200);
            const dataReject = await resReject.json();
            assert.strictEqual(dataReject.student.validationStatus, "REJECTED");

            // Test REQUIRES_REVIEW
            const resFlag = await fetch(`${BASE_URL}/api/students/DEMO-STU-001/status`, {
                method: "PATCH",
                headers: reviewer.headers,
                body: JSON.stringify({
                    validationStatus: "REQUIRES_REVIEW",
                    discrepancyNote: "Pending applicant response on semester registration discrepancy",
                }),
            });
            assert.strictEqual(resFlag.status, 200);
            const dataFlag = await resFlag.json();
            assert.strictEqual(dataFlag.student.validationStatus, "REQUIRES_REVIEW");
        });

        // ==========================================
        // SECTION 8: SYSTEM ADMINISTRATOR ENDPOINTS & PRIVILEGE SEPARATION
        // ==========================================
        await test("Non-admin roles receive 403 Forbidden when accessing /api/admin/* endpoints", async () => {
            const adminEndpoints = [
                `${BASE_URL}/api/admin/users`,
                `${BASE_URL}/api/admin/audit-logs`,
                `${BASE_URL}/api/admin/system-health`,
            ];

            for (const ep of adminEndpoints) {
                const res1 = await fetch(ep, { headers: inst1.headers });
                assert.strictEqual(res1.status, 403, `Institution member should get 403 on ${ep}`);

                const res2 = await fetch(ep, { headers: reviewer.headers });
                assert.strictEqual(res2.status, 403, `Regulatory reviewer should get 403 on ${ep}`);
            }
        });

        await test("System Administrator lists user accounts with role, tenant, and clearance (no password hashes)", async () => {
            const res = await fetch(`${BASE_URL}/api/admin/users`, {
                headers: admin.headers,
            });
            assert.strictEqual(res.status, 200);
            const users = await res.json();
            assert.ok(users.length >= 6);
            for (const u of users) {
                assert.strictEqual(u.password_hash, undefined, "Password hash must not be exposed to admin view");
                assert.ok(u.email);
                assert.ok(u.role);
            }
        });

        let newAdminCreatedUserId = null;

        await test("System Administrator can provision new user account via POST /api/admin/users", async () => {
            const email = `test.user.${Date.now()}@nitdelhi.ac.in`;
            const res = await fetch(`${BASE_URL}/api/admin/users`, {
                method: "POST",
                headers: admin.headers,
                body: JSON.stringify({
                    email,
                    password: "Password123!",
                    role: "INSTITUTION_MEMBER",
                    institutionId: "DEMO-INST-001",
                    fullName: "Admin Created Test Member",
                    canViewDocuments: false,
                }),
            });
            assert.strictEqual(res.status, 201);
            const data = await res.json();
            assert.ok(data.user.id);
            newAdminCreatedUserId = data.user.id;
            testUserIds.push(newAdminCreatedUserId);
            assert.strictEqual(data.user.email, email);
            assert.strictEqual(data.user.canViewDocuments, false);
        });

        await test("System Administrator can grant document clearance and toggle active status via PATCH /api/admin/users/:id", async () => {
            assert.ok(newAdminCreatedUserId, "User ID must exist");
            const res = await fetch(`${BASE_URL}/api/admin/users/${newAdminCreatedUserId}`, {
                method: "PATCH",
                headers: admin.headers,
                body: JSON.stringify({
                    canViewDocuments: true,
                    isActive: false,
                }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.user.canViewDocuments, true);
            assert.strictEqual(data.user.isActive, false);

            // Re-activate
            await fetch(`${BASE_URL}/api/admin/users/${newAdminCreatedUserId}`, {
                method: "PATCH",
                headers: admin.headers,
                body: JSON.stringify({ isActive: true }),
            });
        });

        await test("System Administrator cannot deactivate their own account (guard against lockout)", async () => {
            const myProfileRes = await fetch(`${BASE_URL}/api/auth/me`, { headers: admin.headers });
            const me = await myProfileRes.json();
            const res = await fetch(`${BASE_URL}/api/admin/users/${me.id}`, {
                method: "PATCH",
                headers: admin.headers,
                body: JSON.stringify({ isActive: false }),
            });
            assert.strictEqual(res.status, 400);
            const data = await res.json();
            assert.ok(data.message.includes("cannot deactivate your own administrative account"));
        });

        await test("System Administrator can inspect audit logs via GET /api/admin/audit-logs", async () => {
            const res = await fetch(`${BASE_URL}/api/admin/audit-logs?limit=20`, {
                headers: admin.headers,
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.ok(data.totalCount > 0);
            assert.ok(Array.isArray(data.logs));
            assert.ok(data.logs.length > 0);
            const first = data.logs[0];
            assert.ok(first.action);
            assert.ok(first.userEmail);
        });

        await test("System Administrator queries live system telemetry via GET /api/admin/system-health", async () => {
            const res = await fetch(`${BASE_URL}/api/admin/system-health`, {
                headers: admin.headers,
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.status, "healthy");
            assert.strictEqual(data.database.connected, true);
            assert.ok(data.recordCounts.users >= 6);
            assert.ok(data.recordCounts.students >= 6);
            assert.ok(data.recordCounts.institutions >= 4);
            assert.strictEqual(data.storage.isolatedDir, true);
        });

        await test("System Administrator updates institution metadata via PATCH /api/admin/institutions/:id", async () => {
            const res = await fetch(`${BASE_URL}/api/admin/institutions/DEMO-INST-001`, {
                method: "PATCH",
                headers: admin.headers,
                body: JSON.stringify({
                    city: "New Delhi (Capital Region)",
                }),
            });
            assert.strictEqual(res.status, 200);
            const data = await res.json();
            assert.strictEqual(data.institution.city, "New Delhi (Capital Region)");
        });

        // ==========================================
        // SECTION 9: VERIFICATION ENGINE & RE-SCAN INTEGRITY
        // ==========================================
        await test("Engine detects duplicate synthetic APAAR IDs across different institutions", async () => {
            const stuA = "TEST-DUP-STU-A";
            const stuB = "TEST-DUP-STU-B";
            testIds.push(stuA, stuB);

            const sharedApaar = "7788-9900-1122";

            // Clean up if leftover
            await testPool.query("DELETE FROM validation_issues WHERE record_id IN ($1, $2)", [stuA, stuB]);
            await testPool.query("DELETE FROM students WHERE id IN ($1, $2)", [stuA, stuB]);

            await testPool.query(
                `INSERT INTO students (id, apaar_test_id, full_name, institution_id, institution_name, programme_name, validation_status)
                 VALUES ($1, $2, 'Student Alpha', 'DEMO-INST-001', 'NIT Delhi', 'B.Tech CSE', 'VALIDATED')`,
                [stuA, sharedApaar]
            );

            await testPool.query(
                `INSERT INTO students (id, apaar_test_id, full_name, institution_id, institution_name, programme_name, validation_status)
                 VALUES ($1, $2, 'Student Beta', 'DEMO-INST-002', 'Maharashtra Tech', 'B.Tech ECE', 'VALIDATED')`,
                [stuB, sharedApaar]
            );

            // Trigger scan with reviewer credentials
            const scanRes = await fetch(`${BASE_URL}/api/verification/scan`, {
                method: "POST",
                headers: reviewer.headers,
            });
            assert.strictEqual(scanRes.status, 200);

            // Check that cross-institution duplicate issues were created
            const issueRes = await testPool.query(
                "SELECT id, issue_type, reason FROM validation_issues WHERE record_id IN ($1, $2) AND issue_type = 'DUPLICATE_RECORD'",
                [stuA, stuB]
            );
            assert.strictEqual(issueRes.rowCount, 2);
            for (const r of issueRes.rows) {
                assert.strictEqual(r.issue_type, "DUPLICATE_RECORD");
                assert.ok(r.reason.includes("across different institution"));
            }
        });

        await test("Re-running verification scan preserves RESOLVED issues and does not revert them", async () => {
            const testIssueId = "ISS-RESOLVE-PRESERVE-TEST";
            const testStuId = "STU-RES-TEST";
            testIds.push(testStuId);

            await testPool.query("DELETE FROM validation_issues WHERE id = $1", [testIssueId]);
            await testPool.query("DELETE FROM students WHERE id = $1", [testStuId]);

            await testPool.query(
                `INSERT INTO students (id, apaar_test_id, full_name, institution_id, institution_name, programme_name, validation_status)
                 VALUES ($1, '8899-0011-2233', '', 'DEMO-INST-001', 'NIT Delhi', 'B.Tech CSE', 'REQUIRES_REVIEW')`,
                [testStuId]
            );

            await testPool.query(
                `INSERT INTO validation_issues (id, record_id, student_name, apaar_test_id, institution_id, institution_name, programme_name, issue_type, severity, reason, status)
                 VALUES ($1, $2, '', '8899-0011-2233', 'DEMO-INST-001', 'NIT Delhi', 'B.Tech CSE', 'MISSING_FIELD', 'HIGH', 'Test missing field', 'RESOLVED')`,
                [testIssueId, testStuId]
            );

            // Rescan
            await fetch(`${BASE_URL}/api/verification/scan`, { method: "POST", headers: reviewer.headers });

            const check = await testPool.query("SELECT status FROM validation_issues WHERE id = $1", [testIssueId]);
            assert.strictEqual(check.rows[0].status, "RESOLVED", "RESOLVED issue status must be preserved");

            await testPool.query("DELETE FROM validation_issues WHERE id = $1", [testIssueId]);
        });

        // Cleanups
        if (testFindingIds.length > 0) {
            await testPool.query("DELETE FROM document_mismatch_findings WHERE id = ANY($1)", [testFindingIds]);
        }

        if (testDocIds.length > 0) {
            await testPool.query("DELETE FROM student_documents WHERE id = ANY($1)", [testDocIds]);
            const fs = require("fs");
            const uploadDir = path.resolve(__dirname, "uploads", "documents");
            for (const key of testStorageKeys) {
                const target = path.join(uploadDir, path.basename(key));
                if (fs.existsSync(target)) {
                    try { fs.unlinkSync(target); } catch (_) {}
                }
            }
        }

        if (testIds.length > 0) {
            await testPool.query("DELETE FROM validation_issues WHERE record_id = ANY($1)", [testIds]);
            await testPool.query("DELETE FROM students WHERE id = ANY($1)", [testIds]);
        }

        if (testUserIds.length > 0) {
            await testPool.query("DELETE FROM users WHERE id = ANY($1)", [testUserIds]);
        }

    } finally {
        await testPool.end();
        if (serverInstance) {
            serverInstance.close();
        }
    }

    console.log(`\n=== RBAC & VERIFICATION TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ===\n`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
