// ++++++++++++++ Setup modules

const spicedPg = require("spiced-pg");
require("dotenv").config();

const { DB_USER, DB_PASS, DB_DATABASE, DATABASE_URL } = process.env;
const db = spicedPg(
    // `postgres:${DB_USER}:${DB_PASS}@localhost:5432/${DB_DATABASE}`
    `${DATABASE_URL}`
);

//  ++++++++++++++ END setup modules

// Write entry
// Signing a petition
function addSupporter({
    firstName,
    lastName,
    signaturedata,
    user_id,
    timeStamp,
}) {
    return db.query(
        `INSERT INTO petition (firstName, lastName, signaturedata, user_id, timeStamp)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
        [firstName, lastName, signaturedata, user_id, timeStamp]
    );
    // .then((result) => console.log(result[0].id));
}

// Create a user
function addUser({ firstName, lastName, email, passphrase, timeStamp }) {
    return db.query(
        `INSERT INTO users (firstName, lastName, email, passphrase, timeStamp)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
        [firstName, lastName, email, passphrase, timeStamp]
    );
}

// Create a profile
function createProfile({ userID, age, city, website, timeStamp }) {
    return db.query(
        `INSERT INTO user_profiles (user_id, age, city, website, timeStamp)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *`,
        [userID, age, city, website, timeStamp]
    );
}

// Get entries
// ALL supporters
function getSupporters() {
    return db.query(
        "SELECT users.firstname, users.lastname, user_profiles.age, user_profiles.city, user_profiles.website FROM users JOIN user_profiles ON users.id = user_profiles.user_id"
    );
    // .then((result) => console.log(result));
}

//Supporters by city
function getsupportersByCity({ city }) {
    return db.query(
        `SELECT users.firstname, users.lastname, user_profiles.age, user_profiles.city, user_profiles.website FROM users JOIN user_profiles ON users.id = user_profiles.user_id WHERE city=$1`,
        [city]
    );
}

// ONE supporter by id
function getSignatureByID({ id }) {
    return db.query(
        `SELECT petition.signatureData FROM petition WHERE user_id=$1`,
        [id]
    );
}

// update User by ID
function updateUserVoted({ id }) {
    return db.query(`UPDATE users SET voted=1 WHERE id=$1`, [id]);
}

// ONE user by email
function getPassphraseByEmail({ email }) {
    return db.query(`SELECT passphrase FROM users WHERE email=$1`, [email]);
}

// this fails when signature data is empty. why???
function getAllUserdataByID({ id }) {
    return db.query(
        `SELECT users.id, users.firstname, users.lastname, users.email, users.passphrase, user_profiles.age, user_profiles.city, user_profiles.website, petition.signatureData FROM users FULL OUTER JOIN user_profiles ON users.id = user_profiles.user_id FULL OUTER JOIN petition ON users.id = petition.user_id WHERE users.id=$1`,
        [id]
    );
}
function getUserdataByEmail({ email }) {
    return db.query(
        `SELECT users.id, users.firstname, users.lastname, petition.signatureData FROM users FULL OUTER JOIN petition ON users.id = petition.user_id WHERE users.email=$1`,
        [email]
    );
}

// ONE user by id
function getUserdataByID({ id }) {
    return db.query(`SELECT * FROM users WHERE id=$1`, [id]);
}

function updateUsersByID({ firstName, lastName, email, passphrase, userID }) {
    return db.query(
        `UPDATE users SET firstname = $1, lastname = $2, email = $3, passphrase = $4 WHERE id = $5`,
        [firstName, lastName, email, passphrase, userID]
    );
}

function updateUserProfilesByID({ user_id, age, city, website }) {
    return db.query(
        `INSERT INTO user_profiles (user_id, age, city, website) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO UPDATE SET age=$2, city=$3, website=$4`,
        [user_id, age, city, website]
    );
}

function removeSupportByID({ id }) {
    return db.query(`DELETE FROM petition WHERE user_id=$1`, [id]);
}

function removeUserByID({ id }) {
    db.query(`DELETE FROM petition WHERE user_id=$1`, [id]);
    db.query(`DELETE FROM user_profiles WHERE user_id=$1`, [id]);
    db.query(`DELETE FROM users WHERE id=$1`, [id]);
    return;
}

// Export

module.exports = {
    removeUserByID,
    updateUserProfilesByID,
    getSupporters,
    addSupporter,
    getSignatureByID,
    addUser,
    getAllUserdataByID,
    getUserdataByID,
    createProfile,
    updateUserVoted,
    getsupportersByCity,
    getPassphraseByEmail,
    updateUsersByID,
    getUserdataByEmail,
    removeSupportByID,
};
