const express = require('express');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const router = express.Router();

// Conexión a la base de datos PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: {
        rejectUnauthorized: false, // Esto desactiva la validación del certificado SSL
    },
});

// Crear tabla `users` si no existe
const createUsersTable = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student'))
            )
        `);
        console.log('Tabla users creada/verificada.');
    } catch (err) {
        console.error('Error al crear la tabla users:', err);
    }
};

createUsersTable();

// Registro de usuarios
router.post('/register', async (req, res) => {
    const { username, password, role } = req.body;

    // Validar datos de entrada
    if (!username || !password || !['admin', 'student'].includes(role)) {
        return res.status(400).json({ message: 'Datos inválidos' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            'INSERT INTO users (username, password, role) VALUES ($1, $2, $3)',
            [username, hashedPassword, role]
        );
        res.status(200).json({ message: 'Usuario registrado con éxito' });
    } catch (err) {
        console.error('Error al registrar usuario:', err);
        res.status(500).json({ message: 'Error al registrar usuario' });
    }
});

// Login de usuarios
router.post('/login', async (req, res) => {
    const { username, password, role } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1 AND role = $2',
            [username, role]
        );
        const user = result.rows[0];

        if (!user) {
            console.log('Usuario no encontrado');
            return res.status(401).json({ message: 'Usuario no encontrado' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Contraseña incorrecta');
            return res.status(401).json({ message: 'Contraseña incorrecta' });
        }

        // Configurar sesión
        req.session.user = { id: user.id, username: user.username, role: user.role };
        console.log('Sesión configurada:', req.session.user);

        res.status(200).json({ role: user.role });
    } catch (err) {
        console.error('Error durante el inicio de sesión:', err);
        res.status(500).json({ message: 'Error durante el inicio de sesión' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err);
            return res.status(500).json({ message: 'Error al cerrar sesión' });
        }
        console.log('Sesión cerrada con éxito');
        res.status(200).json({ message: 'Sesión cerrada con éxito' });
    });
});

module.exports = router;
