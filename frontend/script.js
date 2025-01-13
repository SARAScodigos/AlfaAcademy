async function fetchActiveStudents() {
  try {
      const response = await fetch('/api/active-students');
      const data = await response.json();
      const studentNumberElement = document.getElementById('students-number');
      studentNumberElement.textContent = data.count;
  } catch (error) {
      console.error('Error al obtener el número de estudiantes activos:', error);
  }
}

// Actualiza cada 3 minutos
setInterval(fetchActiveStudents, 36000);
// Actualiza al cargar la página
fetchActiveStudents();

// Respuestas correctas del formulario 1
const correctAnswers = {
  1: { // Formulario con data-id="1"
      q1: '20', // Respuesta correcta de la pregunta 1
      q2: 'Suma de exponentes', // Respuesta correcta de la pregunta 2
      q3: '4' // Respuesta correcta de la pregunta 3
  }
  
};
correctAnswers[2] = {
  q1: '5',              // Respuesta correcta para la pregunta 1
  q2: '12',             // Respuesta correcta para la pregunta 2
  q3: '6'               // Respuesta correcta para la pregunta 3
};
correctAnswers[3] = {
  q1: '96',              // Respuesta correcta para la pregunta 1
  q2: '280',             // Respuesta correcta para la pregunta 2
  q3: '1210'             // Respuesta correcta para la pregunta 3
};


// Manejo de todos los formularios dinámicamente
document.addEventListener('change', (event) => {
  const form = event.target.closest('.quiz-form'); // Encuentra el formulario padre
  if (form) {
      const formId = form.dataset.id; // Obtiene el ID del formulario
      const questionName = event.target.name; // Obtiene el nombre de la pregunta
      const userAnswer = event.target.value; // Respuesta seleccionada

      // Busca el elemento de feedback en el formulario actual
      const feedbackElement = form.querySelector('.feedback');
      if (correctAnswers[formId][questionName] === userAnswer) {
          feedbackElement.textContent = '¡Correcto!';
          feedbackElement.className = 'feedback correct';
      } else {
          feedbackElement.textContent = 'Incorrecto, vuelve a intentarlo.';
          feedbackElement.className = 'feedback incorrect';
      }
  }
});
