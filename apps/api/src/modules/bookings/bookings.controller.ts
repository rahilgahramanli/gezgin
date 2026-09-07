import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '@/common/decorators/current-user.decorator';
import { GuestBlockedGuard } from '@/common/guards/guest-blocked.guard';
import { BookingsService } from './bookings.service';
import { CancelBookingDto, CreateBookingDto, ListBookingsDto, PayBookingDto, QuoteDto } from './dto/bookings.dto';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(GuestBlockedGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Post('quote')
  @ApiOperation({ summary: 'Qiymət hesabla — ekran 18, 49 (rezervasiya yaratmır)' })
  quote(@Body() dto: QuoteDto) {
    return this.bookings.quote(dto);
  }

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: false, description: 'Təkrar sifarişin qarşısını alır' })
  @ApiOperation({ summary: 'Rezervasiya yarat — ekran 18 → 19' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.bookings.create(user.id, dto, idempotencyKey);
  }

  @Get()
  @ApiOperation({ summary: 'Rezervasiyalarım — ekran 53' })
  list(@CurrentUser() user: AuthUser, @Query() dto: ListBookingsDto) {
    return this.bookings.list(user.id, dto);
  }

  @Get(':publicId')
  @ApiOperation({ summary: 'Rezervasiya detalı' })
  detail(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.bookings.detail(publicId, user.id);
  }

  @Post(':publicId/pay')
  @ApiOperation({ summary: 'Ödə — 3-D Secure lazımdırsa actionUrl qaytarır' })
  pay(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: PayBookingDto) {
    return this.bookings.pay(user.id, publicId, dto);
  }

  @Post(':publicId/cancel')
  @ApiOperation({ summary: 'Ləğv et — siyasətə görə geri qaytarma' })
  cancel(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string, @Body() dto: CancelBookingDto) {
    return this.bookings.cancel(user.id, publicId, dto);
  }

  @Get(':publicId/ticket')
  @ApiOperation({ summary: 'Bilet və QR — ekran 19, 53' })
  ticket(@CurrentUser() user: AuthUser, @Param('publicId') publicId: string) {
    return this.bookings.ticket(publicId, user.id);
  }
}
