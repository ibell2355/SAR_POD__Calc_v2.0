/* ================================================================
   Reference Image Viewer

   Displays a scrollable full-screen gallery of reference images
   for a given category. Add new categories to IMAGE_SETS below.
   ================================================================ */

const IMAGE_SETS = {
  vegetation_density: {
    title: 'Vegetation Density \u2014 Reference Images',
    images: [
      { src: './assets/Vegetation density/low_vegetation_density_1.jpg', caption: 'Low Vegetation Density (1)' },
      { src: './assets/Vegetation density/low_vegetation_density_2.jpg', caption: 'Low Vegetation Density (2)' },
      { src: './assets/Vegetation density/low_vegetation_density_3.jpg', caption: 'Low Vegetation Density (3)' },
      { src: './assets/Vegetation density/low_vegetation_density_4.jpg', caption: 'Low Vegetation Density (4)' },
    ]
  },
  // Future categories:
  // micro_terrain_complexity: { title: '...', images: [...] },
};

/** Open the reference image viewer for a given category key. */
export function openImageViewer(category) {
  if (document.getElementById('ref-image-viewer')) return;

  const set = IMAGE_SETS[category];
  if (!set || !set.images.length) return;

  const overlay = document.createElement('div');
  overlay.id = 'ref-image-viewer';
  overlay.className = 'ref-image-overlay';

  const imagesHtml = set.images.map((img) =>
    `<figure class="ref-image-figure">
      <img src="${img.src}" alt="${img.caption || ''}" loading="lazy">
      ${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}
    </figure>`
  ).join('');

  overlay.innerHTML =
    `<div class="ref-image-header">
      <span class="ref-image-title">${set.title}</span>
      <button class="ref-image-close" id="ref-image-close">\u00d7</button>
    </div>
    <div class="ref-image-scroll">${imagesHtml}</div>`;

  document.body.appendChild(overlay);

  // Close on button click
  document.getElementById('ref-image-close').addEventListener('click', closeImageViewer);

  // Close on background click (not on images/header)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeImageViewer();
  });

  // Close on Escape key
  overlay._onKey = (e) => { if (e.key === 'Escape') closeImageViewer(); };
  document.addEventListener('keydown', overlay._onKey);
}

/** Close and remove the viewer overlay. */
export function closeImageViewer() {
  const overlay = document.getElementById('ref-image-viewer');
  if (!overlay) return;
  if (overlay._onKey) document.removeEventListener('keydown', overlay._onKey);
  overlay.remove();
}
