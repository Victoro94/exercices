import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequestsService } from './requests.service';
import { CreateRequestDto } from './dto/create-request.dto';

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

  @Delete(':id')
  remove(@Req() req: { user: { userId: string } }, @Param('id') id: string) {
    return this.service.remove(req.user.userId, id);
  }
}
