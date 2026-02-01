const express = require("express");
const path = require("path");
const app = express();
const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "routes"));

app.use(express.static(path.join(__dirname, "static")));

app.get("/", (_, res) => {
    res.render("index");
});

app.use((_, res) => {
    res.status(404).send("Chat, is this a 404?");
});

app.listen(PORT, () => {
    console.log(`Listening to port ${PORT}`);
});
