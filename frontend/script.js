document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('uploadForm');
    const videoGrid = document.getElementById('videoGrid');

    // Cargar videos desde el backend
    fetch('/videos')
        .then(response => response.json())
        .then(videos => {
            videos.forEach(video => {
                const videoElement = document.createElement('div');
                videoElement.innerHTML = `
                    <h3>${video.title}</h3>
                    <video controls src="${video.path}" width="100%"></video>
                    <p>Category: ${video.category}</p>
                `;
                videoGrid.appendChild(videoElement);
            });
        });

    // Manejo del envío del formulario
    uploadForm.addEventListener('submit', (event) => {
        event.preventDefault();
    
        const formData = new FormData(uploadForm);
    
        fetch('/upload', {
            method: 'POST',
            body: formData,
        })
            .then(response => response.text())
            .then(result => {
                if (result === 'Video subido con éxito') {
                    alert(result);
                    location.reload();
                } else {
                    alert(`Error: ${result}`);
                }
            })
            .catch(error => {
                console.error('Error al subir el video:', error);
                alert('Error al subir el video');
            });
    });
    
});
