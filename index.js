const { getSupporters, addSupporter } = require("./db");

getSupporters().then((supporters) => console.log(supporters));
