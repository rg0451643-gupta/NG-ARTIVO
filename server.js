const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const session = require("express-session");

const app = express();
const PORT = 3000;

// ========================================
// DATABASE
// ========================================

const db = new sqlite3.Database("./database.db");

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT NOT NULL,
            city TEXT,
            business TEXT,
            service TEXT NOT NULL,
            project_details TEXT NOT NULL,
            number_of_designs TEXT,
            platform_size TEXT,
            budget TEXT,
            deadline TEXT,
            additional_notes TEXT,
            reference_file TEXT,
            status TEXT DEFAULT 'New',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

});


// ========================================
// MIDDLEWARE
// ========================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ========================================
// SESSION
// ========================================

app.use(
    session({

        secret:
            process.env.SESSION_SECRET ||
            "NG-Artivo-Secret-2026",

        resave: false,

        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: false
        }

    })
);


// ========================================
// PUBLIC FILES
// ========================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ========================================
// FILE UPLOAD
// ========================================

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(null, path.join(__dirname, "uploads"));

    },

    filename: function (req, file, cb) {

        const safeName =
            file.originalname.replace(
                /[^a-zA-Z0-9._-]/g,
                "_"
            );

        const uniqueName =
            Date.now() + "-" + safeName;

        cb(null, uniqueName);

    }

});


const upload = multer({

    storage: storage,

    limits: {
        fileSize: 10 * 1024 * 1024
    }

});


// ========================================
// REGISTER PAGE
// ========================================

app.get("/register", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "register.html"
        )
    );

});


// ========================================
// ADMIN PAGE
// ========================================

app.get("/admin", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "admin.html"
        )
    );

});


// ========================================
// CUSTOMER PROJECT REGISTER
// ========================================

app.post(
    "/register",
    upload.single("reference"),

    (req, res) => {

        const {
            name,
            email,
            phone,
            city,
            business,
            service,
            project_details,
            number_of_designs,
            platform_size,
            budget,
            deadline,
            additional_notes
        } = req.body;


        const reference_file =
            req.file
                ? req.file.filename
                : null;


        // Required fields

        if (
            !name ||
            !email ||
            !phone ||
            !service ||
            !project_details
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Please fill all required details."

            });

        }


        const sql = `

            INSERT INTO users (

                name,
                email,
                phone,
                city,
                business,
                service,
                project_details,
                number_of_designs,
                platform_size,
                budget,
                deadline,
                additional_notes,
                reference_file

            )

            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

        `;


        db.run(

            sql,

            [

                name,
                email,
                phone,
                city || null,
                business || null,
                service,
                project_details,
                number_of_designs || null,
                platform_size || null,
                budget || null,
                deadline || null,
                additional_notes || null,
                reference_file

            ],

            function (err) {

                if (err) {

                    console.error(
                        "Database error:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Registration failed. Please try again."

                    });

                }


                res.json({

                    success: true,

                    message:
                        "Project request submitted successfully!",

                    userId: this.lastID

                });

            }

        );

    }
);


// ========================================
// ADMIN LOGIN
// ========================================

app.post(
    "/admin/login",

    (req, res) => {

        const {
            password
        } = req.body;


        const adminPassword =
            process.env.ADMIN_PASSWORD;


        if (!adminPassword) {

            return res.status(500).json({

                success: false,

                message:
                    "Admin password is not configured."

            });

        }


        if (
            !password ||
            password !== adminPassword
        ) {

            return res.status(401).json({

                success: false,

                message:
                    "Invalid admin password."

            });

        }


        req.session.isAdmin = true;


        res.json({

            success: true,

            message:
                "Admin login successful."

        });

    }
);


// ========================================
// ADMIN AUTH
// ========================================

function requireAdmin(req, res, next) {

    if (
        req.session &&
        req.session.isAdmin === true
    ) {

        return next();

    }


    return res.status(401).json({

        success: false,

        message:
            "Unauthorized. Admin login required."

    });

}


// ========================================
// CHECK ADMIN LOGIN
// ========================================

app.get(
    "/admin/check",

    (req, res) => {

        res.json({

            loggedIn:
                !!(
                    req.session &&
                    req.session.isAdmin
                )

        });

    }
);


// ========================================
// GET CUSTOMER REQUESTS
// ========================================

app.get(
    "/admin/users",
    requireAdmin,

    (req, res) => {

        const sql = `

            SELECT

                id,
                name,
                email,
                phone,
                city,
                business,
                service,
                project_details,
                number_of_designs,
                platform_size,
                budget,
                deadline,
                additional_notes,
                reference_file,
                status,
                created_at

            FROM users

            ORDER BY created_at DESC

        `;


        db.all(
            sql,
            [],

            (err, rows) => {

                if (err) {

                    console.error(
                        "Database error:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Could not load project requests."

                    });

                }


                res.json({

                    success: true,

                    users: rows

                });

            }
        );

    }
);


// ========================================
// UPDATE PROJECT STATUS
// ========================================

app.post(
    "/admin/users/:id/status",
    requireAdmin,

    (req, res) => {

        const {
            status
        } = req.body;


        const allowedStatuses = [

            "New",
            "In Progress",
            "Completed",
            "Cancelled"

        ];


        if (
            !allowedStatuses.includes(status)
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Invalid status."

            });

        }


        db.run(

            `
            UPDATE users
            SET status = ?
            WHERE id = ?
            `,

            [
                status,
                req.params.id
            ],

            function (err) {

                if (err) {

                    console.error(
                        "Status update error:",
                        err
                    );

                    return res.status(500).json({

                        success: false,

                        message:
                            "Could not update status."

                    });

                }


                res.json({

                    success: true,

                    message:
                        "Status updated."

                });

            }

        );

    }
);


// ========================================
// ADMIN LOGOUT
// ========================================

app.post(
    "/admin/logout",

    (req, res) => {

        req.session.destroy(
            (err) => {

                if (err) {

                    return res.status(500).json({

                        success: false

                    });

                }


                res.json({

                    success: true

                });

            }
        );

    }
);


// ========================================
// PROTECTED REFERENCE FILE
// ========================================

app.get(
    "/admin/reference/:filename",
    requireAdmin,

    (req, res) => {

        const filename =
            path.basename(
                req.params.filename
            );


        const filePath =
            path.join(
                __dirname,
                "uploads",
                filename
            );


        res.sendFile(
            filePath,

            (err) => {

                if (err) {

                    res.status(404).send(
                        "File not found."
                    );

                }

            }
        );

    }
);


// ========================================
// START SERVER
// ========================================

app.listen(
    PORT,

    () => {

        console.log(
            `NG Artivo running at http://localhost:${PORT}`
        );

    }
);
