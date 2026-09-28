/** NTD frontend talks only to tri-clinician-portal-be (BFF). */
const trimSlash = (url) => String(url || "").replace(/\/+$/, "");

export const config = {
  apiURL: trimSlash(process.env.REACT_APP_API_URL || "http://localhost:3050"),
};

export const hasAuthConfigured = () => Boolean(config.apiURL);
