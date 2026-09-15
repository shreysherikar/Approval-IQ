import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateJointInspectionDto,
  JointInspectionStageEnum,
  ScheduleInspectionDto,
} from './dto/schedule-inspection.dto';
import {
  CompleteInspectionDto,
  SignoffChecklistDto,
} from './dto/signoff.dto';
import {
  ProposeSlotsDto,
  RespondSlotDto,
} from './dto/negotiate-slots.dto';
import {
  ReviewRectificationDto,
  SubmitRectificationDto,
} from './dto/rectification.dto';

export interface InspectionCandidate {
  stage: JointInspectionStageEnum;
  stageTitle: string;
  stageDescription: string;
  recommendedTimeframe: string;
  leadAuthorityCode: string;
  leadAuthorityName: string;
  participatingApprovals: Array<{
    approvalCode: string;
    approvalName: string;
    authorityCode: string;
    authorityName: string;
    inspectionMandate: string;
    checklistTemplate: Array<{
      item: string;
      status: 'pending' | 'pass' | 'fail' | 'na';
      remarks?: string;
    }>;
  }>;
  readinessRequirements: Array<{
    id: string;
    title: string;
    description: string;
    completed: boolean;
  }>;
  estimatedVisitsSaved: number;
  estimatedDaysSaved: number;
}

const STAGE_TEMPLATES: Record<
  JointInspectionStageEnum,
  {
    stageTitle: string;
    stageDescription: string;
    recommendedTimeframe: string;
    leadAuthorityCode: string;
    leadAuthorityName: string;
    approvalCodes: string[];
    readinessRequirements: Array<{
      id: string;
      title: string;
      description: string;
      completed: boolean;
    }>;
    authorityChecklists: Record<
      string,
      {
        authorityName: string;
        mandate: string;
        items: Array<{
          item: string;
          status: 'pending' | 'pass' | 'fail' | 'na';
        }>;
      }
    >;
    daysSaved: number;
  }
> = {
  [JointInspectionStageEnum.PRE_CONSTRUCTION]: {
    stageTitle: 'Phase 1: Pre-Construction Site & Groundbreaking Clearance',
    stageDescription:
      'Combined inspection before civil construction begins. Evaluates boundary setbacks, environmental buffer zones, and fire tender turning radiuses.',
    recommendedTimeframe: 'Day 15–20 after Project Registration',
    leadAuthorityCode: 'AUTH-MPCB',
    leadAuthorityName: 'Maharashtra Pollution Control Board',
    approvalCodes: ['MPCB-CTE-001', 'FIRE-PROVISIONAL-001'],
    daysSaved: 12,
    readinessRequirements: [
      {
        id: 'readiness-1',
        title: 'Boundary & Setback Demarcation',
        description:
          'Clear physical boundary pegs demarcating 6-meter peripheral fire driveway and building line.',
        completed: false,
      },
      {
        id: 'readiness-2',
        title: 'Approach Road & Access Gate',
        description:
          'Minimum 6.0m wide motorable access road ready for heavy fire tenders and inspection vehicles.',
        completed: false,
      },
      {
        id: 'readiness-3',
        title: 'Ground Water & Effluent Discharge Mapping',
        description:
          'Borewell points and storm water discharge channel coordinates marked on site layout drawings.',
        completed: false,
      },
      {
        id: 'readiness-4',
        title: 'Approved Architectural Drawings on Site',
        description:
          'Laminated copies of site master plan and provisional fire layout ready for inspector signoff.',
        completed: false,
      },
    ],
    authorityChecklists: {
      'AUTH-MPCB': {
        authorityName: 'Maharashtra Pollution Control Board',
        mandate: 'CTE Verification: Site suitability and baseline environmental distance rules',
        items: [
          { item: 'Site location conforms to RRZ (River Regulation Zone) buffer requirements', status: 'pending' },
          { item: 'Proposed Effluent Treatment Plant (ETP) location positioned downhill / downstream', status: 'pending' },
          { item: 'Ambient air quality monitoring station accessibility verified', status: 'pending' },
          { item: 'Solid waste / spent grain segregation yard earmarked', status: 'pending' },
        ],
      },
      'AUTH-FIRE': {
        authorityName: 'Maharashtra Fire & Emergency Services',
        mandate: 'Provisional Fire NOC: Access driveway, hydrant spacing, and water reservoir plan',
        items: [
          { item: 'Main gate width >= 6.0 meters with minimum 5.0m vertical clearance', status: 'pending' },
          { item: 'Peripheral driveway load-bearing capacity (>45 metric tons) verified', status: 'pending' },
          { item: 'Static fire water storage reservoir location verified against civil layout', status: 'pending' },
          { item: 'Proximity to nearest municipal fire station recorded with response time estimate', status: 'pending' },
        ],
      },
    },
  },
  [JointInspectionStageEnum.PLANT_READINESS]: {
    stageTitle: 'Phase 2: Plant Readiness & Equipment Safety Verification',
    stageDescription:
      'Mid-stage factory layout inspection for high-pressure boilers, heavy brewing machinery guarding, and structural fire separation.',
    recommendedTimeframe: 'Day 45–60 (Post-Civil & Machinery Erection)',
    leadAuthorityCode: 'AUTH-DISH',
    leadAuthorityName: 'Directorate of Industrial Safety & Health (Labour Dept)',
    approvalCodes: ['DISH-PLAN-001', 'DISH-LICENCE-001'],
    daysSaved: 10,
    readinessRequirements: [
      {
        id: 'readiness-201',
        title: 'Machine Foundation & Anti-Vibration Mounting',
        description:
          'Mashing tuns, wort kettles, and centrifuge units bolted on reinforced plinths.',
        completed: false,
      },
      {
        id: 'readiness-202',
        title: 'Electrical Substation & Earthing Pits',
        description:
          'Double earthing continuity tests completed for transformer and HT panel.',
        completed: false,
      },
      {
        id: 'readiness-203',
        title: 'Pressure Vessel Test Certificates Available',
        description:
          'Chief Inspector of Boilers certified test reports for steam headers and air receivers.',
        completed: false,
      },
    ],
    authorityChecklists: {
      'AUTH-DISH': {
        authorityName: 'Labour Department (DISH)',
        mandate: 'Factory Safety: Machine guarding, emergency stops, ventilation, and pressure vessel integrity',
        items: [
          { item: 'Minimum 1.5m clear passage between all rotating machinery and bottling lines', status: 'pending' },
          { item: 'Emergency trip wires and isolation push-buttons installed on high-speed conveyors', status: 'pending' },
          { item: 'Ventilation rate >= 6 air changes per hour in fermentation and CO2 storage bays', status: 'pending' },
          { item: 'Illumination levels >= 150 Lux verified at all processing floor work stations', status: 'pending' },
          { item: 'Occupational health & first aid room setup compliant with Factories Act', status: 'pending' },
        ],
      },
    },
  },
  [JointInspectionStageEnum.PRE_COMMISSIONING]: {
    stageTitle: 'Phase 3: Pre-Commissioning Multi-Agency Integrated Inspection',
    stageDescription:
      'Unified final site visit uniting MPCB, Fire Services, DISH, and State Excise before commercial trial runs begin. Eliminates 4 separate departmental visits.',
    recommendedTimeframe: 'Day 75–90 (Pre-Trial Run Window)',
    leadAuthorityCode: 'AUTH-EXCISE',
    leadAuthorityName: 'Maharashtra State Excise Department',
    approvalCodes: [
      'MPCB-CTO-001',
      'FIRE-FINAL-001',
      'DISH-LICENCE-001',
      'BRL-001',
      'FSSAI-LICENCE-001',
    ],
    daysSaved: 24,
    readinessRequirements: [
      {
        id: 'readiness-301',
        title: 'ETP Zero Liquid Discharge / Trial Run Ready',
        description:
          'Effluent Treatment Plant commissioned with water trial run and calibrated flow meters.',
        completed: false,
      },
      {
        id: 'readiness-302',
        title: 'Fire Hydrant & Sprinkler System Charged',
        description:
          'Main diesel fire pump and jockey pump auto-start tested at 7.0 kg/cm² pressure.',
        completed: false,
      },
      {
        id: 'readiness-303',
        title: 'Excise Bonded Warehouse & Tank Calibration',
        description:
          'Storage vats and BBTs (Bright Beer Tanks) dip-calibrated with physical locking seals.',
        completed: false,
      },
      {
        id: 'readiness-304',
        title: 'CCTV Surveillance with 90-Day Retention',
        description:
          'Cameras covering bottling hall, excise bond room, and entry/exit gates operational.',
        completed: false,
      },
      {
        id: 'readiness-305',
        title: 'Food Safety CIP (Clean-In-Place) Sanitization Ready',
        description:
          'Food contact grade SS304/SS316 certificates and portable water test reports ready.',
        completed: false,
      },
    ],
    authorityChecklists: {
      'AUTH-MPCB': {
        authorityName: 'Maharashtra Pollution Control Board',
        mandate: 'CTO Final Verification: ETP commissioning, OCEMS online data connectivity, acoustic DG enclosure',
        items: [
          { item: 'ETP biological aeration basin and tertiary RO unit operational with trial water', status: 'pending' },
          { item: 'Online Continuous Effluent Monitoring System (OCEMS) calibrated and transmitting to CPCB/MPCB server', status: 'pending' },
          { item: 'Acoustic enclosure on Diesel Generator sets reducing noise < 75 dB(A) at 1 meter', status: 'pending' },
          { item: 'Hazardous chemical storage (caustic/acid) fitted with secondary containment bunding', status: 'pending' },
        ],
      },
      'AUTH-FIRE': {
        authorityName: 'Maharashtra Fire & Emergency Services',
        mandate: 'Final Fire NOC: Automatic sprinkler testing, fire doors, pressurized stairwells, and evacuation signage',
        items: [
          { item: 'Automatic fire sprinkler network coverage tested across grain storage and packaging bays', status: 'pending' },
          { item: '2-hour fire rated doors and emergency illuminated exit signboards installed', status: 'pending' },
          { item: 'Main fire hydrant ring main pressure test confirmed >= 7.0 kg/cm²', status: 'pending' },
          { item: 'CO2 gas flooding system in electrical control panel room certified', status: 'pending' },
        ],
      },
      'AUTH-DISH': {
        authorityName: 'Labour Department (DISH)',
        mandate: 'Factory Registration: Machine safety compliance, boiler certificates, PPE provision',
        items: [
          { item: 'Chief Inspector of Boilers steam pipeline radiographical test report verified', status: 'pending' },
          { item: 'Personal Protective Equipment (safety shoes, goggles, ear defenders) available for all crew', status: 'pending' },
          { item: 'Factory welfare amenities (drinking water cooler, washrooms, dining room) inspected', status: 'pending' },
        ],
      },
      'AUTH-EXCISE': {
        authorityName: 'Maharashtra State Excise Department',
        mandate: 'Form BRL Brewery Licence: Physical tank calibration, secure warehouse locks, digital flow meters',
        items: [
          { item: 'Capacity calibration tables for mash tun, brew kettle, and BBTs signed by Weights & Measures', status: 'pending' },
          { item: 'Excise bonded store room fitted with dual-lock mechanism (Excise Officer key + Brewery key)', status: 'pending' },
          { item: 'Tamper-proof electromagnetic flow meters installed on beer transfer pipes', status: 'pending' },
          { item: 'Continuous CCTV feed into State Excise regional control center connected', status: 'pending' },
        ],
      },
      'AUTH-FSSAI': {
        authorityName: 'FSSAI (Food Safety and Standards Authority)',
        mandate: 'Food Safety Licence: Potable water test results, sanitary drainage, hygienic food contact surfaces',
        items: [
          { item: 'Water analysis report complying with IS 10500:2012 potable water standards', status: 'pending' },
          { item: 'Stainless steel piping (SS304/SS316) sanitary tri-clamp fittings with zero dead-legs', status: 'pending' },
          { item: 'Insect screens (air curtains / fly catchers) installed at all process room entrances', status: 'pending' },
          { item: 'Pest management contract and Food Safety Management System (FSMS) plan verified', status: 'pending' },
        ],
      },
    },
  },
  [JointInspectionStageEnum.ANNUAL_COMPLIANCE]: {
    stageTitle: 'Phase 4: Periodic Joint Compliance & Renewal Audit',
    stageDescription:
      'Annual synchronized inspection for environmental consent renewal, factory licence renewal, and fire safety certificate renewal.',
    recommendedTimeframe: 'Annual Cycle (30 Days prior to expiry)',
    leadAuthorityCode: 'AUTH-MPCB',
    leadAuthorityName: 'Maharashtra Pollution Control Board',
    approvalCodes: ['MPCB-CTO-001', 'DISH-LICENCE-001', 'FIRE-FINAL-001'],
    daysSaved: 14,
    readinessRequirements: [
      {
        id: 'readiness-401',
        title: 'Annual Environmental Audit Report Ready',
        description: 'Form V environmental statement and stack monitoring logs.',
        completed: false,
      },
      {
        id: 'readiness-402',
        title: 'Annual Fire Equipment Servicing Record',
        description: 'Third-party certified hydrant test log and refilled extinguisher tags.',
        completed: false,
      },
    ],
    authorityChecklists: {
      'AUTH-MPCB': {
        authorityName: 'Maharashtra Pollution Control Board',
        mandate: 'Annual Environmental Audit',
        items: [
          { item: 'Effluent discharge logbooks and energy meter readings on ETP verified', status: 'pending' },
          { item: 'Solid waste disposal manifested records verified', status: 'pending' },
        ],
      },
      'AUTH-FIRE': {
        authorityName: 'Maharashtra Fire & Emergency Services',
        mandate: 'Annual Fire NOC Renewal Audit',
        items: [
          { item: 'Fire drill records and emergency evacuation mock drill log confirmed', status: 'pending' },
          { item: 'Fire pump engine battery and diesel tank levels verified', status: 'pending' },
        ],
      },
    },
  },
};

import { RoadmapService } from '../roadmap/roadmap.service';

@Injectable()
export class InspectionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RoadmapService) private readonly roadmap: RoadmapService,
  ) {}

  private async assertProject(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, industry: true },
    });
    if (!project) {
      throw new NotFoundException(`Project '${projectId}' not found`);
    }
  }

  async getCandidates(projectId: string): Promise<{
    candidates: InspectionCandidate[];
    summary: {
      totalSeparateVisits: number;
      consolidatedJointVisits: number;
      visitsSaved: number;
      totalDaysSaved: number;
    };
  }> {
    await this.assertProject(projectId);

    // Fetch existing approval instances for this project
    const instances = await this.prisma.approvalInstance.findMany({
      where: { projectId },
      include: {
        approvalDefinition: {
          include: { authority: true },
        },
      },
    });

    const activeApprovalCodes = new Set(
      instances.map((inst) => inst.approvalDefinition.code),
    );

    const candidates: InspectionCandidate[] = [];
    let totalSeparateVisits = 0;
    let totalDaysSaved = 0;

    for (const stageKey of Object.values(JointInspectionStageEnum)) {
      const template = STAGE_TEMPLATES[stageKey];
      if (!template) continue;

      // Filter approvals relevant to this stage
      const stageApprovals = template.approvalCodes
        .filter((code) => activeApprovalCodes.size === 0 || activeApprovalCodes.has(code))
        .map((code) => {
          const authChecklist = Object.entries(template.authorityChecklists).find(([authCode]) => {
            if (code.startsWith('MPCB')) return authCode === 'AUTH-MPCB';
            if (code.startsWith('FIRE')) return authCode === 'AUTH-FIRE';
            if (code.startsWith('DISH')) return authCode === 'AUTH-DISH';
            if (code.startsWith('BRL') || code.startsWith('EXCISE')) return authCode === 'AUTH-EXCISE';
            if (code.startsWith('FSSAI')) return authCode === 'AUTH-FSSAI';
            return false;
          });

          const authorityCode = authChecklist ? authChecklist[0] : 'AUTH-GOV';
          const authorityInfo = authChecklist ? authChecklist[1] : { authorityName: 'Competent Authority', mandate: 'Physical Verification', items: [] };

          return {
            approvalCode: code,
            approvalName: this.getApprovalName(code),
            authorityCode,
            authorityName: authorityInfo.authorityName,
            inspectionMandate: authorityInfo.mandate,
            checklistTemplate: authorityInfo.items.map((it) => ({
              item: it.item,
              status: it.status,
            })),
          };
        });

      if (stageApprovals.length > 0) {
        const separateVisits = stageApprovals.length;
        totalSeparateVisits += separateVisits;
        totalDaysSaved += template.daysSaved;

        candidates.push({
          stage: stageKey,
          stageTitle: template.stageTitle,
          stageDescription: template.stageDescription,
          recommendedTimeframe: template.recommendedTimeframe,
          leadAuthorityCode: template.leadAuthorityCode,
          leadAuthorityName: template.leadAuthorityName,
          participatingApprovals: stageApprovals,
          readinessRequirements: template.readinessRequirements,
          estimatedVisitsSaved: Math.max(0, separateVisits - 1),
          estimatedDaysSaved: template.daysSaved,
        });
      }
    }

    const consolidatedJointVisits = candidates.length;
    const visitsSaved = Math.max(0, totalSeparateVisits - consolidatedJointVisits);

    return {
      candidates,
      summary: {
        totalSeparateVisits,
        consolidatedJointVisits,
        visitsSaved,
        totalDaysSaved,
      },
    };
  }

  async listInspections(projectId: string) {
    await this.assertProject(projectId);
    return this.prisma.jointInspection.findMany({
      where: { projectId },
      include: {
        participatingApprovals: true,
        inspectorChecklists: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getInspection(projectId: string, inspectionId: string) {
    await this.assertProject(projectId);
    const inspection = await this.prisma.jointInspection.findFirst({
      where: { id: inspectionId, projectId },
      include: {
        participatingApprovals: true,
        inspectorChecklists: true,
      },
    });

    if (!inspection) {
      throw new NotFoundException(`Joint inspection '${inspectionId}' not found.`);
    }

    return inspection;
  }

  async createPlan(projectId: string, dto?: CreateJointInspectionDto) {
    await this.assertProject(projectId);

    // If stage specified, create for that stage; otherwise generate all recommended stages
    const stagesToCreate = dto?.stage
      ? [dto.stage]
      : [
          JointInspectionStageEnum.PRE_CONSTRUCTION,
          JointInspectionStageEnum.PRE_COMMISSIONING,
        ];

    const createdInspections = [];

    for (const stage of stagesToCreate) {
      const template = STAGE_TEMPLATES[stage];
      if (!template) continue;

      // Check if one already exists for this stage
      const existing = await this.prisma.jointInspection.findFirst({
        where: { projectId, stage },
        include: {
          participatingApprovals: true,
          inspectorChecklists: true,
        },
      });

      if (existing) {
        createdInspections.push(existing);
        continue;
      }

      // Create new joint inspection
      const newInspection = await this.prisma.jointInspection.create({
        data: {
          projectId,
          title: dto?.title ?? template.stageTitle,
          stage,
          status: 'draft',
          leadAuthorityCode: template.leadAuthorityCode,
          leadAuthorityName: template.leadAuthorityName,
          premisesAddress: dto?.premisesAddress ?? 'Plot No. PAP-K-12, Chakan Industrial Area, Phase II, Pune 410501',
          notes: dto?.notes ?? template.stageDescription,
          readinessChecklist: template.readinessRequirements as unknown as Prisma.InputJsonValue,
          participatingApprovals: {
            create: template.approvalCodes.map((code) => {
              const authEntry = Object.entries(template.authorityChecklists).find(
                ([authCode]) => {
                  if (code.startsWith('MPCB')) return authCode === 'AUTH-MPCB';
                  if (code.startsWith('FIRE')) return authCode === 'AUTH-FIRE';
                  if (code.startsWith('DISH')) return authCode === 'AUTH-DISH';
                  if (code.startsWith('BRL') || code.startsWith('EXCISE')) return authCode === 'AUTH-EXCISE';
                  if (code.startsWith('FSSAI')) return authCode === 'AUTH-FSSAI';
                  return false;
                },
              );
              const authorityCode = authEntry ? authEntry[0] : 'AUTH-GOV';
              const authorityName = authEntry ? authEntry[1].authorityName : 'Government Authority';
              const mandate = authEntry ? authEntry[1].mandate : 'On-site physical inspection';

              return {
                approvalCode: code,
                approvalName: this.getApprovalName(code),
                authorityCode,
                authorityName,
                specificRequirements: mandate,
              };
            }),
          },
          inspectorChecklists: {
            create: Object.entries(template.authorityChecklists).map(
              ([authCode, authData]) => ({
                authorityCode: authCode,
                authorityName: authData.authorityName,
                status: 'pending',
                items: authData.items as unknown as Prisma.InputJsonValue,
                findingsNotes: `Pending joint on-site inspection for ${authData.authorityName}.`,
              }),
            ),
          },
        },
        include: {
          participatingApprovals: true,
          inspectorChecklists: true,
        },
      });

      createdInspections.push(newInspection);
    }

    return createdInspections;
  }

  async scheduleInspection(
    projectId: string,
    inspectionId: string,
    dto: ScheduleInspectionDto,
  ) {
    const inspection = await this.getInspection(projectId, inspectionId);

    const updateData: Prisma.JointInspectionUpdateInput = {
      scheduledDate: new Date(dto.scheduledDate),
      timeSlot: dto.timeSlot,
      premisesAddress: dto.premisesAddress ?? inspection.premisesAddress,
      leadAuthorityCode: dto.leadAuthorityCode ?? inspection.leadAuthorityCode,
      leadAuthorityName: dto.leadAuthorityName ?? inspection.leadAuthorityName,
      notes: dto.notes ?? inspection.notes,
      status: 'scheduled',
    };

    if (dto.readinessChecklist) {
      updateData.readinessChecklist = dto.readinessChecklist as unknown as Prisma.InputJsonValue;
    }

    const updated = await this.prisma.jointInspection.update({
      where: { id: inspection.id },
      data: updateData,
      include: {
        participatingApprovals: true,
        inspectorChecklists: true,
      },
    });

    return updated;
  }

  async signoffChecklist(
    projectId: string,
    inspectionId: string,
    checklistId: string,
    dto: SignoffChecklistDto,
  ) {
    await this.getInspection(projectId, inspectionId);

    const checklist = await this.prisma.jointInspectorChecklist.findFirst({
      where: { id: checklistId, jointInspectionId: inspectionId },
    });

    if (!checklist) {
      throw new NotFoundException(`Inspector checklist '${checklistId}' not found.`);
    }

    await this.prisma.jointInspectorChecklist.update({
      where: { id: checklist.id },
      data: {
        inspectorName: dto.inspectorName ?? checklist.inspectorName ?? 'Senior Field Inspector',
        inspectorDesignation:
          dto.inspectorDesignation ??
          checklist.inspectorDesignation ??
          'Divisional Regulatory Officer',
        status: dto.status,
        items: dto.items as unknown as Prisma.InputJsonValue,
        findingsNotes: dto.findingsNotes ?? checklist.findingsNotes,
        signedOffAt: new Date(),
      },
    });

    // Check if all checklists in this joint inspection are completed
    const allChecklists = await this.prisma.jointInspectorChecklist.findMany({
      where: { jointInspectionId: inspectionId },
    });

    const allSatisfactory = allChecklists.every(
      (c) => c.status === 'satisfactory',
    );
    const anyRejected = allChecklists.some((c) => c.status === 'rejected');
    const allReviewed = allChecklists.every((c) => c.status !== 'pending');

    let newStatus = 'in_progress';
    if (allSatisfactory) {
      newStatus = 'completed';
      await this.advanceRoadmapApprovalsOnCompletion(projectId, inspectionId);
    } else if (anyRejected) {
      newStatus = 'rescheduled';
    } else if (allReviewed) {
      newStatus = 'in_progress';
    }

    await this.prisma.jointInspection.update({
      where: { id: inspectionId },
      data: {
        status: newStatus as any,
        jointReportSummary: allSatisfactory
          ? `All ${allChecklists.length} participating regulatory authorities conducted unified on-site physical verification and signed off satisfactorily. Associated roadmap approvals marked as DONE and downstream prerequisites unlocked.`
          : anyRejected
          ? `One or more regulatory authorities noted critical non-compliances requiring rectification prior to re-inspection.`
          : `Inspection in progress. ${allChecklists.filter((c) => c.status === 'satisfactory').length}/${allChecklists.length} departments signed off.`,
      },
    });

    return this.getInspection(projectId, inspectionId);
  }

  async proposeSlots(
    projectId: string,
    inspectionId: string,
    dto: ProposeSlotsDto,
  ) {
    const inspection = await this.getInspection(projectId, inspectionId);

    const slotNegotiationData = {
      proposedAt: new Date().toISOString(),
      applicantNotes: dto.applicantNotes ?? '',
      slots: dto.slots,
      responses: {},
      consensusSlotId: null,
      status: 'pending_officer_responses',
    };

    const updated = await this.prisma.jointInspection.update({
      where: { id: inspection.id },
      data: {
        slotNegotiation: slotNegotiationData as unknown as Prisma.InputJsonValue,
        notes: dto.applicantNotes
          ? `${inspection.notes ?? ''}\n[Slot Proposal]: ${dto.applicantNotes}`.trim()
          : inspection.notes,
      },
      include: {
        participatingApprovals: true,
        inspectorChecklists: true,
      },
    });

    return updated;
  }

  async respondSlot(
    projectId: string,
    inspectionId: string,
    dto: RespondSlotDto,
  ) {
    const inspection = await this.getInspection(projectId, inspectionId);
    const negotiation: any = inspection.slotNegotiation || {
      slots: [],
      responses: {},
      consensusSlotId: null,
      status: 'in_progress',
    };

    const responses = {
      ...(negotiation.responses || {}),
      [dto.authorityCode]: {
        slotId: dto.slotId,
        status: dto.status,
        alternateDate: dto.alternateDate ?? null,
        officerNotes: dto.officerNotes ?? null,
        respondedAt: new Date().toISOString(),
      },
    };

    // Check if consensus is reached across all participating authorities
    const participatingAuthorities = inspection.inspectorChecklists.map(
      (c) => c.authorityCode,
    );
    const slots: any[] = negotiation.slots || [];

    let consensusSlotId: string | null = null;
    let matchingSlot: any = null;

    for (const slot of slots) {
      const allConfirmed = participatingAuthorities.every(
        (authCode) =>
          responses[authCode]?.slotId === slot.slotId &&
          responses[authCode]?.status === 'confirmed',
      );
      if (allConfirmed) {
        consensusSlotId = slot.slotId;
        matchingSlot = slot;
        break;
      }
    }

    const updatedNegotiation = {
      ...negotiation,
      responses,
      consensusSlotId,
      status: consensusSlotId ? 'consensus_reached' : 'in_negotiation',
    };

    const updateData: Prisma.JointInspectionUpdateInput = {
      slotNegotiation: updatedNegotiation as unknown as Prisma.InputJsonValue,
    };

    if (consensusSlotId && matchingSlot) {
      updateData.scheduledDate = new Date(matchingSlot.date);
      updateData.timeSlot = matchingSlot.timeWindow;
      updateData.status = 'scheduled';
    }

    const updated = await this.prisma.jointInspection.update({
      where: { id: inspection.id },
      data: updateData,
      include: {
        participatingApprovals: true,
        inspectorChecklists: true,
      },
    });

    return updated;
  }

  async submitRectification(
    projectId: string,
    inspectionId: string,
    dto: SubmitRectificationDto,
  ) {
    const inspection = await this.getInspection(projectId, inspectionId);
    const currentPlan: any = inspection.rectificationPlan || { submissions: [] };

    const newSubmission = {
      submissionId: `rect-${Date.now()}`,
      authorityCode: dto.authorityCode,
      submittedAt: new Date().toISOString(),
      itemsResolved: dto.itemsResolved,
      complianceDeclaration: dto.complianceDeclaration,
      status: 'pending_officer_review',
    };

    const updatedPlan = {
      ...currentPlan,
      submissions: [...(currentPlan.submissions || []), newSubmission],
      lastSubmittedAt: new Date().toISOString(),
      status: 'awaiting_re_evaluation',
    };

    const updated = await this.prisma.jointInspection.update({
      where: { id: inspection.id },
      data: {
        rectificationPlan: updatedPlan as unknown as Prisma.InputJsonValue,
        status: 'in_progress',
      },
      include: {
        participatingApprovals: true,
        inspectorChecklists: true,
      },
    });

    return updated;
  }

  async reviewRectification(
    projectId: string,
    inspectionId: string,
    dto: ReviewRectificationDto,
  ) {
    const inspection = await this.getInspection(projectId, inspectionId);

    const checklist = await this.prisma.jointInspectorChecklist.findFirst({
      where: {
        jointInspectionId: inspectionId,
        authorityCode: dto.authorityCode,
      },
    });

    if (!checklist) {
      throw new NotFoundException(
        `Checklist for authority '${dto.authorityCode}' not found.`,
      );
    }

    // Update checklist status
    await this.prisma.jointInspectorChecklist.update({
      where: { id: checklist.id },
      data: {
        status:
          dto.status === 'satisfactory'
            ? 'satisfactory'
            : 'needs_rectification',
        findingsNotes: `[Rectification Review]: ${dto.reviewNotes}`,
        signedOffAt: new Date(),
      },
    });

    // Check if all checklists in this joint inspection are now satisfactory
    const allChecklists = await this.prisma.jointInspectorChecklist.findMany({
      where: { jointInspectionId: inspectionId },
    });

    const allSatisfactory = allChecklists.every(
      (c) => c.status === 'satisfactory',
    );

    const newStatus = allSatisfactory ? 'completed' : 'in_progress';
    if (allSatisfactory) {
      await this.advanceRoadmapApprovalsOnCompletion(projectId, inspectionId);
    }

    const currentPlan: any = inspection.rectificationPlan || { submissions: [] };
    const updatedPlan = {
      ...currentPlan,
      status: allSatisfactory
        ? 'rectifications_cleared'
        : 're_inspection_pending',
      lastReviewedAt: new Date().toISOString(),
      reviewNotes: dto.reviewNotes,
    };

    await this.prisma.jointInspection.update({
      where: { id: inspectionId },
      data: {
        status: newStatus as any,
        rectificationPlan: updatedPlan as unknown as Prisma.InputJsonValue,
        jointReportSummary: allSatisfactory
          ? `All ${allChecklists.length} authorities completed joint physical verification and approved rectified compliances. Downstream approvals unlocked.`
          : inspection.jointReportSummary,
      },
    });

    return this.getInspection(projectId, inspectionId);
  }

  async completeInspection(
    projectId: string,
    inspectionId: string,
    dto: CompleteInspectionDto,
  ) {
    const inspection = await this.getInspection(projectId, inspectionId);

    const updated = await this.prisma.jointInspection.update({
      where: { id: inspection.id },
      data: {
        status: 'completed',
        jointReportSummary: dto.jointReportSummary,
      },
      include: {
        participatingApprovals: true,
        inspectorChecklists: true,
      },
    });

    await this.advanceRoadmapApprovalsOnCompletion(projectId, inspectionId);
    return updated;
  }

  private async advanceRoadmapApprovalsOnCompletion(
    projectId: string,
    inspectionId: string,
  ): Promise<void> {
    const participating = await this.prisma.jointInspectionApproval.findMany({
      where: { jointInspectionId: inspectionId },
    });

    for (const app of participating) {
      const instance = await this.prisma.approvalInstance.findFirst({
        where: {
          projectId,
          approvalDefinition: { code: app.approvalCode },
        },
      });

      if (instance && instance.status !== 'done') {
        await this.prisma.approvalInstance.update({
          where: { id: instance.id },
          data: { status: 'done' },
        });
        await this.roadmap.unlockDependents(
          projectId,
          instance.approvalDefinitionId,
        );
      }
    }
  }

  private getApprovalName(code: string): string {
    const names: Record<string, string> = {
      'BRL-001': 'Form BRL Brewery Manufacturing Licence',
      'MPCB-CTE-001': 'MPCB Consent to Establish',
      'MPCB-CTO-001': 'MPCB Consent to Operate',
      'FIRE-PROVISIONAL-001': 'Provisional Fire No-Objection Certificate',
      'FIRE-FINAL-001': 'Final Fire No-Objection Certificate',
      'DISH-PLAN-001': 'Factory Plan Approval',
      'DISH-LICENCE-001': 'Factory Registration & Operating Licence',
      'FSSAI-LICENCE-001': 'FSSAI Food Business Manufacturing Licence',
      'LM-PACKAGED-001': 'Legal Metrology Packaged Commodities Registration',
      'EXCISE-LABEL-001': 'Excise Label & Brand Registration',
    };
    return names[code] ?? code;
  }
}
