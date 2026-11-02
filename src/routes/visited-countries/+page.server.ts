import type { PageServerLoad } from './$types';

import { trpcServer } from '$lib/server/server';

export const load: PageServerLoad = async () => {
  await Promise.all([
    trpcServer.visitedCountries.list.ssr(),
    trpcServer.visitedCountries.listSubdivisions.ssr(),
    trpcServer.visitedCountries.subdivisionCounts.ssr(),
  ]);
};
