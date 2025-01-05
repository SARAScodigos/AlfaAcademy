require('dotenv').config(); // Para cargar las variables de entorno
const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { google } = require('googleapis');
const authRoutes = require('./routes/auth'); // Importa las rutas de autenticación

const app = express();
const PORT = 3000;

// Configuración de PostgreSQL
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

// Configuración de CORS
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
}));

// Middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configurar cliente OAuth2 de Google
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI // URI configurada en Google Cloud Console
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Crear servicio de Google Drive
const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Configuración de sesiones
app.use(session({
    secret: 'clave-secreta', // Cambia esto por una clave segura en producción
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Cambiar a true si usas HTTPS
}));

// Middleware para proteger rutas
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    res.redirect('/login.html');
}

// Middleware para proteger rutas según rol
function ensureRole(role) {
    return (req, res, next) => {
        if (!req.session || !req.session.user || req.session.user.role !== role) {
            return res.status(403).send('Acceso denegado.');
        }
        next();
    };
}

// Crear tablas en PostgreSQL
async function createTables() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                password TEXT NOT NULL,
                role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'student'))
            );
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS videos (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                path TEXT NOT NULL,
                description TEXT
            );
        `);
        console.log('Tablas creadas/verificadas.');
    } catch (err) {
        console.error('Error al crear tablas:', err);
    }
}

createTables();

// Ruta inicial
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        const { role } = req.session.user;
        res.redirect(role === 'admin' ? '/admin.html' : '/index.html');
    } else {
        res.redirect('/login.html');
    }
});

// Rutas protegidas
app.get('/index.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin.html', ensureRole('admin'), (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});


// Rutas de autenticación
app.use('/auth', authRoutes);

// Configuración de almacenamiento de videos
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta para subir videos a Google Drive
app.post('/upload', upload.single('video'), async (req, res) => {
    const { title, category, description } = req.body;

    try {
        const bufferStream = new Readable();
        bufferStream.push(req.file.buffer);
        bufferStream.push(null);

        const response = await drive.files.create({
            requestBody: {
                name: req.file.originalname,
                parents: [process.env.GOOGLE_FOLDER_ID],
            },
            media: {
                mimeType: req.file.mimetype,
                body: bufferStream,
            },
        });

        const fileId = response.data.id;
        await drive.permissions.create({
            fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });
        const fileLink = `https://drive.google.com/file/d/${fileId}/preview`;

        await pool.query(
            'INSERT INTO videos (title, category, path, description) VALUES ($1, $2, $3, $4)',
            [title, category, fileLink, description]
        );
        res.status(200).send('Video subido con éxito.');
    } catch (err) {
        console.error('Error al subir el video:', err.message);
        res.status(500).send('Error al subir el video.');
    }
});

// Ruta para obtener videos por categoría
app.get('/videos/:category', async (req, res) => {
    const category = req.params.category;

    try {
        const result = await pool.query(
            'SELECT * FROM videos WHERE category = $1',
            [category]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener videos:', err);
        res.status(500).send('Error al obtener videos.');
    }
});

// Rutas estáticas
app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta de fallback
app.use((req, res) => {
    res.status(404).send('Página no encontrada.');
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
