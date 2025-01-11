document.addEventListener('DOMContentLoaded', () => {
    const toggleHeaders = document.querySelectorAll('.toggle-header');

    toggleHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const targetId = header.getAttribute('data-toggle');
            const content = document.getElementById(targetId);

            if (content) {
                content.style.display = content.style.display === 'none' || content.style.display === '' 
                    ? 'block' 
                    : 'none';
                header.querySelector('.icon').classList.toggle('open'); // Cambia la clase del icono
            }
        });
    });
});