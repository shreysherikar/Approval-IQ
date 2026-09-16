import { Injectable } from '@nestjs/common';

export interface ExternalPortalAdapter {
  portalCode: 'maitri' | 'nsws' | 'digilocker' | 'apisetu';
  portalName: string;
  jurisdiction: string;
  status: 'connected' | 'mock_ready' | 'sandbox_active';
  syncDirection: 'inbound_push' | 'bidirectional' | 'pull_query';
  supportedEntities: string[];
}

@Injectable()
export class IntegrationsService {
  /**
   * Returns registered government single-window and digital credential gateway adapters.
   * Proves architecture readiness for National Single Window System (NSWS) and MAITRI.
   */
  getAdapters(): ExternalPortalAdapter[] {
    return [
      {
        portalCode: 'maitri',
        portalName: 'MAITRI (Maharashtra Industry, Trade and Investment Facilitation Cell)',
        jurisdiction: 'Maharashtra',
        status: 'sandbox_active',
        syncDirection: 'bidirectional',
        supportedEntities: ['MPCB-CTE', 'MPCB-CTO', 'MIDC-ALLOTMENT', 'FIRE-NOC', 'DISH-FACTORY'],
      },
      {
        portalCode: 'nsws',
        portalName: 'National Single Window System (NSWS / Invest India)',
        jurisdiction: 'Central / Pan-India',
        status: 'sandbox_active',
        syncDirection: 'bidirectional',
        supportedEntities: ['FSSAI-CENTRAL', 'BOILERS-ACT', 'LEGAL-METROLOGY', 'CGWA-NOC'],
      },
      {
        portalCode: 'digilocker',
        portalName: 'DigiLocker & API Setu (National e-Governance Division)',
        jurisdiction: 'Pan-India',
        status: 'sandbox_active',
        syncDirection: 'inbound_push',
        supportedEntities: ['DOC-PAN', 'DOC-GST', 'DOC-ELECTRICITY', 'DOC-TITLE-7-12', 'DOC-TRADE-LICENCE'],
      },
      {
        portalCode: 'apisetu',
        portalName: 'API Setu Open Data & Interoperability Gateway',
        jurisdiction: 'MeitY / Pan-India',
        status: 'connected',
        syncDirection: 'pull_query',
        supportedEntities: ['CORPORATE-CIN-LOOKUP', 'GSTIN-STATUS-VERIFY', 'LAND-RECORDS-BHULEKH'],
      },
    ];
  }

  /**
   * Simulates an outbound push of a sealed submission packet to a State Single Window system.
   */
  async exportPacketToSingleWindow(params: {
    portalCode: 'maitri' | 'nsws';
    projectId: string;
    approvalCode: string;
    packetId: string;
  }): Promise<{
    success: boolean;
    remoteTransactionId: string;
    targetPortal: string;
    acknowledgedAt: string;
    portalReceiptUrl: string;
  }> {
    const timestamp = new Date().toISOString();
    const mockRef = `${params.portalCode.toUpperCase()}-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    return {
      success: true,
      remoteTransactionId: mockRef,
      targetPortal: params.portalCode === 'maitri' ? 'MAITRI Maharashtra Single Window' : 'National Single Window System (NSWS)',
      acknowledgedAt: timestamp,
      portalReceiptUrl: `https://${params.portalCode}.gov.in/ack/${mockRef}`,
    };
  }

  /**
   * Simulates pulling a verified document from DigiLocker repository.
   */
  async fetchFromDigiLocker(docType: string, _docNumber: string): Promise<{
    verified: boolean;
    issuer: string;
    docType: string;
    digiLockerDocId: string;
    digitalSignature: {
      signedBy: string;
      algorithm: string;
      valid: boolean;
    };
  }> {
    return {
      verified: true,
      issuer: 'Ministry of Electronics & Information Technology (MeitY)',
      docType,
      digiLockerDocId: `DL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      digitalSignature: {
        signedBy: 'DigiLocker National Authority eSign Sub-CA',
        algorithm: 'SHA256withRSA',
        valid: true,
      },
    };
  }
}
