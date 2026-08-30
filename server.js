const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const multer = require("multer");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MONGODB CONNECTION
// ========================================

const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
    console.error("MONGODB_URI is not configured.");
} else {
    mongoose.connect(mongoURI)
        .then(() => {
            console.log("MongoDB connected successfully");
        })
        .catch((error) => {
            console.error("MongoDB connection error:", error);
        });
}


// ========================================
// USER MODEL
// ========================================

const userSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true
    },

    email: {
        type: String,
        required: true
    },

    phone: {
        type: String,
        required: true
    },

    city: String,

    business: String,

    service: {
        type: String,
        required: true
    },

    project_details: {
        type: String,
        required: true
    },

    number_of_designs: String,

    platform_size: String,

    budget: String,

    deadline: String,

    additional_notes: String,

    reference_file: String,

    status: {
        type: String,
        default: "New"
    },

    created_at: {
        type: Date,
        default: Date.now
    }

});

const User = mongoose.model("User", userSchema);


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
            secure: process.env.NODE_ENV === "production"
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

const uploadDirectory =
    path.join(__dirname, "uploads");

const storage = multer.diskStorage({

    destination: function (req, file, cb) {

        cb(null, uploadDirectory);

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

    async (req, res) => {

        try {

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


            const newUser = new User({

                name,

                email,

                phone,

                city:
                    city || null,

                business:
                    business || null,

                service,

                project_details,

                number_of_designs:
                    number_of_designs || null,

                platform_size:
                    platform_size || null,

                budget:
                    budget || null,

                deadline:
                    deadline || null,

                additional_notes:
                    additional_notes || null,

                reference_file

            });


            const savedUser =
                await newUser.save();


            res.json({

                success: true,

                message:
                    "Project request submitted successfully!",

                userId:
                    savedUser._id

            });

        } catch (error) {

            console.error(
                "Registration error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Registration failed. Please try again."

            });

        }

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

    async (req, res) => {

        try {

            const users =
                await User.find()
                    .sort({
                        created_at: -1
                    })
                    .lean();


            res.json({

                success: true,

                users

            });

        } catch (error) {

            console.error(
                "MongoDB error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Could not load project requests."

            });

        }

    }
);


// ========================================
// UPDATE PROJECT STATUS
// ========================================

app.post(
    "/admin/users/:id/status",
    requireAdmin,

    async (req, res) => {

        try {

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


            const updatedUser =
                await User.findByIdAndUpdate(

                    req.params.id,

                    {
                        status
                    },

                    {
                        new: true
                    }

                );


            if (!updatedUser) {

                return res.status(404).json({

                    success: false,

                    message:
                        "User not found."

                });

            }


            res.json({

                success: true,

                message:
                    "Status updated."

            });

        } catch (error) {

            console.error(
                "Status update error:",
                error
            );

            res.status(500).json({

                success: false,

                message:
                    "Could not update status."

            });

        }

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
            `NG Artivo running on port ${PORT}`
        );

    }
);