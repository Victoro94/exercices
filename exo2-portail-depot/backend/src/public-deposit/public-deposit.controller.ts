import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicDepositService } from './public-deposit.service';
import { UnlockDto } from './dto/unlock.dto';
import { PresignDto } from './dto/presign.dto';
import { PublicSessionGuard } from './public-session.guard';

@Controller('public/:token')
export class PublicDepositController {
  constructor(private readonly service: PublicDepositService) {}

  @Get()
  meta(@Param('token') token: string) {
    return this.service.getMeta(token);
  }

  @Post('unlock')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  unlock(
    @Param('token') token: string,
    @Body() dto: UnlockDto,
    @Req() req: { ip?: string },
  ) {
    return this.service.unlock(token, dto.pin, req.ip);
  }

  @Post('files/presign')
  @HttpCode(201)
  @UseGuards(PublicSessionGuard)
  presign(@Param('token') token: string, @Body() dto: PresignDto) {
    return this.service.presign(token, dto);
  }

  @Post('files/:id/complete')
  @HttpCode(200)
  @UseGuards(PublicSessionGuard)
  complete(
    @Param('token') token: string,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.service.complete(token, id, req.ip);
  }

  @Get('files')
  @UseGuards(PublicSessionGuard)
  listFiles(@Param('token') token: string) {
    return this.service.listFiles(token);
  }

  @Delete('files/:id')
  @UseGuards(PublicSessionGuard)
  removeFile(
    @Param('token') token: string,
    @Param('id') id: string,
    @Req() req: { ip?: string },
  ) {
    return this.service.removeFile(token, id, req.ip);
  }

  @Get('files/:id/download')
  @UseGuards(PublicSessionGuard)
  downloadFile(@Param('token') token: string, @Param('id') id: string) {
    return this.service.downloadFile(token, id);
  }

  @Post('files')
  @HttpCode(201)
  @UseGuards(PublicSessionGuard)
  async legacyPresign(@Param('token') token: string, @Body() dto: PresignDto) {
    return this.service.presign(token, dto);
  }
}
