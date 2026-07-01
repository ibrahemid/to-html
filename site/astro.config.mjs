import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://ibrahemid.github.io',
  base: process.env.SITE_BASE || '/to-html',
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    format: 'directory'
  }
});
