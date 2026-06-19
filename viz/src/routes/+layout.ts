// Static single-page app: all data is loaded client-side from Parquet files,
// so we render entirely on the client and serve a fallback page (200.html).
export const ssr = false;
export const prerender = false;
