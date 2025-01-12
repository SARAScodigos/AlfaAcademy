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

        // Crear tabla active_students
        await pool.query(`
            CREATE TABLE IF NOT EXISTS active_students (
                id SERIAL PRIMARY KEY,
                count INTEGER NOT NULL DEFAULT 30
            );
        `);

        // Inserción inicial en active_students si no existe un registro
        await pool.query(`
            INSERT INTO active_students (count) 
            SELECT 30 
            WHERE NOT EXISTS (SELECT 1 FROM active_students WHERE id = 1);
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

app.get('/curso.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/curso.html'));
});

app.get('/simulacros.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/simulacros.html'));
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

// Ruta para obtener el número actual de estudiantes activos
app.get('/api/active-students', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT count FROM active_students WHERE id = 1');
        res.json({ count: rows[0]?.count || 30 });
    } catch (error) {
        console.error('Error al obtener estudiantes activos:', error);
        res.status(500).send('Error al obtener estudiantes activos');
    }
});

async function updateActiveStudents() {
    try {
        const currentHour = new Date().getHours();
        let min, max;

        // Determina los rangos basados en la hora del día
        if (currentHour >= 6 && currentHour < 12) { // Mañana
            min = 30;
            max = 50;
        } else if (currentHour >= 12 && currentHour < 18) { // Tarde
            min = 50;
            max = 70;
        } else { // Noche
            min = 60;
            max = 90;
        }

        // Obtiene el valor actual de la base de datos
        const { rows } = await pool.query('SELECT count FROM active_students WHERE id = 1');
        const currentCount = rows[0]?.count || min;

        // Genera un nuevo valor cercano al actual (±3)
        const newCount = Math.max(min, Math.min(max, currentCount + (Math.random() < 0.5 ? -3 : 3)));

        // Actualiza el valor en la base de datos
        await pool.query('UPDATE active_students SET count = $1 WHERE id = 1', [newCount]);
        console.log(`Estudiantes activos actualizados: ${newCount}`);
    } catch (error) {
        console.error('Error al actualizar estudiantes activos:', error);
    }
}

// Actualiza el número cada 3 minutos
setInterval(updateActiveStudents, 36000);
updateActiveStudents();


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
