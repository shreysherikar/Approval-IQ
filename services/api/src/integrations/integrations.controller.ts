import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IntegrationsService, type ExternalPortalAdapter } from './integrations.service';

@ApiTags('Government Single-Window & DigiLocker Integrations')
@Controller('integrations')
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get('adapters')
  @ApiOperation({ summary: 'List registered single-window gateway and DigiLocker adapters' })
  getAdapters(): ExternalPortalAdapter[] {
    return this.service.getAdapters();
  }

  @Post('export-packet')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Push sealed submission packet to MAITRI / NSWS single-window portal' })
  async exportPacket(
    @Body() body: { portalCode: 'maitri' | 'nsws'; projectId: string; approvalCode: string; packetId: string },
  ) {
    return this.service.exportPacketToSingleWindow(body);
  }

  @Post('digilocker/fetch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Simulate verified credential pull from DigiLocker repository' })
  async fetchDigiLocker(
    @Body() body: { docType: string; docNumber: string },
  ) {
    return this.service.fetchFromDigiLocker(body.docType, body.docNumber);
  }
}
