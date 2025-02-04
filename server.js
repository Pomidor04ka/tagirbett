const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = "super_secret";
const USERS_FILE = "users.json";
const BETS_FILE = "bets.json";

// Загружаем данные
let users = fs.existsSync(USERS_FILE) ? JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) : {};
let bets = fs.existsSync(BETS_FILE) ? JSON.parse(fs.readFileSync(BETS_FILE, "utf8")) : {};

// Функции сохранения
function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveBets() {
    fs.writeFileSync(BETS_FILE, JSON.stringify(bets, null, 2));
}

// Функция расчёта коэффициентов
function calculateOdds() {
    let totalBets = Object.values(bets).reduce((sum, teamBets) => sum + Object.values(teamBets).reduce((a, b) => a + b, 0), 0);
    let odds = {};

    for (let team in bets) {
        let teamTotal = Object.values(bets[team] || {}).reduce((a, b) => a + b, 0);
        odds[team] = teamTotal > 0 ? (totalBets / teamTotal) : 1;
    }

    return odds;
}

// Регистрация
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "Введите логин и пароль" });

    if (users[username]) return res.status(400).json({ error: "Логин занят" });

    const hashedPassword = await bcrypt.hash(password, 10);
    users[username] = { password: hashedPassword, points: 1000 };
    saveUsers();

    res.json({ success: true, message: "Аккаунт создан!" });
});

// Логин
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const user = users[username];

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(400).json({ error: "Неверные данные" });
    }

    const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: "1h" });
    res.json({ success: true, token, points: user.points });
});

// Получение баланса
app.post("/get-balance", (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: "Не авторизован" });

    try {
        const { username } = jwt.verify(token, SECRET_KEY);
        if (!users[username]) return res.status(401).json({ error: "Пользователь не найден" });

        res.json({ success: true, points: users[username].points });
    } catch (error) {
        res.status(401).json({ error: "Неверный токен" });
    }
});

// Получение коэффициентов
app.get("/odds", (req, res) => {
    res.json(calculateOdds());
});

// Сделать ставку
app.post("/bet", (req, res) => {
    const { token, team, amount } = req.body;
    if (!token) return res.status(401).json({ error: "Не авторизован" });

    try {
        const { username } = jwt.verify(token, SECRET_KEY);
        if (!users[username]) return res.status(401).json({ error: "Пользователь не найден" });

        const user = users[username];
        if (user.points < amount) return res.status(400).json({ error: "Недостаточно очков" });

        user.points -= amount;
        saveUsers();

        if (!bets[team]) bets[team] = {};
        bets[team][username] = (bets[team][username] || 0) + amount;
        saveBets();

        res.json({ success: true, newPoints: user.points, odds: calculateOdds() });
    } catch (error) {
        res.status(401).json({ error: "Неверный токен" });
    }
});

// Объявить победителя
app.post("/declare-winner", (req, res) => {
    const { token, winner } = req.body;
    if (!token) return res.status(401).json({ error: "Не авторизован" });

    try {
        const { username } = jwt.verify(token, SECRET_KEY);
        if (username !== "admin") return res.status(403).json({ error: "Нет прав" });

        let odds = calculateOdds();

        if (bets[winner]) {
            for (let user in bets[winner]) {
                let betAmount = bets[winner][user];
                let winnings = betAmount * odds[winner];
                users[user].points += winnings;
            }
        }

        saveUsers();
        bets = {}; // Обнуляем ставки
        saveBets();

        res.json({ success: true, message: `Победитель: ${winner}` });
    } catch (error) {
        res.status(401).json({ error: "Неверный токен" });
    }
});

// Запуск сервера
app.listen(3000, () => console.log("Сервер запущен на порту 3000"));
