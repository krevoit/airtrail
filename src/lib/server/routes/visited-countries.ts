import { z } from 'zod';

import { permissionProcedure, router } from '../trpc';

import { db } from '$lib/db';
import { VisitedCountryStatus } from '$lib/db/types';
import { listFlights } from '$lib/server/utils/flight';
import {
  listVisitedCountries,
  removeVisitedCountry,
  setVisitedCountry,
} from '$lib/server/utils/visited-countries';
import {
  countryOfSubdivision,
  isKnownSubdivisionCode,
  listVisitedSubdivisions,
  placesAtPoints,
  removeVisitedSubdivision,
  setVisitedSubdivision,
  subdivisionCounts,
  subdivisionsOfCountry,
} from '$lib/server/utils/visited-subdivisions';
import {
  countryCodesFromFlights,
  isKnownVisitedPlaceCode,
} from '$lib/utils/data/countries';

const VisitedCountrySchema = z.object({
  code: z.string().min(2).max(3).refine(isKnownVisitedPlaceCode, {
    message: 'Unknown country code',
  }),
  status: z.enum(VisitedCountryStatus).nullable(),
  note: z.string().nullable(),
});

const VisitedSubdivisionSchema = z.object({
  code: z.string().min(3).max(32).refine(isKnownSubdivisionCode, {
    message: 'Unknown subdivision code',
  }),
  status: z.enum(VisitedCountryStatus).nullable(),
  note: z.string().max(1000).nullable(),
});

const countRows = (result: { numInsertedOrUpdatedRows?: bigint }[]) =>
  Number(result?.[0]?.numInsertedOrUpdatedRows || 0);

export const visitedCountriesRouter = router({
  list: permissionProcedure('flight.read.own').query(({ ctx }) =>
    listVisitedCountries(ctx.user.id),
  ),
  save: permissionProcedure('flight.read.own')
    .input(VisitedCountrySchema)
    .mutation(async ({ ctx, input }) => {
      const { code, status, note } = input;
      if (status) {
        await setVisitedCountry(ctx.user.id, { code, status, note });
        return true;
      }
      const result = await removeVisitedCountry(ctx.user.id, code);
      return result.length > 0;
    }),
  subdivisionCounts: permissionProcedure('flight.read.own').query(() =>
    subdivisionCounts(),
  ),
  subdivisions: permissionProcedure('flight.read.own')
    .input(z.object({ country: z.string().min(2).max(3) }))
    .query(({ input }) => subdivisionsOfCountry(input.country)),
  listSubdivisions: permissionProcedure('flight.read.own').query(({ ctx }) =>
    listVisitedSubdivisions(ctx.user.id),
  ),
  saveSubdivision: permissionProcedure('flight.read.own')
    .input(VisitedSubdivisionSchema)
    .mutation(async ({ ctx, input }) => {
      const { code, status, note } = input;
      if (status) {
        await setVisitedSubdivision(ctx.user.id, { code, status, note });
        return true;
      }
      const result = await removeVisitedSubdivision(ctx.user.id, code);
      return result.length > 0;
    }),
  /**
   * Marks every country, disputed territory and subdivision with an airport
   * from the user's flights as visited. Existing entries are never changed.
   */
  importFlights: permissionProcedure('flight.read.own').mutation(
    async ({ ctx }) => {
      const flights = await listFlights(ctx.user.id);
      const countries = countryCodesFromFlights(flights);
      const points = flights.flatMap((flight) =>
        [flight.from, flight.to].filter((airport) => airport !== null),
      );
      const places = await placesAtPoints(points);

      const placeCodes = [...countries, ...places.territories];
      const subdivisions = [...places.subdivisions].filter((code) =>
        countryOfSubdivision(code),
      );
      if (placeCodes.length === 0 && subdivisions.length === 0) {
        return 0;
      }

      let inserted = 0;
      if (placeCodes.length) {
        const result = await db
          .insertInto('visitedCountry')
          .values(
            placeCodes.map((code) => ({
              userId: ctx.user.id,
              code,
              status: 'visited' as const,
            })),
          )
          .onConflict((oc) => oc.columns(['userId', 'code']).doNothing())
          .execute();
        inserted += countRows(result);
      }
      if (subdivisions.length) {
        const result = await db
          .insertInto('visitedSubdivision')
          .values(
            subdivisions.map((code) => ({
              userId: ctx.user.id,
              code,
              country: countryOfSubdivision(code)!,
              status: 'visited' as const,
            })),
          )
          .onConflict((oc) => oc.columns(['userId', 'code']).doNothing())
          .execute();
        inserted += countRows(result);
      }
      return inserted;
    },
  ),
});
