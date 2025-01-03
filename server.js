const express = require('express');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');

const app = express();
const PORT = 3000;

// Configuración de CORS
app.use(cors({
    origin: 'http://127.0.0.1:5500', // URL del frontend
    methods: ['GET', 'POST'],
    credentials: true,
}));

// Middleware global
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/videos', express.static(path.join(__dirname, 'public/videos')));
// Configuración de sesiones
app.use(session({
    secret: 'clave-secreta',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // Cambiar a true si usas HTTPS
}));

// Middleware para proteger rutas
function ensureAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next(); // Si el usuario está autenticado, sigue adelante
    }
    res.redirect('/login.html'); // Redirige al login si no está autenticado
}

// Redirección según el rol
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        const { role } = req.session.user;
        if (role === 'student') {
            res.redirect('/index.html');
        } else if (role === 'admin') {
            res.redirect('/admin.html');
        }
    } else {
        res.redirect('/login.html'); // Si no hay sesión, muestra el login
    }
});

// Ruta protegida para la página principal (estudiantes)
app.get('/index.html', ensureAuthenticated, (req, res) => {
    const { role } = req.session.user;
    if (role === 'student') {
        res.sendFile(path.join(__dirname, '../frontend/index.html'));
    } else {
        res.redirect('/login.html'); // Redirige si no es estudiante
    }
});

// Ruta protegida para la administración (administradores)
app.get('/admin.html', ensureAuthenticated, (req, res) => {
    const { role } = req.session.user;
    if (role === 'admin') {
        res.sendFile(path.join(__dirname, '../frontend/admin.html'));
    } else {
        res.redirect('/login.html'); // Redirige si no es administrador
    }
});

// Rutas de autenticación
app.use('/auth', authRoutes);

// Configuración de la base de datos
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error al conectar la base de datos:', err);
    } else {
        console.log('Base de datos conectada.');
    }
});

// Crear tablas si no existen
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

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            path TEXT NOT NULL,
            description TEXT
        )`, (err) => {
            if (err) {
                console.error('Error al crear/verificar la tabla videos:', err);
            } else {
                console.log('Tabla videos creada/verificada.');
            }
        });
    
        // Intentar agregar la columna description si no existe
        db.run('ALTER TABLE videos ADD COLUMN description TEXT', (err) => {
            if (err && err.message.includes('duplicate column name')) {
                console.log('La columna description ya existe.');
            } else if (!err) {
                console.log('Columna description agregada a la tabla videos.');
            }
        });
    });
});

// Configuración de almacenamiento de videos
const storage = multer.diskStorage({
    destination: 'public/videos',
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});
const upload = multer({ storage });

// Ruta protegida para subir videos
app.post('/upload', ensureAuthenticated, upload.single('video'), (req, res) => {
    const { title, category, description } = req.body;
    const videoPath = `/videos/${req.file.filename}`;

    db.run(
        'INSERT INTO videos (title, category, path, description) VALUES (?, ?, ?, ?)',
        [title, category, videoPath, description],
        (err) => {
            if (err) {
                console.error('Error al guardar video:', err);
                return res.status(500).send('Error al guardar video.');
            }
            res.status(200).send('Video subido con éxito.');
        }
    );
});

// Ruta pública para obtener videos por categoría
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

// Rutas estáticas para servir videos y frontend
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));


// Ruta de fallback
app.use((req, res) => {
    res.status(404).send('Página no encontrada');
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
