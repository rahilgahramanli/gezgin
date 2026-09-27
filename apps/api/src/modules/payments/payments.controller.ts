import { Body, Controller, Delete, Get, Headers, HttpCode, Param, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { PaymentsService } from './payments.service';
import { AddPaymentMethodDto, RefundDto } from './dto/payments.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Get('methods')
  @ApiOperation({ summary: 'Ödəniş üsullarım — ekran 18, 49' })
  methods(@CurrentUser() user: AuthUser) {
    return this.payments.methods(user.id);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Post('methods')
  @ApiOperation({ summary: 'Kart əlavə et — PAN saxlanılmır, tokenləşdirilir' })
  addMethod(@CurrentUser() user: AuthUser, @Body() dto: AddPaymentMethodDto) {
    return this.payments.addMethod(user.id, dto);
  }

  @ApiBearerAuth() @UseGuards(GuestBlockedGuard) @Delete('methods/:id')
  @ApiOperation({ summary: 'Kartı sil' })
  removeMethod(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.payments.removeMethod(user.id, id);
  }

  @Public() @Post('webhook') @HttpCode(200)
  @ApiExcludeEndpoint()
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-signature') signature?: string) {
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));
    return this.payments.handleWebhook(raw, signature);
  }

  /**
   * Yalnız admin/dəstək üçün. İstifadəçi pulu yalnız rezervasiyanı ləğv etməklə
   * (POST /bookings/:id/cancel) və ləğv siyasətinə görə geri alır — əks halda
   * istənilən kəs istənilən ödənişi (başqasınınkını da) geri qaytara bilirdi.
   */
  @ApiBearerAuth() @Roles('admin') @Post(':publicId/refund')
  @ApiOperation({ summary: 'Geri qaytarma — yalnız admin (istifadəçi üçün: rezervasiyanı ləğv et)' })
  refund(@Param('publicId') publicId: string, @Body() dto: RefundDto) {
    return this.payments.refund(publicId, dto);
  }
}
