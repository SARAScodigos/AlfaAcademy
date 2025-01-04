document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const videoGrid = document.getElementById('videoGrid');

    // Cargar videos desde el backend
    
    // Manejar la subida del video
    uploadForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(uploadForm);
        fetch('/upload', {
            method: 'POST',
            body: formData,
        })
            .then(response => response.text())
            .then(result => {
                alert(result);
                location.reload(); // Recargar para mostrar los nuevos videos
            })
            .catch(err => {
                console.error('Error al subir el video:', err);
                alert('Error al subir el video');
            });
    });
});

//Scipt para el registro

document.getElementById('registerForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const data = {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        role: document.getElementById('role').value
    };

    fetch('https://e0e3-200-37-205-82.ngrok-free.app/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(result => {
        const responseMessage = document.getElementById('responseMessage');
        responseMessage.textContent = result.message;
        responseMessage.className = result.message.includes('éxito') ? 'text-success' : 'text-danger';
    })
    .catch(error => console.error('Error:', error));
});

//Script para el login

document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();

    const role = document.getElementById('role').value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role }),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Credenciales incorrectas');
            }
            return response.json();
        })
        .then(({ role }) => {
            window.location.href = role === 'admin' ? 'admin.html' : 'index.html';
        })
        .catch(error => {
            document.getElementById('error').textContent = error.message;
        });
});