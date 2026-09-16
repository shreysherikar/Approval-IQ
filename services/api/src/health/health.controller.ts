import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Get('health')
  @ApiOperation({ summary: 'Service + database health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Database is unreachable' })
  async check(): Promise<{ status: string; timestamp: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database is unreachable');
    }
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('engine/health')
  @ApiOperation({ summary: 'Approval Engine health check & ruleset version metadata' })
  @ApiResponse({ status: 200, description: 'Engine operational' })
  async engineHealth(): Promise<{
    status: string;
    rulesetVersion: string;
    gitCommit: string;
    timestamp: string;
  }> {
    const rulesetVersion = process.env.VITE_RULESET_VERSION || process.env.RULESET_VERSION || 'ruleset-v2026.09.1-beta+git7a2f9';
    const gitCommit = process.env.GIT_COMMIT || '7a2f9e4';

    return {
      status: 'ok',
      rulesetVersion,
      gitCommit,
      timestamp: new Date().toISOString(),
    };
  }
}
