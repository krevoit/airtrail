import { db } from '$lib/db';
import type { VisitedCountryStatus } from '$lib/db/types';
import { isKnownVisitedPlaceCode } from '$lib/utils/data/countries';

type Status = (typeof VisitedCountryStatus)[number];

/** The user's visited countries and territories, leaving out unknown codes. */
export const listVisitedCountries = async (userId: string) => {
  const rows = await db
    .selectFrom('visitedCountry')
    .selectAll()
    .where('userId', '=', userId)
    .orderBy('code')
    .execute();
  return rows.filter((row) => isKnownVisitedPlaceCode(row.code));
};

export const setVisitedCountry = (
  userId: string,
  input: { code: string; status: Status; note: string | null },
) =>
  db
    .insertInto('visitedCountry')
    .values({ ...input, userId })
    .onConflict((oc) =>
      oc
        .columns(['userId', 'code'])
        .doUpdateSet({ status: input.status, note: input.note }),
    )
    .returningAll()
    .executeTakeFirstOrThrow();

export const removeVisitedCountry = (userId: string, code: string) =>
  db
    .deleteFrom('visitedCountry')
    .where('userId', '=', userId)
    .where('code', '=', code)
    .execute();
