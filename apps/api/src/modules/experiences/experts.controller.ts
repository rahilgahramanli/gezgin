import { Controller, Get, Headers, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@/common/decorators/public.decorator';
import { ExperiencesService } from './experiences.service';
import { parseLang } from '@/common/i18n';

@ApiTags('experts')
@Controller('experts')
export class ExpertsController {
  constructor(private readonly experiences: ExperiencesService) {}

  @Public() @Get(':username')
  @ApiOperation({ summary: 'Local Expert profili — ekran 21' })
  profile(@Param('username') username: string, @Headers('accept-language') lang?: string) {
    return this.experiences.expertProfile(username, parseLang(lang));
  }
}
