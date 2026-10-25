const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
// Load environment variables from backend/.env or root .env
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { Pool } = require("pg");
const { PDFParse } = require("pdf-parse");
const Tesseract = require("tesseract.js");

const app = express();
const PORT = parseInt(process.env.PORT || "5001", 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";

// Configure isolated storage directory for student documents (outside any public web root)
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, "uploads", "documents");

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configurable maximum upload size (default: 10 MB)
const MAX_UPLOAD_SIZE_BYTES = parseInt(
    process.env.MAX_UPLOAD_SIZE_BYTES || String(10 * 1024 * 1024),
    10
);

/**
 * Validates file magic bytes to verify actual content type (PDF, PNG, JPEG).
 * Rejects disguised files even if the browser claims a valid Content-Type.
 */
function detectVerifiedMimeType(buffer, originalname) {
    if (!buffer || buffer.length < 4) return null;

    // Check PDF signature: %PDF-
    if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
        return { mimeType: "application/pdf", extension: "pdf" };
    }

    // Check PNG signature: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
        buffer.length >= 8 &&
        buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4E &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0D &&
        buffer[5] === 0x0A &&
        buffer[6] === 0x1A &&
        buffer[7] === 0x0A
    ) {
        return { mimeType: "image/png", extension: "png" };
    }

    // Check JPEG signature: 0xFF 0xD8 0xFF
    if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        const ext = path.extname(originalname || "").toLowerCase().replace(".", "");
        return {
            mimeType: "image/jpeg",
            extension: ext === "jpeg" ? "jpeg" : "jpg",
        };
    }

    return null;
}

// Secure multer memory upload configuration
const uploadHandler = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_UPLOAD_SIZE_BYTES,
        files: 1,
    },
    fileFilter: (req, file, cb) => {
        const allowedExts = [".pdf", ".png", ".jpg", ".jpeg"];
        const ext = path.extname(file.originalname || "").toLowerCase();
        if (!allowedExts.includes(ext)) {
            const err = new Error(
                `Unsupported file extension '${ext}'. Allowed extensions: ${allowedExts.join(", ")}`
            );
            err.code = "INVALID_FILE_TYPE";
            return cb(err, false);
        }
        cb(null, true);
    },
});

function handleUploadMiddleware(req, res, next) {
    uploadHandler.fields([
        { name: "document", maxCount: 1 },
        { name: "file", maxCount: 1 },
    ])(req, res, (err) => {
        if (err) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(413).json({
                    message: `File exceeds maximum allowed upload size of ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB`,
                });
            }
            if (err.code === "INVALID_FILE_TYPE") {
                return res.status(400).json({
                    message: err.message,
                });
            }
            return res.status(400).json({
                message: err.message || "File upload failed",
            });
        }
        req.file = (req.files?.document && req.files.document[0]) || (req.files?.file && req.files.file[0]) || null;
        next();
    });
}

// Configure PostgreSQL pool securely via environment variables
const poolConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl:
            process.env.DATABASE_URL.includes("localhost") ||
            process.env.DATABASE_URL.includes("127.0.0.1") ||
            process.env.DB_SSL === "false"
                ? false
                : { rejectUnauthorized: false },
    }
    : {
        host: process.env.DB_HOST || process.env.PGHOST || "localhost",
        port: parseInt(process.env.DB_PORT || process.env.PGPORT || "5432", 10),
        database: process.env.DB_NAME || process.env.PGDATABASE || "eduverify",
        user: process.env.DB_USER || process.env.PGUSER || process.env.USER,
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD || undefined,
        ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

// Setup CORS with configurable origins and support for cloud hosting
const rawOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);

const defaultAllowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
];
const allowedOrigins = Array.from(new Set([...rawOrigins, ...defaultAllowedOrigins]));

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            const normalized = origin.replace(/\/+$/, "");
            if (
                process.env.CORS_ORIGIN === "*" ||
                allowedOrigins.includes(normalized) ||
                normalized.endsWith(".vercel.app") ||
                normalized.endsWith(".onrender.com") ||
                normalized.endsWith(".up.railway.app") ||
                normalized.endsWith(".railway.app")
            ) {
                return callback(null, true);
            }
            callback(new Error(`CORS blocked for origin: ${origin}`));
        },
        credentials: true,
    })
);
app.use(express.json({ limit: "10mb" }));

// Root health check endpoint
app.get("/", (req, res) => {
    res.send("EduVerify Backend is running!");
});

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            database: "connected",
        });
    } catch (err) {
        res.status(500).json({
            status: "error",
            message: "Database connection failed",
            error: err.message,
        });
    }
});

// GET /api/students - Return all students from PostgreSQL ordered by ID
app.get("/api/students", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                apaar_test_id AS "apaarTestId",
                full_name AS "fullName",
                gender,
                dob,
                category,
                institution_id AS "institutionId",
                institution_name AS "institutionName",
                programme_id AS "programmeId",
                programme_name AS "programmeName",
                academic_year AS "academicYear",
                semester,
                admission_quota AS "admissionQuota",
                validation_status AS "validationStatus",
                discrepancy_note AS "discrepancyNote",
                last_updated AS "lastUpdated"
            FROM students
            ORDER BY id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ message: "Could not fetch students", error: error.message });
    }
});

// PATCH /api/students/:id/status - Update validation status and note
app.patch("/api/students/:id/status", async (req, res) => {
    const { id } = req.params;
    const { validationStatus, discrepancyNote } = req.body;

    const allowedStatuses = [
        "VALIDATED",
        "REQUIRES_REVIEW",
        "REJECTED",
        "PENDING",
    ];

    if (!allowedStatuses.includes(validationStatus)) {
        return res.status(400).json({
            message: `Invalid validation status '${validationStatus}'. Allowed statuses: ${allowedStatuses.join(", ")}`,
        });
    }

    try {
        const result = await pool.query(
            `UPDATE students
             SET validation_status = $1,
                 discrepancy_note = CASE
                     WHEN $2::text IS NOT NULL THEN $2
                     ELSE discrepancy_note
                 END,
                 last_updated = NOW()
             WHERE id = $3
             RETURNING
                id,
                apaar_test_id AS "apaarTestId",
                full_name AS "fullName",
                gender,
                dob,
                category,
                institution_id AS "institutionId",
                institution_name AS "institutionName",
                programme_id AS "programmeId",
                programme_name AS "programmeName",
                academic_year AS "academicYear",
                semester,
                admission_quota AS "admissionQuota",
                validation_status AS "validationStatus",
                discrepancy_note AS "discrepancyNote",
                last_updated AS "lastUpdated"`,
            [validationStatus, discrepancyNote !== undefined ? discrepancyNote : null, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: `Student with ID '${id}' not found`,
            });
        }

        res.json({
            message: "Student status updated",
            student: result.rows[0],
        });
    } catch (error) {
        console.error("Error updating student:", error);
        res.status(500).json({
            message: "Could not update student status",
            error: error.message,
        });
    }
});

// POST /api/students/batch - Batch import student records
app.post("/api/students/batch", async (req, res) => {
    const rawList = Array.isArray(req.body)
        ? req.body
        : Array.isArray(req.body?.students)
        ? req.body.students
        : null;

    if (!rawList || rawList.length === 0) {
        return res.status(400).json({
            message: "Batch payload must contain a non-empty array of students",
        });
    }

    const allowedStatuses = ["VALIDATED", "REQUIRES_REVIEW", "REJECTED", "PENDING"];

    // 1. Validate each record in payload
    for (let i = 0; i < rawList.length; i++) {
        const s = rawList[i];
        if (!s || typeof s !== "object") {
            return res.status(400).json({
                message: `Record at index ${i} is not a valid object`,
            });
        }

        const id = s.id ? String(s.id).trim() : "";
        const fullName = (s.fullName || s.full_name) ? String(s.fullName || s.full_name).trim() : "";

        if (!id) {
            return res.status(400).json({
                message: `Validation error at record ${i + 1}: Missing student ID`,
            });
        }

        if (!fullName) {
            return res.status(400).json({
                message: `Validation error at record ${i + 1} (${id}): Missing student full name`,
            });
        }

        const status = s.validationStatus || s.validation_status || "PENDING";
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: `Validation error at record ${i + 1} (${id}): Invalid status '${status}'`,
            });
        }
    }

    // 2. Check for duplicate IDs within the incoming batch itself
    const seenBatchIds = new Set();
    const batchDuplicates = [];
    for (const s of rawList) {
        const id = String(s.id).trim();
        if (seenBatchIds.has(id)) {
            batchDuplicates.push(id);
        }
        seenBatchIds.add(id);
    }

    if (batchDuplicates.length > 0) {
        const uniqueDups = Array.from(new Set(batchDuplicates));
        return res.status(400).json({
            message: `Batch contains duplicate student ID(s): ${uniqueDups.join(", ")}`,
            duplicates: uniqueDups,
        });
    }

    // 3. Check for collision with existing records in PostgreSQL
    const candidateIds = Array.from(seenBatchIds);
    let existingIds = [];
    try {
        const checkRes = await pool.query(
            "SELECT id FROM students WHERE id = ANY($1)",
            [candidateIds]
        );
        existingIds = checkRes.rows.map((r) => r.id);
    } catch (err) {
        return res.status(500).json({
            message: "Failed to check existing student records",
            error: err.message,
        });
    }

    const skipDuplicates =
        req.query.skipDuplicates === "true" ||
        req.query.onConflict === "skip" ||
        req.body?.skipDuplicates === true;

    if (existingIds.length > 0 && !skipDuplicates) {
        return res.status(409).json({
            message: `Student ID(s) already exist in database: ${existingIds.join(", ")}`,
            duplicateIds: existingIds,
        });
    }

    // Filter to only new records if skipDuplicates is true
    const toInsert = skipDuplicates
        ? rawList.filter((s) => !existingIds.includes(String(s.id).trim()))
        : rawList;

    if (toInsert.length === 0) {
        return res.status(200).json({
            message: "No new records to insert. All records were existing duplicates.",
            insertedCount: 0,
            skippedCount: existingIds.length,
            duplicates: existingIds,
            students: [],
        });
    }

    // 4. Perform database insertion within a transaction using parameterized queries
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const insertedStudents = [];

        for (const s of toInsert) {
            const studentId = String(s.id).trim();
            const apaarId = (s.apaarTestId || s.apaar_test_id) ? String(s.apaarTestId || s.apaar_test_id).trim() : null;
            const fullName = String(s.fullName || s.full_name).trim();
            const gender = s.gender ? String(s.gender).trim() : null;
            const dob = s.dob ? String(s.dob).trim() : null;
            const category = s.category ? String(s.category).trim() : null;
            const institutionId = (s.institutionId || s.institution_id) ? String(s.institutionId || s.institution_id).trim() : null;
            const institutionName = (s.institutionName || s.institution_name) ? String(s.institutionName || s.institution_name).trim() : null;
            const programmeId = (s.programmeId || s.programme_id) ? String(s.programmeId || s.programme_id).trim() : null;
            const programmeName = (s.programmeName || s.programme_name) ? String(s.programmeName || s.programme_name).trim() : null;
            const academicYear = (s.academicYear || s.academic_year) ? String(s.academicYear || s.academic_year).trim() : null;
            const semester = (s.semester !== undefined && s.semester !== null && s.semester !== "") ? parseInt(s.semester, 10) : null;
            const admissionQuota = (s.admissionQuota || s.admission_quota) ? String(s.admissionQuota || s.admission_quota).trim() : null;
            const validationStatus = s.validationStatus || s.validation_status || "PENDING";
            const discrepancyNote = (s.discrepancyNote || s.discrepancy_note || "").trim();

            const insertRes = await client.query(
                `INSERT INTO students (
                    id, apaar_test_id, full_name, gender, dob, category,
                    institution_id, institution_name, programme_id, programme_name,
                    academic_year, semester, admission_quota, validation_status, discrepancy_note, last_updated
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW())
                RETURNING
                    id,
                    apaar_test_id AS "apaarTestId",
                    full_name AS "fullName",
                    gender,
                    dob,
                    category,
                    institution_id AS "institutionId",
                    institution_name AS "institutionName",
                    programme_id AS "programmeId",
                    programme_name AS "programmeName",
                    academic_year AS "academicYear",
                    semester,
                    admission_quota AS "admissionQuota",
                    validation_status AS "validationStatus",
                    discrepancy_note AS "discrepancyNote",
                    last_updated AS "lastUpdated"`,
                [
                    studentId,
                    apaarId,
                    fullName,
                    gender,
                    dob,
                    category,
                    institutionId,
                    institutionName,
                    programmeId,
                    programmeName,
                    academicYear,
                    semester,
                    admissionQuota,
                    validationStatus,
                    discrepancyNote,
                ]
            );

            insertedStudents.push(insertRes.rows[0]);
        }

        await client.query("COMMIT");

        // Trigger automated rule-based verification scan after new records are inserted
        try {
            await runVerificationEngine(pool);
        } catch (scanErr) {
            console.error("Post-import verification scan warning:", scanErr);
        }

        res.status(201).json({
            message: `Successfully imported ${insertedStudents.length} student records`,
            insertedCount: insertedStudents.length,
            skippedCount: existingIds.length,
            duplicates: existingIds,
            students: insertedStudents,
        });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Batch import error:", err);
        res.status(500).json({
            message: "Failed to commit batch student records to database",
            error: err.message,
        });
    } finally {
        client.release();
    }
});

// ==========================================
// Phase 2A: Secure Student Document Upload & Metadata
// ==========================================

// POST /api/students/:studentId/documents - Secure upload of synthetic student document
app.post("/api/students/:studentId/documents", handleUploadMiddleware, async (req, res) => {
    const studentId = req.params.studentId ? String(req.params.studentId).trim() : "";
    if (!studentId) {
        return res.status(400).json({ message: "Missing student ID parameter" });
    }

    try {
        // 1. Verify that the referenced student exists in PostgreSQL
        const studentCheck = await pool.query(
            "SELECT id, full_name AS \"fullName\" FROM students WHERE id = $1",
            [studentId]
        );

        if (studentCheck.rowCount === 0) {
            return res.status(404).json({
                message: `Student with ID '${studentId}' not found`,
            });
        }

        // 2. Verify that a file was provided
        if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
            return res.status(400).json({
                message: "No document file uploaded. Please attach a valid PDF, JPEG, or PNG file.",
            });
        }

        // 3. Inspect magic bytes to detect actual file content type
        const verifiedFormat = detectVerifiedMimeType(req.file.buffer, req.file.originalname);
        if (!verifiedFormat) {
            return res.status(400).json({
                message: "Invalid file content. File does not match valid PDF, JPEG, or PNG signature.",
            });
        }

        // 4. Validate that file extension matches the verified content type
        const rawExt = path.extname(req.file.originalname || "").toLowerCase().replace(".", "");
        const validExtensionsMap = {
            "application/pdf": ["pdf"],
            "image/png": ["png"],
            "image/jpeg": ["jpg", "jpeg"],
        };

        if (!validExtensionsMap[verifiedFormat.mimeType] || !validExtensionsMap[verifiedFormat.mimeType].includes(rawExt)) {
            return res.status(400).json({
                message: `File extension '.${rawExt}' does not match detected content format '${verifiedFormat.mimeType}'`,
            });
        }

        // 5. Generate secure, server-controlled unique identifier and storage name
        const documentId = `DOC-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const safeStorageKey = `${documentId}.${verifiedFormat.extension}`;

        // Guard against path traversal
        const targetFilePath = path.join(UPLOAD_DIR, path.basename(safeStorageKey));
        if (!targetFilePath.startsWith(UPLOAD_DIR)) {
            return res.status(400).json({ message: "Invalid file storage path generation" });
        }

        // 6. Write file securely to disk outside public web root
        let fileSavedToDisk = false;
        try {
            await fs.promises.writeFile(targetFilePath, req.file.buffer);
            fileSavedToDisk = true;

            // 7. Insert metadata record into PostgreSQL
            const insertResult = await pool.query(
                `INSERT INTO student_documents (
                    id, student_id, original_filename, mime_type, file_extension,
                    file_size, storage_key, uploaded_at, processing_status, review_status,
                    created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 'UPLOADED', 'PENDING', NOW(), NOW())
                RETURNING
                    id,
                    student_id AS "studentId",
                    original_filename AS "originalFilename",
                    mime_type AS "mimeType",
                    file_extension AS "fileExtension",
                    file_size AS "fileSize",
                    storage_key AS "storageKey",
                    uploaded_at AS "uploadedAt",
                    processing_status AS "processingStatus",
                    review_status AS "reviewStatus",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"`,
                [
                    documentId,
                    studentId,
                    path.basename(req.file.originalname).slice(0, 255),
                    verifiedFormat.mimeType,
                    verifiedFormat.extension,
                    req.file.buffer.length,
                    safeStorageKey,
                ]
            );

            res.status(201).json({
                message: "Document uploaded successfully",
                document: insertResult.rows[0],
            });
        } catch (dbErr) {
            // Clean up file if database insertion fails
            if (fileSavedToDisk && fs.existsSync(targetFilePath)) {
                try {
                    await fs.promises.unlink(targetFilePath);
                } catch (unlinkErr) {
                    console.error("Cleanup warning: failed to unlink file after DB failure:", unlinkErr);
                }
            }
            throw dbErr;
        }
    } catch (error) {
        console.error("Document upload error:", error);
        res.status(500).json({
            message: "Failed to upload document",
            error: error.message,
        });
    }
});

// ==========================================
// Phase 2B: Local OCR & Document Text Extraction Service
// ==========================================

/**
 * Phase 2B: Local text extraction helper for PDF and Image documents.
 * Handles text-based PDFs via PDFParse, images via local Tesseract.js, and scanned PDFs.
 */
async function extractDocumentText(filePath, mimeType, fileExtension) {
    const timeoutMs = 30000; // 30-second safety timeout

    const extractionPromise = (async () => {
        const isPdf = mimeType === "application/pdf" || fileExtension === "pdf";
        const isImage = mimeType.startsWith("image/") || ["png", "jpg", "jpeg"].includes(fileExtension);

        if (isPdf) {
            const buffer = await fs.promises.readFile(filePath);
            const parser = new PDFParse(new Uint8Array(buffer));
            const textResult = await parser.getText();
            const rawText = textResult?.text ? textResult.text.trim() : "";
            const pageCount = textResult?.total || textResult?.pages?.length || 1;

            if (rawText.length > 0) {
                return {
                    text: rawText,
                    pageCount,
                    confidence: 100.0,
                    source: "PDF_EMBEDDED_TEXT",
                };
            }

            // Scanned PDF fallback: check for embedded raster images to run OCR
            try {
                const imgResult = await parser.getImage({ imageBuffer: true });
                let combinedOcrText = "";
                let confidenceSum = 0;
                let imageCount = 0;

                if (imgResult?.pages && Array.isArray(imgResult.pages)) {
                    for (const pg of imgResult.pages) {
                        for (const img of pg.images || []) {
                            if (img.data && img.data.length > 0) {
                                const ocrRes = await Tesseract.recognize(Buffer.from(img.data), "eng");
                                const ocrText = (ocrRes.data?.text || "").trim();
                                if (ocrText) {
                                    combinedOcrText += (combinedOcrText ? "\n\n" : "") + ocrText;
                                    confidenceSum += (ocrRes.data?.confidence || 0);
                                    imageCount++;
                                }
                            }
                        }
                    }
                }

                if (combinedOcrText.trim().length > 0) {
                    return {
                        text: combinedOcrText.trim(),
                        pageCount,
                        confidence: imageCount > 0 ? Math.round((confidenceSum / imageCount) * 100) / 100 : 85.0,
                        source: "PDF_SCANNED_OCR",
                    };
                }
            } catch (scanErr) {
                console.warn("Scanned PDF OCR attempt notice:", scanErr.message);
            }

            throw new Error("No readable text found in document. The document appears to be blank, unscanned, or unreadable.");
        }

        if (isImage) {
            const ocrRes = await Tesseract.recognize(filePath, "eng");
            const text = (ocrRes.data?.text || "").trim();
            const confidence = Math.round((ocrRes.data?.confidence || 0) * 100) / 100;

            if (!text || text.length === 0) {
                throw new Error("No readable text detected in image.");
            }

            return {
                text,
                pageCount: 1,
                confidence,
                source: "IMAGE_OCR",
            };
        }

        throw new Error(`Unsupported document format '${mimeType || fileExtension}' for text extraction`);
    })();

    return Promise.race([
        extractionPromise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Document text extraction timed out after 30 seconds")), timeoutMs)
        ),
    ]);
}

// GET /api/students/:studentId/documents - List documents for an existing student
app.get("/api/students/:studentId/documents", async (req, res) => {
    const studentId = req.params.studentId ? String(req.params.studentId).trim() : "";
    if (!studentId) {
        return res.status(400).json({ message: "Missing student ID parameter" });
    }

    try {
        const studentCheck = await pool.query(
            "SELECT id FROM students WHERE id = $1",
            [studentId]
        );
        if (studentCheck.rowCount === 0) {
            return res.status(404).json({
                message: `Student with ID '${studentId}' not found`,
            });
        }

        const result = await pool.query(
            `SELECT
                id,
                student_id AS "studentId",
                original_filename AS "originalFilename",
                mime_type AS "mimeType",
                file_extension AS "fileExtension",
                file_size AS "fileSize",
                storage_key AS "storageKey",
                uploaded_at AS "uploadedAt",
                processing_status AS "processingStatus",
                review_status AS "reviewStatus",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                extracted_text AS "extractedText",
                extracted_at AS "extractedAt",
                page_count AS "pageCount",
                ocr_confidence AS "ocrConfidence",
                ocr_error AS "ocrError"
             FROM student_documents
             WHERE student_id = $1
             ORDER BY uploaded_at DESC, id DESC`,
            [studentId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching student documents:", error);
        res.status(500).json({
            message: "Could not fetch student documents",
            error: error.message,
        });
    }
});

// GET /api/documents/:documentId - Retrieve document metadata by document ID
app.get("/api/documents/:documentId", async (req, res) => {
    const documentId = req.params.documentId ? String(req.params.documentId).trim() : "";
    if (!documentId) {
        return res.status(400).json({ message: "Missing document ID parameter" });
    }

    try {
        const result = await pool.query(
            `SELECT
                id,
                student_id AS "studentId",
                original_filename AS "originalFilename",
                mime_type AS "mimeType",
                file_extension AS "fileExtension",
                file_size AS "fileSize",
                storage_key AS "storageKey",
                uploaded_at AS "uploadedAt",
                processing_status AS "processingStatus",
                review_status AS "reviewStatus",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                extracted_text AS "extractedText",
                extracted_at AS "extractedAt",
                page_count AS "pageCount",
                ocr_confidence AS "ocrConfidence",
                ocr_error AS "ocrError"
             FROM student_documents
             WHERE id = $1`,
            [documentId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: `Document with ID '${documentId}' not found`,
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching document metadata:", error);
        res.status(500).json({
            message: "Could not fetch document metadata",
            error: error.message,
        });
    }
});

// GET /api/documents/:documentId/text - Retrieve extracted text and OCR status
app.get("/api/documents/:documentId/text", async (req, res) => {
    const documentId = req.params.documentId ? String(req.params.documentId).trim() : "";
    if (!documentId) {
        return res.status(400).json({ message: "Missing document ID parameter" });
    }

    try {
        const result = await pool.query(
            `SELECT
                id,
                student_id AS "studentId",
                original_filename AS "originalFilename",
                processing_status AS "processingStatus",
                extracted_text AS "extractedText",
                extracted_at AS "extractedAt",
                page_count AS "pageCount",
                ocr_confidence AS "ocrConfidence",
                ocr_error AS "ocrError"
             FROM student_documents
             WHERE id = $1`,
            [documentId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: `Document with ID '${documentId}' not found`,
            });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error fetching document text:", error);
        res.status(500).json({
            message: "Could not fetch document text",
            error: error.message,
        });
    }
});

// POST /api/documents/:documentId/extract - Trigger local OCR / text extraction
app.post("/api/documents/:documentId/extract", async (req, res) => {
    const documentId = req.params.documentId ? String(req.params.documentId).trim() : "";
    if (!documentId) {
        return res.status(400).json({ message: "Missing document ID parameter" });
    }

    try {
        // 1. Fetch document from PostgreSQL
        const docRes = await pool.query(
            `SELECT
                id,
                student_id AS "studentId",
                original_filename AS "originalFilename",
                mime_type AS "mimeType",
                file_extension AS "fileExtension",
                file_size AS "fileSize",
                storage_key AS "storageKey",
                uploaded_at AS "uploadedAt",
                processing_status AS "processingStatus",
                review_status AS "reviewStatus",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                extracted_text AS "extractedText",
                extracted_at AS "extractedAt",
                page_count AS "pageCount",
                ocr_confidence AS "ocrConfidence",
                ocr_error AS "ocrError"
             FROM student_documents
             WHERE id = $1`,
            [documentId]
        );

        if (docRes.rowCount === 0) {
            return res.status(404).json({
                message: `Document with ID '${documentId}' not found`,
            });
        }

        const doc = docRes.rows[0];

        // 2. Prevent simultaneous duplicate processing
        if (doc.processingStatus === "PROCESSING") {
            return res.status(409).json({
                message: "Document is already being processed. Please wait for current extraction to finish.",
                document: doc,
            });
        }

        // 3. Mark document status as PROCESSING
        await pool.query(
            `UPDATE student_documents
             SET processing_status = 'PROCESSING',
                 ocr_error = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [documentId]
        );

        // 4. Resolve file path safely
        const targetFilePath = path.join(UPLOAD_DIR, path.basename(doc.storageKey));
        if (!targetFilePath.startsWith(UPLOAD_DIR) || !fs.existsSync(targetFilePath)) {
            const errMessage = "Stored document file not found on server.";
            const failRes = await pool.query(
                `UPDATE student_documents
                 SET processing_status = 'FAILED',
                     ocr_error = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING
                    id, student_id AS "studentId", original_filename AS "originalFilename",
                    mime_type AS "mimeType", file_extension AS "fileExtension", file_size AS "fileSize",
                    storage_key AS "storageKey", uploaded_at AS "uploadedAt",
                    processing_status AS "processingStatus", review_status AS "reviewStatus",
                    created_at AS "createdAt", updated_at AS "updatedAt",
                    extracted_text AS "extractedText", extracted_at AS "extractedAt",
                    page_count AS "pageCount", ocr_confidence AS "ocrConfidence", ocr_error AS "ocrError"`,
                [errMessage, documentId]
            );
            return res.status(404).json({
                message: errMessage,
                document: failRes.rows[0],
            });
        }

        // 5. Run local text extraction
        try {
            const result = await extractDocumentText(targetFilePath, doc.mimeType, doc.fileExtension);

            // 6. Persist successful extraction in PostgreSQL
            const updateRes = await pool.query(
                `UPDATE student_documents
                 SET processing_status = 'COMPLETED',
                     extracted_text = $1,
                     extracted_at = NOW(),
                     ocr_error = NULL,
                     page_count = $2,
                     ocr_confidence = $3,
                     updated_at = NOW()
                 WHERE id = $4
                 RETURNING
                    id, student_id AS "studentId", original_filename AS "originalFilename",
                    mime_type AS "mimeType", file_extension AS "fileExtension", file_size AS "fileSize",
                    storage_key AS "storageKey", uploaded_at AS "uploadedAt",
                    processing_status AS "processingStatus", review_status AS "reviewStatus",
                    created_at AS "createdAt", updated_at AS "updatedAt",
                    extracted_text AS "extractedText", extracted_at AS "extractedAt",
                    page_count AS "pageCount", ocr_confidence AS "ocrConfidence", ocr_error AS "ocrError"`,
                [result.text, result.pageCount, result.confidence, documentId]
            );

            res.json({
                message: "Text extracted successfully",
                document: updateRes.rows[0],
            });
        } catch (extractErr) {
            console.error(`Extraction failed for document ${documentId}:`, extractErr.message);
            const safeErrorMessage = extractErr.message.replace(/[\/\\][^\s]+/g, "[file]");

            const failRes = await pool.query(
                `UPDATE student_documents
                 SET processing_status = 'FAILED',
                     ocr_error = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING
                    id, student_id AS "studentId", original_filename AS "originalFilename",
                    mime_type AS "mimeType", file_extension AS "fileExtension", file_size AS "fileSize",
                    storage_key AS "storageKey", uploaded_at AS "uploadedAt",
                    processing_status AS "processingStatus", review_status AS "reviewStatus",
                    created_at AS "createdAt", updated_at AS "updatedAt",
                    extracted_text AS "extractedText", extracted_at AS "extractedAt",
                    page_count AS "pageCount", ocr_confidence AS "ocrConfidence", ocr_error AS "ocrError"`,
                [safeErrorMessage, documentId]
            );

            res.status(422).json({
                message: safeErrorMessage,
                document: failRes.rows[0],
            });
        }
    } catch (error) {
        console.error("Text extraction route error:", error);
        res.status(500).json({
            message: "Failed to process document text extraction",
            error: error.message,
        });
    }
});

// ==========================================
// Phase 2C: Deterministic Document Mismatch Detection
// ==========================================

/**
 * Normalizes text for conservative rule-based comparison:
 * collapses whitespace, converts dashes to standard hyphens, removes outer whitespace.
 */
function normalizeComparisonText(str) {
    if (str === null || str === undefined) return "";
    return String(str)
        .trim()
        .toLowerCase()
        .replace(/[\u2010-\u2015\u2212]/g, "-") // Unicode hyphens/dashes to standard '-'
        .replace(/\s+/g, " ");
}

/**
 * Deterministically extracts candidate student fields from raw extracted OCR text.
 * Uses explicit labels, line-anchored patterns, and conservative rules.
 * Never invents values. If not found confidently, returns null.
 */
function extractCandidateDocumentFields(rawText) {
    if (!rawText || typeof rawText !== "string") {
        return {};
    }

    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const candidateFields = {};

    const extractionRules = [
        {
            fieldName: "studentName",
            fieldLabel: "Student Full Name",
            dbField: "full_name",
            findingType: "NAME_MISMATCH",
            severity: "HIGH",
            patterns: [
                /^(?:Student\s+Name|Candidate\s+Name|Full\s+Name)\s*[:\-–—]?\s+(.+)$/i,
            ],
            clean: (v) => v.replace(/\s+/g, " ").trim(),
        },
        {
            fieldName: "studentId",
            fieldLabel: "Synthetic Student ID",
            dbField: "id",
            findingType: "ID_MISMATCH",
            severity: "HIGH",
            patterns: [
                /^(?:Synthetic\s+Student\s+ID|Student\s+ID|Roll\s+No|Enrollment\s+No)\s*[:\-–—]?\s+([A-Za-z0-9\-_]+)$/i,
            ],
            clean: (v) => v.trim(),
        },
        {
            fieldName: "apaarTestId",
            fieldLabel: "Synthetic APAAR ID",
            dbField: "apaar_test_id",
            findingType: "APAAR_ID_MISMATCH",
            severity: "HIGH",
            patterns: [
                /^(?:Synthetic\s+APAAR(?:-like)?(?:\s+Test)?\s+ID|APAAR\s+ID|APAAR\s+Number)\s*[:\-–—]?\s+([0-9]{4}[-\s][0-9]{4}[-\s][0-9]{4})$/i,
            ],
            clean: (v) => v.replace(/\s+/g, "-").trim(),
        },
        {
            fieldName: "academicYear",
            fieldLabel: "Academic Year",
            dbField: "academic_year",
            findingType: "ACADEMIC_YEAR_MISMATCH",
            severity: "WARNING",
            patterns: [
                /^(?:Academic\s+Year|Session)\s*[:\-–—]?\s+([0-9]{4}\s*[-–—/]\s*[0-9]{2,4})$/i,
            ],
            clean: (v) => v.replace(/[–—/]/g, "-").replace(/\s+/g, "").trim(),
        },
        {
            fieldName: "semester",
            fieldLabel: "Enrolled Semester",
            dbField: "semester",
            findingType: "SEMESTER_MISMATCH",
            severity: "WARNING",
            patterns: [
                /^(?:Semester|Sem)\s*[:\-–—]?\s+([0-9]{1,2}|I{1,3}|IV|V|VI{0,3}|VIII)$/i,
            ],
            clean: (v) => {
                const romanMap = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
                const num = parseInt(v, 10);
                if (!isNaN(num)) return String(num);
                return String(romanMap[v.toLowerCase()] || v);
            },
        },
        {
            fieldName: "institutionName",
            fieldLabel: "Enrolled Institution",
            dbField: "institution_name",
            findingType: "INSTITUTION_MISMATCH",
            severity: "WARNING",
            patterns: [
                /^(?:Institution|College|University)(?:\s+Name)?\s*[:\-–—]?\s+(.+)$/i,
            ],
            clean: (v) => v.replace(/\s+/g, " ").trim(),
        },
        {
            fieldName: "programmeName",
            fieldLabel: "Academic Programme",
            dbField: "programme_name",
            findingType: "PROGRAMME_MISMATCH",
            severity: "WARNING",
            patterns: [
                /^(?:Programme|Program|Course)(?:\s+Name)?\s*[:\-–—]?\s+(.+)$/i,
            ],
            clean: (v) => v.replace(/\s+/g, " ").trim(),
        },
    ];

    for (const line of lines) {
        for (const rule of extractionRules) {
            if (candidateFields[rule.fieldName]) continue;
            for (const pattern of rule.patterns) {
                const match = line.match(pattern);
                if (match && match[1]) {
                    const rawVal = match[1].trim();
                    // Avoid full explanatory sentences or headers
                    if (
                        rawVal.length > 0 &&
                        rawVal.length < 150 &&
                        !rawVal.endsWith(".") &&
                        !rawVal.toLowerCase().startsWith("upload this")
                    ) {
                        candidateFields[rule.fieldName] = {
                            fieldName: rule.fieldName,
                            fieldLabel: rule.fieldLabel,
                            dbField: rule.dbField,
                            findingType: rule.findingType,
                            severity: rule.severity,
                            documentValue: rule.clean(rawVal),
                            rawEvidence: line,
                            status: "EXTRACTED",
                        };
                        break;
                    }
                }
            }
        }
    }

    return candidateFields;
}

/**
 * Compares extracted candidate document fields against linked PostgreSQL student record.
 * Generates rule-based findings only for genuine differences.
 */
function compareFieldsWithStudentRecord(candidateFields, studentRecord) {
    const discrepancies = [];

    for (const [key, candidate] of Object.entries(candidateFields)) {
        if (!candidate || candidate.status !== "EXTRACTED") continue;

        const dbValRaw = studentRecord[candidate.dbField];
        const dbValStr = dbValRaw !== null && dbValRaw !== undefined ? String(dbValRaw).trim() : "";
        const docValStr = String(candidate.documentValue || "").trim();

        const normDoc = normalizeComparisonText(docValStr);
        const normDb = normalizeComparisonText(dbValStr);

        let isMismatch = false;
        let explanation = "";

        if (key === "semester") {
            const docSem = parseInt(docValStr, 10);
            const dbSem = parseInt(dbValStr, 10);
            if (!isNaN(docSem) && !isNaN(dbSem)) {
                if (docSem !== dbSem) {
                    isMismatch = true;
                    explanation = `Document indicates semester ${docSem}, whereas student record is enrolled for semester ${dbSem}.`;
                }
            } else if (normDoc !== normDb) {
                isMismatch = true;
                explanation = `Document indicates semester "${docValStr}", whereas student record specifies "${dbValStr}".`;
            }
        } else if (key === "studentName") {
            if (normDoc !== normDb) {
                isMismatch = true;
                explanation = `Document student name "${docValStr}" does not match registered student name "${dbValStr}".`;
            }
        } else if (key === "studentId") {
            if (normDoc !== normDb) {
                isMismatch = true;
                explanation = `Document student ID "${docValStr}" does not match registered student ID "${dbValStr}".`;
            }
        } else if (key === "apaarTestId") {
            const unhyphenDoc = normDoc.replace(/-/g, "");
            const unhyphenDb = normDb.replace(/-/g, "");
            if (unhyphenDoc !== unhyphenDb) {
                isMismatch = true;
                explanation = `Synthetic APAAR ID in document ("${docValStr}") does not match registered test ID ("${dbValStr}").`;
            }
        } else if (key === "academicYear") {
            if (normDoc !== normDb) {
                isMismatch = true;
                explanation = `Document academic year "${docValStr}" differs from registered academic year "${dbValStr}".`;
            }
        } else if (key === "institutionName") {
            if (normDoc !== normDb) {
                isMismatch = true;
                explanation = `Document institution "${docValStr}" does not match enrolled institution "${dbValStr}".`;
            }
        } else if (key === "programmeName") {
            if (normDoc !== normDb) {
                isMismatch = true;
                explanation = `Document programme "${docValStr}" does not match registered programme "${dbValStr}".`;
            }
        }

        if (isMismatch) {
            discrepancies.push({
                fieldName: candidate.fieldName,
                fieldLabel: candidate.fieldLabel,
                documentValue: docValStr,
                databaseValue: dbValStr,
                rawEvidence: candidate.rawEvidence,
                findingType: candidate.findingType,
                severity: candidate.severity,
                explanation: explanation,
            });
        }
    }

    return discrepancies;
}

// POST /api/documents/:documentId/compare - Deterministic Rule-Based Comparison
app.post("/api/documents/:documentId/compare", async (req, res) => {
    const documentId = req.params.documentId ? String(req.params.documentId).trim() : "";
    if (!documentId) {
        return res.status(400).json({ message: "Missing document ID parameter" });
    }

    try {
        // 1. Fetch document metadata and extracted text
        const docRes = await pool.query(
            `SELECT
                id,
                student_id AS "studentId",
                original_filename AS "originalFilename",
                processing_status AS "processingStatus",
                extracted_text AS "extractedText"
             FROM student_documents
             WHERE id = $1`,
            [documentId]
        );

        if (docRes.rowCount === 0) {
            return res.status(404).json({
                message: `Document with ID '${documentId}' not found`,
            });
        }

        const doc = docRes.rows[0];

        if (doc.processingStatus !== "COMPLETED" || !doc.extractedText) {
            return res.status(422).json({
                message: "Document text extraction has not completed. Please run text extraction first before comparison.",
            });
        }

        // 2. Fetch linked student record from PostgreSQL
        const stuRes = await pool.query(
            `SELECT * FROM students WHERE id = $1`,
            [doc.studentId]
        );

        if (stuRes.rowCount === 0) {
            return res.status(404).json({
                message: `Linked student record with ID '${doc.studentId}' not found in database`,
            });
        }

        const student = stuRes.rows[0];

        // 3. Extract candidate fields deterministically
        const candidateFields = extractCandidateDocumentFields(doc.extractedText);

        // 4. Compare supported fields against database
        const discrepancies = compareFieldsWithStudentRecord(candidateFields, student);

        // 5. Persist findings safely with ON CONFLICT (idempotent, never duplicates, preserves resolved/dismissed status)
        for (const d of discrepancies) {
            const findingId = `FIND-${documentId.slice(-8)}-${d.fieldName}`;
            await pool.query(
                `INSERT INTO document_mismatch_findings (
                    id, document_id, student_id, field_name, field_label,
                    document_value, database_value, raw_evidence,
                    finding_type, severity, explanation, status,
                    created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'OPEN', NOW(), NOW())
                ON CONFLICT (document_id, field_name)
                DO UPDATE SET
                    document_value = EXCLUDED.document_value,
                    database_value = EXCLUDED.database_value,
                    raw_evidence = EXCLUDED.raw_evidence,
                    finding_type = EXCLUDED.finding_type,
                    explanation = EXCLUDED.explanation,
                    updated_at = NOW()`,
                [
                    findingId,
                    documentId,
                    doc.studentId,
                    d.fieldName,
                    d.fieldLabel,
                    d.documentValue,
                    d.databaseValue,
                    d.rawEvidence,
                    d.findingType,
                    d.severity,
                    d.explanation,
                ]
            );
        }

        // 6. Fetch all persisted findings for this document
        const findingsRes = await pool.query(
            `SELECT
                id,
                document_id AS "documentId",
                student_id AS "studentId",
                field_name AS "fieldName",
                field_label AS "fieldLabel",
                document_value AS "documentValue",
                database_value AS "databaseValue",
                raw_evidence AS "rawEvidence",
                finding_type AS "findingType",
                severity,
                explanation,
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM document_mismatch_findings
             WHERE document_id = $1
             ORDER BY
                CASE severity WHEN 'HIGH' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
                created_at ASC`,
            [documentId]
        );

        res.json({
            message: "Document comparison completed successfully",
            documentId: doc.id,
            studentId: doc.studentId,
            studentName: student.full_name,
            candidateFields: Object.values(candidateFields),
            findings: findingsRes.rows,
            totalDiscrepancies: findingsRes.rowCount,
            openDiscrepancies: findingsRes.rows.filter((f) => f.status === "OPEN").length,
        });
    } catch (error) {
        console.error("Document comparison route error:", error);
        res.status(500).json({
            message: "Failed to perform document comparison",
            error: error.message,
        });
    }
});

// GET /api/documents/:documentId/findings - Retrieve Persisted Document Mismatch Findings
app.get("/api/documents/:documentId/findings", async (req, res) => {
    const documentId = req.params.documentId ? String(req.params.documentId).trim() : "";
    if (!documentId) {
        return res.status(400).json({ message: "Missing document ID parameter" });
    }

    try {
        const docRes = await pool.query(
            `SELECT id, student_id AS "studentId", extracted_text AS "extractedText"
             FROM student_documents
             WHERE id = $1`,
            [documentId]
        );

        if (docRes.rowCount === 0) {
            return res.status(404).json({
                message: `Document with ID '${documentId}' not found`,
            });
        }

        const candidateFields = extractCandidateDocumentFields(docRes.rows[0].extractedText);

        const findingsRes = await pool.query(
            `SELECT
                id,
                document_id AS "documentId",
                student_id AS "studentId",
                field_name AS "fieldName",
                field_label AS "fieldLabel",
                document_value AS "documentValue",
                database_value AS "databaseValue",
                raw_evidence AS "rawEvidence",
                finding_type AS "findingType",
                severity,
                explanation,
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM document_mismatch_findings
             WHERE document_id = $1
             ORDER BY
                CASE severity WHEN 'HIGH' THEN 1 WHEN 'WARNING' THEN 2 ELSE 3 END,
                created_at ASC`,
            [documentId]
        );

        res.json({
            documentId,
            studentId: docRes.rows[0].studentId,
            candidateFields: Object.values(candidateFields),
            findings: findingsRes.rows,
        });
    } catch (error) {
        console.error("Error fetching document findings:", error);
        res.status(500).json({
            message: "Could not fetch document mismatch findings",
            error: error.message,
        });
    }
});

// GET /api/students/:studentId/document-findings - Retrieve all document findings for a student
app.get("/api/students/:studentId/document-findings", async (req, res) => {
    const studentId = req.params.studentId ? String(req.params.studentId).trim() : "";
    if (!studentId) {
        return res.status(400).json({ message: "Missing student ID parameter" });
    }

    try {
        const result = await pool.query(
            `SELECT
                id,
                document_id AS "documentId",
                student_id AS "studentId",
                field_name AS "fieldName",
                field_label AS "fieldLabel",
                document_value AS "documentValue",
                database_value AS "databaseValue",
                raw_evidence AS "rawEvidence",
                finding_type AS "findingType",
                severity,
                explanation,
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM document_mismatch_findings
             WHERE student_id = $1
             ORDER BY created_at DESC, id ASC`,
            [studentId]
        );

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching student document findings:", error);
        res.status(500).json({
            message: "Could not fetch document findings for student",
            error: error.message,
        });
    }
});

// PATCH /api/findings/:id/status - Update Mismatch Finding Review Status
const handleUpdateFindingStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["OPEN", "RESOLVED", "DISMISSED"];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            message: `Invalid status '${status}'. Allowed statuses: ${allowedStatuses.join(", ")}`,
        });
    }

    try {
        const result = await pool.query(
            `UPDATE document_mismatch_findings
             SET status = $1,
                 updated_at = NOW()
             WHERE id = $2
             RETURNING
                id,
                document_id AS "documentId",
                student_id AS "studentId",
                field_name AS "fieldName",
                field_label AS "fieldLabel",
                document_value AS "documentValue",
                database_value AS "databaseValue",
                raw_evidence AS "rawEvidence",
                finding_type AS "findingType",
                severity,
                explanation,
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt"`,
            [status, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                message: `Document mismatch finding with ID '${id}' not found`,
            });
        }

        res.json({
            message: `Finding status updated to '${status}' successfully`,
            finding: result.rows[0],
        });
    } catch (error) {
        console.error("Error updating finding status:", error);
        res.status(500).json({
            message: "Could not update finding status",
            error: error.message,
        });
    }
};

app.patch("/api/findings/:id/status", handleUpdateFindingStatus);
app.patch("/api/document-findings/:id/status", handleUpdateFindingStatus);

// ==========================================
// Phase 1: Rule-Based Mismatch Detection Engine
// ==========================================

async function runVerificationEngine(dbPool) {
    const issues = [];

    // --- Rule 1: Duplicate Synthetic APAAR IDs Detection ---
    // Detect identical synthetic APAAR IDs across different student records (including across different institutions)
    const dupeRes = await dbPool.query(`
        SELECT 
            s1.id AS s1_id,
            s1.full_name AS s1_name,
            s1.apaar_test_id,
            s1.institution_id AS s1_inst_id,
            s1.institution_name AS s1_inst_name,
            s1.programme_name AS s1_prog_name,
            s2.id AS s2_id,
            s2.full_name AS s2_name,
            s2.institution_id AS s2_inst_id,
            s2.institution_name AS s2_inst_name
        FROM students s1
        JOIN students s2 ON s1.apaar_test_id = s2.apaar_test_id AND s1.id != s2.id
        WHERE s1.apaar_test_id IS NOT NULL AND TRIM(s1.apaar_test_id) != ''
        ORDER BY s1.id
    `);

    for (const row of dupeRes.rows) {
        const isCrossInstitution = row.s1_inst_id !== row.s2_inst_id;
        const reason = isCrossInstitution
            ? `Synthetic APAAR ID collision detected with student ${row.s2_name} (${row.s2_id}) across different institution (${row.s2_inst_name || row.s2_inst_id}).`
            : `Synthetic APAAR ID collision detected with student ${row.s2_name} (${row.s2_id}) at the same institution.`;

        issues.push({
            id: `ISS-DUP-${row.s1_id}`,
            recordId: row.s1_id,
            studentName: row.s1_name,
            apaarTestId: row.apaar_test_id,
            institutionId: row.s1_inst_id,
            institutionName: row.s1_inst_name,
            programmeName: row.s1_prog_name,
            issueType: "DUPLICATE_RECORD",
            severity: "HIGH",
            reason,
            recommendedAction: "Trigger APAAR deduplication review to re-verify enrolment documents and regenerate test registry ID.",
            status: "OPEN",
        });

        // Flag student's status if not already rejected, resolved, or dismissed
        await dbPool.query(
            `UPDATE students
             SET validation_status = 'REQUIRES_REVIEW',
                 discrepancy_note = CASE
                     WHEN discrepancy_note IS NULL OR discrepancy_note = ''
                     THEN $1
                     ELSE discrepancy_note
                 END,
                 last_updated = NOW()
             WHERE id = $2 
               AND validation_status IN ('VALIDATED', 'PENDING')
               AND NOT EXISTS (
                   SELECT 1 FROM validation_issues 
                   WHERE id = $3 AND status IN ('RESOLVED', 'DISMISSED')
               )`,
            [reason, row.s1_id, `ISS-DUP-${row.s1_id}`]
        );
    }

    // --- Rule 2: Missing Mandatory Fields & Invalid Academic Year / Semester Values ---
    const studentCheckRes = await dbPool.query(`
        SELECT 
            id, full_name, apaar_test_id, institution_id, institution_name,
            programme_name, academic_year, semester, validation_status
        FROM students
        ORDER BY id
    `);

    for (const s of studentCheckRes.rows) {
        // Missing Full Name
        if (!s.full_name || !s.full_name.trim()) {
            issues.push({
                id: `ISS-MISSING-NAME-${s.id}`,
                recordId: s.id,
                studentName: s.full_name || "(Missing Name)",
                apaarTestId: s.apaar_test_id || "",
                institutionId: s.institution_id || "",
                institutionName: s.institution_name || "",
                programmeName: s.programme_name || "",
                issueType: "MISSING_FIELD",
                severity: "HIGH",
                reason: `Mandatory student legal full name is omitted in registry record ${s.id}.`,
                recommendedAction: "Audit institutional admission roster and record student legal name.",
                status: "OPEN",
            });
        }

        // Missing or Malformed Synthetic APAAR ID
        if (!s.apaar_test_id || !s.apaar_test_id.trim()) {
            issues.push({
                id: `ISS-MISSING-APAAR-${s.id}`,
                recordId: s.id,
                studentName: s.full_name,
                apaarTestId: "(Missing)",
                institutionId: s.institution_id || "",
                institutionName: s.institution_name || "",
                programmeName: s.programme_name || "",
                issueType: "MISSING_FIELD",
                severity: "HIGH",
                reason: `Mandatory 12-digit synthetic APAAR identifier is missing for ${s.full_name} (${s.id}).`,
                recommendedAction: "Request institute nodal registrar to link verified 12-digit APAAR.",
                status: "OPEN",
            });
        } else if (!/^\d{4}-\d{4}-\d{4}$/.test(s.apaar_test_id.trim())) {
            issues.push({
                id: `ISS-INVALID-APAAR-${s.id}`,
                recordId: s.id,
                studentName: s.full_name,
                apaarTestId: s.apaar_test_id,
                institutionId: s.institution_id || "",
                institutionName: s.institution_name || "",
                programmeName: s.programme_name || "",
                issueType: "INVALID_FORMAT",
                severity: "MEDIUM",
                reason: `Synthetic APAAR ID "${s.apaar_test_id}" violates 12-digit standard specification (NNNN-NNNN-NNNN).`,
                recommendedAction: "Apply format correction to replace alphanumeric typo with verified numeric sequence.",
                status: "OPEN",
            });
        }

        // Invalid Academic Year (expected format YYYY-YYYY, e.g. 2024-2025)
        if (!s.academic_year || !/^\d{4}-\d{4}$/.test(s.academic_year.trim())) {
            issues.push({
                id: `ISS-INVALID-YEAR-${s.id}`,
                recordId: s.id,
                studentName: s.full_name,
                apaarTestId: s.apaar_test_id || "",
                institutionId: s.institution_id || "",
                institutionName: s.institution_name || "",
                programmeName: s.programme_name || "",
                issueType: "INVALID_FORMAT",
                severity: "MEDIUM",
                reason: `Academic year "${s.academic_year || '(Empty)'}" is invalid or omitted. Must follow session format YYYY-YYYY (e.g. 2024-2025).`,
                recommendedAction: "Correct student enrolment academic year to valid session format.",
                status: "OPEN",
            });
        }

        // Invalid or Missing Semester (valid range 1 to 12)
        if (s.semester === null || s.semester === undefined || s.semester < 1 || s.semester > 12) {
            issues.push({
                id: `ISS-INVALID-SEM-${s.id}`,
                recordId: s.id,
                studentName: s.full_name,
                apaarTestId: s.apaar_test_id || "",
                institutionId: s.institution_id || "",
                institutionName: s.institution_name || "",
                programmeName: s.programme_name || "",
                issueType: "INVALID_FORMAT",
                severity: "LOW",
                reason: `Semester value "${s.semester !== null ? s.semester : '(Empty)'}" is missing or outside valid academic range (1-12).`,
                recommendedAction: "Verify curriculum cohort and record valid active semester (1-12).",
                status: "OPEN",
            });
        }
    }

    // --- Rule 3: Programme Enrolment Exceeding Approved Intake (Actual DB Records) ---
    const intakeCheckRes = await dbPool.query(`
        SELECT 
            p.institution_id,
            i.name AS institution_name,
            p.programme_id,
            p.programme_name,
            p.approved_intake,
            p.reported_enrolment,
            COALESCE(sc.student_count, 0) AS actual_student_count
        FROM programmes p
        JOIN institutions i ON i.id = p.institution_id
        LEFT JOIN (
            SELECT 
                institution_id,
                COALESCE(programme_id, '') AS programme_id,
                COALESCE(programme_name, '') AS programme_name,
                COUNT(*)::int AS student_count
            FROM students
            GROUP BY institution_id, programme_id, programme_name
        ) sc ON sc.institution_id = p.institution_id AND (sc.programme_id = p.programme_id OR sc.programme_name = p.programme_name)
        ORDER BY p.institution_id, p.programme_id
    `);

    for (const p of intakeCheckRes.rows) {
        const totalEnrolled = Math.max(p.actual_student_count, p.reported_enrolment);
        if (totalEnrolled > p.approved_intake) {
            const excess = totalEnrolled - p.approved_intake;

            const stuRes = await dbPool.query(
                `SELECT id, full_name, apaar_test_id FROM students 
                 WHERE institution_id = $1 AND (programme_id = $2 OR programme_name = $3)
                 ORDER BY last_updated DESC LIMIT 1`,
                [p.institution_id, p.programme_id, p.programme_name]
            );
            const stu = stuRes.rows[0];

            issues.push({
                id: `ISS-INTAKE-${p.institution_id}-${p.programme_id}`,
                recordId: stu ? stu.id : `BATCH-${p.institution_id}-${p.programme_id}`,
                studentName: stu ? stu.full_name : `${p.programme_name} Enrolment Batch`,
                apaarTestId: stu ? stu.apaar_test_id : "BATCH-AUDIT",
                institutionId: p.institution_id,
                institutionName: p.institution_name,
                programmeName: p.programme_name,
                issueType: "INTAKE_DISCREPANCY",
                severity: "HIGH",
                reason: `Reported batch enrolment of ${totalEnrolled} students exceeds AICTE approved intake ceiling of ${p.approved_intake} seats by +${excess} in ${p.programme_name} at ${p.institution_name}.`,
                recommendedAction: "Audit institute admission ledger to flag non-sanctioned seats or verify supernumerary quota approval.",
                status: "OPEN",
            });
        }
    }

    // --- Persist Issues into PostgreSQL (Preserving any admin-resolved status) ---
    for (const iss of issues) {
        await dbPool.query(
            `INSERT INTO validation_issues (
                id, record_id, student_name, apaar_test_id,
                institution_id, institution_name, programme_name,
                issue_type, severity, reason, recommended_action, status, detected_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            ON CONFLICT (id) DO UPDATE SET
                student_name = EXCLUDED.student_name,
                apaar_test_id = EXCLUDED.apaar_test_id,
                institution_id = EXCLUDED.institution_id,
                institution_name = EXCLUDED.institution_name,
                programme_name = EXCLUDED.programme_name,
                reason = EXCLUDED.reason,
                recommended_action = EXCLUDED.recommended_action
            WHERE validation_issues.status = 'OPEN'`,
            [
                iss.id,
                iss.recordId,
                iss.studentName,
                iss.apaarTestId,
                iss.institutionId,
                iss.institutionName,
                iss.programmeName,
                iss.issueType,
                iss.severity,
                iss.reason,
                iss.recommendedAction,
                iss.status,
            ]
        );
    }

    return issues;
}

// GET /api/issues - Return all validation issues from PostgreSQL
app.get("/api/issues", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                id,
                record_id AS "recordId",
                student_name AS "studentName",
                apaar_test_id AS "apaarTestId",
                institution_id AS "institutionId",
                institution_name AS "institutionName",
                programme_name AS "programmeName",
                issue_type AS "issueType",
                severity,
                reason,
                recommended_action AS "recommendedAction",
                status,
                detected_at AS "detectedAt"
            FROM validation_issues
            ORDER BY detected_at DESC, id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching validation issues:", error);
        res.status(500).json({ message: "Could not fetch validation issues", error: error.message });
    }
});

// PATCH /api/issues/:id/status - Resolve or dismiss validation issue and update linked student
app.patch("/api/issues/:id/status", async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["OPEN", "RESOLVED", "DISMISSED"];
    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
            message: `Invalid status '${status}'. Allowed statuses: ${allowedStatuses.join(", ")}`,
        });
    }

    try {
        const result = await pool.query(
            `UPDATE validation_issues
             SET status = $1
             WHERE id = $2
             RETURNING
                id,
                record_id AS "recordId",
                student_name AS "studentName",
                apaar_test_id AS "apaarTestId",
                institution_id AS "institutionId",
                institution_name AS "institutionName",
                programme_name AS "programmeName",
                issue_type AS "issueType",
                severity,
                reason,
                recommended_action AS "recommendedAction",
                status,
                detected_at AS "detectedAt"`,
            [status, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ message: `Validation issue '${id}' not found` });
        }

        const updatedIssue = result.rows[0];
        let updatedStudent = null;

        // If marked RESOLVED, update associated student record in PostgreSQL to VALIDATED
        if (status === "RESOLVED" && updatedIssue.recordId) {
            const stuUpdate = await pool.query(
                `UPDATE students
                 SET validation_status = 'VALIDATED',
                     discrepancy_note = 'Issue resolved by administrator review.',
                     last_updated = NOW()
                 WHERE id = $1
                 RETURNING
                    id,
                    apaar_test_id AS "apaarTestId",
                    full_name AS "fullName",
                    gender,
                    dob,
                    category,
                    institution_id AS "institutionId",
                    institution_name AS "institutionName",
                    programme_id AS "programmeId",
                    programme_name AS "programmeName",
                    academic_year AS "academicYear",
                    semester,
                    admission_quota AS "admissionQuota",
                    validation_status AS "validationStatus",
                    discrepancy_note AS "discrepancyNote",
                    last_updated AS "lastUpdated"`,
                [updatedIssue.recordId]
            );
            if (stuUpdate.rowCount > 0) {
                updatedStudent = stuUpdate.rows[0];
            }
        }

        res.json({
            message: `Validation issue '${id}' marked as ${status}`,
            issue: updatedIssue,
            student: updatedStudent,
        });
    } catch (error) {
        console.error("Error updating issue status:", error);
        res.status(500).json({ message: "Could not update issue status", error: error.message });
    }
});

// POST /api/verification/scan - Trigger on-demand verification scan
app.post("/api/verification/scan", async (req, res) => {
    try {
        const issues = await runVerificationEngine(pool);
        res.json({
            message: "Verification scan completed successfully",
            detectedCount: issues.length,
        });
    } catch (error) {
        console.error("Error during verification scan:", error);
        res.status(500).json({ message: "Verification scan failed", error: error.message });
    }
});

// GET /api/institutions - Return institutions with dynamic programme enrolment aggregated from PostgreSQL
app.get("/api/institutions", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT
                i.id,
                i.aicte_code AS "aicteCode",
                i.name,
                i.state,
                i.city,
                i.type,
                i.established_year AS "establishedYear",
                i.contact_email AS "contactEmail",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'programmeId', p.programme_id,
                            'programmeName', p.programme_name,
                            'degreeType', p.degree_type,
                            'approvedIntake', p.approved_intake,
                            'reportedEnrolment', GREATEST(p.reported_enrolment, COALESCE(sc.student_count, 0)),
                            'activeBatches', p.active_batches,
                            'intakeStatus', CASE
                                WHEN GREATEST(p.reported_enrolment, COALESCE(sc.student_count, 0)) > p.approved_intake THEN 'OVER_INTAKE'
                                WHEN GREATEST(p.reported_enrolment, COALESCE(sc.student_count, 0)) < (p.approved_intake * 0.7)::int THEN 'VACANCY_WARNING'
                                ELSE 'COMPLIANT'
                            END
                        ) ORDER BY p.id
                    ) FILTER (WHERE p.id IS NOT NULL), '[]'::json
                ) AS programmes
            FROM institutions i
            LEFT JOIN programmes p ON p.institution_id = i.id
            LEFT JOIN (
                SELECT 
                    institution_id,
                    COALESCE(programme_id, '') AS programme_id,
                    COALESCE(programme_name, '') AS programme_name,
                    COUNT(*)::int AS student_count
                FROM students
                GROUP BY institution_id, programme_id, programme_name
            ) sc ON sc.institution_id = p.institution_id AND (sc.programme_id = p.programme_id OR sc.programme_name = p.programme_name)
            GROUP BY i.id
            ORDER BY i.id
        `);

        res.json(result.rows);
    } catch (error) {
        console.error("Error fetching institutions:", error);
        res.status(500).json({ message: "Could not fetch institutions", error: error.message });
    }
});

// Server bootstrap with schema assurance and idempotent demo record initialization
async function startServer() {
    try {
        // 1. Ensure students table and optional columns exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS students (
                id VARCHAR(50) PRIMARY KEY,
                apaar_test_id VARCHAR(50),
                full_name VARCHAR(150) NOT NULL,
                institution_id VARCHAR(50),
                institution_name VARCHAR(200),
                programme_id VARCHAR(50),
                programme_name VARCHAR(200),
                academic_year VARCHAR(20),
                semester INTEGER,
                admission_quota VARCHAR(100),
                validation_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
                discrepancy_note TEXT DEFAULT '',
                last_updated TIMESTAMPTZ DEFAULT NOW(),
                gender VARCHAR(50),
                dob VARCHAR(50),
                category VARCHAR(50)
            )
        `);

        // 2. Ensure institutions table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS institutions (
                id VARCHAR(50) PRIMARY KEY,
                aicte_code VARCHAR(50) NOT NULL UNIQUE,
                name VARCHAR(200) NOT NULL,
                state VARCHAR(100),
                city VARCHAR(100),
                type VARCHAR(100),
                established_year INTEGER,
                contact_email VARCHAR(150),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        `);

        // 3. Ensure programmes table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS programmes (
                id SERIAL PRIMARY KEY,
                institution_id VARCHAR(50) NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
                programme_id VARCHAR(50) NOT NULL,
                programme_name VARCHAR(200) NOT NULL,
                degree_type VARCHAR(50) NOT NULL,
                approved_intake INTEGER NOT NULL DEFAULT 60,
                reported_enrolment INTEGER NOT NULL DEFAULT 0,
                active_batches INTEGER NOT NULL DEFAULT 4,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                CONSTRAINT unique_inst_prog UNIQUE (institution_id, programme_id)
            )
        `);

        // 4. Ensure validation_issues table exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS validation_issues (
                id VARCHAR(100) PRIMARY KEY,
                record_id VARCHAR(50) NOT NULL,
                student_name VARCHAR(150),
                apaar_test_id VARCHAR(50),
                institution_id VARCHAR(50),
                institution_name VARCHAR(200),
                programme_name VARCHAR(200),
                issue_type VARCHAR(50) NOT NULL,
                severity VARCHAR(20) NOT NULL,
                reason TEXT NOT NULL,
                recommended_action TEXT,
                status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
                detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_val_issues_status ON validation_issues(status);
            CREATE INDEX IF NOT EXISTS idx_val_issues_type ON validation_issues(issue_type);
            CREATE INDEX IF NOT EXISTS idx_val_issues_record ON validation_issues(record_id);
        `);

        // 4b. Ensure student_documents table exists (Phase 2A)
        await pool.query(`
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
        `);

        // 4c. Phase 2B: Add OCR columns to student_documents if not present (safe on both fresh and existing DBs)
        await pool.query(`
            ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS extracted_text TEXT;
            ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ;
            ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS ocr_error TEXT;
            ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS page_count INTEGER DEFAULT 1;
            ALTER TABLE student_documents ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,2);
        `);

        // 4d. Phase 2C: Ensure document_mismatch_findings table exists
        await pool.query(`
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
        `);

        // 5. Seed initial demo institutions & programmes if not existing
        await pool.query(`
            INSERT INTO institutions (id, aicte_code, name, state, city, type, established_year, contact_email)
            VALUES
            ('DEMO-INST-001', 'AICTE-1-4928172', 'National Institute of Technology & Engineering, New Delhi', 'Delhi (NCT)', 'New Delhi', 'Government Autonomous', 1988, 'registrar@demo-nite-delhi.edu.in'),
            ('DEMO-INST-002', 'AICTE-1-7821943', 'Maharashtra College of Technology & Applied Research', 'Maharashtra', 'Pune', 'Government Aided', 1994, 'academic.dean@demo-mct-pune.org'),
            ('DEMO-INST-003', 'AICTE-1-3920194', 'Karnataka Institute of Advanced Technical Sciences', 'Karnataka', 'Bengaluru', 'Self-Financing Technical', 2002, 'admissions@demo-kiats-blr.ac.in'),
            ('DEMO-INST-004', 'AICTE-1-5820491', 'Tamil Nadu College of Engineering & Poly-Studies', 'Tamil Nadu', 'Coimbatore', 'Government Autonomous', 1976, 'director@demo-tnce-cbe.edu.in')
            ON CONFLICT (id) DO NOTHING;

            INSERT INTO programmes (institution_id, programme_id, programme_name, degree_type, approved_intake, reported_enrolment, active_batches)
            VALUES
            ('DEMO-INST-001', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 120, 120, 4),
            ('DEMO-INST-001', 'PROG-AI-DS', 'B.Tech - Artificial Intelligence & Data Science', 'B.Tech', 60, 65, 3),
            ('DEMO-INST-001', 'PROG-ECE', 'B.Tech - Electronics & Communication Engineering', 'B.Tech', 120, 114, 4),
            ('DEMO-INST-001', 'PROG-ME', 'B.Tech - Mechanical Engineering', 'B.Tech', 60, 38, 4),
            ('DEMO-INST-001', 'PROG-MCA', 'Master of Computer Applications (MCA)', 'MCA', 60, 60, 2),

            ('DEMO-INST-002', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 180, 180, 4),
            ('DEMO-INST-002', 'PROG-ECE', 'B.Tech - Electronics & Communication Engineering', 'B.Tech', 120, 126, 4),
            ('DEMO-INST-002', 'PROG-EE', 'B.Tech - Electrical Engineering', 'B.Tech', 60, 58, 4),
            ('DEMO-INST-002', 'PROG-CE', 'B.Tech - Civil Engineering', 'B.Tech', 60, 41, 4),

            ('DEMO-INST-003', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 240, 238, 4),
            ('DEMO-INST-003', 'PROG-AI-DS', 'B.Tech - Artificial Intelligence & Data Science', 'B.Tech', 120, 120, 3),
            ('DEMO-INST-003', 'PROG-IT', 'B.Tech - Information Technology', 'B.Tech', 120, 124, 4),
            ('DEMO-INST-003', 'PROG-MCA', 'Master of Computer Applications (MCA)', 'MCA', 60, 59, 2),

            ('DEMO-INST-004', 'PROG-CSE', 'B.Tech - Computer Science & Engineering', 'B.Tech', 120, 119, 4),
            ('DEMO-INST-004', 'PROG-ME', 'B.Tech - Mechanical Engineering', 'B.Tech', 120, 102, 4),
            ('DEMO-INST-004', 'PROG-ROBO', 'B.Tech - Robotics & Automation', 'B.Tech', 60, 60, 2)
            ON CONFLICT (institution_id, programme_id) DO NOTHING;
        `);

        // 6. Insert initial demo records ONLY if they do not already exist.
        // Existing records and their validation statuses are completely preserved.
        await pool.query(`
            INSERT INTO students (
                id, apaar_test_id, full_name, gender, dob, category,
                institution_id, institution_name,
                programme_id, programme_name,
                academic_year, semester, admission_quota,
                validation_status, discrepancy_note, last_updated
            )
            VALUES
            (
                'DEMO-STU-001', '9182-3746-5120', 'Aarav Sharma', 'Male', '2004-03-14', 'General',
                'DEMO-INST-001',
                'National Institute of Technology & Engineering, New Delhi',
                'PROG-CSE', 'B.Tech - Computer Science & Engineering',
                '2024-2025', 3, 'State Merit',
                'VALIDATED', '', NOW()
            ),
            (
                'DEMO-STU-002', '8241-9952-1403', 'Ananya Iyer', 'Female', '2005-07-22', 'General',
                'DEMO-INST-001',
                'National Institute of Technology & Engineering, New Delhi',
                'PROG-AI-DS',
                'B.Tech - Artificial Intelligence & Data Science',
                '2024-2025', 1, 'All India AICTE',
                'REQUIRES_REVIEW',
                'Institution reported enrolment exceeds sanctioned intake.',
                NOW()
            ),
            (
                'DEMO-STU-101', '9210-4819-2041', 'Aarushi Singhania', 'Female', NULL, NULL,
                'DEMO-INST-001',
                'National Institute of Technology & Engineering, New Delhi',
                'PROG-CSE',
                'B.Tech - Computer Science & Engineering',
                '2024-2025', NULL, 'State Merit',
                'REQUIRES_REVIEW', '', NOW()
            ),
            (
                'DEMO-STU-102', '8491-3820-1193', 'Devansh Joshi', 'Male', NULL, NULL,
                'DEMO-INST-001',
                'National Institute of Technology & Engineering, New Delhi',
                'PROG-CSE',
                'B.Tech - Computer Science & Engineering',
                '2024-2025', NULL, 'State Merit',
                'VALIDATED', '', NOW()
            ),
            (
                'DEMO-STU-103', '7104-9281-5520', 'Ritika Choudhary', 'Female', NULL, NULL,
                'DEMO-INST-002',
                'Maharashtra College of Technology & Applied Research',
                'PROG-ECE',
                'B.Tech - Electronics & Communication Engineering',
                '2024-2025', NULL, 'All India AICTE',
                'VALIDATED', 'Issue resolved by administrator review.', NOW()
            ),
            (
                'DEMO-STU-104', '9182-3746-5120', 'Mihir Saxena', 'Male', NULL, NULL,
                'DEMO-INST-003',
                'Karnataka Institute of Advanced Technical Sciences',
                'PROG-CSE',
                'B.Tech - Computer Science & Engineering',
                '2024-2025', NULL, 'Management',
                'REQUIRES_REVIEW', 'Issue resolved by administrator review.', NOW()
            )
            ON CONFLICT (id) DO NOTHING
        `);

        // 7. Run initial verification engine scan to detect and synchronize issues
        try {
            await runVerificationEngine(pool);
            console.log("Automated verification engine scan completed on startup.");
        } catch (scanErr) {
            console.error("Startup verification scan error:", scanErr);
        }

        const server = app.listen(PORT, () => {
            console.log(`EduVerify backend running on http://localhost:${PORT}`);
            console.log(`Connected to PostgreSQL database: ${poolConfig.database} on ${poolConfig.host}:${poolConfig.port}`);
        });

        return server;
    } catch (error) {
        console.error("Could not start backend:", error);
        await pool.end();
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = {
    app,
    pool,
    startServer,
    runVerificationEngine,
    UPLOAD_DIR,
    MAX_UPLOAD_SIZE_BYTES,
    detectVerifiedMimeType,
};
