// ponytail: 20 líneas en vez de una librería. Añadir animación compleja o stack si se necesita.
/**
 * Muestra un toast no bloqueante.
 * @param {string} msg  - Texto a mostrar
 * @param {'success'|'error'|'warn'|'info'} type - Tipo (defecto: 'info')
 * @param {number} duration - ms antes de desaparecer (defecto: 3500)
 */
export function toast(msg, type = 'info', duration = 3500) {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    // Forzar reflow para que la transición CSS arrange
    requestAnimationFrame(() => t.classList.add('toast-visible'));
    setTimeout(() => {
        t.classList.remove('toast-visible');
        t.addEventListener('transitionend', () => t.remove(), { once: true });
    }, duration);
}
