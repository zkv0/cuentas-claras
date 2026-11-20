import { extractJson } from '../services/ai.js';

export function connectPersonalAI(prefix, buildPrompt, review, invalidate = () => {}, collection = "materias") {
  const field = suffix => document.getElementById(prefix + suffix);
  const selector = field('Method');
  let start = null;
  selector?.addEventListener('touchstart', event => {
    start = event.touches.length === 1 ? event.touches[0] : null;
  }, {passive:true});
  selector?.addEventListener('touchend', event => {
    if (!start) return;
    const end = event.changedTouches[0];
    const dx = end.clientX - start.clientX;
    const dy = end.clientY - start.clientY;
    start = null;
    if (Math.abs(dx) < 24 || Math.abs(dx) <= Math.abs(dy)) return;
    event.preventDefault();
    selector.querySelector(dx > 0 ? '[value="api"]' : '[value="personal"]').click();
  }, {passive:false});
  const feedback = field('Feedback');
  field('Copy')?.addEventListener('click', async () => {
    const prompt = buildPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      feedback.textContent = 'Prompt copiado.';
    } catch {
      const box = field('Prompt');
      box.hidden = false;
      box.value = prompt;
      box.focus();
      box.select();
      feedback.textContent = 'Copia el texto seleccionado.';
    }
  });
  field('Answer')?.addEventListener('input', () => {
    feedback.textContent = '';
    invalidate();
  });
  field('ReviewAnswer')?.addEventListener('click', () => {
    try {
      const data = extractJson(field('Answer').value);
      if (!Array.isArray(data?.[collection]) || !data[collection].length)
        throw new Error('Pega el JSON completo con ' + (collection === 'semestres' ? 'los semestres.' : 'las materias.'));
      feedback.textContent = '';
      review(data);
    } catch (error) {
      feedback.textContent = error.message;
    }
  });
}
