// ++++++++++++++ Setup modules
const path = require("path");
const { join } = require("path");
const express = require("express");
const app = express();
const cookieSession = require("cookie-session");
const bcrypt = require("bcryptjs");
const checkMail = require("email-validator");

require("dotenv").config();
const { PASSPHRASE } = process.env;

const {
    getSupporters,
    addSupporter,
    getSignatureByID,
    addUser,
    getUserdataByEmail,
    getUserdataByID,
    createProfile,
    updateUserVoted,
    getsupportersByCity,
    getPassphraseByEmail,
    updateUsersByID,
    getAllUserdataByID,
    getAllUserdataByEmail,
} = require("./db");

const handlebars = require("express-handlebars");

//  ++++++++++++++ END setup modules

//  ++++++++++++++ Handlebars setup

let supporters = {};

// Handlebars engine
app.engine("handlebars", handlebars.engine());
app.set("view engine", "handlebars");
// ++++++++++++++ END Handlebars setup

// ++++++++++++++ Middleware
// Session cookie setup
app.use(
    cookieSession({
        secret: `${PASSPHRASE}`,
        maxAge: 1000 * 60 * 60 * 24 * 14,
    })
);

// Parse URL querys
app.use(express.urlencoded());

//  Cookies
app.use(require("cookie-parser")());

// Serve dependencies
app.use(express.static(path.join(__dirname, "public")));
// ++++++++++++++ END middleware

// ........................................................................ routs

// On arrival sent users to signup/signin depending on session cookie ... working ... get /
app.get("/", (req, res) => {
    if (req.session.userData) {
        res.redirect("/signin");
        return;
    }
    res.redirect("/registration");
});

// Registration path .................................................... working ... registration path
// Display registration form
app.get("/registration", (req, res) => {
    let formError = {};
    res.render("registration", { userFeedback: formError });
});

// Form validation and user creation .................................... working
app.post("/registration", (req, res) => {
    // display different error messages
    let formError = {};
    if (
        !req.body.first_name ||
        !req.body.last_name ||
        !req.body.email ||
        !checkMail.validate(req.body.email) ||
        !req.body.password ||
        !req.body.password_rep ||
        req.body.password !== req.body.password_rep
    ) {
        formError.errorReadingForm = "There was a Problem!";
        if (!req.body.first_name) {
            formError.firstName = "Pls. give a First Name";
        }
        if (!req.body.last_name) {
            formError.lastName = "Pls. give a Second Name";
        }
        if (!req.body.email) {
            formError.email = "Pls. give a Email Address";
        }
        if (!checkMail.validate(req.body.email)) {
            formError.emailfail = "Not a Email Address";
        }
        if (!req.body.password) {
            formError.password = "Pls. give a Password";
        }
        if (!req.body.password_rep) {
            formError.passwordRep = "Pls. repeat your Password";
        }
        if (req.body.password !== req.body.password_rep) {
            formError.passwordMatch = "Your Passwords do not match";
        }
        res.render("registration", { userFeedback: formError });
        return;
    }
    // Hash/Salt Password
    const password = req.body.password;
    const salt = bcrypt.genSaltSync();
    const hash = bcrypt.hashSync(password, salt);

    addUser({
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        email: req.body.email,
        passphrase: hash,
        timeStamp: new Date(),
    }).then((result) => {
        req.session.userData = {
            id: result.rows[0].id,
            firstName: req.body.first_name,
            lastName: req.body.last_name,
            email: req.body.email,
        };
        res.redirect("/profiledata");
    });
});

// Generate profile ..................................................... working ... finish profile path
// Prefil w/ placeholders if profile exists
app.get("/profiledata", (req, res) => {
    if (req.session.userData) {
        res.render("profiledata");
        return;
    }
    res.redirect("/registration");
});

app.post("/profiledata", (req, res) => {
    // let userID = req.session.id;
    createProfile({
        userID: req.session.userData.id,
        age: req.body.age,
        city: req.body.city.charAt(0).toUpperCase() + req.body.city.slice(1),
        website: req.body.website,
        timeStamp: new Date(),
    }).then(() => res.redirect("/petition"));
});

// Login path ........................................................... working ... login path
// Display login form
app.get("/signin", (req, res) => {
    res.render("signin");
});

app.post("/signin", (req, res) => {
    let formError = {
        errorReadingForm: "There was a Problem!",
    };
    let email = req.body.email;
    getPassphraseAndIDByEmail({ email: req.body.email }).then((hash) => {
        if (
            !hash.rows[0] ||
            !bcrypt.compareSync(req.body.password, hash.rows[0].passphrase)
        ) {
            res.render("signin", { userFeedback: formError });
            return;
        }
        req.session.userdata.id = hash.rows[0].id;
    });
    getAllUserdataByID({ id: req.session.userdata.id }).then((result) => {
        req.session.userData = {
            firstname: result.rows[0].firstname,
            lastname: result.rows[0].lastname,
        };
        if (result.rows[0]?.signaturedata) {
            req.session.userData.voted = 1;
        }
        console.log(req.session.userData);
        res.redirect("/petition");
    });
});

// Petition form
// after login/register send user to the form w/ f/l name filled ........ working ... sign petition
app.get("/petition", (req, res) => {
    if (req.session.userData.voted === 1) {
        res.redirect("/thanks");
        return;
    }
    let formError = {
        errorReadingForm: "There was a Problem!",
    };
    let userData = {
        first_name: req.session.userData.firstName,
        last_name: req.session.userData.lastName,
    };
    res.render("basic_form", { userData: userData });
});

// Petition form validation and signature display ....................... working
app.post("/petition", (req, res) => {
    let userData = {
        first_name: req.session.userData.firstname,
        last_name: req.session.userData.lastname,
        userID: req.session.userData.id,
    };
    // let signature;
    // Form validation w/ error message render
    if (
        !req.body.first_name ||
        !req.body.last_name ||
        !req.body.signature ||
        req.body.waiver !== "on"
    ) {
        userData.errorReadingForm = "There was a Problem!";
        res.render("basic_form", { userData: userData });
        return;
    }

    // all good? call add supporter with form data
    // once DB is finished: make it so you can call addSupporter with res.body
    addSupporter({
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        signaturedata: req.body.signature,
        user_id: req.session.userData.id,
        timeStamp: new Date(),
    })
        .then((result) => {
            req.session.signatureId = result.rows[0].id;
            req.session.userData.voted = 1;
        })
        .then(() => {
            res.redirect("/thanks");
        });
});

app.get("/thanks", (req, res) => {
    getSignatureByID({ id: req.session.userData.id })
        .then((result) => {
            supporters.currentSignature = result.rows[0].signaturedata;
        })

        .then(() => getSupporters())
        .then((result) => {
            //  Create handlebars object for thank you message
            (supporters.list = result.rows),
                (supporters.amount = result.rowCount);

            // Render thanks with supporters handlebars for amount of support
            res.render("thanks", { supporters: supporters });
            supporters = {};
        });
});

app.get("/userdata", (req, res) => {
    console.log(req.session);
    getAllUserdataByID({ id: req.session.userData.id }).then((result) => {
        let userData = {
            first_name: result.rows[0].firstname,
            last_name: result.rows[0].lastname,
            email: result.rows[0].email,
            age: result.rows[0].age,
            city: result.rows[0].city,
            website: result.rows[0].website,
        };
        console.log(userData);
        res.render("userdata", { userData: userData });
    });
});

app.post("/userdata", (req, res) => {
    getAllUserdataByID({ id: req.session.userData.id }).then((result) => {
        let updateUsersData = {
            firstName: req.body.first_name,
            lastName: req.body.last_name,
            email: req.body.email,
        };
        if (req.body.password === "") {
            updateUsersData.passphrase = result.rows[0].passphrase;
        } else {
            const password = req.body.password;
            const salt = bcrypt.genSaltSync();
            const hash = bcrypt.hashSync(password, salt);
            updateUsersData.passphrase = hash;
        }
        updateUsersData.userID = req.session.userData.id;
        console.log(updateUsersData);
        updateUsersByID(updateUsersData).then(console.log("here"));
    });

    // updataUserProfile({ updateData });
});

// Supporters list ...........................................part 3 ..... working ... show the others ... NEED get the aliases
// Let users have a look at all other supporters

// need alias f/l name, users(id) to join to profile data
app.get("/supporters", (req, res) => {
    getSupporters().then((result) => {
        (supporters.list = result.rows), (supporters.amount = result.rowCount);
        res.render("supporters", { supporters: supporters });
    });
});

app.get("/supporters/:city", (req, res) => {
    getsupportersByCity({ city: req.params.city }).then((result) => {
        (supporters.list = result.rows), (supporters.amount = result.rowCount);
        res.render("supporters", { supporters: supporters });
    });
});

app.listen(8080, () => {
    console.log("listening");
});
