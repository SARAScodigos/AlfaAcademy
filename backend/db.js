const { Pool } = require('pg');

// Configuración de la conexión a PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Conexión inicial
pool.connect((err) => {
    if (err) {
        console.error('Error al conectar la base de datos:', err);
    } else {
        console.log('Base de datos PostgreSQL conectada.');
    }
});

// Crear las tablas necesarias
const createTables = async () => {
    try {
        // Crear tabla 'users'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role VARCHAR(20) NOT NULL
            )
        `);
        console.log('Tabla users creada/verificada.');

        // Crear tabla 'videos'
        await pool.query(`
            CREATE TABLE IF NOT EXISTS videos (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                path TEXT NOT NULL,
                description TEXT
            )
        `);
        console.log('Tabla videos creada/verificada.');
    } catch (error) {
        console.error('Error al crear las tablas:', error);
    }
};

// Llamar a la función para crear las tablas
createTables();

// Exportar el pool para usarlo en otras partes de la aplicación
module.exports = pool;
