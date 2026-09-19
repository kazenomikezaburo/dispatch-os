import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";

const localDevelopmentOrigins = [
  "127.0.0.1",
  "localhost",
  ...Object.values(networkInterfaces())
    .flatMap((interfaces) => interfaces ?? [])
    .filter(
      (networkInterface) =>
        networkInterface.family === "IPv4" && !networkInterface.internal,
    )
    .map((networkInterface) => networkInterface.address),
];

const nextConfig: NextConfig = {
  allowedDevOrigins: localDevelopmentOrigins,
};

export default nextConfig;
