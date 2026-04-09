const mongoose = require("mongoose");
const { TECH_ACADEMIES } = require("./data_academics_technical");

mongoose.connect("mongodb://127.0.0.1:27017/eliteforge");

const Academy = mongoose.model("Academy", {
    name: String,
    skill: String,
    district: String,
    category: String
});

async function insert() {
    const data = TECH_ACADEMIES.map(a => ({
        ...a,
        category: "technical"
    }));

    await Academy.insertMany(data);
    console.log("Inserted Technical Academies");
    process.exit();
}

insert();