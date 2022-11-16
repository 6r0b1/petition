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
    removeUserByID,
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
    updateUserProfilesByID,
    removeSupportByID,
} = require("./db");

const handlebars = require("express-handlebars");
// ++++++++++++++ END setup modules

// ++++++++++++++ Handlebars engine
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
        res.redirect("/petition");
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
    })
        .then((result) => {
            req.session.userData = {
                id: result.rows[0].id,
                firstName: req.body.first_name,
                lastName: req.body.last_name,
                email: req.body.email,
            };
            res.redirect("/profiledata");
        })
        .catch(() => {
            console.log("here");
            formError.emailInUse = "This Email Address is already in use";
            res.render("registration", { userFeedback: formError });
            console.log(formError);
            return;
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

// Signin path ........................................................... working ... signin path
// Display login form
app.get("/signin", (req, res) => {
    res.render("signin");
});

app.post("/signin", (req, res) => {
    let formError = {
        errorReadingForm: "There was a Problem!",
    };
    let email = req.body.email;
    getPassphraseByEmail({ email }).then((hash) => {
        // display just one error messages
        console.log("beforet login");
        if (
            !hash.rows[0] ||
            !bcrypt.compareSync(req.body.password, hash.rows[0].passphrase)
        ) {
            res.render("signin", { userFeedback: formError });
            return;
        } else {
            getUserdataByEmail({ email }).then((result) => {
                console.log(result);
                req.session.userData = {
                    id: result.rows[0].id,
                    firstName: result.rows[0].firstname,
                    lastName: result.rows[0].lastname,
                };
                if (result.rows[0]?.signaturedata) {
                    req.session.userData.voted = 1;
                }
                console.log(req.session.userData);
                res.redirect("/petition");
            });
        }
    });
});

// Petition form
// after login/register send user to the form w/ f/l name filled ........ working ... sign petition
app.get("/petition", (req, res) => {
    if (!req.session.userData) {
        res.redirect("/");
        return;
    }
    if (req.session.userData.voted === 1) {
        res.redirect("/thanks");
        return;
    }
    // let formError = {
    //     errorReadingForm: "There was a Problem!",
    // };
    let userData = {
        first_name: req.session.userData.firstName,
        last_name: req.session.userData.lastName,
    };
    res.render("basic_form", { userData: userData });
});

// Petition form validation and signature display ....................... working
app.post("/petition", (req, res) => {
    if (req.session.userData.voted === 1) {
        res.redirect("/thanks");
        return;
    }
    let userData = {
        first_name: req.session.userData.firstName,
        last_name: req.session.userData.lastName,
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

// Petition summary/thank you note ...................................... working ... thank you

app.get("/thanks", (req, res) => {
    if (req.session.userData.voted !== 1) {
        res.redirect("/petition");
        return;
    }
    let supporters = {};
    getSignatureByID({ id: req.session.userData.id })
        .then((result) => {
            supporters.currentSignature = result.rows[0].signaturedata;
        })

        .then(() => getSupporters())
        .then((result) => {
            console.log(result);
            //  Create handlebars object for thank you message
            (supporters.list = result.rows),
                (supporters.amount = result.rowCount);

            // Render thanks with supporters handlebars for amount of support
            res.render("thanks", { supporters: supporters });
            supporters = {};
        });
});

// Supporters list ...........................................part 3 ..... working ... show the others ... NEED get the aliases

// need alias f/l name, users(id) to join to profile data
app.get("/supporters", (req, res) => {
    if (req.session.userData.voted !== 1) {
        res.redirect("/petition");
        return;
    }
    let supporters = {};
    getSupporters().then((result) => {
        (supporters.list = result.rows), (supporters.amount = result.rowCount);
        res.render("supporters", { supporters: supporters });
    });
});

app.get("/supporters/:city", (req, res) => {
    if (req.session.userData.voted !== 1) {
        res.redirect("/petition");
        return;
    }
    let supporters = {};
    getsupportersByCity({ city: req.params.city }).then((result) => {
        (supporters.list = result.rows), (supporters.amount = result.rowCount);
        res.render("supporters", { supporters: supporters });
    });
});

// Unsign ............................................................... working ... unsign

app.get("/unsign", (req, res) => {
    if (req.session.userData.voted !== 1) {
        res.redirect("/petition");
        return;
    }
    res.render("unsign");
});

app.post("/unsign", (req, res) => {
    let userData = {};
    if (req.session.userData.voted !== 1) {
        res.redirect("/petition");
        return;
    }
    if (req.body.waiver !== "on") {
        userData.errorReadingForm = "There was a Problem!";
        res.render("unsign", { userData: userData });
        return;
    }
    req.session.userData.voted = 0;
    removeSupportByID({ id: req.session.userData.id }).then(() => {
        res.redirect("/petition");
    });
});

// Display userdata and allow update .................................... working ... userdata ... NEED Form validation for mandatory fields, update user_profiles, unsign

app.get("/userdata", (req, res) => {
    getAllUserdataByID({ id: req.session.userData.id }).then((result) => {
        console.log(result);
        let userData = {
            first_name: result.rows[0].firstname,
            last_name: result.rows[0].lastname,
            email: result.rows[0].email,
            age: result.rows[0].age,
            city: result.rows[0].city,
            website: result.rows[0].website,
        };
        // console.log(userData);
        res.render("userdata", { userData: userData });
    });
});

app.post("/userdata", (req, res) => {
    getAllUserdataByID({ id: req.session.userData.id })
        .then((result) => {
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
            updateUsersByID(updateUsersData).then(() => {
                req.session.userData.firstName = req.body.first_name;
                req.session.userData.lastName = req.body.last_name;
            });
            let updateUserProfile = {
                user_id: req.session.userData.id,
                age: req.body.age,
                city:
                    req.body.city.charAt(0).toUpperCase() +
                    req.body.city.slice(1),
                website: req.body.website,
            };
            console.log("update date:", req.body);
            updateUserProfilesByID(updateUserProfile);
        })
        .then(() => res.redirect("/thanks"));
});

// Delete account .......................................................  ... delete account

app.get("/delete-account", (req, res) => {
    if (!req.session.userData) {
        res.redirect("/");
        return;
    }
    res.render("delete_account");
});

app.post("/delete-account", (req, res) => {
    let userData = {};
    if (!req.session.userData.id) {
        res.redirect("/");
        return;
    }
    if (req.body.waiver !== "on") {
        userData.errorReadingForm = "There was a Problem!";
        res.render("delete_account", { userData: userData });
        return;
    }
    removeUserByID({ id: req.session.userData.id });
    req.session = null;
    res.redirect("/");
});

app.get("/logout", (req, res) => {
    req.session = null;
    res.redirect("/");
});

app.listen(8080, () => {
    console.log("listening");
});
