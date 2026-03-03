// Known major military installations — sourced from open OSINT / public domain
export const MILITARY_BASES = [
  // NATO / US
  { id:"b01", name:"Ramstein Air Base",       country:"Germany",        lat:49.4369,  lon:7.6007,   type:"Air",      side:"NATO" },
  { id:"b02", name:"RAF Mildenhall",           country:"UK",             lat:52.3614,  lon:0.4863,   type:"Air",      side:"NATO" },
  { id:"b03", name:"Incirlik Air Base",        country:"Turkey",         lat:37.0012,  lon:35.4263,  type:"Air",      side:"NATO" },
  { id:"b04", name:"Aviano Air Base",          country:"Italy",          lat:46.0319,  lon:12.5962,  type:"Air",      side:"NATO" },
  { id:"b05", name:"Al Udeid Air Base",        country:"Qatar",          lat:25.1176,  lon:51.3148,  type:"Air",      side:"US"   },
  { id:"b06", name:"Camp Arifjan",             country:"Kuwait",         lat:28.9834,  lon:48.1633,  type:"Army",     side:"US"   },
  { id:"b07", name:"Kadena Air Base",          country:"Japan",          lat:26.3553,  lon:127.7694, type:"Air",      side:"US"   },
  { id:"b08", name:"Camp Humphreys",           country:"South Korea",    lat:36.9603,  lon:126.9965, type:"Army",     side:"US"   },
  { id:"b09", name:"Diego Garcia",             country:"BIOT",           lat:-7.3139,  lon:72.4233,  type:"Naval",    side:"US"   },
  { id:"b10", name:"Camp Lemonnier",           country:"Djibouti",       lat:11.5475,  lon:43.1589,  type:"Army",     side:"US"   },
  { id:"b11", name:"Rota Naval Station",       country:"Spain",          lat:36.6323,  lon:-6.3493,  type:"Naval",    side:"NATO" },
  { id:"b12", name:"NAS Sigonella",            country:"Italy",          lat:37.4012,  lon:14.9228,  type:"Naval",    side:"NATO" },
  { id:"b13", name:"Keflavik Air Base",        country:"Iceland",        lat:63.9906,  lon:-22.5956, type:"Air",      side:"NATO" },
  { id:"b14", name:"Andersen AFB",             country:"Guam",           lat:13.5839,  lon:144.9300, type:"Air",      side:"US"   },
  { id:"b15", name:"Mihail Kogalniceanu AB",   country:"Romania",        lat:44.3622,  lon:28.4881,  type:"Air",      side:"NATO" },
  { id:"b16", name:"Grafenwoehr Training",     country:"Germany",        lat:49.7061,  lon:11.8711,  type:"Army",     side:"NATO" },
  { id:"b17", name:"Ali Al Salem AB",          country:"Kuwait",         lat:29.3267,  lon:47.5200,  type:"Air",      side:"US"   },
  // Russia
  { id:"b20", name:"Hmeimim Air Base",         country:"Syria",          lat:35.4011,  lon:37.2422,  type:"Air",      side:"Russia" },
  { id:"b21", name:"Tartus Naval Base",        country:"Syria",          lat:34.8928,  lon:36.0044,  type:"Naval",    side:"Russia" },
  { id:"b22", name:"Kant Air Base",            country:"Kyrgyzstan",     lat:42.8538,  lon:74.8466,  type:"Air",      side:"Russia" },
  { id:"b23", name:"201st Military Base",      country:"Tajikistan",     lat:38.5897,  lon:68.7716,  type:"Army",     side:"Russia" },
  { id:"b24", name:"Erebuni Military Base",    country:"Armenia",        lat:40.1222,  lon:44.4650,  type:"Air",      side:"Russia" },
  { id:"b25", name:"Belbek Air Base",          country:"Crimea",         lat:44.6916,  lon:33.5825,  type:"Air",      side:"Russia" },
  { id:"b26", name:"Sevastopol Black Sea Flt", country:"Crimea",         lat:44.6234,  lon:33.5228,  type:"Naval",    side:"Russia" },
  // China
  { id:"b30", name:"Woody Island Garrison",    country:"South China Sea",lat:16.8400,  lon:112.3393, type:"Air/Naval",side:"China" },
  { id:"b31", name:"Fiery Cross Reef",         country:"South China Sea",lat:9.5503,   lon:112.8977, type:"Naval",    side:"China" },
  { id:"b32", name:"Mischief Reef",            country:"South China Sea",lat:9.9064,   lon:115.5305, type:"Naval",    side:"China" },
  { id:"b33", name:"Subi Reef",                country:"South China Sea",lat:10.9196,  lon:114.0888, type:"Naval",    side:"China" },
  { id:"b34", name:"PLA Navy — Djibouti",      country:"Djibouti",       lat:11.5372,  lon:43.1596,  type:"Naval",    side:"China" },
  { id:"b35", name:"Ream Naval Base",          country:"Cambodia",       lat:10.5369,  lon:103.6531, type:"Naval",    side:"China" },
  { id:"b36", name:"Sanya Naval Base",         country:"China",          lat:18.2265,  lon:109.5139, type:"Naval",    side:"China" },
  // Iran / Proxies
  { id:"b40", name:"Shahid Nojeh AB",          country:"Iran",           lat:35.2097,  lon:48.6534,  type:"Air",      side:"Iran" },
  { id:"b41", name:"Bandar Abbas Naval",       country:"Iran",           lat:27.1865,  lon:56.2808,  type:"Naval",    side:"Iran" },
  { id:"b42", name:"Imam Ali Base",            country:"Iraq",           lat:34.0589,  lon:46.3322,  type:"Army",     side:"Iran" },
  // DPRK
  { id:"b50", name:"Sunan Air Base",           country:"North Korea",    lat:39.1244,  lon:125.6706, type:"Air",      side:"DPRK" },
  { id:"b51", name:"Sinpo Submarine Base",     country:"North Korea",    lat:40.0256,  lon:128.1821, type:"Naval",    side:"DPRK" },
];

export const BASE_COLORS = {
  NATO:   "#4fc3f7",
  US:     "#1e90ff",
  Russia: "#e53935",
  China:  "#c62828",
  Iran:   "#43a047",
  DPRK:   "#ef6c00",
};
