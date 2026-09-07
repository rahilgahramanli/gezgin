import { ulid } from 'ulid';

/** Xaricə açıq identifikator — daxili BigInt ID heç vaxt API-də görünmür. */
export const newPublicId = (): string => ulid();

/** Rezervasiya kodu — ekran 19, 53: GZ-27A4K9 */
export function newBookingCode(): string {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `GZ-${out}`;
}
