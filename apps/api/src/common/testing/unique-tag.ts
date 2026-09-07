import { randomBytes } from 'node:crypto';

/**
 * Test məlumatları üçün toqquşmayan etiket.
 *
 * Əvvəl `Date.now().toString(36)` işlədilirdi — jest suite-ləri paralel
 * işlədiyi üçün ikisi eyni millisaniyədə başlayanda eyni etiketi alırdı və
 * bir suite digərinin istifadəçisini silməyə çalışırdı. `bookings` və
 * `payouts` cədvəllərində FK RESTRICT olduğundan (maliyyə qeydləri
 * silinməməlidir) əməliyyat sınır və bütün suite "failed to run" olurdu.
 */
export function uniqueTag(): string {
  return `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
}
