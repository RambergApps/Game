// Cinderborn – materialer (malte valører). Mørk kropp under gulvets valør (#2b2e31), lyse platekanter og varmt
// kantlys bærer silhuetten – samme regel som Warden-arket («suit darker than floor», rim fra LIGHT_DIR).
// WARDEN-DESIGN §4: Warden er lyseste figur (lys plate #7d858e), monstrene de mørkeste – ingen
// monsterflate (unntatt tynne slitekanter og glød) skal bli lysere enn Wardens mellomtone #5a6068.
// Ingen cyan/blått på monstrene (reservert for Warden). Kantlys er VARMT her; Warden har kaldt #dfe6ea.
export const MATS = {
  chitin: { lo: [3, 2, 2], mid: [20, 16, 16], hi: [68, 56, 52], edge: [150, 128, 108], seam: [4, 3, 3], spec: 0.45 },
  plate:  { lo: [3, 2, 2], mid: [24, 20, 20], hi: [96, 82, 74], edge: [196, 160, 132], seam: [4, 3, 3], spec: 0.7 },
  bone:   { lo: [10, 8, 7], mid: [50, 43, 38], hi: [132, 114, 98], edge: [196, 172, 146], seam: [6, 5, 4], spec: 0.9 },
  frill:  { lo: [34, 6, 6], mid: [118, 24, 22], hi: [204, 62, 50], edge: [210, 96, 80], seam: [16, 3, 3], spec: 0.25, trans: [170, 34, 24] },
  // Lurcher: nesten svart kitin med varm rødbrun undertone, smalt varmt kantlys, dyp rød hinne (#8e1e1e)
  lchitin: { lo: [2, 1, 1], mid: [15, 9, 8], hi: [54, 32, 24], edge: [164, 90, 60], seam: [2, 1, 1], spec: 0.3 },
  lplate:  { lo: [2, 1, 1], mid: [18, 11, 9], hi: [74, 44, 32], edge: [196, 108, 70], seam: [2, 1, 1], spec: 0.4 },
  lbone:   { lo: [4, 2, 2], mid: [30, 18, 14], hi: [86, 52, 38], edge: [170, 96, 64], seam: [3, 2, 1], spec: 0.5 },
  lfrill:  { lo: [22, 4, 4], mid: [92, 20, 20], hi: [142, 30, 30], edge: [176, 56, 46], seam: [10, 2, 2], spec: 0.2, trans: [142, 30, 30] },
  magma:  { lo: [90, 16, 8], mid: [178, 44, 28], hi: [236, 96, 56], edge: [255, 150, 90], seam: [20, 4, 2], spec: 0.2 },   // glødende kjerne mellom platene
};
// Spitter: nesten svart kitin (kald-nøytral, litt fiolett), fiolette giftsekker (#9b59ff). Kiln: store mørke plater, oransje sømmer.
MATS.schitin = { lo: [2, 1, 3], mid: [14, 11, 17], hi: [46, 38, 56], edge: [128, 104, 150], seam: [2, 1, 3], spec: 0.35 };
MATS.splate  = { lo: [3, 2, 4], mid: [20, 16, 24], hi: [70, 58, 82], edge: [160, 132, 180], seam: [3, 2, 4], spec: 0.5 };
MATS.sack    = { lo: [40, 16, 80], mid: [110, 60, 200], hi: [190, 150, 255], edge: [220, 196, 255], seam: [20, 8, 40], spec: 0.6 };
MATS.sackOff = { lo: [8, 5, 12], mid: [30, 22, 40], hi: [70, 58, 86], edge: [110, 96, 130], seam: [6, 4, 8], spec: 0.4 };
MATS.kplate  = { lo: [3, 3, 3], mid: [19, 18, 18], hi: [56, 54, 52], edge: [128, 122, 116], seam: [3, 3, 3], spec: 0.45 };   // kald slagg, lav metning
MATS.kchitin = { lo: [2, 2, 2], mid: [13, 12, 12], hi: [42, 40, 38], edge: [104, 98, 92], seam: [2, 2, 2], spec: 0.35 };
MATS.kcore   = { lo: [110, 40, 6], mid: [210, 96, 22], hi: [255, 160, 70], edge: [255, 200, 120], seam: [30, 10, 2], spec: 0.2 };
MATS.metal   = { lo: [5, 5, 5], mid: [34, 32, 30], hi: [110, 104, 96], edge: [190, 176, 156], seam: [4, 4, 4], spec: 1.0 };
