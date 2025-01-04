require('dotenv').config(); // Para cargar las variables de entorno
const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const { google } = require('googleapis');
const authRoutes = require('./routes/auth'); // Importa las rutas de autenticación

const app = express();
const PORT = 3000;

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


// Middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// Configuración de sesiones
app.use(session({
    secret: 'clave-secreta', // Cambia esto por una clave segura en producción
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Cambiar a true si usas HTTPS
}));

// Middleware para proteger rutas
function ensureAuthenticated(req, res, next) {
    console.log("Verificando autenticación...");
    console.log("Sesión actual:", req.session);

    if (req.session && req.session.user) {
        console.log("Usuario autenticado:", req.session.user);
        return next();
    }
    console.log("No autenticado. Redirigiendo a /login.html");
    res.redirect('/login.html');
}

// Middleware para proteger rutas según autenticación y roles
function ensureRole(role) {
    return (req, res, next) => {
        console.log("Verificando autenticación y rol...");
        console.log("Sesión actual:", req.session);

        if (!req.session || !req.session.user) {
            console.log("No autenticado. Redirigiendo a /login.html");
            return res.redirect('/login.html');
        }

        const user = req.session.user;

        if (user.role !== role) {
            console.log(`Acceso denegado. Se requiere el rol: ${role}, pero el usuario tiene: ${user.role}`);
            return res.status(403).send('Acceso denegado.');
        }

        console.log(`Acceso permitido al rol: ${role}`);
        next();
    };
}

// Ruta inicial que redirige al login si no hay sesión
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        const { role } = req.session.user;
        console.log("Usuario autenticado, redirigiendo según rol:", role);
        res.redirect(role === 'admin' ? '/admin.html' : '/index.html');
    } else {
        console.log("Sin sesión, redirigiendo a login.html");
        res.redirect('/login.html');
    }
});

// Rutas protegidas
app.get('/index.html', ensureAuthenticated, (req, res) => {
    console.log("Accediendo a index.html");
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/admin.html', ensureRole('admin'), (req, res) => {
    console.log("Accediendo a admin.html");
    res.sendFile(path.join(__dirname, '../frontend/admin.html'));

});

app.get('/register.html', ensureRole('admin'), (req, res) => {
    console.log("Accediendo a register.html");
    res.sendFile(path.join(__dirname, '../frontend/register.html'));
    
});

// Rutas de autenticación
app.use('/auth', authRoutes);

// Conexión a la base de datos
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error al conectar la base de datos:', err);
    } else {
        console.log('Base de datos conectada.');
    }
});

// Crear las tablas requeridas
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'student'))
    )`, (err) => {
        if (err) {
            console.error('Error al crear la tabla users:', err);
        } else {
            console.log('Tabla users creada/verificada.');
        }
    });

    db.run(`CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        path TEXT NOT NULL,
        description TEXT
    )`, (err) => {
        if (err) {
            console.error('Error al crear la tabla videos:', err);
        } else {
            console.log('Tabla videos creada/verificada.');
        }
    });
});

// Configuración de almacenamiento de videos
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Ruta para subir videos a Google Drive
app.post('/upload', upload.single('video'), async (req, res) => {
    console.log("Archivo recibido:", req.file);
    console.log("Título:", req.body.title);
    console.log("Categoría:", req.body.category);

    const { title, category, description } = req.body;

    try {
        // Convertir el buffer del archivo a un flujo
        const bufferStream = new Readable();
        bufferStream.push(req.file.buffer);
        bufferStream.push(null); // Indica el fin del flujo

        // Subir el archivo directamente a Google Drive
        const response = await drive.files.create({
            requestBody: {
                name: req.file.originalname,
                parents: [process.env.GOOGLE_FOLDER_ID], // ID de la carpeta en Google Drive
            },
            media: {
                mimeType: req.file.mimetype,
                body: bufferStream, // Usar el flujo creado
            },
        });

        // Obtener el enlace público del archivo
        const fileId = response.data.id;
        await drive.permissions.create({
            fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });
        const fileLink = `https://drive.google.com/file/d/${fileId}/preview`;

        // Guardar en la base de datos
        db.run(
            'INSERT INTO videos (title, category, path, description) VALUES (?, ?, ?, ?)',
            [title, category, fileLink, description],
            (err) => {
                if (err) {
                    console.error('Error al guardar video en la base de datos:', err);
                    return res.status(500).send('Error al guardar video.');
                }
                res.status(200).send('Video subido con éxito.');
            }
        );
    } catch (err) {
        console.error('Error al subir el video a Google Drive:', err.message);
        res.status(500).send('Error al subir el video.');
    }
});


app.use(express.static(path.join(__dirname, '../frontend')));

// Ruta para obtener videos por categoría
app.get('/videos/:category', (req, res) => {
    const category = req.params.category;

    db.all('SELECT * FROM videos WHERE category = ?', [category], (err, rows) => {
        if (err) {
            console.error('Error al obtener videos:', err);
            return res.status(500).send('Error al obtener videos.');
        }
        res.json(rows);
    });
});

// Ruta de fallback
app.use((req, res) => {
    res.status(404).send('Página no encontrada.');
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
