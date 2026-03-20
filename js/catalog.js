// js/catalog.js
// 58 navigational stars, J2000.0 epoch
// Format: { name: [ra_hours, dec_degrees, magnitude] }
export const CAT = {
  'Acamar': [2.970, -40.30, 3.2],
  'Achernar': [1.629, -57.24, 0.5],
  'Acrux': [12.443, -63.10, 0.8],
  'Adhara': [6.977, -28.97, 1.5],
  'Aldebaran': [4.599, 16.51, 0.9],
  'Alioth': [12.900, 55.96, 1.8],
  'Alkaid': [13.792, 49.31, 1.9],
  'Alnilam': [5.603, -1.20, 1.7],
  'Alphard': [9.460, -8.66, 2.0],
  'Alphecca': [15.578, 26.71, 2.2],
  'Alpheratz': [0.140, 29.09, 2.1],
  'Altair': [19.846, 8.87, 0.8],
  'Ankaa': [0.438, -42.31, 2.4],
  'Antares': [16.490, -26.43, 1.1],
  'Arcturus': [14.261, 19.18, -0.1],
  'Atria': [16.811, -69.03, 1.9],
  'Avior': [8.375, -59.51, 1.9],
  'Bellatrix': [5.419, 6.35, 1.6],
  'Betelgeuse': [5.920, 7.41, 0.5],
  'Canopus': [6.399, -52.70, -0.7],
  'Capella': [5.278, 45.99, 0.1],
  'Castor': [7.577, 31.89, 1.6],
  'Deneb': [20.690, 45.28, 1.3],
  'Denebola': [11.818, 14.57, 2.1],
  'Diphda': [0.726, -17.99, 2.0],
  'Dubhe': [11.062, 61.75, 1.8],
  'Elnath': [5.438, 28.61, 1.7],
  'Eltanin': [17.944, 51.49, 2.2],
  'Enif': [21.736, 9.88, 2.4],
  'Fomalhaut': [22.961, -29.62, 1.2],
  'Gacrux': [12.519, -57.11, 1.6],
  'Gienah': [12.264, -17.54, 2.6],
  'Hadar': [14.064, -60.37, 0.6],
  'Hamal': [2.120, 23.46, 2.1],
  'Kaus Australis': [18.403, -34.38, 1.9],
  'Kochab': [14.845, 74.16, 2.1],
  'Markab': [23.079, 15.21, 2.5],
  'Menkar': [3.038, 4.09, 2.5],
  'Menkent': [14.111, -36.37, 2.1],
  'Miaplacidus': [9.220, -69.72, 1.7],
  'Mirfak': [3.406, 49.86, 1.8],
  'Nunki': [18.921, -26.30, 2.1],
  'Peacock': [20.427, -56.74, 1.9],
  'Polaris': [2.530, 89.26, 2.0],
  'Pollux': [7.755, 28.03, 1.2],
  'Procyon': [7.655, 5.22, 0.4],
  'Rasalhague': [17.582, 12.56, 2.1],
  'Regulus': [10.140, 11.97, 1.4],
  'Rigel': [5.242, -8.20, 0.1],
  'Rigil Kentaurus': [14.660, -60.83, -0.3],
  'Sabik': [17.173, -15.72, 2.4],
  'Schedar': [0.675, 56.54, 2.2],
  'Shaula': [17.561, -37.10, 1.6],
  'Sirius': [6.753, -16.72, -1.5],
  'Spica': [13.420, -11.16, 1.0],
  'Suhail': [9.133, -43.43, 2.2],
  'Vega': [18.615, 38.78, 0.0],
  'Zubenelgenubi': [14.851, -16.04, 2.8]
};

export const CAT_ENTRIES = Object.entries(CAT).sort((a, b) => a[0].localeCompare(b[0]));
export const CAT_BY_MAG = [...CAT_ENTRIES].sort((a, b) => a[1][2] - b[1][2]);

// Constellation stick figure lines: [[star1, star2], ...]
// (remove any entry containing 'Algol' since it's not in the catalog)
export const CONST_LINES = [
  // Orion
  ['Betelgeuse', 'Bellatrix'],
  ['Betelgeuse', 'Alnilam'],
  ['Bellatrix', 'Alnilam'],
  ['Alnilam', 'Rigel'],
  // Ursa Major
  ['Dubhe', 'Alioth'],
  ['Alioth', 'Alkaid'],
  // Ursa Minor
  ['Polaris', 'Kochab'],
  // Scorpius
  ['Antares', 'Shaula'],
  // Centaurus
  ['Rigil Kentaurus', 'Hadar'],
  // Canis Major
  ['Sirius', 'Adhara'],
  // Crux
  ['Acrux', 'Gacrux'],
  // Leo
  ['Regulus', 'Denebola'],
  // Taurus
  ['Aldebaran', 'Elnath'],
  // Gemini
  ['Castor', 'Pollux'],
  // Pegasus
  ['Alpheratz', 'Markab'],
  ['Markab', 'Enif'],
  // Sagittarius
  ['Kaus Australis', 'Nunki'],
  // Ophiuchus
  ['Rasalhague', 'Sabik'],
  // Eridanus
  ['Achernar', 'Acamar'],
  // Carina/Vela
  ['Canopus', 'Avior'],
  ['Avior', 'Suhail'],
  ['Canopus', 'Miaplacidus'],
  // Boötes–Corona
  ['Arcturus', 'Alphecca'],
];
