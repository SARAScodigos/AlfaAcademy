const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const router = express.Router();

// Conexión a la base de datos
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Error al conectar la base de datos:', err);
    else console.log('Base de datos conectada.');
});

// Crear tabla unificada
db.run(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'student'))
    )
`);

// Registro de usuarios
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !['admin', 'student'].includes(role)) {
        return res.status(400).json({ message: 'Datos inválidos' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
        'INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
        [username, hashedPassword, role],
        (err) => {
            if (err) return res.status(500).json({ message: 'Error al registrar usuario' });
            res.status(200).json({ message: 'Usuario registrado con éxito' });
        }
    );
});

// Login de usuarios
router.post('/login', (req, res) => {
    const { username, password, role } = req.body;

    db.get('SELECT * FROM users WHERE username = ? AND role = ?', [username, role], (err, user) => {
        if (err || !user) {
            console.log("Usuario no encontrado o error:", err);
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }
        
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err || !isMatch) {
                console.log("Contraseña incorrecta");
                return res.status(401).json({ message: 'Contraseña incorrecta' });
            }

            req.session.user = { id: user.id, username: user.username, role: user.role };
            console.log("Sesión configurada:", req.session.user);

            res.status(200).json({ role: user.role });
        });
    });
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Error al cerrar sesión:", err);
            return res.status(500).json({ message: 'Error al cerrar sesión' });
        }
        console.log("Sesión cerrada con éxito");
        res.status(200).json({ message: 'Sesión cerrada con éxito' });
    });
});

module.exports = router;
