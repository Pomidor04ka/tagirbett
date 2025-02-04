const express = require("express");
const app = express();

app.get("/test", (req, res) => {
    res.send("Тестовый сервер работает!");
});

app.listen(3000, () => console.log("Тестовый сервер запущен на порту 3000"));