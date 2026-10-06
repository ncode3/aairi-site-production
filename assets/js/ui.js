document.addEventListener('click', (event) => {
    if (event.target.closest('[data-mobile-menu-toggle]')) {
        document.getElementById('mobile-menu')?.classList.toggle('hidden');
    }
});
document.addEventListener('error', (event) => {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.dataset.fallbackSrc) {
        const fallback = image.dataset.fallbackSrc;
        delete image.dataset.fallbackSrc;
        image.src = fallback;
    }
}, true);
