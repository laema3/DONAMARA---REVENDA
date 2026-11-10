import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

async function buildServer() {
  try {
    await esbuild.build({
      entryPoints: ['server.ts'],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      packages: 'external',
      sourcemap: true,
      outfile: 'dist/server.cjs',
    });
    console.log('✅ Server built successfully to dist/server.cjs');

    const seedSrc = path.join(process.cwd(), 'src', 'data', 'seed');
    const seedDist = path.join(process.cwd(), 'dist', 'seed');
    if (fs.existsSync(seedSrc)) {
      fs.cpSync(seedSrc, seedDist, { recursive: true });
      console.log('✅ Seed catalog data copied to dist/seed');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildServer();

