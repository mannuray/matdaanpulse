/**
 * Maps each of Bihar's 243 assembly constituencies (by number) to a region code.
 *
 * Regions based on traditional geographic/cultural divisions:
 *   tirhut     — W/E Champaran, Sheohar, Sitamarhi, Muzaffarpur, Vaishali
 *   saran      — Saran, Siwan, Gopalganj
 *   mithila    — Darbhanga, Madhubani, Samastipur
 *   kosi       — Supaul, Saharsa, Madhepura
 *   seemanchal — Kishanganj, Araria, Purnia, Katihar
 *   ang        — Bhagalpur, Banka, Munger, Begusarai, Khagaria, Jamui, Lakhisarai
 *   magadh     — Patna, Nalanda, Nawada, Gaya, Jehanabad, Arwal, Aurangabad
 *   shahabad   — Rohtas, Kaimur
 *   bhojpur    — Bhojpur, Buxar
 *
 * Numbering follows the 2008 delimitation (used in 2010, 2015, 2020, 2025).
 */

function assign(map: Record<number, string>, from: number, to: number, region: string) {
  for (let i = from; i <= to; i++) map[i] = region;
}

const m: Record<number, string> = {};

// Tirhut: W. Champaran (1-10), E. Champaran (11-20), Sheohar (21),
//         Sitamarhi (22-28), Muzaffarpur (29-40), Vaishali (41-48)
assign(m, 1, 48, 'tirhut');

// Saran: Saran (49-56), Siwan (57-62), Gopalganj (63-68)
assign(m, 49, 68, 'saran');

// Mithila: Darbhanga (69-75), Madhubani (76-84), Samastipur (85-95)
assign(m, 69, 95, 'mithila');

// Kosi: Supaul (96-101), Saharsa (102-105), Madhepura (106-109)
assign(m, 96, 109, 'kosi');

// Seemanchal: Kishanganj (110-112), Araria (113-118), Purnia (119-124), Katihar (125-130)
assign(m, 110, 130, 'seemanchal');

// Ang: Bhagalpur (131-137), Banka (138-143), Munger (144-149),
//      Begusarai (150-155), Khagaria (156-159), Jamui (160-165), Lakhisarai (166-168)
assign(m, 131, 168, 'ang');

// Magadh: Patna (169-182), Nalanda (183-189), Nawada (190-195),
//         Gaya (196-205), Jehanabad (206-209), Arwal (210-211), Aurangabad (212-218)
assign(m, 169, 218, 'magadh');

// Shahabad: Rohtas (219-225), Kaimur (226-229)
assign(m, 219, 229, 'shahabad');

// Bhojpur: Bhojpur (230-236), Buxar (237-243)
assign(m, 230, 243, 'bhojpur');

export const biharRegionMap = m;
