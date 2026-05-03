import { createRequire } from "module";
const require = createRequire(import.meta.url);
export class LocationDetector {
    async getLocation(config) {
        if (config.location) {
            return config.location;
        }
        try {
            const geoip = require("geoip-lite");
            // Use a public IP lookup to get coordinates, then resolve via geoip
            const response = await fetch("https://api.ipify.org?format=json");
            if (!response.ok)
                throw new Error("IP lookup failed");
            const { ip } = (await response.json());
            const geo = geoip.lookup(ip);
            if (geo?.city && geo?.country) {
                return `${geo.city}, ${geo.country}`;
            }
            if (geo?.country) {
                return geo.country;
            }
        }
        catch {
            // Ignore errors — fall back to default
        }
        return "The Cloud";
    }
}
//# sourceMappingURL=location.js.map