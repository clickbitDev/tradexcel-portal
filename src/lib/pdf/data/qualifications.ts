/**
 * Edward Business College — Qualifications & RTO Configuration
 *
 * RTO Code: 45818
 * ABN: 86 643 641 990
 * Website: https://www.edwardbusinesscollege.edu.au
 *
 * Source: scopes.md — complete unit lists with core/elective designations
 */

export interface QualificationConfig {
  code: string;
  title: string;
  level: string;
  totalUnits: number;
  coreCount: number;
  electiveCount: number;
  entryRequirements: string;
  units: UnitEntry[];
}

export interface UnitEntry {
  code: string;
  title: string;
  type: 'core' | 'elective';
  /** Optional elective group label, e.g. 'A', 'B', 'Specialist Elective (A)' */
  group?: string;
}

export const RTO_CONFIG = {
  rtoCode: '45818',
  rtoName: 'Edward Business College PTY LTD',
  abn: '86 643 641 990',
  phone: '0451 781 759',
  email: 'info@edwardbusinesscollege.com',
  website: 'https://www.edwardbusinesscollege.edu.au',
  address: 'Level 2, 16 Figtree Drive, Sydney Olympic Park, NSW 2127',
  /** Path to RTO logo */
  logoPath: 'assets/logos/ebc-logo.png',
  /** Government logos */
  nrtLogoPath: 'assets/logos/nrt-transparent.png',
  aqfLogoPath: 'assets/logos/aqf-transparent.png',
  /** CEO / authorised signatory */
  ceoName: 'Md Kamruzzaman',
  ceoTitle: 'Chief Executive Officer',
  /** Optional path to signature image */
  signaturePath: 'assets/logos/ebc-signature.png',
  /** Font paths (relative to project root) */
  fonts: {
    montserrat: 'assets/fonts/Montserrat-Variable.ttf',
    raleway: 'assets/fonts/Raleway-Variable.ttf',
  },
} as const;

// ─────────────────────────────────────────────────────────────
// AHC30921 — Certificate III in Landscape Construction
// ─────────────────────────────────────────────────────────────
const AHC30921: QualificationConfig = {
  code: 'AHC30921',
  title: 'Certificate III in Landscape Construction',
  level: 'Certificate III',
  totalUnits: 17,
  coreCount: 10,
  electiveCount: 7,
  entryRequirements: 'No formal academic prerequisites. Must be 18+, basic English and numeracy, capacity for outdoor manual work.',
  units: [
    { code: 'AHCDRG305', title: 'Install drainage systems', type: 'core' },
    { code: 'AHCLSC311', title: 'Set out site for construction works', type: 'core' },
    { code: 'AHCLSC312', title: 'Construct brick and block structures and features', type: 'core' },
    { code: 'AHCLSC313', title: 'Construct stone structures and features, and install stone cladding', type: 'core' },
    { code: 'AHCLSC316', title: 'Implement a paving project', type: 'core' },
    { code: 'AHCLSC317', title: 'Construct landscape features using concrete', type: 'core' },
    { code: 'AHCLSC319', title: 'Implement a retaining wall project', type: 'core' },
    { code: 'AHCPCM306', title: 'Provide information on plants and their culture', type: 'core' },
    { code: 'AHCPGD307', title: 'Implement a plant establishment program', type: 'core' },
    { code: 'AHCSOL304', title: 'Implement soil improvements for garden and turf areas', type: 'core' },
    { code: 'CPCCWHS2001', title: 'Apply WHS requirements, policies and procedures in the construction industry', type: 'elective', group: 'A' },
    { code: 'AHCBUS407', title: 'Cost a project', type: 'elective', group: 'B' },
    { code: 'AHCGRI301', title: 'Maintain roof gardens, vertical gardens and green facades', type: 'elective', group: 'B' },
    { code: 'CPCCCA3028', title: 'Erect and dismantle formwork for footings and slabs on ground', type: 'elective', group: 'B' },
    { code: 'CPCCON3042', title: 'Finish concrete', type: 'elective', group: 'B' },
    { code: 'CPCCON3043', title: 'Cure concrete', type: 'elective', group: 'B' },
    { code: 'MSFFL3063', title: 'Install synthetic textile floor coverings in indoor and outdoor facilities', type: 'elective', group: 'B' },
  ],
};

// ─────────────────────────────────────────────────────────────
// AUR30620 — Certificate III in Light Vehicle Mechanical Technology
// ─────────────────────────────────────────────────────────────
const AUR30620: QualificationConfig = {
  code: 'AUR30620',
  title: 'Certificate III in Light Vehicle Mechanical Technology',
  level: 'Certificate III',
  totalUnits: 36,
  coreCount: 20,
  electiveCount: 16,
  entryRequirements: 'No formal academic prerequisites. Must be 16-18+, basic English and numeracy, physically capable of workshop tasks.',
  units: [
    { code: 'AURAEA002', title: 'Follow environmental and sustainability best practice in an automotive workplace', type: 'core' },
    { code: 'AURASA102', title: 'Follow safe working practices in an automotive workplace', type: 'core' },
    { code: 'AURETR112', title: 'Test and repair basic electrical circuits', type: 'core' },
    { code: 'AURETR123', title: 'Diagnose and repair spark ignition engine management systems', type: 'core' },
    { code: 'AURETR125', title: 'Test, charge and replace batteries and jump-start vehicles', type: 'core' },
    { code: 'AURETR129', title: 'Diagnose and repair charging systems', type: 'core' },
    { code: 'AURETR130', title: 'Diagnose and repair starting systems', type: 'core' },
    { code: 'AURETR131', title: 'Diagnose and repair ignition systems', type: 'core' },
    { code: 'AURLTB103', title: 'Diagnose and repair light vehicle hydraulic braking systems', type: 'core' },
    { code: 'AURLTD104', title: 'Diagnose and repair light vehicle steering systems', type: 'core' },
    { code: 'AURLTD105', title: 'Diagnose and repair light vehicle suspension systems', type: 'core' },
    { code: 'AURLTE102', title: 'Diagnose and repair light vehicle engines', type: 'core' },
    { code: 'AURLTZ101', title: 'Diagnose and repair light vehicle emission control systems', type: 'core' },
    { code: 'AURTTA104', title: 'Carry out servicing operations', type: 'core' },
    { code: 'AURTTA118', title: 'Develop and carry out diagnostic test strategies', type: 'core' },
    { code: 'AURTTB101', title: 'Inspect and service braking systems', type: 'core' },
    { code: 'AURTTC103', title: 'Diagnose and repair cooling systems', type: 'core' },
    { code: 'AURTTE104', title: 'Inspect and service engines', type: 'core' },
    { code: 'AURTTF101', title: 'Inspect and service petrol fuel systems', type: 'core' },
    { code: 'AURTTK102', title: 'Use and maintain tools and equipment in an automotive workplace', type: 'core' },
    { code: 'AURACA101', title: 'Respond to customer needs and enquiries in an automotive workplace', type: 'elective' },
    { code: 'AURETR010', title: 'Repair wiring harnesses and looms', type: 'elective' },
    { code: 'AURLTJ113', title: 'Remove, inspect and refit light vehicle wheel and tyre assemblies', type: 'elective' },
    { code: 'AURLTQ101', title: 'Diagnose and repair light vehicle final drive assemblies', type: 'elective' },
    { code: 'AURLTQ102', title: 'Diagnose and repair light vehicle drive shafts', type: 'elective' },
    { code: 'AURLTX101', title: 'Diagnose and repair light vehicle manual transmissions', type: 'elective' },
    { code: 'AURLTX102', title: 'Diagnose and repair light vehicle automatic transmissions', type: 'elective' },
    { code: 'AURLTX103', title: 'Diagnose and repair light vehicle clutch systems', type: 'elective' },
    { code: 'AURTTA105', title: 'Select and use bearings, seals, gaskets, sealants and adhesives', type: 'elective' },
    { code: 'AURTTB015', title: 'Assemble and fit braking system components', type: 'elective' },
    { code: 'AURTTC001', title: 'Inspect and service cooling systems', type: 'elective' },
    { code: 'AURTTD002', title: 'Inspect and service steering systems', type: 'elective' },
    { code: 'AURTTD004', title: 'Inspect and service suspension systems', type: 'elective' },
    { code: 'AURTTK001', title: 'Use and maintain measuring equipment in an automotive workplace', type: 'elective' },
    { code: 'AURTTX102', title: 'Inspect and service manual transmissions', type: 'elective' },
    { code: 'AURTTX103', title: 'Inspect and service automatic transmissions', type: 'elective' },
  ],
};

// ─────────────────────────────────────────────────────────────
// AUR31120 — Certificate III in Heavy Commercial Vehicle Mechanical Technology
// ─────────────────────────────────────────────────────────────
const AUR31120: QualificationConfig = {
  code: 'AUR31120',
  title: 'Certificate III in Heavy Commercial Vehicle Mechanical Technology',
  level: 'Certificate III',
  totalUnits: 37,
  coreCount: 22,
  electiveCount: 15,
  entryRequirements: 'No formal academic prerequisites. Must be 16-18+, basic English and numeracy, physically capable of workshop tasks.',
  units: [
    { code: 'AURAEA002', title: 'Follow environmental and sustainability best practice in an automotive workplace', type: 'core' },
    { code: 'AURASA102', title: 'Follow safe working practices in an automotive workplace', type: 'core' },
    { code: 'AURETR112', title: 'Test and repair basic electrical circuits', type: 'core' },
    { code: 'AURETR122', title: 'Diagnose and repair vehicle dynamic control systems', type: 'core' },
    { code: 'AURETR124', title: 'Diagnose and repair compression ignition engine management systems', type: 'core' },
    { code: 'AURETR125', title: 'Test, charge and replace batteries and jump-start vehicles', type: 'core' },
    { code: 'AURETR129', title: 'Diagnose and repair charging systems', type: 'core' },
    { code: 'AURETR130', title: 'Diagnose and repair starting systems', type: 'core' },
    { code: 'AURHTB101', title: 'Diagnose and repair heavy vehicle air braking systems', type: 'core' },
    { code: 'AURHTD102', title: 'Diagnose and repair heavy commercial vehicle steering systems', type: 'core' },
    { code: 'AURHTD103', title: 'Diagnose and repair heavy commercial vehicle suspension systems', type: 'core' },
    { code: 'AURHTE102', title: 'Diagnose and repair heavy vehicle compression ignition engines', type: 'core' },
    { code: 'AURHTQ103', title: 'Diagnose and repair heavy vehicle drive shafts', type: 'core' },
    { code: 'AURHTZ101', title: 'Diagnose and repair heavy vehicle emission control systems', type: 'core' },
    { code: 'AURTTA006', title: 'Inspect and service hydraulic systems', type: 'core' },
    { code: 'AURTTA104', title: 'Carry out servicing operations', type: 'core' },
    { code: 'AURTTA118', title: 'Develop and carry out diagnostic test strategies', type: 'core' },
    { code: 'AURTTC103', title: 'Diagnose and repair cooling systems', type: 'core' },
    { code: 'AURTTF102', title: 'Inspect and service diesel fuel injection systems', type: 'core' },
    { code: 'AURTTF105', title: 'Diagnose and repair engine forced-induction systems', type: 'core' },
    { code: 'AURTTK102', title: 'Use and maintain tools and equipment in an automotive workplace', type: 'core' },
    { code: 'AURTTQ001', title: 'Inspect and service final drive assemblies', type: 'core' },
    { code: 'AURHTX101', title: 'Diagnose and repair heavy vehicle manual transmissions', type: 'elective', group: 'Specialist Elective (A)' },
    { code: 'AURHTX103', title: 'Diagnose and repair heavy vehicle automatic transmissions', type: 'elective', group: 'Specialist Elective (B)' },
    { code: 'AURAFA103', title: 'Communicate effectively in an automotive workplace', type: 'elective', group: 'General' },
    { code: 'AURETR132', title: 'Diagnose and repair automotive electrical systems', type: 'elective', group: 'General' },
    { code: 'AURETR144', title: 'Diagnose and repair integrated engine and transmission management systems', type: 'elective', group: 'General' },
    { code: 'AURTTA105', title: 'Select and use bearings, seals, gaskets, sealants and adhesives', type: 'elective', group: 'General' },
    { code: 'AURTTB004', title: 'Inspect and service air braking systems', type: 'elective', group: 'General' },
    { code: 'AURTTB101', title: 'Inspect and service braking systems', type: 'elective', group: 'General' },
    { code: 'AURTTD002', title: 'Inspect and service steering systems', type: 'elective', group: 'General' },
    { code: 'AURTTD004', title: 'Inspect and service suspension systems', type: 'elective', group: 'General' },
    { code: 'AURTTE104', title: 'Inspect and service engines', type: 'elective', group: 'General' },
    { code: 'AURTTK001', title: 'Use and maintain measuring equipment in an automotive workplace', type: 'elective', group: 'General' },
    { code: 'AURTTX102', title: 'Inspect and service manual transmissions', type: 'elective', group: 'General' },
    { code: 'AURTTX103', title: 'Inspect and service automatic transmissions', type: 'elective', group: 'General' },
  ],
};

// ─────────────────────────────────────────────────────────────
// BSB50420 — Diploma of Leadership and Management
// ─────────────────────────────────────────────────────────────
const BSB50420: QualificationConfig = {
  code: 'BSB50420',
  title: 'Diploma of Leadership and Management',
  level: 'Diploma',
  totalUnits: 12,
  coreCount: 6,
  electiveCount: 6,
  entryRequirements: 'Nil. Recommended: 18+, Year 12 or equivalent, basic computer/communication skills.',
  units: [
    { code: 'BSBCMM511', title: 'Communicate with influence', type: 'core' },
    { code: 'BSBCRT511', title: 'Develop critical thinking in others', type: 'core' },
    { code: 'BSBLDR523', title: 'Lead and manage effective workplace relationships', type: 'core' },
    { code: 'BSBOPS502', title: 'Manage business operational plans', type: 'core' },
    { code: 'BSBPEF502', title: 'Develop and use emotional intelligence', type: 'core' },
    { code: 'BSBTWK502', title: 'Manage team effectiveness', type: 'core' },
    { code: 'BSBCMM412', title: 'Lead difficult conversations', type: 'elective' },
    { code: 'BSBLDR522', title: 'Manage people performance', type: 'elective' },
    { code: 'BSBOPS504', title: 'Manage business risk', type: 'elective' },
    { code: 'BSBOPS505', title: 'Manage organisational customer service', type: 'elective' },
    { code: 'BSBTWK503', title: 'Manage meetings', type: 'elective' },
    { code: 'BSBXCM501', title: 'Lead communication in the workplace', type: 'elective' },
  ],
};

// ─────────────────────────────────────────────────────────────
// BSB60420 — Advanced Diploma of Leadership and Management
// ─────────────────────────────────────────────────────────────
const BSB60420: QualificationConfig = {
  code: 'BSB60420',
  title: 'Advanced Diploma of Leadership and Management',
  level: 'Advanced Diploma',
  totalUnits: 10,
  coreCount: 5,
  electiveCount: 5,
  entryRequirements: 'Recommended: Completed Diploma/Advanced Diploma from BSB, or 2 years relevant workplace experience in leadership.',
  units: [
    { code: 'BSBCRT611', title: 'Apply critical thinking for complex problem solving', type: 'core' },
    { code: 'BSBLDR601', title: 'Lead and manage organisational change', type: 'core' },
    { code: 'BSBLDR602', title: 'Provide leadership across the organisation', type: 'core' },
    { code: 'BSBOPS601', title: 'Develop and implement business plans', type: 'core' },
    { code: 'BSBSTR601', title: 'Manage innovation and continuous improvement', type: 'core' },
    { code: 'BSBHRM613', title: 'Contribute to the development of learning and development strategies', type: 'elective' },
    { code: 'BSBHRM614', title: 'Contribute to strategic workforce planning', type: 'elective' },
    { code: 'BSBPEF501', title: 'Manage personal and professional development', type: 'elective' },
    { code: 'BSBSTR602', title: 'Develop organisational strategies', type: 'elective' },
    { code: 'BSBSTR801', title: 'Lead innovative thinking and practice', type: 'elective' },
  ],
};

// ─────────────────────────────────────────────────────────────
// CPC30620 — Certificate III in Painting and Decorating
// ─────────────────────────────────────────────────────────────
const CPC30620: QualificationConfig = {
  code: 'CPC30620',
  title: 'Certificate III in Painting and Decorating',
  level: 'Certificate III',
  totalUnits: 28,
  coreCount: 25,
  electiveCount: 3,
  entryRequirements: 'No formal academic prerequisites. Must be 16-18+, basic English and numeracy, physically capable.',
  units: [
    { code: 'CPCCCM2008', title: 'Erect and dismantle restricted height scaffolding', type: 'core' },
    { code: 'CPCCCM2012', title: 'Work safely at heights', type: 'core' },
    { code: 'CPCCCM3001', title: 'Operate elevated work platforms up to 11 metres', type: 'core' },
    { code: 'CPCCCM3005', title: 'Calculate costs of construction work', type: 'core' },
    { code: 'CPCCOM1012', title: 'Work effectively and sustainably in the construction industry', type: 'core' },
    { code: 'CPCCOM1013', title: 'Plan and organise work', type: 'core' },
    { code: 'CPCCOM1014', title: 'Conduct workplace communication', type: 'core' },
    { code: 'CPCCOM1015', title: 'Carry out measurements and calculations', type: 'core' },
    { code: 'CPCCOM2001', title: 'Read and interpret plans and specifications', type: 'core' },
    { code: 'CPCCPB3026', title: 'Erect and maintain trestle and plank systems', type: 'core' },
    { code: 'CPCCPD2011', title: 'Handle and store painting and decorating materials', type: 'core' },
    { code: 'CPCCPD2012', title: 'Use painting and decorating tools and equipment', type: 'core' },
    { code: 'CPCCPD2013', title: 'Remove and replace doors and doors and window components', type: 'core' },
    { code: 'CPCCPD3021', title: 'Prepare existing coated surface for painting', type: 'core' },
    { code: 'CPCCPD3022', title: 'Apply paint by brush and roller', type: 'core' },
    { code: 'CPCCPD3023', title: 'Apply texture coat paint finishes by brush, roller and spray', type: 'core' },
    { code: 'CPCCPD3024', title: 'Apply paint by spray', type: 'core' },
    { code: 'CPCCPD3025', title: 'Match specific paint colours', type: 'core' },
    { code: 'CPCCPD3026', title: 'Apply stains and clear timber finishes', type: 'core' },
    { code: 'CPCCPD3027', title: 'Remove and apply wallpaper', type: 'core' },
    { code: 'CPCCPD3028', title: 'Apply decorative paint finishes', type: 'core' },
    { code: 'CPCCPD3030', title: 'Apply protective paint coating systems', type: 'core' },
    { code: 'CPCCPD3031', title: 'Work safely with lead-painted surfaces in the painting industry', type: 'core' },
    { code: 'CPCCPD3035', title: 'Prepare uncoated surfaces for painting', type: 'core' },
    { code: 'CPCCPD3036', title: 'Work safely to encapsulate non-friable asbestos in the painting industry', type: 'core' },
    { code: 'CPCCWHS2001', title: 'Apply WHS requirements, policies and procedures in the construction industry', type: 'core' },
    { code: 'BSBESB303', title: 'Organise finances for new business venture', type: 'elective' },
    { code: 'BSBESB407', title: 'Manage finances for new business ventures', type: 'elective' },
    { code: 'CPCCSP3003', title: 'Apply trowelled texture coat finishes', type: 'elective' },
  ],
};

// ─────────────────────────────────────────────────────────────
// CPC32420 — Certificate III in Plumbing
// ─────────────────────────────────────────────────────────────
const CPC32420: QualificationConfig = {
  code: 'CPC32420',
  title: 'Certificate III in Plumbing',
  level: 'Certificate III',
  totalUnits: 59,
  coreCount: 43,
  electiveCount: 16,
  entryRequirements: 'No formal academic prerequisites. Must be 16-18+, basic English and numeracy, physically capable.',
  units: [
    { code: 'CPCCCM2012', title: 'Work safely at heights', type: 'core' },
    { code: 'CPCPCM2039', title: 'Carry out interactive workplace communication', type: 'core' },
    { code: 'CPCPCM2040', title: 'Read plans, calculate quantities and mark out materials', type: 'core' },
    { code: 'CPCPCM2041', title: 'Work effectively in the plumbing services sector', type: 'core' },
    { code: 'CPCPCM2043', title: 'Carry out WHS requirements', type: 'core' },
    { code: 'CPCPCM2045', title: 'Handle and store plumbing materials', type: 'core' },
    { code: 'CPCPCM2046', title: 'Use plumbing hand and power tools', type: 'core' },
    { code: 'CPCPCM2047', title: 'Carry out levelling', type: 'core' },
    { code: 'CPCPCM2048', title: 'Cut and join sheet metal', type: 'core' },
    { code: 'CPCPCM2054', title: 'Carry out simple concreting and rendering', type: 'core' },
    { code: 'CPCPCM2055', title: 'Work safely on roofs', type: 'core' },
    { code: 'CPCPCM3021', title: 'Flash penetrations through roofs and walls', type: 'core' },
    { code: 'CPCPCM3022', title: 'Weld polymer pipes using fusion method', type: 'core' },
    { code: 'CPCPCM3023', title: 'Fabricate and install non-ferrous pressure piping', type: 'core' },
    { code: 'CPCPCM3024', title: 'Prepare simple drawings', type: 'core' },
    { code: 'CPCPCM3025', title: 'Install trench support', type: 'core' },
    { code: 'CPCPDR2021', title: 'Locate and clear blockages', type: 'core' },
    { code: 'CPCPDR2025', title: 'Install stormwater and sub-soil drainage systems and drain work site', type: 'core' },
    { code: 'CPCPDR2026', title: 'Install prefabricated inspection openings and inspection chambers', type: 'core' },
    { code: 'CPCPDR3021', title: 'Plan layout and install below ground sanitary drainage systems', type: 'core' },
    { code: 'CPCPDR3023', title: 'Install on-site domestic wastewater treatment plants and disposal systems', type: 'core' },
    { code: 'CPCPFS3031', title: 'Fabricate and install fire hydrant and hose reel systems', type: 'core' },
    { code: 'CPCPGS3048', title: 'Install gas pressure control equipment', type: 'core' },
    { code: 'CPCPGS3049', title: 'Install gas appliance flues', type: 'core' },
    { code: 'CPCPGS3051', title: 'Purge consumer piping', type: 'core' },
    { code: 'CPCPGS3053', title: 'Disconnect and reconnect Type A gas appliances', type: 'core' },
    { code: 'CPCPGS3054', title: 'Calculate and install natural ventilation for Type A gas appliances', type: 'core' },
    { code: 'CPCPGS3056', title: 'Size and install consumer gas piping systems', type: 'core' },
    { code: 'CPCPGS3059', title: 'Install LPG storage of aggregate storage capacity up to 500 litres', type: 'core' },
    { code: 'CPCPGS3061', title: 'Install and commission Type A gas appliances', type: 'core' },
    { code: 'CPCPRF2023', title: 'Collect and store roof water', type: 'core' },
    { code: 'CPCPRF3022', title: 'Fabricate and install roof drainage systems', type: 'core' },
    { code: 'CPCPRF3023', title: 'Fabricate and install external flashings', type: 'core' },
    { code: 'CPCPRF3024', title: 'Install roof components', type: 'core' },
    { code: 'CPCPSN3011', title: 'Plan the layout of a residential sanitary plumbing system and fabricate and install sanitary stacks', type: 'core' },
    { code: 'CPCPSN3022', title: 'Install discharge pipes', type: 'core' },
    { code: 'CPCPWT3020', title: 'Connect and install storage tanks to a domestic water supply', type: 'core' },
    { code: 'CPCPWT3021', title: 'Set out and install water services', type: 'core' },
    { code: 'CPCPWT3022', title: 'Install and commission water heating systems and adjust controls and devices', type: 'core' },
    { code: 'CPCPWT3025', title: 'Install water pumpsets', type: 'core' },
    { code: 'CPCPWT3026', title: 'Install and fit off sanitary fixtures, water services and adjust water service controls', type: 'core' },
    { code: 'CPCPWT3027', title: 'Install backflow prevention devices', type: 'core' },
    { code: 'HLTAID011', title: 'Provide First Aid', type: 'core' },
    { code: 'CPCCCM2008', title: 'Erect and dismantle restricted height scaffolding', type: 'elective' },
    { code: 'CPCPCM2053', title: 'Weld using metal arc welding equipment', type: 'elective' },
    { code: 'CPCPDR3025', title: 'Plan layout and install vacuum drainage systems', type: 'elective' },
    { code: 'CPCPFS3037', title: 'Install residential life safety sprinkler systems', type: 'elective' },
    { code: 'CPCPFS3038', title: 'Test and maintain fire hydrant and hose reel installations', type: 'elective' },
    { code: 'CPCPGS3052', title: 'Maintain Type A gas appliances', type: 'elective' },
    { code: 'CPCPGS3055', title: 'Install gas sub-meters', type: 'elective' },
    { code: 'CPCPGS3060', title: 'Install LPG storage of aggregate storage capacity exceeding 500 litres and less than 8 kl', type: 'elective' },
    { code: 'CPCPIG2021', title: 'Design domestic urban irrigation systems', type: 'elective' },
    { code: 'CPCPIG3021', title: 'Design domestic urban irrigation systems', type: 'elective' },
    { code: 'CPCPSN3025', title: 'Install pre-treatment facilities', type: 'elective' },
    { code: 'CPCPSN3026', title: 'Install sewerage pumpsets', type: 'elective' },
    { code: 'CPCPWT3028', title: 'Install property service', type: 'elective' },
    { code: 'CPCPWT3029', title: 'Install water pipe systems', type: 'elective' },
    { code: 'CPCPWT3030', title: 'Install home fire sprinkler systems', type: 'elective' },
  ],
};

// ─────────────────────────────────────────────────────────────
// CPC40920 — Certificate IV in Plumbing and Services
// ─────────────────────────────────────────────────────────────
const CPC40920: QualificationConfig = {
  code: 'CPC40920',
  title: 'Certificate IV in Plumbing and Services',
  level: 'Certificate IV',
  totalUnits: 15,
  coreCount: 10,
  electiveCount: 5,
  entryRequirements: 'CPC32420 Certificate III in Plumbing or equivalent. Relevant plumbing trade experience.',
  units: [
    { code: 'BSBESB402', title: 'Establish legal and risk management requirements of new business ventures', type: 'core' },
    { code: 'CPCCBC4012', title: 'Read and interpret plans and specifications', type: 'core' },
    { code: 'CPCPCM4011', title: 'Carry out work-based risk control processes', type: 'core' },
    { code: 'CPCPCM4012', title: 'Estimate and cost work', type: 'core' },
    { code: 'CPCPCM4015', title: 'Access and interpret regulatory requirements for the plumbing and services industry', type: 'core' },
    { code: 'CPCPDR4011', title: 'Design and size sanitary drainage systems', type: 'core' },
    { code: 'CPCPDR4012', title: 'Design and size stormwater drainage systems', type: 'core' },
    { code: 'CPCPGS4011', title: 'Design and size consumer gas installations', type: 'core' },
    { code: 'CPCPSN4011', title: 'Design and size sanitary plumbing systems', type: 'core' },
    { code: 'CPCPWT4011', title: 'Design and size heated and cold-water services and systems', type: 'core' },
    { code: 'BSBESB403', title: 'Plan finances for new business ventures', type: 'elective' },
    { code: 'CPCCBC4002', title: 'Manage work health and safety in the building and construction workplace', type: 'elective' },
    { code: 'CPCCBC4019', title: 'Apply sustainable building design principles to water management systems', type: 'elective' },
    { code: 'CPCCBC4024', title: 'Resolve business disputes', type: 'elective' },
    { code: 'CPCPCM2043', title: 'Carry out WHS requirements', type: 'elective' },
  ],
};

// ─────────────────────────────────────────────────────────────
// MEM30219 — Certificate III in Engineering - Mechanical Trade
// ─────────────────────────────────────────────────────────────
const MEM30219: QualificationConfig = {
  code: 'MEM30219',
  title: 'Certificate III in Engineering - Mechanical Trade',
  level: 'Certificate III',
  totalUnits: 28,
  coreCount: 12,
  electiveCount: 16,
  entryRequirements: 'No formal academic prerequisites. Must be 16-18+, basic English and numeracy, physically capable of workshop tasks.',
  units: [
    { code: 'MEM09002', title: 'Interpret technical drawing', type: 'core' },
    { code: 'MEM11011', title: 'Undertake manual handling', type: 'core' },
    { code: 'MEM12023', title: 'Perform engineering measurements', type: 'core' },
    { code: 'MEM12024', title: 'Perform computations', type: 'core' },
    { code: 'MEM13015', title: 'Work safely and effectively in manufacturing and engineering', type: 'core' },
    { code: 'MEM14006', title: 'Plan work activities', type: 'core' },
    { code: 'MEM16006', title: 'Organise and communicate information', type: 'core' },
    { code: 'MEM16008', title: 'Interact with computing technology', type: 'core' },
    { code: 'MEM17003', title: 'Assist in the provision of on-the-job training', type: 'core' },
    { code: 'MEM18001', title: 'Use hand tools', type: 'core' },
    { code: 'MEM18002', title: 'Use power tools/handheld operations', type: 'core' },
    { code: 'MSMENV272', title: 'Participate in environmentally sustainable work practices', type: 'core' },
    { code: 'MEM05005', title: 'Carry out mechanical cutting', type: 'elective', group: 'A' },
    { code: 'MEM07005', title: 'Perform general machining', type: 'elective', group: 'A' },
    { code: 'MEM07006', title: 'Perform lathe operations', type: 'elective', group: 'A' },
    { code: 'MEM07007', title: 'Perform milling operations', type: 'elective', group: 'A' },
    { code: 'MEM07008', title: 'Perform grinding operations', type: 'elective', group: 'A' },
    { code: 'MEM07011', title: 'Perform complex milling operations', type: 'elective', group: 'A' },
    { code: 'MEM07015', title: 'Set computer-controlled machines and processes', type: 'elective', group: 'D' },
    { code: 'MEM07016', title: 'Set and edit computer-controlled machines and processes', type: 'elective', group: 'D' },
    { code: 'MEM07024', title: 'Operate and monitor machine and process', type: 'elective' },
    { code: 'MEM07028', title: 'Operate computer-controlled machines and processes', type: 'elective' },
    { code: 'MEM12003', title: 'Perform precision mechanical measurement', type: 'elective', group: 'A' },
    { code: 'MEM12006', title: 'Mark off/out (general engineering)', type: 'elective', group: 'A' },
    { code: 'MEM18003', title: 'Use tools for precision work', type: 'elective', group: 'A' },
    { code: 'MEM18006', title: 'Perform precision fitting of engineering components', type: 'elective', group: 'B' },
    { code: 'MEM18009', title: 'Perform precision levelling and alignment of machines and engineering components', type: 'elective', group: 'B' },
    { code: 'MEM18011', title: 'Shut down and isolate machines/equipment', type: 'elective', group: 'D' },
    { code: 'MEM18055', title: 'Dismantle, replace and assemble engineering components', type: 'elective', group: 'D' },
  ],
};

// ─────────────────────────────────────────────────────────────
// MEM31922 — Certificate III in Engineering - Fabrication Trade
// ─────────────────────────────────────────────────────────────
const MEM31922: QualificationConfig = {
  code: 'MEM31922',
  title: 'Certificate III in Engineering - Fabrication Trade',
  level: 'Certificate III',
  totalUnits: 32,
  coreCount: 12,
  electiveCount: 20,
  entryRequirements: 'No formal academic prerequisites. Must be 16-18+, basic English and numeracy, physically capable of workshop tasks.',
  units: [
    { code: 'MEM09002', title: 'Interpret technical drawing', type: 'core' },
    { code: 'MEM11011', title: 'Undertake manual handling', type: 'core' },
    { code: 'MEM12023', title: 'Perform engineering measurements', type: 'core' },
    { code: 'MEM12024', title: 'Perform computations', type: 'core' },
    { code: 'MEM13015', title: 'Work safely and effectively in manufacturing and engineering', type: 'core' },
    { code: 'MEM14006', title: 'Plan work activities', type: 'core' },
    { code: 'MEM16006', title: 'Organise and communicate information', type: 'core' },
    { code: 'MEM16008', title: 'Interact with computing technology', type: 'core' },
    { code: 'MEM17003', title: 'Assist in the provision of on-the-job training', type: 'core' },
    { code: 'MEM18001', title: 'Use hand tools', type: 'core' },
    { code: 'MEM18002', title: 'Use power tools/handheld operations', type: 'core' },
    { code: 'MSMENV272', title: 'Participate in environmentally sustainable work practices', type: 'core' },
    { code: 'MEM05005', title: 'Carry out mechanical cutting', type: 'elective', group: 'A' },
    { code: 'MEM05007', title: 'Perform manual heating and thermal cutting', type: 'elective', group: 'A' },
    { code: 'MEM05012', title: 'Perform routine manual metal arc welding', type: 'elective', group: 'A' },
    { code: 'MEM05014', title: 'Monitor quality of production welding/fabrications', type: 'elective', group: 'A' },
    { code: 'MEM05049', title: 'Perform routine gas tungsten arc welding', type: 'elective', group: 'A' },
    { code: 'MEM05050', title: 'Perform routine gas metal arc welding', type: 'elective', group: 'A' },
    { code: 'MEM05052', title: 'Apply safe welding practices', type: 'elective', group: 'A' },
    { code: 'MEM05056', title: 'Perform routine flux core arc welding', type: 'elective', group: 'A' },
    { code: 'MEM05071', title: 'Perform advanced manual thermal cutting, gouging and shaping', type: 'elective', group: 'A' },
    { code: 'MEM05072', title: 'Perform advanced welding using manual metal arc welding process', type: 'elective', group: 'C' },
    { code: 'MEM05074', title: 'Perform advanced welding using gas tungsten arc welding process', type: 'elective', group: 'C' },
    { code: 'MEM05085', title: 'Select welding processes', type: 'elective', group: 'C' },
    { code: 'MEM05089', title: 'Assemble fabricated components', type: 'elective', group: 'C' },
    { code: 'MEM05090', title: 'Weld using manual metal arc welding process', type: 'elective', group: 'B' },
    { code: 'MEM05092', title: 'Weld using gas tungsten arc welding process', type: 'elective', group: 'C' },
    { code: 'MEM05094', title: 'Repair, replace and/or modify fabrications', type: 'elective', group: 'D' },
    { code: 'MEM10010', title: 'Install pipework and pipework assemblies', type: 'elective', group: 'H' },
    { code: 'MEM12007', title: 'Mark off/out structural fabrications and shapes', type: 'elective', group: 'H' },
    { code: 'MEM15004', title: 'Perform inspection', type: 'elective', group: 'H' },
    { code: 'MEM18055', title: 'Dismantle, replace and assemble engineering components', type: 'elective', group: 'H' },
  ],
};

// ─────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────

export const QUALIFICATIONS: QualificationConfig[] = [
  AHC30921,
  AUR30620,
  AUR31120,
  BSB50420,
  BSB60420,
  CPC30620,
  CPC32420,
  CPC40920,
  MEM30219,
  MEM31922,
];

/**
 * Look up a qualification by its code.
 */
export function getQualification(code: string): QualificationConfig | undefined {
  return QUALIFICATIONS.find(q => q.code === code);
}

/**
 * Get all qualification codes.
 */
export function getAllQualificationCodes(): string[] {
  return QUALIFICATIONS.map(q => q.code);
}
