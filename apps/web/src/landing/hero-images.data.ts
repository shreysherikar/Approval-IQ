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
    id: 'heritage-gov',
    title: 'Statutory & Regulatory Governance',
    category: 'Regulatory Authorities',
    location: 'Bengaluru, India',
    url: 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?auto=format&fit=crop&w=1600&q=85',
    alt: 'Grand architectural government institution and state regulatory authority building in India',
    badgeText: 'State & Central Authorities',
  },
  {
    id: 'modern-manufacturing',
    title: 'Advanced Industrial Manufacturing',
    category: 'Manufacturing',
    location: 'Maharashtra, India',
    url: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1600&q=85',
    alt: 'Engineer overseeing precision automated industrial manufacturing plant with robotics',
    badgeText: 'Industrial Plant Approvals',
  },
  {
    id: 'pharma-biotech',
    title: 'Pharmaceuticals & Cleanroom Biotech',
    category: 'Pharmaceuticals',
    location: 'Hyderabad, India',
    url: 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1600&q=85',
    alt: 'Modern sterile pharmaceutical manufacturing cleanroom and analytical testing laboratory',
    badgeText: 'CDSCO & Pollution Compliance',
  },
  {
    id: 'smart-logistics',
    title: 'Smart Logistics & Cold Chain Supply',
    category: 'Logistics',
    location: 'NCR Corridor, India',
    url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1600&q=85',
    alt: 'Modern automated supply chain logistics terminal and warehouse facility',
    badgeText: 'Warehouse & PESO Approvals',
  },
  {
    id: 'brewery-processing',
    title: 'Brewery & Food Processing Plant',
    category: 'Food & Beverage',
    location: 'Karnataka, India',
    url: 'https://images.unsplash.com/photo-1584225064785-c62a8b43d148?auto=format&fit=crop&w=1600&q=85',
    alt: 'Stainless steel fermentation and brewing tanks in a modern craft brewery facility',
    badgeText: 'Excise & FSSAI Licenses',
  },
  {
    id: 'renewable-infrastructure',
    title: 'Sustainable Green Energy Infrastructure',
    category: 'Clean Energy',
    location: 'Rajasthan, India',
    url: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=1600&q=85',
    alt: 'Expansive utility-scale solar energy and wind farm development',
    badgeText: 'Environmental & Green Consents',
  },
  {
    id: 'business-leadership',
    title: 'Corporate Strategy & Regulatory Alignment',
    category: 'Enterprise Governance',
    location: 'Mumbai, India',
    url: 'https://images.unsplash.com/photo-1577495508048-b635879837f1?auto=format&fit=crop&w=1600&q=85',
    alt: 'Diverse executive business team strategizing in modern corporate boardroom',
    badgeText: 'Board-Level Assurance',
  },
  {
    id: 'chemical-engineering',
    title: 'Precision Chemical & Materials Processing',
    category: 'Chemical Processing',
    location: 'Gujarat, India',
    url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1600&q=85',
    alt: 'Modern chemical manufacturing plant pipelines, processing reactors and control systems',
    badgeText: 'SPCB Consent to Establish (CTE)',
  },
];
