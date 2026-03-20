// js/catalog.js
// Navigational stars, J2000.0 epoch
// Format: { name: [ra_hours, dec_degrees, magnitude] }
export const CAT = {
  // ─── Original 58 navigational stars ─────────────────────────────────────
  'Acamar':          [2.970,  -40.30,  3.2],
  'Achernar':        [1.629,  -57.24,  0.5],
  'Acrux':           [12.443, -63.10,  0.8],
  'Adhara':          [6.977,  -28.97,  1.5],
  'Aldebaran':       [4.599,   16.51,  0.9],
  'Alioth':          [12.900,  55.96,  1.8],
  'Alkaid':          [13.792,  49.31,  1.9],
  'Alnilam':         [5.603,   -1.20,  1.7],
  'Alphard':         [9.460,   -8.66,  2.0],
  'Alphecca':        [15.578,  26.71,  2.2],
  'Alpheratz':       [0.140,   29.09,  2.1],
  'Altair':          [19.846,   8.87,  0.8],
  'Ankaa':           [0.438,  -42.31,  2.4],
  'Antares':         [16.490, -26.43,  1.1],
  'Arcturus':        [14.261,  19.18, -0.1],
  'Atria':           [16.811, -69.03,  1.9],
  'Avior':           [8.375,  -59.51,  1.9],
  'Bellatrix':       [5.419,    6.35,  1.6],
  'Betelgeuse':      [5.920,    7.41,  0.5],
  'Canopus':         [6.399,  -52.70, -0.7],
  'Capella':         [5.278,   45.99,  0.1],
  'Castor':          [7.577,   31.89,  1.6],
  'Deneb':           [20.690,  45.28,  1.3],
  'Denebola':        [11.818,  14.57,  2.1],
  'Diphda':          [0.726,  -17.99,  2.0],
  'Dubhe':           [11.062,  61.75,  1.8],
  'Elnath':          [5.438,   28.61,  1.7],
  'Eltanin':         [17.944,  51.49,  2.2],
  'Enif':            [21.736,   9.88,  2.4],
  'Fomalhaut':       [22.961, -29.62,  1.2],
  'Gacrux':          [12.519, -57.11,  1.6],
  'Gienah':          [12.264, -17.54,  2.6],
  'Hadar':           [14.064, -60.37,  0.6],
  'Hamal':           [2.120,   23.46,  2.1],
  'Kaus Australis':  [18.403, -34.38,  1.9],
  'Kochab':          [14.845,  74.16,  2.1],
  'Markab':          [23.079,  15.21,  2.5],
  'Menkar':          [3.038,    4.09,  2.5],
  'Menkent':         [14.111, -36.37,  2.1],
  'Miaplacidus':     [9.220,  -69.72,  1.7],
  'Mirfak':          [3.406,   49.86,  1.8],
  'Nunki':           [18.921, -26.30,  2.1],
  'Peacock':         [20.427, -56.74,  1.9],
  'Polaris':         [2.530,   89.26,  2.0],
  'Pollux':          [7.755,   28.03,  1.2],
  'Procyon':         [7.655,    5.22,  0.4],
  'Rasalhague':      [17.582,  12.56,  2.1],
  'Regulus':         [10.140,  11.97,  1.4],
  'Rigel':           [5.242,   -8.20,  0.1],
  'Rigil Kentaurus': [14.660, -60.83, -0.3],
  'Sabik':           [17.173, -15.72,  2.4],
  'Schedar':         [0.675,   56.54,  2.2],
  'Shaula':          [17.561, -37.10,  1.6],
  'Sirius':          [6.753,  -16.72, -1.5],
  'Spica':           [13.420, -11.16,  1.0],
  'Suhail':          [9.133,  -43.43,  2.2],
  'Vega':            [18.615,  38.78,  0.0],
  'Zubenelgenubi':   [14.851, -16.04,  2.8],

  // ─── Ursa Minor (Little Dipper) ──────────────────────────────────────────
  'Pherkad':         [15.346,  71.834, 3.05],  // γ UMi

  // ─── Ursa Major (Big Dipper — completing the bowl) ───────────────────────
  'Merak':           [11.031,  56.383, 2.37],  // β UMa — pointer to Polaris (with Dubhe)
  'Phecda':          [11.897,  53.695, 2.44],  // γ UMa
  'Megrez':          [12.257,  57.033, 3.31],  // δ UMa — bowl/handle junction
  'Mizar':           [13.399,  54.925, 2.27],  // ζ UMa — handle middle

  // ─── Cassiopeia (W asterism) ─────────────────────────────────────────────
  'Caph':            [0.153,   59.150, 2.27],  // β Cas
  'Navi':            [0.945,   60.717, 2.47],  // γ Cas
  'Ruchbah':         [1.430,   60.235, 2.68],  // δ Cas
  'Segin':           [1.907,   63.670, 3.35],  // ε Cas

  // ─── Orion (completing the figure) ───────────────────────────────────────
  'Mintaka':         [5.534,   -0.299, 2.25],  // δ Ori — west belt star
  'Alnitak':         [5.679,   -1.943, 2.05],  // ζ Ori — east belt star
  'Saiph':           [5.796,   -9.670, 2.07],  // κ Ori — lower right foot

  // ─── Perseus ─────────────────────────────────────────────────────────────
  'Algol':           [3.136,   40.957, 2.12],  // β Per (variable: min 3.4)

  // ─── Andromeda ───────────────────────────────────────────────────────────
  'Mirach':          [1.162,   35.621, 2.07],  // β And
  'Almach':          [2.065,   42.330, 2.10],  // γ And

  // ─── Auriga ──────────────────────────────────────────────────────────────
  'Menkalinan':      [5.992,   44.948, 1.90],  // β Aur

  // ─── Pegasus (Great Square) ──────────────────────────────────────────────
  'Scheat':          [23.063,  28.083, 2.44],  // β Peg
  'Algenib':         [0.221,   15.184, 2.83],  // γ Peg

  // ─── Leo ─────────────────────────────────────────────────────────────────
  'Algieba':         [10.333,  19.842, 2.01],  // γ Leo

  // ─── Cygnus (Northern Cross) ─────────────────────────────────────────────
  'Sadr':            [20.371,  40.257, 2.23],  // γ Cyg — centre of cross
  'Aljanah':         [20.770,  33.970, 2.48],  // ε Cyg — cross arm east
  'Albireo':         [19.512,  27.960, 3.09],  // β Cyg — head of swan

  // ─── Sagittarius (Teapot) ────────────────────────────────────────────────
  'Kaus Borealis':   [18.466, -25.422, 2.82],  // λ Sgr — teapot lid
  'Kaus Media':      [18.350, -29.828, 2.71],  // δ Sgr — teapot spout middle

  // ─── Scorpius ────────────────────────────────────────────────────────────
  'Sargas':          [17.622, -42.998, 1.87],  // θ Sco — tail
  'Dschubba':        [16.006, -22.622, 2.29],  // δ Sco — head/claw

  // ─── Draco ───────────────────────────────────────────────────────────────
  'Rastaban':        [17.507,  52.301, 2.79],  // β Dra — head
  'Aldibain':        [16.400,  61.514, 2.74],  // η Dra — neck

  // ─── Crux (Southern Cross — completing the cross) ────────────────────────
  'Mimosa':          [12.795, -59.689, 1.25],  // β Cru — east arm
  'Delta Cru':       [12.252, -58.749, 2.79],  // δ Cru — west arm

  // ─── Aquila ──────────────────────────────────────────────────────────────
  'Tarazed':         [19.771,  10.613, 2.72],  // γ Aql

  // ─── Lyra ────────────────────────────────────────────────────────────────
  'Sulafat':         [18.982,  32.689, 3.26],  // γ Lyr
  'Sheliak':         [18.835,  33.363, 3.52],  // β Lyr (variable)

  // ─── Virgo ───────────────────────────────────────────────────────────────
  'Porrima':         [12.694,  -1.449, 2.74],  // γ Vir

  // ─── Aries ───────────────────────────────────────────────────────────────
  'Sheratan':        [1.911,   20.808, 2.64],  // β Ari

  // ─── Canis Minor ─────────────────────────────────────────────────────────
  'Gomeisa':         [7.452,    8.289, 2.89],  // β CMi

  // ─── Canis Major ─────────────────────────────────────────────────────────
  'Mirzam':          [6.378,  -17.956, 1.98],  // β CMa
  'Wezen':           [7.140,  -26.393, 1.84],  // δ CMa

  // ─── Boötes ──────────────────────────────────────────────────────────────
  'Nekkar':          [15.032,  40.390, 3.49],  // β Boo

  // ─── Bright stars not in original 58 ─────────────────────────────────────
  'Regor':           [8.159,  -47.336, 1.72],  // γ Vel
  'Al Na\'ir':       [22.137, -46.961, 1.73],  // α Gru
  'Delta Vel':       [8.745,  -54.709, 1.96],  // δ Vel
  'Aspidiske':       [9.285,  -59.275, 2.21],  // ι Car
  'Naos':            [8.059,  -40.003, 2.25],  // ζ Pup
  'Epsilon Cen':     [13.665, -53.466, 2.30],  // ε Cen
  'Eta Cen':         [14.592, -42.158, 2.31],  // η Cen
  'Alpha Lupi':      [14.699, -47.388, 2.30],  // α Lup
  'Epsilon Sco':     [16.836, -34.293, 2.29],  // ε Sco / Wei
  'Girtab':          [17.708, -39.030, 2.41],  // κ Sco
  'Zeta Cen':        [13.926, -47.288, 2.55],  // ζ Cen
  'Kraz':            [12.573, -23.397, 2.65],  // β Crv
  'Zubeneschamali':  [15.284,  -9.383, 2.61],  // β Lib
  'Algorab':         [12.498, -16.515, 2.95],  // δ Crv
  'Sadalsuud':       [21.526,  -5.571, 2.91],  // β Aqr
  'Sadalmelik':      [22.096,  -0.320, 2.95],  // α Aqr

  // ─── Constellation fill-in stars ─────────────────────────────────────────
  'Kornephoros':     [16.503,  21.490, 2.77],  // β Her
  'Zeta Her':        [16.688,  31.603, 2.81],  // ζ Her
  'Pi Her':          [17.251,  36.809, 3.16],  // π Her
  'Eta Her':         [16.714,  38.922, 3.48],  // η Her
  'Adhafera':        [10.167,  23.417, 3.44],  // ζ Leo
  'Eta Leo':         [10.122,  16.763, 3.49],  // η Leo
  'Tianguan':        [5.627,   21.143, 3.00],  // ζ Tau
  'Delta Cyg':       [19.750,  45.131, 2.87],  // δ Cyg
  'Thuban':          [14.073,  64.376, 3.65],  // α Dra (former pole star)
  'Edasich':         [15.415,  58.966, 3.29],  // ι Dra
  'Gamma Hya':       [13.315, -23.171, 2.99],  // γ Hya
  'Yed Prior':       [16.241,  -3.694, 2.74],  // δ Oph
  'Cebalrai':        [17.722,   4.567, 2.77],  // β Oph
};

export const CAT_ENTRIES = Object.entries(CAT).sort((a, b) => a[0].localeCompare(b[0]));
export const CAT_BY_MAG = [...CAT_ENTRIES].sort((a, b) => a[1][2] - b[1][2]);

// Constellation stick figure lines: [[star1, star2], ...]
export const CONST_LINES = [
  // ─── Orion ───────────────────────────────────────────────────────────────
  ['Betelgeuse', 'Bellatrix'],   // shoulders
  ['Betelgeuse', 'Alnitak'],     // body diagonal
  ['Bellatrix',  'Mintaka'],     // body diagonal
  ['Mintaka',    'Alnilam'],     // belt
  ['Alnilam',    'Alnitak'],     // belt
  ['Alnilam',    'Rigel'],       // to left foot
  ['Alnilam',    'Saiph'],       // to right foot

  // ─── Ursa Major (Big Dipper) ─────────────────────────────────────────────
  ['Dubhe',   'Merak'],          // bowl right edge (pointer stars)
  ['Merak',   'Phecda'],         // bowl bottom
  ['Phecda',  'Megrez'],         // bowl left edge
  ['Megrez',  'Dubhe'],          // bowl top
  ['Megrez',  'Alioth'],         // handle start
  ['Alioth',  'Mizar'],          // handle middle
  ['Mizar',   'Alkaid'],         // handle tip

  // ─── Ursa Minor (Little Dipper — tip of handle) ──────────────────────────
  ['Polaris', 'Kochab'],
  ['Kochab',  'Pherkad'],

  // ─── Cassiopeia (W) ──────────────────────────────────────────────────────
  ['Caph',    'Schedar'],
  ['Schedar', 'Navi'],
  ['Navi',    'Ruchbah'],
  ['Ruchbah', 'Segin'],

  // ─── Perseus ─────────────────────────────────────────────────────────────
  ['Mirfak', 'Algol'],

  // ─── Andromeda ───────────────────────────────────────────────────────────
  ['Alpheratz', 'Mirach'],
  ['Mirach',    'Almach'],

  // ─── Auriga ──────────────────────────────────────────────────────────────
  ['Capella',    'Menkalinan'],
  ['Menkalinan', 'Elnath'],

  // ─── Pegasus (Great Square) ──────────────────────────────────────────────
  ['Alpheratz', 'Scheat'],
  ['Scheat',    'Markab'],
  ['Markab',    'Algenib'],
  ['Algenib',   'Alpheratz'],
  ['Markab',    'Enif'],         // extending toward Aquarius

  // ─── Leo ─────────────────────────────────────────────────────────────────
  ['Regulus',  'Algieba'],
  ['Algieba',  'Denebola'],

  // ─── Cygnus (Northern Cross) ─────────────────────────────────────────────
  ['Deneb',   'Sadr'],           // top of cross → centre
  ['Sadr',    'Albireo'],        // centre → bottom (long axis)
  ['Sadr',    'Aljanah'],        // centre → east arm

  // ─── Scorpius ────────────────────────────────────────────────────────────
  ['Dschubba', 'Antares'],
  ['Antares',  'Shaula'],
  ['Antares',  'Sargas'],

  // ─── Sagittarius (Teapot) ────────────────────────────────────────────────
  ['Kaus Australis', 'Kaus Media'],
  ['Kaus Media',     'Kaus Borealis'],
  ['Kaus Borealis',  'Nunki'],

  // ─── Centaurus ───────────────────────────────────────────────────────────
  ['Rigil Kentaurus', 'Hadar'],

  // ─── Canis Major ─────────────────────────────────────────────────────────
  ['Sirius', 'Mirzam'],
  ['Sirius', 'Adhara'],
  ['Sirius', 'Wezen'],

  // ─── Crux (Southern Cross) ───────────────────────────────────────────────
  ['Acrux',    'Gacrux'],        // vertical arm
  ['Mimosa',   'Delta Cru'],     // horizontal arm

  // ─── Aquila ──────────────────────────────────────────────────────────────
  ['Altair', 'Tarazed'],

  // ─── Lyra ────────────────────────────────────────────────────────────────
  ['Vega',    'Sulafat'],
  ['Vega',    'Sheliak'],
  ['Sulafat', 'Sheliak'],

  // ─── Virgo ───────────────────────────────────────────────────────────────
  ['Porrima', 'Spica'],

  // ─── Taurus ──────────────────────────────────────────────────────────────
  ['Aldebaran', 'Elnath'],

  // ─── Gemini ──────────────────────────────────────────────────────────────
  ['Castor', 'Pollux'],

  // ─── Canis Minor ─────────────────────────────────────────────────────────
  ['Procyon', 'Gomeisa'],

  // ─── Boötes ──────────────────────────────────────────────────────────────
  ['Arcturus', 'Alphecca'],
  ['Arcturus', 'Nekkar'],

  // ─── Draco (head arc) ────────────────────────────────────────────────────
  ['Eltanin',  'Rastaban'],
  ['Rastaban', 'Aldibain'],

  // ─── Aries ───────────────────────────────────────────────────────────────
  ['Hamal', 'Sheratan'],

  // ─── Eridanus ────────────────────────────────────────────────────────────
  ['Achernar', 'Acamar'],

  // ─── Carina/Vela ─────────────────────────────────────────────────────────
  ['Canopus',    'Avior'],
  ['Avior',      'Suhail'],
  ['Canopus',    'Miaplacidus'],

  // ─── Ophiuchus (base line) ────────────────────────────────────────────────
  ['Rasalhague', 'Sabik'],

  // ─── Hercules (Keystone) ─────────────────────────────────────────────────
  ['Kornephoros', 'Zeta Her'],
  ['Zeta Her',    'Eta Her'],
  ['Eta Her',     'Pi Her'],
  ['Pi Her',      'Rasalhague'],

  // ─── Aquarius ────────────────────────────────────────────────────────────
  ['Sadalsuud',   'Sadalmelik'],
  ['Sadalmelik',  'Enif'],

  // ─── Corvus ──────────────────────────────────────────────────────────────
  ['Gienah',  'Kraz'],
  ['Kraz',    'Algorab'],
  ['Algorab', 'Gienah'],

  // ─── Libra ───────────────────────────────────────────────────────────────
  ['Zubenelgenubi', 'Zubeneschamali'],

  // ─── Ophiuchus (completing) ───────────────────────────────────────────────
  ['Rasalhague', 'Cebalrai'],
  ['Cebalrai',   'Sabik'],
  ['Yed Prior',  'Sabik'],

  // ─── Leo (Sickle) ────────────────────────────────────────────────────────
  ['Regulus',  'Eta Leo'],
  ['Eta Leo',  'Algieba'],
  ['Algieba',  'Adhafera'],

  // ─── Taurus (completing V) ───────────────────────────────────────────────
  ['Aldebaran', 'Tianguan'],

  // ─── Draco (fuller body) ─────────────────────────────────────────────────
  ['Eltanin',  'Edasich'],
  ['Edasich',  'Thuban'],
  ['Aldibain', 'Edasich'],

  // ─── Cygnus (west arm of cross) ──────────────────────────────────────────
  ['Sadr', 'Delta Cyg'],

  // ─── Centaurus (body/legs) ───────────────────────────────────────────────
  ['Hadar',           'Epsilon Cen'],
  ['Epsilon Cen',     'Eta Cen'],
  ['Rigil Kentaurus', 'Zeta Cen'],

  // ─── Hydra (extending) ───────────────────────────────────────────────────
  ['Alphard', 'Gamma Hya'],

  // ─── Scorpius (completing tail arc) ──────────────────────────────────────
  ['Shaula',  'Girtab'],
  ['Sargas',  'Epsilon Sco'],
];
