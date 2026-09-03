import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function sitemap(): MetadataRoute.Sitemap { const base = getSiteUrl(); return ["", "/products", "/privacy"].map((path, index) => ({ url: `${base}${path}`, lastModified: new Date(), changeFrequency: index === 0 ? "weekly" : "monthly", priority: index === 0 ? 1 : .6 })); }
