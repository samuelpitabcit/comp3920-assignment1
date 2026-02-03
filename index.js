require("dotenv").config();

const express = require("express");
const bcrypt = require("bcrypt");
const mysql = require("mysql2/promise");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 12;

//
// Set up connection to MySQL
//

const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    multipleStatements: true,
});

//
// Set up session cookies middleware
//

const store = new MongoDBStore({
    uri: process.env.MONGODB_URI,
    collection: "assignment1_sessions",
});

store.on("error", (error) => console.log(error));

app.use(
    session({
        secret: process.env.MONGODB_SESSION_SECRET,
        cookie: {
            maxAge: 1000 * 60 * 60 * 24 * 7,
            secure: process.env.NODE_ENV === "prod",
        },
        store: store,
        resave: false,
        saveUninitialized: true,
    }),
);

//
// Set up EJS and POST middleware.
//

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "routes"));
app.use(express.static(path.join(__dirname, "static")));

//
// Functions
//

/**
 * Checks the given password's strength.
 * @param {string} password
 * @returns {bool}
 */
function isPasswordStrong(password) {
    const MIN_LENGTH = 8;

    if (password < MIN_LENGTH) {
        return false;
    }

    return true;
}

/**
 * Filters clients that are not logged in.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {import("express").NextFunction} next
 */
function filterNotLoggedIn(req, res, next) {
    if (!req.session.authenticated) {
        res.status(307).redirect("/login");
        return;
    }

    next();
}

/**
 * Filters clients already logged in.
 *
 * @param {Request} req
 * @param {Response} res
 * @param {import("express").NextFunction} next
 */
function filterLoggedIn(req, res, next) {
    if (req.session.authenticated) {
        res.status(301).redirect("/account");
        return;
    }

    next();
}

//
// API Routes
//

app.post("/api/login", filterLoggedIn, async (req, res) => {
    /**
     * @typedef LoginBody
     * @property {string} username
     * @property {string} password
     */

    /** @type {LoginBody} */
    const login = req.body;

    // const [rows] = await pool
    //     .query("SELECT user_id, passwd FROM user WHERE username = ?", [login.username])
    //     .catch((reason) => {
    //         res.status(500).send(reason);
    //     });

    const [rows] = await pool
        .query(`SELECT user_id, passwd FROM user WHERE username = '${login.username}'"`)
        .catch((reason) => res.status(500).send(reason));

    for (const { user_id, passwd } of rows) {
        if (bcrypt.compareSync(login.password, passwd)) {
            req.session.authenticated = true;
            req.session.username = login.username;
            req.session.userId = user_id;
            res.status(301).redirect("/account");
            return;
        }
    }

    res.status(401).render("login", { message: "Username and password do not match!" });
});

app.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) console.log(err);
        res.status(301).redirect("/");
    });
});

app.post("/api/register", filterLoggedIn, async (req, res) => {
    /**
     * @typedef RegisterBody
     * @property {string} username
     * @property {string} password
     */

    /** @type {RegisterBody} */
    const { username, password } = req.body;

    if (!isPasswordStrong(password)) {
        res.status(401).send("Invalid password!");
        return;
    }

    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);

    await pool
        // .query("INSERT INTO user (username, passwd) VALUES (?, ?)", [username, passwordHash])
        .query(`INSERT INTO user (username, passwd) VALUES ('${username}', '${passwordHash}')`)
        .then(([results]) => {
            req.session.authenticated = true;
            req.session.username = username;
            req.session.userId = results.insertId;

            res.status(301).redirect("/account");
        })
        .catch((reason) => res.status(401).send("Failed to create an account | " + reason));
});

//
// Page Routes
//

app.get("/", (_, res) => {
    res.render("index");
});

app.get("/login", filterLoggedIn, (req, res) => {
    res.render("login");
});

app.get("/register", filterLoggedIn, (req, res) => {
    res.render("register");
});

app.get("/account", filterNotLoggedIn, (req, res) => {
    res.render("account", { username: req.session.username });
});

app.use((_, res) => {
    res.status(404).send("Chat, is this a 404?");
});

app.listen(PORT, () => {
    console.log(`Listening to port ${PORT}`);
});
