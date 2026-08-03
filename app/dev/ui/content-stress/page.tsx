/**
 * Thin re-export: the implementation lives in a sibling module so tests can import it without going
 * through `./page`, which Next's typed-routes stubs shadow.
 */
export { ContentStressPage as default } from './ContentStressPage';

export const dynamic = 'force-dynamic';
