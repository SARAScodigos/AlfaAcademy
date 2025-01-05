// Función para generar un número aleatorio entre min y max
function getRandomNumber(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  
  // Función para actualizar el número de estudiantes
  function updateStudentCount() {
    const studentNumberElement = document.getElementById('students-number');
    const newCount = getRandomNumber(30, 121); // Genera un número entre 30 y 121
    studentNumberElement.textContent = newCount;
  }
  
  // Actualiza cada 3 minutos (180,000 ms)
  setInterval(updateStudentCount, 180000);
  
  // Actualiza al cargar la página
  updateStudentCount();
  