export interface HeroImageItem {
  id: string;
  title: string;
  category: string;
  location: string;
  url: string;
  alt: string;
  badgeText: string;
}

/**
 * Curated list of high-quality, high-resolution imagery for ApprovalIQ.
 * Covers the entire spectrum:
 * Regulatory Heritage, Manufacturing, Laboratories, Logistics, Food Processing,
 * Clean Energy, Infrastructure, Modern Offices, and Entrepreneurship.
 *
 * NOTE: Images can easily be replaced or mapped to an external API (Unsplash/Pexels)
 * via this data module.
 */
export const HERO_IMAGES: HeroImageItem[] = [
  {
    id: 'chemical-engineering',
    title: 'Precision Chemical & Materials Processing',
    category: 'Chemical Processing',
    location: 'Gujarat, India',
    url: '/images/chemical_plant.jpg',
    alt: 'Modern chemical manufacturing plant pipelines, processing reactors and control systems',
    badgeText: 'SPCB Consent to Establish (CTE)',
  },
  {
    id: 'modern-manufacturing',
    title: 'Advanced Industrial Manufacturing & Robotics',
    category: 'Manufacturing & Robotics',
    location: 'Maharashtra, India',
    url: '/images/smart_manufacturing.jpg',
    alt: 'High-tech precision automated industrial manufacturing facility with robotics and telemetry',
    badgeText: 'Industrial Factory & DISH Approvals',
  },
  {
    id: 'brewery-processing',
    title: 'Brewery & Beverage Production Facility',
    category: 'Food & Beverage Fermentation',
    location: 'Pune, Maharashtra',
    url: '/images/brewery_facility.jpg',
    alt: 'State-of-the-art craft brewery brewhouse with stainless steel fermentation tanks',
    badgeText: 'Excise & FSSAI Licenses',
  },
  {
    id: 'pharma-biotech',
    title: 'Pharmaceuticals & Cleanroom Analytics',
    category: 'Pharma & Life Sciences',
    location: 'Hyderabad, India',
    url: '/images/pharma_cleanroom.jpg',
    alt: 'Sterile modern pharmaceutical cleanroom and analytical testing laboratory',
    badgeText: 'CDSCO & SPCB Red Category',
  },
  {
    id: 'renewable-infrastructure',
    title: 'Sustainable Green Energy Infrastructure',
    category: 'Clean Energy & Solar',
    location: 'Rajasthan, India',
    url: '/images/solar_green_park.jpg',
    alt: 'Panoramic utility-scale solar photovoltaic energy park and clean power grid',
    badgeText: 'Environmental & Green Subsidies',
  },
  {
    id: 'smart-logistics',
    title: 'Smart Logistics & Automated Warehousing',
    category: 'Logistics & Supply Chain',
    location: 'NCR Corridor, India',
    url: '/images/smart_logistics.jpg',
    alt: 'Automated supply chain distribution terminal with high-bay shelving and conveyors',
    badgeText: 'Warehouse & PESO Approvals',
  },
];
