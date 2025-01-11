document.addEventListener('DOMContentLoaded', () => {
    // Función para cargar un video en un contenedor específico
        function loadVideo(category, containerId) {
            fetch(`/videos/${category}`) // Llama a la ruta del backend para la categoría
                .then(response => response.json())
                .then(videos => {
                    const container = document.getElementById(containerId);

                    // Si hay videos en la categoría
                    if (videos.length > 0) {
                        const video = videos[0]; // Solo usa el primer video (según tu requerimiento)
                        const videoElement = document.createElement('div');
                        videoElement.classList.add('video-container');
                        videoElement.innerHTML = `
                            <div>
                                <iframe 
                                    src="${video.path}"  
                                    frameborder="0"
                                    allow="autoplay; fullscreen" 
                                    allowfullscreen>
                                </iframe>
                            </div>
                        `;
                        container.appendChild(videoElement);
                    } else {
                        console.warn(`No se encontraron videos para la categoría: ${category}`);
                    }
                })
                .catch(err => console.error(`Error al cargar los videos de ${category}:`, err));
        }

        // Cargar videos para cada categoría
        loadVideo('sesion1', 'sesion1');
        loadVideo('sesion2', 'sesion2');
        loadVideo('sesion3', 'sesion3');
        loadVideo('sesion4', 'sesion4');
        loadVideo('sesion5', 'sesion5');
        loadVideo('sesion6', 'sesion6');
        loadVideo('sesion7', 'sesion7');
        loadVideo('sesion8', 'sesion8');
        loadVideo('sesion9', 'sesion9');
        loadVideo('sesion10', 'sesion10');
        loadVideo('sesion11', 'sesion11');
        loadVideo('sesion12', 'sesion12');
        loadVideo('sesion13', 'sesion13');
        loadVideo('sesion14', 'sesion14');
});