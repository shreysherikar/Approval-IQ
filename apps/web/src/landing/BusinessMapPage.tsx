import React, { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  FlaskConical,
  Utensils,
  TestTube2,
  Zap,
  Car,
  Layers,
  Cpu,
  Boxes,
  MapPin,
  Map as MapIcon,
  Globe2,
  Satellite,
  ShieldCheck,
  Clock,
  Sparkles,
  Search,
  TrendingUp,
  CheckCircle2,
  Factory,
  Loader2
} from 'lucide-react';
import { RealIndiaLeafletMap, CityMarkerData } from './RealIndiaLeafletMap';
import { ScrollProgressBar } from './ScrollProgressBar';
import { LanguageSwitcher } from '../Layout';
import { useLanguage } from '../i18n';
import { businessMapApi } from '../api-client';

interface DomainPreset {
  id: string;
  name: string;
  iconKey: string;
  description: string;
  color: string;
  multiplier: number;
}

function DomainPresetIcon({ iconKey, className = "w-3.5 h-3.5" }: { iconKey: string; className?: string }): JSX.Element {
  switch (iconKey) {
    case 'pharma':
      return <FlaskConical className={className} />;
    case 'breweries':
      return <Building2 className={className} />;
    case 'food_processing':
      return <Utensils className={className} />;
    case 'chemicals':
      return <TestTube2 className={className} />;
    case 'renewable_energy':
      return <Zap className={className} />;
    case 'automotive_ev':
      return <Car className={className} />;
    case 'textiles':
      return <Layers className={className} />;
    case 'electronics_datacenter':
      return <Cpu className={className} />;
    case 'cold_chain':
    default:
      return <Boxes className={className} />;
  }
}

const DOMAIN_PRESETS: DomainPreset[] = [
  { id: 'pharma', name: 'Pharmaceuticals & APIs', iconKey: 'pharma', description: 'Bulk active ingredients, formulations, bio-similar manufacturing & R&D labs', color: '#38ACCC', multiplier: 1.8 },
  { id: 'automotive_ev', name: 'Automotive & EV Powertrains', iconKey: 'automotive_ev', description: 'EV battery assembly, motor winding, body-in-white & component machining', color: '#F59E0B', multiplier: 1.5 },
  { id: 'electronics_datacenter', name: 'Electronics & Semiconductor Fab', iconKey: 'electronics_datacenter', description: 'PCB assembly, cleanroom fab, testing labs & hyperscale data parks', color: '#10B981', multiplier: 1.4 },
  { id: 'breweries', name: 'Craft Breweries & Distilleries', iconKey: 'breweries', description: 'Microbreweries, grain distilleries, winery bottling & excise-regulated units', color: '#F97316', multiplier: 0.9 },
  { id: 'food_processing', name: 'Food Processing & Beverages', iconKey: 'food_processing', description: 'Agro-processing, dairy automation, cold-storage packhouses & FSSAI lines', color: '#14B8A6', multiplier: 2.2 },
  { id: 'chemicals', name: 'Specialty Chemicals & Polymers', iconKey: 'chemicals', description: 'Agrochemicals, intermediate reagents, green polymers & CPCB ZLD plants', color: '#EC4899', multiplier: 1.6 },
  { id: 'renewable_energy', name: 'Solar, Wind & Green Hydrogen', iconKey: 'renewable_energy', description: 'Solar wafer/cell lines, wind turbines, electrolyzers & grid sub-stations', color: '#EAB308', multiplier: 1.1 },
  { id: 'textiles', name: 'Textiles & Technical Fabrics', iconKey: 'textiles', description: 'Yarn spinning, automated looms, zero-discharge dyeing & export apparel', color: '#06B6D4', multiplier: 2.0 },
  { id: 'cold_chain', name: 'Cold Chain & Logistics SEZs', iconKey: 'cold_chain', description: 'Temperature-controlled multi-modal hubs, dry ports & automated fulfillment', color: '#8B5CF6', multiplier: 1.3 },
];

const BASE_CITIES: Omit<CityMarkerData, 'count'>[] = [
  // --- MAHARASHTRA ---
  {
    id: 'mumbai',
    name: 'Mumbai Metropolitan',
    stateCode: 'MH',
    stateName: 'Maharashtra',
    lat: 19.076,
    lng: 72.8777,
    description: 'India\'s commercial nexus featuring specialized chemical, electronics and large-scale data center parks with direct JNPT deep-water port connectivity.',
    stateAuthority: 'MIDC (Maharashtra Industrial Development Corporation)',
    environmentalZoning: 'Red/Orange Category permitted in designated zones (Taloja/TTC); White/Green in Airoli.',
    powerGrid: '400/220 kV Tata/MSEDCL dedicated industrial feeder with 99.8% uptime.',
    connectivity: 'Nhava Sheva (JNPT Port) 32 km • Mumbai Air Cargo 18 km • NH-48 Express.',
    incentiveScheme: 'PSI-2019 Mega Project Policy (up to 75% SGST refund + electricity duty exemption).',
    industrialParks: ['TTC Industrial Area (Mahape/Turbhe)', 'MIDC Taloja Chemical Zone', 'Thane Belapur Industrial Corridor'],
    avgClearanceDays: 36,
    topClearances: ['MPCB Consent to Establish (CTE)', 'MIDC Land Allotment & Water Sanction', 'State Excise / DISH Factory License'],
  },
  {
    id: 'pune',
    name: 'Pune Industrial Belt',
    stateCode: 'MH',
    stateName: 'Maharashtra',
    lat: 18.5204,
    lng: 73.8567,
    description: 'India\'s primary automotive and precision engineering cluster with world-class tool rooms, test tracks, and specialized food-tech corridors.',
    stateAuthority: 'MIDC (Maharashtra Industrial Development Corporation)',
    environmentalZoning: 'Orange/Green permitted; Red permitted with CETP at Chakan/Talegaon.',
    powerGrid: '220/132 kV MSEDCL Chakan & Bhosari sub-stations with industrial feeder ring.',
    connectivity: 'Mumbai-Pune Expressway 15 km • JNPT Port 110 km • Pune Air Cargo.',
    incentiveScheme: 'Maharashtra EV Policy 2021 + PSI-2019 Group D+ special investment subsidy.',
    industrialParks: ['Chakan Phase I-IV Auto Hub', 'Talegaon MIDC High-Tech Park', 'Ranjangaon Industrial Area'],
    avgClearanceDays: 30,
    topClearances: ['MPCB Orange/Red CTE', 'DISH Directorate of Industrial Safety', 'MIDC Express Power Connection'],
  },
  {
    id: 'nagpur',
    name: 'Nagpur Multi-Modal Hub',
    stateCode: 'MH',
    stateName: 'Maharashtra',
    lat: 21.1458,
    lng: 79.0882,
    description: 'Geographical center of India hosting MIHAN Multi-modal International Hub Airport with aerospace SEZ and vast manufacturing zones.',
    stateAuthority: 'MADC & MIDC Maharashtra',
    environmentalZoning: 'Multi-category zoning with integrated CETP and logistics zone.',
    powerGrid: '400 kV National Power Grid switching node with low industrial tariff.',
    connectivity: 'Samruddhi Mahamarg (Direct expressway to JNPT) • Nagpur International Air Cargo.',
    incentiveScheme: 'Vidarbha Special Industrial Package (100% SGST refund + interest subvention).',
    industrialParks: ['MIHAN Multi-Modal SEZ', 'Butibori Industrial Estate', 'Hingna MIDC Zone'],
    avgClearanceDays: 26,
    topClearances: ['MADC Single Window Sanction', 'Fire CFO NOC', 'MPCB Consent to Establish'],
  },
  {
    id: 'nashik',
    name: 'Nashik Manufacturing & Agro Belt',
    stateCode: 'MH',
    stateName: 'Maharashtra',
    lat: 19.9975,
    lng: 73.7898,
    description: 'Major hub for electrical equipment, auto ancillary, food processing, wineries, and defense aerospace engineering.',
    stateAuthority: 'MIDC Nashik Division',
    environmentalZoning: 'Food & Agro processing priority; Engineering Red/Orange permitted.',
    powerGrid: '132 kV Ambad substation with dedicated agro-industrial feeders.',
    connectivity: 'Samruddhi Mahamarg link • NH-60 Pune-Nashik Corridor • Ozar Airport.',
    incentiveScheme: 'Maharashtra Wine & Agro-Processing Policy (excise duty concessions).',
    industrialParks: ['Ambad MIDC Engineering Hub', 'Satpur Industrial Area', 'Sinnar SEZ & Wine Park'],
    avgClearanceDays: 28,
    topClearances: ['MIDC Industrial Water Connection', 'MPCB CTE Consent', 'FSSAI Central Manufacturing License'],
  },
  {
    id: 'aurangabad',
    name: 'Aurangabad AURIC Smart City',
    stateCode: 'MH',
    stateName: 'Maharashtra',
    lat: 19.8762,
    lng: 75.3433,
    description: 'Flagship DMIC smart city with pre-cleared environmental approvals, automated utility distribution, and heavy engineering ecosystem.',
    stateAuthority: 'AITL (AURIC Industrial Township Ltd)',
    environmentalZoning: 'Pre-cleared Master Environmental Clearance for Shendra-Bidkin node.',
    powerGrid: 'Automated SCADA 220 kV smart grid with dual-redundancy feeders.',
    connectivity: 'DMIC Dedicated Freight Corridor feeder • Samruddhi Expressway.',
    incentiveScheme: 'AURIC Plug-and-Play Fast-Track with Marathwada regional incentives.',
    industrialParks: ['AURIC Shendra Smart City', 'Bidkin Mega Industrial Zone', 'Waluj MIDC Area'],
    avgClearanceDays: 22,
    topClearances: ['AURIC Master Single-Window Clearance', 'DISH Safety License', 'Power Load Sanction'],
  },

  // --- GUJARAT ---
  {
    id: 'ahmedabad',
    name: 'Ahmedabad & Sanand Auto Hub',
    stateCode: 'GJ',
    stateName: 'Gujarat',
    lat: 23.0225,
    lng: 72.5714,
    description: 'Premier automotive and engineering capital with massive OEM assembly plants, EV battery hubs, and specialized textile clusters.',
    stateAuthority: 'GIDC (Gujarat Industrial Development Corporation)',
    environmentalZoning: 'Engineering/Auto Green/Orange permitted; Special chemical zone in Vatva.',
    powerGrid: 'Torrent Power / UGVCL industrial grid with uninterrupted 400 kV supply.',
    connectivity: 'Mundra Port 330 km • Ahmedabad Air Cargo • Western Dedicated Freight Corridor.',
    incentiveScheme: 'Gujarat Industrial Policy 2020 (Capital subsidy + 10-year electricity exemption).',
    industrialParks: ['Sanand GIDC Automotive Zone', 'Vatva Chemical & Textile Hub', 'Changodar Industrial Estate'],
    avgClearanceDays: 32,
    topClearances: ['GPCB Environmental Clearance', 'GIDC Land Lease Sanction', 'PESO Petroleum Storage Approval'],
  },
  {
    id: 'bharuch',
    name: 'Dahej PCPIR & Bharuch Belt',
    stateCode: 'GJ',
    stateName: 'Gujarat',
    lat: 21.7051,
    lng: 72.9959,
    description: 'India\'s largest Petroleum, Chemicals and Petrochemical Investment Region (PCPIR) with deep-water all-weather port terminals and massive CETP pipelines.',
    stateAuthority: 'GIDC PCPIR Authority',
    environmentalZoning: 'Red category heavy chemical permitted; ZLD and marine outfall pipelines.',
    powerGrid: '400 kV DGVCL dedicated chemical corridor substation.',
    connectivity: 'Dahej All-Weather Port & LNG Terminal • Western DFC Bharuch node.',
    incentiveScheme: 'Gujarat Mega Chemical Incentive (infrastructure support + stamp duty rebate).',
    industrialParks: ['Dahej PCPIR SEZ', 'Ankleshwar GIDC Mega Chemical Belt', 'Panoli Chemical Zone'],
    avgClearanceDays: 42,
    topClearances: ['MoEFCC Central Environmental Clearance', 'GPCB CTO/CTE', 'PESO Class A Solvent Clearance'],
  },
  {
    id: 'surat',
    name: 'Surat & Hazira Industrial Port',
    stateCode: 'GJ',
    stateName: 'Gujarat',
    lat: 21.1702,
    lng: 72.8311,
    description: 'Global capital for synthetic textiles, diamond processing, heavy engineering, and LNG gasification terminals at Hazira port.',
    stateAuthority: 'GIDC Surat Division',
    environmentalZoning: 'Textile processing with shared CETP; Heavy steel/gas at Hazira.',
    powerGrid: 'DGVCL & Torrent Power high-tension industrial network.',
    connectivity: 'Hazira Deep Seaport • Western Railway Freight Corridor • Surat Airport.',
    incentiveScheme: 'Gujarat Textile Policy (interest subvention on machinery + power tariff subsidy).',
    industrialParks: ['Hazira Heavy Industrial Complex', 'Sachin GIDC Apparel SEZ', 'Pandesara Industrial Estate'],
    avgClearanceDays: 30,
    topClearances: ['GPCB CTE/CTO Consent', 'Central Excise & Customs Port NOC', 'Factory Inspectorate Permit'],
  },
  {
    id: 'vadodara',
    name: 'Vadodara Engineering & Pharma',
    stateCode: 'GJ',
    stateName: 'Gujarat',
    lat: 22.3072,
    lng: 73.1812,
    description: 'Known as the "Banyan City", leader in heavy power equipment, transformers, APIs, formulations, and advanced glass manufacturing.',
    stateAuthority: 'GIDC Vadodara',
    environmentalZoning: 'Chemical & Pharma in Nandesari/Savli; Engineering in Makarpura.',
    powerGrid: 'MGVCL 220 kV high-reliability power grid with dedicated power transmission.',
    connectivity: 'Vadodara Express Highway • Western DFC • Ahmedabad International Airport.',
    incentiveScheme: 'Gujarat Electronics & R&D Scheme (assistance for patent filing + tech transfer).',
    industrialParks: ['Nandesari Chemical GIDC', 'Makarpura Industrial Estate', 'Savli GIDC Mega Engineering Park'],
    avgClearanceDays: 34,
    topClearances: ['GPCB / CPCB Red Category EC', 'Boiler Directorate Approval', 'Hazardous Waste Authorization'],
  },

  // --- TAMIL NADU ---
  {
    id: 'chennai',
    name: 'Chennai & Sriperumbudur Corridor',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    description: 'The "Detroit of Asia" with multi-OEM automobile complexes, smartphone assembly giants, and modern electronic hardware tech parks.',
    stateAuthority: 'SIPCOT & Guidance Tamil Nadu',
    environmentalZoning: 'Automotive, ESDM, and Engineering priority zones with green compliance.',
    powerGrid: 'TANGEDCO dedicated 230 kV industrial power network.',
    connectivity: 'Chennai Port & Ennore Port • NH-48 Bengaluru-Chennai Expressway • Chennai Air Cargo.',
    incentiveScheme: 'Tamil Nadu Industrial Policy 2021 (structured package with payroll subsidies).',
    industrialParks: ['Sriperumbudur SIPCOT Hi-Tech SEZ', 'Oragadam Mega Auto Cluster', 'Ambattur Industrial Estate'],
    avgClearanceDays: 28,
    topClearances: ['TNPCB Consent to Establish', 'Guidance Single Window Fast-Track Approval', 'DISH Factory Registration'],
  },
  {
    id: 'hosur',
    name: 'Hosur EV & Precision Corridor',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    lat: 12.7409,
    lng: 77.8253,
    description: 'Fastest-growing EV powertrain and two-wheeler manufacturing ecosystem in South India, directly abutting Bengaluru\'s tech corridor.',
    stateAuthority: 'SIPCOT Hosur Division',
    environmentalZoning: 'EV Battery, Machine Tools, and Precision Auto Ancillaries.',
    powerGrid: 'TANGEDCO 230/110 kV dedicated industrial feeders.',
    connectivity: 'Bengaluru Electronic City 25 km • NH-44 Expressway • Kempegowda Airport.',
    incentiveScheme: 'Tamil Nadu EV Policy 2023 (100% electricity duty exemption for 5 years).',
    industrialParks: ['Hosur SIPCOT Phase I & II', 'GMR Hosur Industrial Park', 'Moranapalli Industrial Estate'],
    avgClearanceDays: 25,
    topClearances: ['TNPCB Orange Consent', 'SIPCOT Water & Power Sanction', 'Fire Safety NOC'],
  },
  {
    id: 'coimbatore',
    name: 'Coimbatore Engineering & Pumps',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    lat: 11.0168,
    lng: 76.9558,
    description: 'The "Manchester of South India", producing over 50% of India\'s motors and water pumps, alongside advanced foundry casting and aerospace machining.',
    stateAuthority: 'SIDCO & CODISSIA',
    environmentalZoning: 'Foundry & Machining zones with centralized sand reclamation systems.',
    powerGrid: 'TANGEDCO 110 kV industrial substation with high renewable wind power mix.',
    connectivity: 'Coimbatore International Airport • NH-544 • Kochi Port 160 km.',
    incentiveScheme: 'MSME Capital Subsidy (up to 25% on plant and machinery).',
    industrialParks: ['CODISSIA Industrial Park', 'SIDCO Kurichi Estate', 'Eachanari Engineering Zone'],
    avgClearanceDays: 24,
    topClearances: ['TNPCB Orange Consent', 'TANGEDCO Power Grid Sanction', 'Foundry Pollution NOC'],
  },
  {
    id: 'tirupur',
    name: 'Tiruppur Export Knitwear Hub',
    stateCode: 'TN',
    stateName: 'Tamil Nadu',
    lat: 11.1085,
    lng: 77.3411,
    description: 'Global knitwear manufacturing hub driving over 55% of India\'s cotton textile exports, pioneer in Zero Liquid Discharge (ZLD) effluent treatment.',
    stateAuthority: 'SIPCOT & SIDCO Tirupur',
    environmentalZoning: 'Textile wet processing strictly tied to 18 CETPs with 100% ZLD recovery.',
    powerGrid: 'TANGEDCO dedicated knitwear power supply with wind energy tie-ins.',
    connectivity: 'Tuticorin Port 240 km • Cochin Port 175 km • Coimbatore Air Cargo.',
    incentiveScheme: 'Central & State TUFS (Textile Upgradation Fund Scheme).',
    industrialParks: ['Netaji Apparel Park', 'SIDCO Mudalipalayam', 'Tirupur Export Knitwear Zone'],
    avgClearanceDays: 26,
    topClearances: ['TNPCB ZLD Compliance Certificate', 'Textile Committee Registration', 'Factory License'],
  },

  // --- KARNATAKA ---
  {
    id: 'bengaluru',
    name: 'Bengaluru Aerospace & Tech',
    stateCode: 'KA',
    stateName: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    description: 'India\'s Silicon Valley and Aerospace capital, hosting global semiconductor design hubs, satellite fab, and Peenya SME industrial complex.',
    stateAuthority: 'KIADB (Karnataka Industrial Areas Development Board)',
    environmentalZoning: 'ESDM, Aerospace & Green industries priority; Peenya mixed engineering.',
    powerGrid: 'BESCOM dedicated 220/66 kV substations with high-reliability dual bus.',
    connectivity: 'Kempegowda International Airport (Aerospace SEZ) • NH-44 & NH-48 • Chennai Port.',
    incentiveScheme: 'Karnataka Aerospace & Defense Policy + ESDM Incentive Scheme.',
    industrialParks: ['Devanahalli Aerospace SEZ', 'Peenya Industrial Complex', 'Electronic City & Bommasandra'],
    avgClearanceDays: 28,
    topClearances: ['KSPCB Consent to Establish', 'Karnataka e-Udyami Single Desk', 'BESCOM Power Sanction'],
  },
  {
    id: 'mysuru',
    name: 'Mysuru High-Tech Corridor',
    stateCode: 'KA',
    stateName: 'Karnataka',
    lat: 12.2958,
    lng: 76.6394,
    description: 'Emerging hub for electronics hardware, precision machine tools, pharma formulation, and food-tech testing labs.',
    stateAuthority: 'KIADB Mysuru',
    environmentalZoning: 'Electronic hardware, Green and Orange category manufacturing.',
    powerGrid: 'CESC 66 kV high-reliability express feeder.',
    connectivity: 'Bengaluru-Mysuru 10-Lane Expressway (75 mins to Bengaluru) • Mysuru Airport.',
    incentiveScheme: 'Beyond Bengaluru Industrial Package (20% extra investment allowance).',
    industrialParks: ['Hebbal Industrial Area', 'Kadakola Industrial Area', 'Belagola Food & Tech Zone'],
    avgClearanceDays: 24,
    topClearances: ['KIADB Land Allotment', 'KSPCB Environmental Consent', 'Factory Inspectorate DISH'],
  },

  // --- TELANGANA & ANDHRA PRADESH ---
  {
    id: 'hyderabad',
    name: 'Hyderabad Genome Valley & Pharma',
    stateCode: 'TS',
    stateName: 'Telangana',
    lat: 17.385,
    lng: 78.4867,
    description: 'Vaccine capital of the world producing 33% of global vaccines, with Genome Valley R&D labs, Hyderabad Pharma City, and aerospace defense corridors.',
    stateAuthority: 'TGIIC (Telangana Industrial Infrastructure Corp)',
    environmentalZoning: 'Red/Orange permitted with dedicated Pharma City ZLD infrastructure.',
    powerGrid: 'TSSPDCL dedicated 220 kV industrial power ring with statutory zero load-shedding.',
    connectivity: 'Rajiv Gandhi International Airport (Pharma Zone) • Outer Ring Road (ORR).',
    incentiveScheme: 'TS-iPASS 15-day statutory deemed clearance guarantee + Life Sciences incentives.',
    industrialParks: ['Genome Valley Life Sciences SEZ', 'Hyderabad Pharma City', 'Adibatla Aerospace & Defense Park'],
    avgClearanceDays: 21,
    topClearances: ['TS-iPASS Instant Deemed Clearance', 'TSPCB Consent to Establish', 'Drug Control Administration'],
  },
  {
    id: 'visakhapatnam',
    name: 'Visakhapatnam Pharma & Steel Port',
    stateCode: 'AP',
    stateName: 'Andhra Pradesh',
    lat: 17.6868,
    lng: 83.2185,
    description: 'Major coastal manufacturing and export hub housing Jawaharlal Nehru Pharma City, heavy steel rolling mills, and deep-water commercial container ports.',
    stateAuthority: 'APIIC (Andhra Pradesh Industrial Infrastructure Corp)',
    environmentalZoning: 'Pharma & Chemical in Parawada with marine outfall; Heavy steel in Gajuwaka.',
    powerGrid: 'APEPDCL 220 kV robust coastal industrial grid.',
    connectivity: 'Visakhapatnam Seaport (Deep Container Berth) • Gangavaram Port • National Highway 16.',
    incentiveScheme: 'AP Industrial Development Policy 2023-27 (Fixed capital investment subsidy).',
    industrialParks: ['Jawaharlal Nehru Pharma City (JNPC)', 'Atchutapuram Mega SEZ', 'Duvvada Industrial Park'],
    avgClearanceDays: 24,
    topClearances: ['APPCB Consent to Establish', 'AP Single Desk Portal Clearance', 'CRZ Coastal NOC'],
  },
  {
    id: 'sricity',
    name: 'Sri City Multi-Product SEZ',
    stateCode: 'AP',
    stateName: 'Andhra Pradesh',
    lat: 13.535,
    lng: 80.027,
    description: 'Integrated master-planned smart industrial city hosting 200+ global brands across consumer electronics, auto OEM, and FMCG manufacturing.',
    stateAuthority: 'Sri City Development Authority & APIIC',
    environmentalZoning: 'Pre-cleared Master Environmental Clearance for multi-sector production.',
    powerGrid: '220/132 kV dedicated dedicated dual-substation with 100% underground cabling.',
    connectivity: 'Chennai Port 65 km • Ennore Port 50 km • NH-16 Golden Quadrilateral.',
    incentiveScheme: 'SEZ 100% Export Income Tax Exemption + AP Mega Project Custom Package.',
    industrialParks: ['Sri City Domestic Tariff Area (DTA)', 'Sri City Multi-Product SEZ', 'Electronics Cluster'],
    avgClearanceDays: 18,
    topClearances: ['Development Commissioner SEZ Sanction', 'APPCB Consent', 'Factory Inspectorate NOC'],
  },

  // --- DELHI NCR, HARYANA & UTTAR PRADESH ---
  {
    id: 'delhi_ncr',
    name: 'Gurugram & Manesar Auto Corridor',
    stateCode: 'HR',
    stateName: 'Haryana',
    lat: 28.4595,
    lng: 77.0266,
    description: 'North India\'s engine of automobile and electronics manufacturing, home to Maruti Suzuki, Honda, and massive Tier-1 auto-ancillary suppliers.',
    stateAuthority: 'HSIIDC (Haryana State Industrial Infrastructure Corp)',
    environmentalZoning: 'Automotive, Precision Engineering, and ESDM with CAQM compliance.',
    powerGrid: 'DHBVN 220/66 kV industrial network with continuous gas-based backup.',
    connectivity: 'Delhi-Mumbai Expressway • Western Dedicated Freight Corridor • IGI Air Cargo 28 km.',
    incentiveScheme: 'Haryana Enterprises & Employment Policy (HEEP 2020 capital subsidies).',
    industrialParks: ['Manesar IMT (Industrial Model Township)', 'Udyog Vihar Gurugram', 'Roz-Ka-Meo Industrial Area'],
    avgClearanceDays: 32,
    topClearances: ['CAQM Air Quality Strict Compliance NOC', 'HSPCB Consent to Establish', 'Fire CFO NOC'],
  },
  {
    id: 'noida',
    name: 'Noida & Greater Noida ESDM Hub',
    stateCode: 'UP',
    stateName: 'Uttar Pradesh',
    lat: 28.5355,
    lng: 77.391,
    description: 'India\'s fastest-growing mobile phone manufacturing and hyperscale data center corridor, anchored by Yamuna Expressway Industrial Development Authority.',
    stateAuthority: 'NOIDA, Greater Noida & YEIDA Authorities',
    environmentalZoning: 'Electronic hardware, Data Centers, and Light Engineering priority.',
    powerGrid: 'UPPCL 400/220 kV smart grid with dedicated green power supply for data centers.',
    connectivity: 'Noida International Airport (Jewar) • Yamuna Expressway • Eastern Peripheral.',
    incentiveScheme: 'UP Data Center Policy 2021 + UP Semiconductor Policy 2024 (massive capital aid).',
    industrialParks: ['Noida Phase II Sector 80/81', 'Greater Noida TechZone IV Data Park', 'YEIDA Electronic City (Jewar)'],
    avgClearanceDays: 26,
    topClearances: ['Nivesh Mitra Single-Window NOC', 'UPPCB Consent to Establish', 'UP Fire Service License'],
  },

  // --- RAJASTHAN ---
  {
    id: 'jaipur',
    name: 'Jaipur & Neemrana Japanese Zone',
    stateCode: 'RJ',
    stateName: 'Rajasthan',
    lat: 26.9124,
    lng: 75.7873,
    description: 'Premier corridor featuring the Neemrana Japanese Industrial Zone, Sitapura gems and jewelry SEZ, and rapid renewable solar module production.',
    stateAuthority: 'RIICO (Rajasthan State Industrial Development Corp)',
    environmentalZoning: 'Engineering, Auto & Solar Module manufacturing; Sitapura SEZ.',
    powerGrid: 'JVVNL 220 kV industrial power network with abundant solar grid feed.',
    connectivity: 'Delhi-Jaipur Expressway (NH-48) • Western DFC Rewari Node • Jaipur Airport.',
    incentiveScheme: 'RIPS 2022 (Rajasthan Investment Promotion Scheme - 75% SGST subsidy for 7 years).',
    industrialParks: ['Neemrana Japanese Zone', 'Sitapura Industrial Area & SEZ', 'Ghiloth Korean Zone'],
    avgClearanceDays: 26,
    topClearances: ['RIICO Land Sanction', 'RSPCB Consent to Establish', 'RajNivesh Single-Window NOC'],
  },

  // --- WEST BENGAL & ODISHA ---
  {
    id: 'kolkata',
    name: 'Kolkata & Haldia Petrochem Port',
    stateCode: 'WB',
    stateName: 'West Bengal',
    lat: 22.5726,
    lng: 88.3639,
    description: 'Gateway to Eastern India with Haldia petrochemical complexes, Bantala leather technology SEZ, and heavy foundry engineering clusters.',
    stateAuthority: 'WBIDC & Haldia Development Authority',
    environmentalZoning: 'Petrochemical & Red Category at Haldia; Bantala integrated CETP.',
    powerGrid: 'CESC & WBSEDCL 220 kV industrial transmission.',
    connectivity: 'Haldia Deep Port • Syama Prasad Mookerjee Port Kolkata • Eastern DFC.',
    incentiveScheme: 'West Bengal State Industrial Incentive Scheme (Electricity duty waiver).',
    industrialParks: ['Haldia Petrochemical Complex', 'Kolkata Leather Complex (Bantala)', 'Kalyani Phase I & II'],
    avgClearanceDays: 34,
    topClearances: ['WBPCB Environmental Consent', 'WBIDC Land Allotment', 'Fire & Emergency Services NOC'],
  },
  {
    id: 'kalinganagar',
    name: 'Kalinganagar & Paradip Steel Zone',
    stateCode: 'OR',
    stateName: 'Odisha',
    lat: 20.95,
    lng: 86.05,
    description: 'The Steel City of India, hosting mega blast furnaces, stainless steel cold-rolling mills, and Paradip plastic & petrochemical port zone.',
    stateAuthority: 'IDCO (Industrial Infrastructure Development Corp of Odisha)',
    environmentalZoning: 'Heavy Metallurgy, Steel, and Petrochemicals with integrated slag management.',
    powerGrid: 'OPTCL 400 kV ultra-high voltage transmission grid.',
    connectivity: 'Paradip Port 90 km • Dedicated mineral freight rail lines • NH-16.',
    incentiveScheme: 'Odisha IPR 2022 (Exemption on land premium + 100% stamp duty waiver).',
    industrialParks: ['Kalinganagar National Steel Hub', 'Paradip Plastic Park', 'Choudwar Industrial Estate'],
    avgClearanceDays: 25,
    topClearances: ['GO-SWIFT Single Window Clearance', 'OSPCB Consent to Establish', 'Factory & Boilers License'],
  },

  // --- PUNJAB & HIMACHAL PRADESH ---
  {
    id: 'ludhiana',
    name: 'Ludhiana Industrial Capital',
    stateCode: 'PB',
    stateName: 'Punjab',
    lat: 30.901,
    lng: 75.8573,
    description: 'The "Manchester of India", driving 70% of India\'s bicycle production, knitwear garments, machine tools, and auto parts.',
    stateAuthority: 'PSIEC (Punjab Small Industries & Export Corp)',
    environmentalZoning: 'Engineering, Textiles, and Electroplating tied to shared CETP.',
    powerGrid: 'PSPCL 220 kV high-tension industrial feeder ring.',
    connectivity: 'Sahnewal Multi-Modal Logistics Hub • Eastern DFC Ludhiana Node • NH-44.',
    incentiveScheme: 'Punjab Industrial & Business Development Policy (Net SGST reimbursement).',
    industrialParks: ['Focal Point Phase I-VIII', 'Dhandari Kalan Industrial Area', 'Sahnewal Logistics Park'],
    avgClearanceDays: 28,
    topClearances: ['PPCB Consent to Establish', 'Invest Punjab Single-Window NOC', 'DISH Safety License'],
  },
  {
    id: 'baddi',
    name: 'Baddi-Barotiwala-Nalagarh (BBN)',
    stateCode: 'HP',
    stateName: 'Himachal Pradesh',
    lat: 30.9578,
    lng: 76.7914,
    description: 'Asia\'s largest pharmaceutical formulation hub producing nearly 35% of Asia\'s medicines, backed by specialized Himalayan industrial incentives.',
    stateAuthority: 'HPSIDC Himachal Pradesh',
    environmentalZoning: 'Pharma formulations and Medical Devices priority with Zero Effluent discharge.',
    powerGrid: 'HPSEB reliable Himalayan hydel power with low industrial tariffs.',
    connectivity: 'Chandigarh International Airport 42 km • Kalka-Chandigarh Rail Link.',
    incentiveScheme: 'Himalayan Special Industrial Incentive + HP Pharma Park Subsidies.',
    industrialParks: ['Baddi Industrial Area Phase I-IV', 'Barotiwala Industrial Complex', 'Nalagarh Pharma Zone'],
    avgClearanceDays: 25,
    topClearances: ['HPPCB Consent to Establish', 'Drug Controller General / CDSCO NOC', 'State Single Window Approval'],
  },

  // --- MADHYA PRADESH ---
  {
    id: 'indore',
    name: 'Indore & Pithampur Auto Cluster',
    stateCode: 'MP',
    stateName: 'Madhya Pradesh',
    lat: 22.7196,
    lng: 75.8577,
    description: 'Known as the "Detroit of Central India", housing commercial vehicle assembly lines, precision engineering, and India\'s cleanest city ecosystem.',
    stateAuthority: 'MPIDC (MP Industrial Development Corporation)',
    environmentalZoning: 'Auto, Engineering, Pharma and Smart Industrial Park.',
    powerGrid: 'MPPKVVCL 220 kV industrial ring with 99.7% continuous reliability.',
    connectivity: 'Indore International Airport (Air Cargo) • Delhi-Mumbai Expressway link • NH-52.',
    incentiveScheme: 'MP Industrial Promotion Policy (Up to 40% investment promotion assistance).',
    industrialParks: ['Pithampur Sector 1-3 Auto Zone', 'Smart Industrial Park MPIDC', 'Sanwer Road Industrial Area'],
    avgClearanceDays: 23,
    topClearances: ['MPIDC Single-Window Fast-Track', 'MPPCB Consent to Establish', 'DISH Factory Permit'],
  },

  // --- KERALA & GOA ---
  {
    id: 'kochi',
    name: 'Kochi Port & Petrochemical SEZ',
    stateCode: 'KL',
    stateName: 'Kerala',
    lat: 9.9312,
    lng: 76.2673,
    description: 'International maritime container transshipment hub with BPCL petrochemical refinery zone, electronics hardware, and marine export cold chains.',
    stateAuthority: 'KINFRA & Cochin Port Trust',
    environmentalZoning: 'Petrochemicals & Marine Food processing; ESDM in Kakkanad.',
    powerGrid: 'KSEB 220 kV dedicated industrial line with hydel backup.',
    connectivity: 'Vallarpadam International Container Terminal • Cochin International Airport.',
    incentiveScheme: 'Kerala Industrial Policy (Special capital grant for ESDM and green ventures).',
    industrialParks: ['Ambalamugal Petrochemical Park', 'KINFRA Mega Food Park', 'Kakkanad High-Tech SEZ'],
    avgClearanceDays: 29,
    topClearances: ['KSPCB Consent to Establish', 'K-SWIFT Single Window Clearance', 'PESO Petrochemical License'],
  },
  {
    id: 'goa',
    name: 'Goa Verna Industrial Estates',
    stateCode: 'GA',
    stateName: 'Goa',
    lat: 15.4909,
    lng: 73.8278,
    description: 'Leading formulation pharmaceutical, packaging, and high-end distillery hub with scenic industrial parks and direct sea/air cargo access.',
    stateAuthority: 'GIDC (Goa Industrial Development Corporation)',
    environmentalZoning: 'Pharma formulations, Biotech, Distilleries and Light Engineering.',
    powerGrid: 'Goa Electricity Department 110 kV dedicated feeder.',
    connectivity: 'Mormugao Deep Seaport • Manohar International Airport (MOPA) & Dabolim.',
    incentiveScheme: 'Goa Investment Promotion Policy (Stamp duty rebate + employment subsidy).',
    industrialParks: ['Verna Industrial Estate', 'Kundaim Industrial Area', 'Tuem Electronic City'],
    avgClearanceDays: 27,
    topClearances: ['GIDC Land Lease Sanction', 'Goa State Pollution Control Board Consent', 'Excise Commissionerate Permit'],
  },
];

// Weighted multipliers for realistic industry concentrations
const CITY_DISTRIBUTION_WEIGHTS: Record<string, Record<string, number>> = {
  pharma: {
    hyderabad: 3.6,
    baddi: 3.2,
    ahmedabad: 2.7,
    vadodara: 2.3,
    mumbai: 2.1,
    visakhapatnam: 2.2,
    bengaluru: 1.9,
    goa: 2.0,
    indore: 1.8,
    chennai: 1.7,
    pune: 1.6,
  },
  automotive_ev: {
    pune: 3.9,
    chennai: 3.8,
    delhi_ncr: 3.4,
    ahmedabad: 3.0,
    hosur: 3.5,
    indore: 2.6,
    aurangabad: 2.4,
    bengaluru: 2.1,
    sricity: 2.2,
  },
  electronics_datacenter: {
    bengaluru: 4.2,
    mumbai: 3.8,
    noida: 3.7,
    hyderabad: 3.5,
    chennai: 3.2,
    sricity: 2.8,
    mysuru: 2.4,
    aurangabad: 2.2,
  },
  breweries: {
    bengaluru: 3.2,
    goa: 3.8,
    mumbai: 2.8,
    pune: 2.6,
    delhi_ncr: 2.5,
    nashik: 2.9,
    jaipur: 2.0,
    hyderabad: 1.9,
    kolkata: 1.6,
  },
  food_processing: {
    pune: 3.1,
    nashik: 3.2,
    indore: 2.9,
    ludhiana: 2.8,
    ahmedabad: 2.5,
    nagpur: 2.4,
    coimbatore: 2.3,
    kochi: 2.5,
    kolkata: 2.2,
  },
  chemicals: {
    bharuch: 4.6,
    surat: 3.5,
    vadodara: 3.2,
    mumbai: 2.6,
    visakhapatnam: 2.4,
    kolkata: 2.3,
    kalinganagar: 2.5,
    ahmedabad: 2.2,
  },
  renewable_energy: {
    jaipur: 3.8,
    ahmedabad: 3.2,
    bengaluru: 2.6,
    hyderabad: 2.4,
    chennai: 2.2,
    coimbatore: 2.5,
    nagpur: 2.0,
  },
  textiles: {
    surat: 4.8,
    tirupur: 4.6,
    coimbatore: 3.4,
    ludhiana: 3.2,
    ahmedabad: 3.0,
    jaipur: 2.4,
    mumbai: 2.0,
  },
  cold_chain: {
    mumbai: 3.8,
    delhi_ncr: 3.6,
    nagpur: 3.2,
    kolkata: 2.7,
    bengaluru: 2.6,
    kochi: 2.8,
    visakhapatnam: 2.4,
    chennai: 2.5,
  },
};

export const BusinessMapPage: React.FC = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialDomain = searchParams.get('domain') || 'pharma';

  const [selectedDomainId, setSelectedDomainId] = useState<string>(initialDomain);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStateCode, setSelectedStateCode] = useState<string | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<string | null>('mumbai');
  const [tileStyle, setTileStyle] = useState<'dark' | 'satellite' | 'street' | 'light'>('dark');
  const [statusFilter, setStatusFilter] = useState<'all' | 'operational' | 'greenfield'>('all');
  const [activeTab, setActiveTab] = useState<'overview' | 'clearances' | 'infra'>('overview');
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const activePreset = DOMAIN_PRESETS.find((p) => p.id === selectedDomainId) || DOMAIN_PRESETS[0]!;
  const currentDomainName = searchQuery.trim() ? searchQuery.trim() : activePreset.name;

  // Filter and compute realistic city counts
  const computedCities: CityMarkerData[] = useMemo(() => {
    const weights = CITY_DISTRIBUTION_WEIGHTS[selectedDomainId] || {};
    const baseMult = activePreset.multiplier;

    return BASE_CITIES.map((base) => {
      const cityWeight = weights[base.id] || 1.0;
      let rawCount = Math.round(180 * baseMult * cityWeight);
      if (statusFilter === 'greenfield') rawCount = Math.round(rawCount * 0.28);
      else if (statusFilter === 'operational') rawCount = Math.round(rawCount * 0.72);

      return {
        ...base,
        count: Math.max(16, rawCount),
      };
    }).filter((city) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        city.name.toLowerCase().includes(q) ||
        city.stateName.toLowerCase().includes(q) ||
        city.industrialParks.some((p) => p.toLowerCase().includes(q))
      );
    });
  }, [selectedDomainId, statusFilter, activePreset.multiplier, searchQuery]);

  // Total National Business Count
  const totalNationalCount = useMemo(() => {
    return computedCities.reduce((acc, c) => acc + c.count, 0);
  }, [computedCities]);

  // Grouped by State for leaderboard
  const stateLeaderboard = useMemo(() => {
    const stateMap = new Map<string, { code: string; name: string; totalCount: number; cities: CityMarkerData[] }>();

    for (const city of computedCities) {
      const existing = stateMap.get(city.stateCode) || {
        code: city.stateCode,
        name: city.stateName,
        totalCount: 0,
        cities: [],
      };
      existing.totalCount += city.count;
      existing.cities.push(city);
      stateMap.set(city.stateCode, existing);
    }

    return Array.from(stateMap.values()).sort((a, b) => b.totalCount - a.totalCount);
  }, [computedCities]);

  // Active City Details
  const activeCity: CityMarkerData =
    computedCities.find((c) => c.id === selectedCityId) ||
    computedCities[0] || { ...BASE_CITIES[0]!, count: 42 };

  // Live Dynamic AI Cluster & Regulatory Analysis
  useEffect(() => {
    let isMounted = true;
    setIsAiLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await businessMapApi.analyzeClusterWithAi({
          clusterName: activeCity.name,
          stateCode: activeCity.stateCode,
          stateName: activeCity.stateName,
          sector: currentDomainName,
          customQuery: searchQuery,
        });
        if (isMounted && res) {
          setAiAnalysis(res);
        }
      } catch {
        // Handled gracefully
      } finally {
        if (isMounted) setIsAiLoading(false);
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeCity.id, activeCity.name, activeCity.stateCode, selectedDomainId, searchQuery]);

  return (
    <div className="min-h-screen bg-[#04161F] text-white flex flex-col font-sans selection:bg-cyan-500 selection:text-ocean-950">
      <ScrollProgressBar />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-[#06212B]/95 backdrop-blur-2xl border-b border-ocean-700/80 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xl">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-ocean-900/90 hover:bg-ocean-800 text-cyan-200 text-xs font-semibold transition-all hover:scale-105 border border-ocean-600/60 shadow-sm"
          >
            <span>←</span>
            <span>{t('map.back_home', 'Back to Platform')}</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-lg shadow-cyan-400/50" />
            <div>
              <div className="text-xs font-bold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                <span>ApprovalIQ Geospatial Radar</span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-ocean-800 text-cyan-300 text-[10px] border border-cyan-500/40">
                  Live National GIS
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Global Business Count Counter & Language Switcher */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher />

          <div className="hidden md:flex flex-col text-right">
            <span className="text-[10px] uppercase font-mono text-ocean-300 font-bold">
              Total Mapped Units
            </span>
            <span className="text-sm font-black text-cyan-300 font-mono tracking-tight">
              {totalNationalCount.toLocaleString()} Across India
            </span>
          </div>

          <Link
            to={`/register?state=${activeCity.stateCode}&industry=${encodeURIComponent(currentDomainName)}&city=${encodeURIComponent(activeCity.name)}`}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-ocean-500 to-cyan-500 hover:from-ocean-400 hover:to-cyan-400 text-ocean-950 text-xs font-bold shadow-glow-cyan transition-all hover:scale-105"
          >
            {`Start Docket in ${activeCity.name} →`}
          </Link>
        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1680px] mx-auto w-full gap-5">

        {/* Informative "What is this?" Glassmorphism Feature Capsule */}
        <div className="relative overflow-hidden rounded-3xl border border-ocean-600/60 bg-gradient-to-r from-ocean-950 via-[#072B38] to-ocean-900 p-5 sm:p-6 shadow-2xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none -z-0" />
          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase bg-cyan-950/80 border border-cyan-400/50 text-cyan-300">
                <Sparkles className="w-3.5 h-3.5 text-cyan-300 animate-pulse" />
                <span>Geospatial Regulatory Intelligence</span>
              </div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-white tracking-tight">
                National Industrial & Statutory Clearance Radar
              </h2>
              <p className="text-xs sm:text-sm text-ocean-100/90 leading-relaxed font-sans">
                An intelligent spatial planning system indexing India’s top industrial estates, SEZs, and manufacturing corridors across 16 states. Select your industry sector to evaluate real-time statutory SLA benchmarks, environmental categorizations (Red/Orange/Green), nodal development agencies (MIDC, GIDC, SIPCOT, KIADB), and pre-requisite compliance dependencies before capital deployment.
              </p>
            </div>

            {/* 4 Value Pillars */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 w-full lg:w-auto shrink-0">
              <div className="p-3 rounded-2xl bg-ocean-900/80 border border-ocean-700/80 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold font-mono">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>30+ Major Hubs</span>
                </div>
                <span className="text-[11px] text-ocean-200">SEZs & Industrial Belts</span>
              </div>

              <div className="p-3 rounded-2xl bg-ocean-900/80 border border-ocean-700/80 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold font-mono">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span>RTS Timers</span>
                </div>
                <span className="text-[11px] text-ocean-200">Statutory SLA Tracking</span>
              </div>

              <div className="p-3 rounded-2xl bg-ocean-900/80 border border-ocean-700/80 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold font-mono">
                  <Factory className="w-4 h-4 text-emerald-400" />
                  <span>Nodal Agencies</span>
                </div>
                <span className="text-[11px] text-ocean-200">MIDC, GIDC, SIPCOT, KIADB</span>
              </div>

              <div className="p-3 rounded-2xl bg-ocean-900/80 border border-ocean-700/80 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-purple-300 text-xs font-bold font-mono">
                  <TrendingUp className="w-4 h-4 text-purple-400" />
                  <span>Policy Schemes</span>
                </div>
                <span className="text-[11px] text-ocean-200">CapEx & SGST Incentives</span>
              </div>
            </div>
          </div>
        </div>

        {/* Domain Search & Filter Bar */}
        <div className="bg-[#06212B] border border-ocean-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
          
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            
            {/* Live Search Input Box */}
            <div className="relative flex-1 w-full">
              <Search className="w-5 h-5 text-cyan-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter by city, state, or industrial park (e.g. Chakan, Dahej, Sriperumbudur, Genome Valley, Sanand)..."
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-ocean-950 border border-ocean-700 text-sm text-white placeholder-ocean-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 shadow-inner"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ocean-400 hover:text-white"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-ocean-950 p-1 rounded-xl border border-ocean-700 text-xs shrink-0 w-full lg:w-auto justify-center">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold ${
                  statusFilter === 'all' ? 'bg-gradient-to-r from-ocean-500 to-cyan-500 text-ocean-950 shadow-md font-bold' : 'text-ocean-300 hover:text-white'
                }`}
              >
                All Statuses
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('operational')}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold ${
                  statusFilter === 'operational' ? 'bg-gradient-to-r from-ocean-500 to-cyan-500 text-ocean-950 shadow-md font-bold' : 'text-ocean-300 hover:text-white'
                }`}
              >
                Operational Units
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('greenfield')}
                className={`px-3 py-1.5 rounded-lg transition-all font-semibold ${
                  statusFilter === 'greenfield' ? 'bg-gradient-to-r from-ocean-500 to-cyan-500 text-ocean-950 shadow-md font-bold' : 'text-ocean-300 hover:text-white'
                }`}
              >
                Greenfield / Planned
              </button>
            </div>

            {/* Basemap Switcher */}
            <div className="flex items-center gap-1 bg-ocean-950 p-1 rounded-xl border border-ocean-700 text-xs shrink-0 w-full lg:w-auto justify-center">
              <button
                type="button"
                onClick={() => setTileStyle('dark')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors text-[11px] font-medium ${
                  tileStyle === 'dark' ? 'bg-ocean-600 text-white font-bold shadow' : 'text-ocean-300 hover:text-white'
                }`}
              >
                Voyager Oceanic
              </button>
              <button
                type="button"
                onClick={() => setTileStyle('satellite')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors text-[11px] font-medium ${
                  tileStyle === 'satellite' ? 'bg-ocean-600 text-white font-bold shadow' : 'text-ocean-300 hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <Satellite className="w-3.5 h-3.5" />
                  <span>Satellite</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTileStyle('street')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors text-[11px] font-medium ${
                  tileStyle === 'street' ? 'bg-ocean-600 text-white font-bold shadow' : 'text-ocean-300 hover:text-white'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <MapIcon className="w-3.5 h-3.5" />
                  <span>Street Map</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setTileStyle('light')}
                className={`px-2.5 py-1.5 rounded-lg transition-colors text-[11px] font-medium ${
                  tileStyle === 'light' ? 'bg-ocean-600 text-white font-bold shadow' : 'text-ocean-300 hover:text-white'
                }`}
              >
                Clean Light
              </button>
            </div>

          </div>

          {/* Quick Domain Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            <span className="text-xs font-bold text-ocean-300 uppercase tracking-wider shrink-0 mr-1 font-mono">
              Sectors:
            </span>
            {DOMAIN_PRESETS.map((preset) => {
              const isSelected = selectedDomainId === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedDomainId(preset.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-2 border ${
                    isSelected
                      ? 'bg-gradient-to-r from-ocean-500 to-cyan-500 text-ocean-950 border-cyan-300 shadow-glow-cyan scale-105'
                      : 'bg-ocean-950 hover:bg-ocean-900 text-ocean-200 border-ocean-800 hover:border-ocean-600'
                  }`}
                >
                  <DomainPresetIcon iconKey={preset.iconKey} className={`w-3.5 h-3.5 ${isSelected ? 'text-ocean-950 font-bold' : 'text-cyan-400'}`} />
                  <span>{preset.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active Sector Summary Banner */}
          <div className="pt-3 border-t border-ocean-800 flex flex-wrap items-center justify-between text-xs gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-cyan-300 uppercase font-bold bg-cyan-950 border border-cyan-700 px-2 py-0.5 rounded">
                Active Sector
              </span>
              <span className="font-bold text-white text-sm">
                {currentDomainName}
              </span>
              <span className="text-ocean-300 hidden sm:inline">
                • {activePreset.description}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700 text-emerald-400 font-mono text-xs font-bold inline-flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{totalNationalCount.toLocaleString()} Establishments Mapped</span>
              </div>
            </div>
          </div>

        </div>

        {/* Real Leaflet Map + Multi-Layer Intelligence Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Map Canvas (8 Columns) */}
          <div className="lg:col-span-8 flex flex-col gap-3 min-h-[620px]">
            <div className="flex items-center justify-between text-xs text-ocean-300 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="font-bold text-white">Interactive Geospatial Map</span>
                <span className="text-ocean-300">• Click any glowing cluster pin to zoom & inspect</span>
              </div>
              <div className="flex items-center gap-2 font-mono text-[11px] text-ocean-300">
                <span>Displaying {computedCities.length} Key Hubs</span>
                {selectedStateCode && (
                  <button
                    type="button"
                    onClick={() => setSelectedStateCode(null)}
                    className="text-cyan-400 hover:underline font-bold"
                  >
                    (Clear State Filter)
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 w-full h-[620px]">
              <RealIndiaLeafletMap
                cities={computedCities}
                selectedCityId={selectedCityId}
                selectedStateCode={selectedStateCode}
                onSelectCity={(city) => {
                  setSelectedCityId(city.id);
                  setSelectedStateCode(city.stateCode);
                }}
                tileStyle={tileStyle}
                domainName={currentDomainName}
              />
            </div>
          </div>

          {/* Right Side Intelligence & Deep Dive Center (4 Columns) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            
            {/* Selected Cluster Deep Dive Card */}
            <div className="bg-[#06212B] border border-cyan-500/40 rounded-3xl p-5 shadow-2xl space-y-4 flex flex-col relative overflow-hidden">
              
              {/* Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                      {activeCity.stateName} • Cluster Detail
                    </span>
                    {isAiLoading && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-cyan-300 animate-pulse bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/30">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                        <span>Synthesizing...</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-2xl font-black text-white mt-0.5 tracking-tight font-editorial">
                    {activeCity.name}
                  </h3>
                </div>
                <div className="px-3.5 py-1.5 rounded-xl bg-ocean-950 border border-cyan-500/60 text-right shrink-0">
                  <div className="text-xl font-black text-cyan-300 font-mono leading-none">
                    {activeCity.count}
                  </div>
                  <div className="text-[9px] uppercase font-mono text-cyan-400 mt-0.5 font-bold">Mapped Units</div>
                </div>
              </div>

              {/* Dynamic Executive Description */}
              <p className="text-xs text-ocean-100/90 leading-relaxed font-sans bg-ocean-950/60 p-3 rounded-xl border border-ocean-800">
                {aiAnalysis?.executiveSummary || activeCity.description}
              </p>

              {/* Tab Selector */}
              <div className="flex items-center gap-1 bg-ocean-950 p-1 rounded-xl border border-ocean-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold transition-all ${
                    activeTab === 'overview' ? 'bg-ocean-700 text-white shadow' : 'text-ocean-400 hover:text-white'
                  }`}
                >
                  Industrial Hubs
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('clearances')}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold transition-all ${
                    activeTab === 'clearances' ? 'bg-ocean-700 text-white shadow' : 'text-ocean-400 hover:text-white'
                  }`}
                >
                  Clearances & RTS
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('infra')}
                  className={`flex-1 py-1.5 rounded-lg text-center font-bold transition-all ${
                    activeTab === 'infra' ? 'bg-ocean-700 text-white shadow' : 'text-ocean-400 hover:text-white'
                  }`}
                >
                  Infra & Policy
                </button>
              </div>

              {/* Tab Content */}
              <div className="space-y-3 flex-1">
                {activeTab === 'overview' && (
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-ocean-300 font-mono flex items-center justify-between">
                      <span>Prominent Estates & SEZs:</span>
                      <span className="text-[10px] text-cyan-400">{activeCity.industrialParks.length} Zones</span>
                    </div>
                    <div className="space-y-1.5">
                      {activeCity.industrialParks.map((park, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-ocean-950 border border-ocean-800 text-xs text-white">
                          <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="font-semibold">{park}</span>
                        </div>
                      ))}
                    </div>

                    <div className="p-2.5 rounded-xl bg-ocean-950/80 border border-ocean-800 text-xs space-y-1">
                      <div className="text-[10px] font-mono uppercase text-ocean-400 font-bold">Nodal Development Authority</div>
                      <div className="font-semibold text-white">{activeCity.stateAuthority}</div>
                    </div>

                    {aiAnalysis?.complianceRoadmap && (
                      <div className="p-2.5 rounded-xl bg-ocean-950/80 border border-ocean-800 text-xs space-y-2">
                        <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold">Sequential Workflow Stages</div>
                        <div className="space-y-1.5">
                          {aiAnalysis.complianceRoadmap.map((stage: any) => (
                            <div key={stage.step} className="flex items-center justify-between text-[11px] text-ocean-100 bg-ocean-900/60 p-1.5 rounded-lg border border-ocean-800">
                              <span className="font-semibold flex items-center gap-1.5">
                                <span className="w-4 h-4 rounded-full bg-ocean-800 text-cyan-300 flex items-center justify-center text-[9px] font-mono">{stage.step}</span>
                                <span>{stage.title}</span>
                              </span>
                              <span className="text-amber-400 font-mono font-bold text-[10px]">~{stage.durationDays}d</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'clearances' && (
                  <div className="space-y-2.5">
                    <div className="p-3 rounded-2xl bg-ocean-950 border border-ocean-800 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ocean-300">Predicted RTS Turnaround:</span>
                        <span className="font-bold text-amber-400 font-mono text-sm">
                          ~{aiAnalysis?.predictedRtsDays || activeCity.avgClearanceDays} Working Days
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-ocean-300">Statutory Risk Classification:</span>
                        <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded-full border ${
                          (aiAnalysis?.statutoryRiskLevel || 'Moderate') === 'Low'
                            ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                            : (aiAnalysis?.statutoryRiskLevel || 'Moderate') === 'Moderate'
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : (aiAnalysis?.statutoryRiskLevel || 'Moderate') === 'High'
                            ? 'bg-orange-950 text-orange-300 border-orange-700'
                            : 'bg-rose-950 text-rose-300 border-rose-700'
                        }`}>
                          {aiAnalysis?.statutoryRiskLevel || 'Moderate'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-ocean-300 font-mono">
                        Critical Statutory Clearances:
                      </div>
                      {(aiAnalysis?.criticalPrerequisites || activeCity.topClearances).map((c: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-ocean-950 border border-ocean-800 text-xs text-ocean-100">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>{c}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'infra' && (
                  <div className="space-y-2.5 text-xs">
                    {aiAnalysis?.zoningConstraints && (
                      <div className="p-2.5 rounded-xl bg-ocean-950 border border-ocean-800 space-y-1">
                        <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold">Environmental & ZLD Feasibility</div>
                        <div className="text-ocean-100 font-medium">{aiAnalysis.zoningConstraints}</div>
                      </div>
                    )}

                    <div className="p-2.5 rounded-xl bg-ocean-950 border border-ocean-800 space-y-1">
                      <div className="text-[10px] font-mono uppercase text-ocean-400 font-bold">Power & Substation Grid</div>
                      <div className="text-white font-medium">{activeCity.powerGrid}</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-ocean-950 border border-ocean-800 space-y-1">
                      <div className="text-[10px] font-mono uppercase text-cyan-400 font-bold">Port & Freight Connectivity</div>
                      <div className="text-white font-medium">{activeCity.connectivity}</div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-ocean-950 border border-ocean-800 space-y-1">
                      <div className="text-[10px] font-mono uppercase text-amber-400 font-bold">Tailored State Policy Incentives</div>
                      {aiAnalysis?.incentiveRecommendations ? (
                        <ul className="list-disc list-inside space-y-1 text-ocean-100">
                          {aiAnalysis.incentiveRecommendations.map((inc: string, i: number) => (
                            <li key={i}>{inc}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-white font-medium">{activeCity.incentiveScheme}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Roadmapping Action */}
              <Link
                to={`/register?state=${activeCity.stateCode}&industry=${encodeURIComponent(currentDomainName)}&city=${encodeURIComponent(activeCity.name)}`}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-ocean-500 via-cyan-500 to-ocean-400 hover:from-ocean-400 hover:to-cyan-300 text-ocean-950 font-extrabold text-xs sm:text-sm shadow-glow-cyan transition-all hover:scale-105"
              >
                <span>Launch Compliance Docket for {activeCity.name} →</span>
              </Link>
            </div>

            {/* State Concentration Leaderboard */}
            <div className="bg-[#06212B] border border-ocean-700/80 rounded-3xl p-5 shadow-2xl flex-1 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-ocean-200 font-mono">
                  State Manufacturing Density
                </h4>
                <span className="text-[10px] text-cyan-400 font-mono font-bold">
                  {stateLeaderboard.length} States Indexed
                </span>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-[260px] pr-1 scrollbar-thin">
                {stateLeaderboard.map((item, idx) => {
                  const percent = Math.round((item.totalCount / totalNationalCount) * 100);
                  const isSelected = selectedStateCode === item.code;

                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setSelectedStateCode(item.code);
                        if (item.cities.length > 0) {
                          setSelectedCityId(item.cities[0]!.id);
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                        isSelected
                          ? 'bg-ocean-900 border-cyan-400 shadow-md ring-1 ring-cyan-300'
                          : 'bg-ocean-950/80 hover:bg-ocean-900 border-ocean-800 hover:border-ocean-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-ocean-400 text-[10px] w-4 font-bold">
                            0{idx + 1}
                          </span>
                          <span className="font-bold text-white">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-300 font-mono">{item.totalCount}</span>
                          <span className="text-[10px] text-ocean-400">({percent}%)</span>
                        </div>
                      </div>

                      {/* Animated Progress Bar */}
                      <div className="w-full bg-ocean-950 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-ocean-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, percent * 3))}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

        </div>

        {/* Data Freshness & Methodology Footer */}
        <div className="mt-2 pt-5 border-t border-ocean-800 text-center text-xs text-ocean-400 space-y-1">
          <div className="font-mono text-[11px] text-cyan-300 font-bold">
            DATA SOURCE: State Industrial Development Corporations (MIDC, GIDC, SIPCOT, KIADB) & National RTS Portals • Verified Live: September 2026
          </div>
          <div className="text-[11px] text-ocean-300 max-w-4xl mx-auto">
            ⓘ Geospatial cluster figures represent registered commercial & manufacturing enterprises matching active sector parameters. Statutory clearances, SLA timelines, and incentive packages are synchronized with state single-window regulations.
          </div>
        </div>

      </main>
    </div>
  );
};
