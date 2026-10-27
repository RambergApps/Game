// Bakezoom for Cinderborn-sprites (egen modul: brukes av kinds.js og bakeone.js uten importsirkel).
import { PROJ } from '../../shared/projection.js';
/** px per verdens-px = startzoomen til kameraet (Arena: PROJ.zoom = camera.js DEFAULT_ZOOM; 2,25 ved 55°, 1,5 med ?view=34, ?zoom=N overstyrer).
 *  Workere importerer PROJ med samme URL-søk → samme verdi. Med ?camfollow=0 regner kameraet egen zoom under spill; bakes likevel ved PROJ.zoom
 *  (kan bli litt uskarpt der – akseptert). Avrundet til 0,25; ligger i cache-navnet. */
export const D = Math.min(3, Math.max(1, Math.round((+PROJ.zoom || 1.5) * 4) / 4));
/** (zoom/1,5)² – bare til rapport; taket er MEM_TOTAL_MB under. */
export const MEM_K = (D / 1.5) ** 2;
/** Totaltak for fiendesprites (base-cacher, alle fem), Breach 27.10 13:45. Fordeles per type etter memShare i kinds.js. */
export const MEM_TOTAL_MB = 32;
