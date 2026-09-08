import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateRequestDto } from './dto/update-request.dto';

@UseGuards(JwtAuthGuard)
@Controller('requests')
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Post()
  create(@Req() req: { user: { userId: string } }, @Body() dto: CreateRequestDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: { user: { userId: string } }) {
    return this.service.list(req.user.userId);
  }

  @Get(':id')
  getOne(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.service.getOne(req.user.userId, id);
  }

  @Get(':id/files')
  listFiles(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.service.listFiles(req.user.userId, id);
  }

  @Get(':id/files/:fileId/download')
  downloadFile(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.service.downloadFile(req.user.userId, id, fileId);
  }

  @Patch(':id')
  update(
    @Req() req: { user: { userId: string } },
    @Param('id') id: string,
    @Body() dto: UpdateRequestDto,
  ) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
