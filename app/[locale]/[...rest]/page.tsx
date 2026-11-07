import { notFound } from 'next/navigation';

// Any path below the locale segment that no other route matches. The locale layout is the root
// layout, so without this page Next serves its built-in 404 in a default document with no language,
// theme or chrome. Raising the 404 from inside the layout makes the browser render
// `../not-found.tsx` inside the layout instead.
const UnknownRoutePage = (): never => {
    notFound();
};

export default UnknownRoutePage;
