import { Prisma } from '@prisma/client';

type Lang = 'az' | 'en' | 'ru';

/**
 * AZ-yə düşən tərcümə JOIN-u (raw SQL üçün).
 *
 * `JOIN x_translations t ON ... AND t.lang = 'en'` tərcüməsi olmayan obyektləri
 * siyahıdan atırdı. Burada əvvəlcə istənən dildəki sətir yoxlanılır, yoxdursa
 * `az` sətri qoşulur — `alias` sonrakı SQL-də adi tərcümə sətri kimi işlənir
 * (`t.name`, `t.search_text`). Prisma `include` ilə yüklənən yerlərdə eyni
 * seçim JS-də edilir (bax RegionsService.pick).
 *
 * Cədvəl/sütun adları yalnız koddakı sabitlərdən gəlir — istifadəçi girişi deyil.
 */
export function translationJoin(opts: {
  table: 'place_translations' | 'route_translations' | 'region_translations';
  fk: 'place_id' | 'route_id' | 'region_id';
  alias: string;
  owner: string;
  lang: Lang;
  left?: boolean;
}): Prisma.Sql {
  const { table, fk, alias, owner, lang, left = false } = opts;
  const join = Prisma.raw(left ? 'LEFT JOIN' : 'JOIN');
  const tbl = Prisma.raw(table);
  const a = Prisma.raw(alias);
  const on = Prisma.raw(`${alias}.${fk} = ${owner}.id`);

  if (lang === 'az') {
    return Prisma.sql`${join} ${tbl} ${a} ON ${on} AND ${a}.lang = 'az'`;
  }

  const probe = `${alias}_req`;
  return Prisma.sql`LEFT JOIN ${tbl} ${Prisma.raw(probe)} ON ${Prisma.raw(`${probe}.${fk} = ${owner}.id`)} AND ${Prisma.raw(probe)}.lang = ${lang}
    ${join} ${tbl} ${a} ON ${on} AND ${a}.lang = IF(${Prisma.raw(`${probe}.${fk}`)} IS NULL, 'az', ${lang})`;
}
