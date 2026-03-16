/* ================================================================
   Reference Image Viewer

   Displays a scrollable full-screen gallery of reference images
   for a given category and level.

   To add images for a new category/level:
   1. Place images in assets/<Category name>/
   2. Add an entry to IMAGE_SETS below under category → level
   3. Pass refCategory to the radioChips call in render.js
   4. Add the image paths to the SW pre-cache list
   ================================================================ */

const IMAGE_SETS = {
  vegetation_density: {
    '1': {
      title: 'Low Vegetation Density',
      images: [
        { src: './assets/Vegetation density/low_vegetation_density_1.jpg', caption: 'Low Vegetation Density (1)' },
        { src: './assets/Vegetation density/low_vegetation_density_2.jpg', caption: 'Low Vegetation Density (2)' },
        { src: './assets/Vegetation density/low_vegetation_density_3.jpg', caption: 'Low Vegetation Density (3)' },
        { src: './assets/Vegetation density/low_vegetation_density_4.jpg', caption: 'Low Vegetation Density (4)' },
      ]
    },
    '2': {
      title: 'Low/Moderate Vegetation Density',
      images: [
        { src: './assets/Vegetation density/low-moderate_vegetation_density_1.jpg', caption: 'Low/Moderate Vegetation Density (1)' },
        { src: './assets/Vegetation density/low-moderate_vegetation_density_2.jpg', caption: 'Low/Moderate Vegetation Density (2)' },
        { src: './assets/Vegetation density/low-moderate_vegetation_density_3.JPG', caption: 'Low/Moderate Vegetation Density (3)' },
        { src: './assets/Vegetation density/low-moderate_vegetation_density_4.jpg', caption: 'Low/Moderate Vegetation Density (4)' },
      ]
    },
    '3': {
      title: 'Moderate Vegetation Density',
      images: [
        { src: './assets/Vegetation density/moderate_vegetation_density _1.jpg', caption: 'Moderate Vegetation Density (1)' },
        { src: './assets/Vegetation density/moderate_vegetation_density _2.jpg', caption: 'Moderate Vegetation Density (2)' },
        { src: './assets/Vegetation density/moderate_vegetation_density _3.jpg', caption: 'Moderate Vegetation Density (3)' },
        { src: './assets/Vegetation density/moderate_vegetation_density _4.jpg', caption: 'Moderate Vegetation Density (4)' },
      ]
    },
    '4': {
      title: 'Moderate/High Vegetation Density',
      images: [
        { src: './assets/Vegetation density/moderate_high_vegetation_density _1.jpg', caption: 'Moderate/High Vegetation Density (1)' },
        { src: './assets/Vegetation density/moderate_high_vegetation_density _2.jpg', caption: 'Moderate/High Vegetation Density (2)' },
        { src: './assets/Vegetation density/moderate_high_vegetation_density_3.jpg', caption: 'Moderate/High Vegetation Density (3)' },
        { src: './assets/Vegetation density/moderate_high_vegetation_density _4.png', caption: 'Moderate/High Vegetation Density (4)' },
      ]
    },
    '5': {
      title: 'High Vegetation Density',
      images: [
        { src: './assets/Vegetation density/high_vegetation_density _1.jpg', caption: 'High Vegetation Density (1)' },
        { src: './assets/Vegetation density/high_vegetation_density _2.jpg', caption: 'High Vegetation Density (2)' },
        { src: './assets/Vegetation density/high_vegetation_density _3.JPG', caption: 'High Vegetation Density (3)' },
        { src: './assets/Vegetation density/high_vegetation_density _4.png', caption: 'High Vegetation Density (4)' },
      ]
    },
  },
  micro_terrain_complexity: {
    // '1': { title: 'Minimal Micro-terrain', images: [] },
    // '2': { title: 'Minimal/Moderate Micro-terrain', images: [] },
    // ...
  },
};

/** Check whether reference images exist for a category + level. */
export function hasRefImages(category, level) {
  const set = IMAGE_SETS[category]?.[String(level)];
  return !!(set && set.images.length);
}

/** Open the reference image viewer for a given category and level. */
export function openImageViewer(category, level) {
  if (document.getElementById('ref-image-viewer')) return;

  const set = IMAGE_SETS[category]?.[String(level)];
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

  document.getElementById('ref-image-close').addEventListener('click', closeImageViewer);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeImageViewer();
  });

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
