/** NTD frontend talks only to tri-clinician-portal-be (BFF). */
const trimSlash = (url) => String(url || "").replace(/\/+$/, "");

export const config = {
  apiURL: trimSlash(process.env.REACT_APP_API_URL || "http://localhost:3050"),
  /**
   * Local/dev only: facility host when the page is localhost
   * (localhost cannot map to a tenant in admin). Production uses
   * window.location.hostname — same as Apex → admin, like HMIS.
   */
  facilityUrl: String(process.env.REACT_APP_FACILITY_URL || "").trim(),
};

export const hasAuthConfigured = () => Boolean(config.apiURL);
