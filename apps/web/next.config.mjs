/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Note: the build prints benign "Critical dependency" warnings from
  // stellar-sdk's optional native signing dep (sodium-native). The dashboard only
  // does read-only simulation (no signing), so it's unused at runtime. Aliasing it
  // out via webpack.resolve.alias breaks Next's internal resolution (/_document),
  // so we leave the warnings rather than risk the build.
};

export default nextConfig;
