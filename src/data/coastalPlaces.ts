// Coastal place gazetteer with native-script aliases, so questions asked in
// Hindi, Marathi, Tamil, Telugu, Malayalam, Kannada, Bengali, Gujarati, Odia
// or romanised Indian languages still resolve to a location.

export interface CoastalPlace {
  /** Canonical name passed to the geocoder. */
  name: string;
  /** Lower-cased aliases in any script. */
  aliases: string[];
}

export const COASTAL_PLACES: CoastalPlace[] = [
  { name: "Mumbai", aliases: ["mumbai", "bombay", "मुंबई", "मुम्बई", "बंबई", "மும்பை", "ముంబై", "മുംബൈ", "ಮುಂಬೈ", "মুম্বাই", "મુંબઈ", "ମୁମ୍ବାଇ"] },
  { name: "Colaba, Mumbai", aliases: ["colaba", "कुलाबा", "कोलाबा"] },
  { name: "Versova, Mumbai", aliases: ["versova", "वर्सोवा"] },
  { name: "Alibag", aliases: ["alibag", "alibaug", "अलिबाग"] },
  { name: "Ratnagiri", aliases: ["ratnagiri", "रत्नागिरी"] },
  { name: "Malvan", aliases: ["malvan", "मालवण"] },
  { name: "Panaji, Goa", aliases: ["goa", "panaji", "panjim", "गोवा", "पणजी", "கோவா", "ಗೋವಾ", "ഗോവ"] },
  { name: "Karwar", aliases: ["karwar", "कारवार", "ಕಾರವಾರ"] },
  { name: "Mangaluru", aliases: ["mangalore", "mangaluru", "मंगलौर", "मंगलुरु", "ಮಂಗಳೂರು", "മംഗലാപുരം"] },
  { name: "Malpe", aliases: ["malpe", "ಮಲ್ಪೆ", "माल्पे"] },
  { name: "Udupi", aliases: ["udupi", "ಉಡುಪಿ", "उडुपी"] },
  { name: "Kozhikode", aliases: ["calicut", "kozhikode", "കോഴിക്കോട്", "कोझिकोड"] },
  { name: "Kochi", aliases: ["kochi", "cochin", "കൊച്ചി", "कोच्चि", "கொச்சி"] },
  { name: "Alappuzha", aliases: ["alappuzha", "alleppey", "ആലപ്പുഴ"] },
  { name: "Kollam", aliases: ["kollam", "quilon", "കൊല്ലം"] },
  { name: "Vizhinjam", aliases: ["vizhinjam", "വിഴിഞ്ഞം"] },
  { name: "Thiruvananthapuram", aliases: ["trivandrum", "thiruvananthapuram", "തിരുവനന്തപുരം", "तिरुवनंतपुरम"] },
  { name: "Kanyakumari", aliases: ["kanyakumari", "cape comorin", "கன்னியாகுமரி", "कन्याकुमारी"] },
  { name: "Thoothukudi", aliases: ["tuticorin", "thoothukudi", "தூத்துக்குடி"] },
  { name: "Rameswaram", aliases: ["rameswaram", "rameshwaram", "ராமேஸ்வரம்", "रामेश्वरम"] },
  { name: "Nagapattinam", aliases: ["nagapattinam", "நாகப்பட்டினம்"] },
  { name: "Puducherry", aliases: ["pondicherry", "puducherry", "புதுச்சேரி", "पुडुचेरी"] },
  { name: "Chennai", aliases: ["chennai", "madras", "சென்னை", "चेन्नई", "చెన్నై", "ചെന്നൈ", "ಚೆನ್ನೈ", "চেন্নাই"] },
  { name: "Nellore", aliases: ["nellore", "నెల్లూరు"] },
  { name: "Kakinada", aliases: ["kakinada", "కాకినాడ"] },
  { name: "Visakhapatnam", aliases: ["visakhapatnam", "vizag", "విశాఖపట్నం", "विशाखापत्तनम"] },
  { name: "Puri", aliases: ["puri", "ପୁରୀ", "पुरी"] },
  { name: "Paradip", aliases: ["paradip", "paradeep", "ପାରାଦ୍ୱୀପ"] },
  { name: "Digha", aliases: ["digha", "দীঘা", "दीघा"] },
  { name: "Kolkata", aliases: ["kolkata", "calcutta", "কলকাতা", "कोलकाता"] },
  { name: "Haldia", aliases: ["haldia", "হলদিয়া"] },
  { name: "Port Blair", aliases: ["port blair", "andaman", "पोर्ट ब्लेयर", "अंडमान"] },
  { name: "Kavaratti", aliases: ["kavaratti", "lakshadweep", "लक्षद्वीप"] },
  { name: "Veraval", aliases: ["veraval", "વેરાવળ", "वेरावल"] },
  { name: "Porbandar", aliases: ["porbandar", "પોરબંદર", "पोरबंदर"] },
  { name: "Okha", aliases: ["okha", "ઓખા", "ओखा"] },
  { name: "Dwarka", aliases: ["dwarka", "દ્વારકા", "द्वारका"] },
  { name: "Kandla", aliases: ["kandla", "કંડલા"] },
  { name: "Surat", aliases: ["surat", "સુરત", "सूरत"] },
  { name: "Daman", aliases: ["daman", "दमण", "દમણ"] },
  { name: "Diu", aliases: ["diu", "दीव", "દીવ"] },
  { name: "Jakhau", aliases: ["jakhau", "જખૌ"] },
];

const NORMALISED = COASTAL_PLACES.flatMap((p) =>
  p.aliases.map((a) => ({ alias: a.toLowerCase(), name: p.name })),
).sort((a, b) => b.alias.length - a.alias.length);

/** Find a known coastal place mentioned anywhere in a question, in any script. */
export function matchCoastalPlace(query: string): string | null {
  const q = query.toLowerCase();
  for (const entry of NORMALISED) {
    if (q.includes(entry.alias)) return entry.name;
  }
  return null;
}
