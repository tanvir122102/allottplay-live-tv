/** @type {import('next').NextConfig} */
const nextConfig = {
outputFileTracingRoot: __dirname,
experimental: {
serverActions: {
allowedOrigins: ['7kb896.bot-keep.xyz'],
},
},
};

module.exports = nextConfig;