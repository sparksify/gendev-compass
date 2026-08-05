/**
 * Illustrative ZIP-code reference data for local development and demos.
 * Coordinates are approximate city-level centroids (not survey-grade); the
 * app is designed to work with a real ZCTA dataset in production instead —
 * see docs/territory-advisor.md "Known limitations". Population/household/
 * income figures are round, plausible placeholders for demo purposes only —
 * never treat them as real Census data.
 */
import type { ZipCodeReferenceRecord } from "@/types/territory";

type SeedRow = Omit<ZipCodeReferenceRecord, "created_at" | "updated_at">;

const DFW: SeedRow[] = [
  { zip_code: "75201", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.7831, longitude: -96.8067, population: 4200, households: 2600, median_household_income: 78000, timezone: "America/Chicago" },
  { zip_code: "75204", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.8018, longitude: -96.8005, population: 18500, households: 11200, median_household_income: 86000, timezone: "America/Chicago" },
  { zip_code: "75206", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.8138, longitude: -96.7716, population: 33200, households: 17800, median_household_income: 91000, timezone: "America/Chicago" },
  { zip_code: "75209", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.8479, longitude: -96.8203, population: 24700, households: 10400, median_household_income: 121000, timezone: "America/Chicago" },
  { zip_code: "75214", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.8203, longitude: -96.7625, population: 29800, households: 12600, median_household_income: 108000, timezone: "America/Chicago" },
  { zip_code: "75225", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.8636, longitude: -96.7847, population: 22100, households: 8300, median_household_income: 175000, timezone: "America/Chicago" },
  { zip_code: "75230", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.8848, longitude: -96.79, population: 26400, households: 11800, median_household_income: 132000, timezone: "America/Chicago" },
  { zip_code: "75248", city: "Dallas", state_code: "TX", county_name: "Dallas", latitude: 32.9537, longitude: -96.8118, population: 31900, households: 14200, median_household_income: 98000, timezone: "America/Chicago" },
  { zip_code: "75024", city: "Plano", state_code: "TX", county_name: "Collin", latitude: 33.0587, longitude: -96.7996, population: 34600, households: 12900, median_household_income: 115000, timezone: "America/Chicago" },
  { zip_code: "75025", city: "Plano", state_code: "TX", county_name: "Collin", latitude: 33.0837, longitude: -96.7286, population: 40200, households: 14100, median_household_income: 122000, timezone: "America/Chicago" },
  { zip_code: "75074", city: "Plano", state_code: "TX", county_name: "Collin", latitude: 33.0198, longitude: -96.6689, population: 37800, households: 14700, median_household_income: 72000, timezone: "America/Chicago" },
  { zip_code: "75075", city: "Plano", state_code: "TX", county_name: "Collin", latitude: 33.0212, longitude: -96.7278, population: 41500, households: 17300, median_household_income: 79000, timezone: "America/Chicago" },
  { zip_code: "75093", city: "Plano", state_code: "TX", county_name: "Collin", latitude: 33.0512, longitude: -96.8118, population: 38900, households: 14800, median_household_income: 128000, timezone: "America/Chicago" },
  { zip_code: "75033", city: "Frisco", state_code: "TX", county_name: "Denton", latitude: 33.1465, longitude: -96.8747, population: 42300, households: 13600, median_household_income: 141000, timezone: "America/Chicago" },
  { zip_code: "75034", city: "Frisco", state_code: "TX", county_name: "Collin", latitude: 33.136, longitude: -96.83, population: 45700, households: 15100, median_household_income: 135000, timezone: "America/Chicago" },
  { zip_code: "75035", city: "Frisco", state_code: "TX", county_name: "Collin", latitude: 33.1633, longitude: -96.7716, population: 39400, households: 12700, median_household_income: 148000, timezone: "America/Chicago" },
  { zip_code: "75070", city: "McKinney", state_code: "TX", county_name: "Collin", latitude: 33.1836, longitude: -96.6683, population: 46200, households: 16300, median_household_income: 108000, timezone: "America/Chicago" },
  { zip_code: "75071", city: "McKinney", state_code: "TX", county_name: "Collin", latitude: 33.2334, longitude: -96.6072, population: 40800, households: 13900, median_household_income: 99000, timezone: "America/Chicago" },
  { zip_code: "75080", city: "Richardson", state_code: "TX", county_name: "Dallas", latitude: 32.9642, longitude: -96.7299, population: 35100, households: 14400, median_household_income: 87000, timezone: "America/Chicago" },
  { zip_code: "75081", city: "Richardson", state_code: "TX", county_name: "Dallas", latitude: 32.9445, longitude: -96.6989, population: 33700, households: 13500, median_household_income: 74000, timezone: "America/Chicago" },
  { zip_code: "75040", city: "Garland", state_code: "TX", county_name: "Dallas", latitude: 32.9126, longitude: -96.6389, population: 43200, households: 15600, median_household_income: 62000, timezone: "America/Chicago" },
  { zip_code: "75041", city: "Garland", state_code: "TX", county_name: "Dallas", latitude: 32.8807, longitude: -96.6389, population: 29500, households: 10800, median_household_income: 54000, timezone: "America/Chicago" },
  { zip_code: "76102", city: "Fort Worth", state_code: "TX", county_name: "Tarrant", latitude: 32.7554, longitude: -97.3308, population: 6800, households: 3900, median_household_income: 68000, timezone: "America/Chicago" },
  { zip_code: "76110", city: "Fort Worth", state_code: "TX", county_name: "Tarrant", latitude: 32.7096, longitude: -97.3428, population: 27400, households: 11200, median_household_income: 58000, timezone: "America/Chicago" },
  { zip_code: "76001", city: "Arlington", state_code: "TX", county_name: "Tarrant", latitude: 32.6763, longitude: -97.1517, population: 32100, households: 11700, median_household_income: 89000, timezone: "America/Chicago" },
  { zip_code: "76013", city: "Arlington", state_code: "TX", county_name: "Tarrant", latitude: 32.7288, longitude: -97.1206, population: 41300, households: 16400, median_household_income: 61000, timezone: "America/Chicago" },
  { zip_code: "75038", city: "Irving", state_code: "TX", county_name: "Dallas", latitude: 32.8626, longitude: -96.9589, population: 38900, households: 15800, median_household_income: 67000, timezone: "America/Chicago" },
  { zip_code: "75039", city: "Irving", state_code: "TX", county_name: "Dallas", latitude: 32.8807, longitude: -96.9589, population: 9200, households: 5100, median_household_income: 95000, timezone: "America/Chicago" },
];

const NASHVILLE: SeedRow[] = [
  { zip_code: "37201", city: "Nashville", state_code: "TN", county_name: "Davidson", latitude: 36.1667, longitude: -86.7784, population: 6100, households: 3900, median_household_income: 82000, timezone: "America/Chicago" },
  { zip_code: "37203", city: "Nashville", state_code: "TN", county_name: "Davidson", latitude: 36.15, longitude: -86.7975, population: 22400, households: 13100, median_household_income: 76000, timezone: "America/Chicago" },
  { zip_code: "37206", city: "Nashville", state_code: "TN", county_name: "Davidson", latitude: 36.1834, longitude: -86.7423, population: 28900, households: 13600, median_household_income: 71000, timezone: "America/Chicago" },
  { zip_code: "37209", city: "Nashville", state_code: "TN", county_name: "Davidson", latitude: 36.1489, longitude: -86.8611, population: 31200, households: 14300, median_household_income: 68000, timezone: "America/Chicago" },
  { zip_code: "37211", city: "Nashville", state_code: "TN", county_name: "Davidson", latitude: 36.0489, longitude: -86.7128, population: 47800, households: 19700, median_household_income: 55000, timezone: "America/Chicago" },
  { zip_code: "37215", city: "Nashville", state_code: "TN", county_name: "Davidson", latitude: 36.1034, longitude: -86.8161, population: 27600, households: 11900, median_household_income: 129000, timezone: "America/Chicago" },
  { zip_code: "37027", city: "Brentwood", state_code: "TN", county_name: "Williamson", latitude: 35.9834, longitude: -86.7828, population: 44100, households: 15900, median_household_income: 154000, timezone: "America/Chicago" },
  { zip_code: "37064", city: "Franklin", state_code: "TN", county_name: "Williamson", latitude: 35.9251, longitude: -86.9204, population: 40300, households: 15600, median_household_income: 112000, timezone: "America/Chicago" },
  { zip_code: "37067", city: "Franklin", state_code: "TN", county_name: "Williamson", latitude: 35.9309, longitude: -86.8014, population: 43800, households: 16700, median_household_income: 119000, timezone: "America/Chicago" },
  { zip_code: "37069", city: "Franklin", state_code: "TN", county_name: "Williamson", latitude: 35.8548, longitude: -86.9047, population: 24700, households: 8900, median_household_income: 168000, timezone: "America/Chicago" },
  { zip_code: "37128", city: "Murfreesboro", state_code: "TN", county_name: "Rutherford", latitude: 35.7862, longitude: -86.4372, population: 45200, households: 16800, median_household_income: 69000, timezone: "America/Chicago" },
  { zip_code: "37130", city: "Murfreesboro", state_code: "TN", county_name: "Rutherford", latitude: 35.8378, longitude: -86.3651, population: 38600, households: 14200, median_household_income: 61000, timezone: "America/Chicago" },
];

const OTHER: SeedRow[] = [
  { zip_code: "10001", city: "New York", state_code: "NY", county_name: "New York", latitude: 40.7506, longitude: -73.9972, population: 23000, households: 12900, median_household_income: 98000, timezone: "America/New_York" },
  { zip_code: "90001", city: "Los Angeles", state_code: "CA", county_name: "Los Angeles", latitude: 33.9731, longitude: -118.2479, population: 57100, households: 13200, median_household_income: 42000, timezone: "America/Los_Angeles" },
  { zip_code: "85001", city: "Phoenix", state_code: "AZ", county_name: "Maricopa", latitude: 33.4484, longitude: -112.074, population: 100, households: 60, median_household_income: 51000, timezone: "America/Phoenix" },
  { zip_code: "33101", city: "Miami", state_code: "FL", county_name: "Miami-Dade", latitude: 25.7743, longitude: -80.1937, population: 1000, households: 600, median_household_income: 47000, timezone: "America/New_York" },
  { zip_code: "60601", city: "Chicago", state_code: "IL", county_name: "Cook", latitude: 41.8858, longitude: -87.6229, population: 15900, households: 9800, median_household_income: 112000, timezone: "America/Chicago" },
];

export const SEED_ZIP_CODES: SeedRow[] = [...DFW, ...NASHVILLE, ...OTHER];
